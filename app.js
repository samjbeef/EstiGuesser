const path = require('path');
require('dotenv').config({
    override: true,
    path: path.join(__dirname, '.env')
});
const { json } = require('express');
const express = require('express');
const postgres = require('postgres');
const exphbs = require('express-handlebars');
const app = express();
const bodyParser = require('body-parser');
const axios = require("axios");
const { stringify, escape } = require('querystring');
const { request } = require('http');
var requestIp = require('request-ip');
const { Pool } = require('pg');
const { startConnection } = require('./db')
const { createSSHTunnel } = require('./sshTunnel');
const session = require('express-session');

app.use(session({
    secret: 'samkey', // Change this to a random string
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 1 day in milliseconds
    }
}));


let options = {
    dotfiles: "ignore", //allow, deny, ignore
    etag: true,
    extensions: ["htm", "html"],
    index: false, //to disable directory indexing
    // maxAge: "7d",
    redirect: false,
};
app.use(express.static("./views/images", options));
app.use(express.static('public'))

app.engine(
    "hbs",
    exphbs.engine({
        extname: "hbs",
        defaultLayout: false,
    })
);

//providing path for images 
// app.use(express.static("images"));
//Setting view engine 
app.set('view engine', 'hbs');


//getting input from user
app.use(bodyParser.urlencoded({ extended: true }));



let dbCon

async function getDBcon() {
    dbCon = await startConnection();
    return dbCon;
}

async function getLeaderboardData(timeRange, limit, orderBy) {
    //const dbCon = await pool.connect();
    const client = await getDBcon();
    try {
        let query;
        if (timeRange === 'last24Hours') {
            // Fetch top N entries for the last 24 hours based on date_played
            query = `SELECT name, score, timeplayed FROM leaderboard WHERE timeplayed >= NOW() - interval '24 hours' ORDER BY ${orderBy} DESC LIMIT 10`;
        } else if (timeRange === 'allTime') {
            // Fetch top N entries all time based on your sorting logic
            query = `SELECT name, score, timeplayed FROM leaderboard ORDER BY ${orderBy} DESC LIMIT 25`;
        } else {
            throw new Error('Invalid time range specified');
        }
        const result = await client.query(query);
        return result.rows;
    } finally {
        client.end();
    }
}

app.get('/leaderboard', async (request, response) => {
    try {
        // Fetch top 10 for the last 24 hours based on date_played
        const last24HoursEntries = await getLeaderboardData('last24Hours', 10, 'score');
        // Fetch top 25 all time based on score
        const allTimeEntries = await getLeaderboardData('allTime', 25, 'score');

        response.render('layouts/leaderboard.hbs', { last24HoursEntries, allTimeEntries });
    } catch (error) {
        console.error('Error fetching leaderboard data:', error);
        response.status(500).send('Internal Server Error');
    }

});



//Middleware for parsing URL-encoded data in the body of incoming requests
app.use(express.urlencoded({ extended: true }));
const maxChances = 3; // Set the maximum number of chances
let remainingChances = maxChances; // Initialize the remaining 
let targetNumber;
let bestScore = 0;


// Array of pre-defined zpid values
const zpidArray = ['75631637', '75630783', '75649898', '339427424'/* add more zpid values */];

// Function to randomly choose a zpid from the array
const getRandomZpid = () => {
    const randomIndex = Math.floor(Math.random() * zpidArray.length);
    return zpidArray[randomIndex];
};

const fetchRealEstateData = async (zpid) => {
    const options = {
        method: 'GET',
        url: 'https://zillow-working-api.p.rapidapi.com/pro/byzpid',
        params: { zpid },
        headers: {
            'X-RapidAPI-Key': process.env.API_KEY,
            'X-RapidAPI-Host': 'zillow-working-api.p.rapidapi.com',
        },
    };

    try {
        const response = await axios.request(options);

        // Extract necessary data for rendering
        const propertyDetails = response.data.propertyDetails;
        const address = propertyDetails.address;
        const price = propertyDetails.price;
        const yearBuilt = propertyDetails.yearBuilt;
        const photos = propertyDetails.originalPhotos || [];

        // Store the address and price in a global variable for later use
        global.addressDetails = { photos, address, price, yearBuilt };
    } catch (error) {
        console.error(error);
        throw error;
    }
};


app.post('/check-guess', async (request, response) => {
    const userGuess = parseInt(request.body.userInput);
    const client = await getDBcon();
    const { address, price, yearBuilt, photos } = global.addressDetails || {};

    try {
        const correctGuess = userGuess === price;
        targetNumber = price;

        let message = ''; // Initialize an empty message

        if (correctGuess) {
            const tries = (maxChances - remainingChances) + 1;

            bestScore = calculateScore(userGuess, price);

            message = `Congratulations! You guessed the correct price in ${tries} tries. You score is${bestScore}!`;

            const username = request.session.username;
            bestScore = calculateScore(userGuess, price);
            // const currentTime = new Date().toISOString();
            const currentTime = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
            await client.query(`
                INSERT INTO leaderboard (name, score, timeplayed)
                VALUES ($1, $2, $3)
                DO UPDATE SET score = GREATEST(leaderboard.score, EXCLUDED.score)
            `, [username, bestScore, currentTime]);


            return response.render('./layouts/play.hbs', {
                message,
                userGuess: userGuess,
                showPlayAgain: true,
                bestScore,
                price,
                address,
                yearBuilt,
                photos
            });

        } else {
            remainingChances--;

            if (remainingChances === 0) {
                message = 'You are out of chances. Game over!';

                const username = request.session.username;
                bestScore = calculateScore(userGuess, price);
                const currentTime = new Date().toISOString();
                await client.query(`
                    INSERT INTO leaderboard (name, score, timeplayed)
                    VALUES ($1, $2, $3)
                    DO UPDATE SET score = GREATEST(leaderboard.score, EXCLUDED.score)
                `, [username, bestScore, currentTime]);


            } else if (userGuess < targetNumber) {
                message = `Try a higher number. Chances remaining: ${remainingChances}`;
            } else {
                message = `Try a lower number. Chances remaining: ${remainingChances}`;
            }
        }
        response.redirect(`/play?message=${encodeURIComponent(message)}&user_input=${userGuess}`);

    } catch (error) {
        console.error('Error retrieving the target number from the database:', error);
        response.status(500).send('Internal Server Error');
    } finally {
        await client.end();
    }
});

const port = process.env.port || 3000;
app.use(express.json())

//console.log(__dirname);
//const publicDirectory = path.join(__dirname, './public');


app.get('/', async (request, response) => {
    try {
        remainingChances = 3;
        targetNumber = undefined;

        // Get a random zpid from the array
        const randomZpid = getRandomZpid();

        // Fetch real estate data
        await fetchRealEstateData(randomZpid);

        response.render('./layouts/index.hbs', {
            address: global.addressDetails.address,
            price: global.addressDetails.price,
            yearBuilt: global.addressDetails.yearBuilt,
            photos: global.addressDetails.photos
        });
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal Server Error');
    }
});
app.get('/leaderboard', async (request, response) => {
    response.render('./layouts/leaderboard.hbs', {
    });
})

app.get('/play', (request, response) => {
    if (!request.session.username) {
        // Redirect user to the login page if not logged in
        return response.redirect('/signin');
    }
    // Render the game page
    // response.render('./layouts/play.hbs', { username: request.session.username });

    const { address, price, yearBuilt, photos } = global.addressDetails || {};
    const message = request.query.message || ''; // Retrieve the message from the query parameter    
    const user_input = request.query.user_input;
    const remainingChancesEqualsZero = remainingChances === undefined || remainingChances === 0;
    // Check if remaining chances are zero
    if (remainingChancesEqualsZero) {
        // Display the correct guess message here
        const correctGuess = targetNumber || 0; // Get the correct guess from targetNumber
        const formattedCorrectGuess = correctGuess.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
        });

        //Score logic
        const score = calculateScore(user_input, correctGuess);

        // Update the best score if the current score is higher
        if (score > bestScore) {
            bestScore = score;
        }

        response.render('./layouts/play.hbs', {
            message: `The correct price was ${formattedCorrectGuess}. Your score is ${bestScore}.`,
            remainingChancesEqualsZero,
            showPlayAgain: true,
            bestScore,
            address,
            price,
            yearBuilt,
            photos
        });

    } else {
        // Display the regular game interface with the message
        response.render('./layouts/play.hbs', {
            message,
            remainingChancesEqualsZero,
            address,
            price,
            yearBuilt,
            photos
        });
    }
});

function calculateScore(userGuess, actualPrice) {
    const priceDifference = Math.abs(actualPrice - userGuess);
    const score = Math.round(Math.max(0, 100 - (priceDifference / actualPrice) * 100));
    return score;
}

app.listen(port, () => {
    console.log("app listening on port 3000");
})

//Username authentication below

// Route for the sign-in page
app.get('/signin', (request, response) => {
    response.render('./layouts/signin.hbs');
});


app.post('/login', async (request, response) => {
    const { username } = request.body;
    const client = await getDBcon();
    console.log(username);
    try {
        // Check if the username already exists in the database
        const { rows } = await client.query('SELECT * FROM users WHERE username = $1', [username]);
        // const existingUser = await client.query('SELECT * FROM users');
        if (rows.length > 0) {
            return response.render('./layouts/signin.hbs', { errorMessage: 'Username is already taken. Please try again.' });
            response.redirect('/signin'); // Redirect back to the sign-in page
        } else {
            // If the username is unique, store it in the database
            await client.query('INSERT INTO users (username) VALUES ($1)', [username]);
            request.session.username = username; // Store the username in the session
            response.redirect('/play'); // Redirect to the dashboard or any other page
        }
    } catch (error) {
        console.error('Error during sign-in:', error);
        response.status(500).send('Internal Server Error');
    }
});

