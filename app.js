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
const { stringify } = require('querystring');
const { request } = require('http');
var requestIp = require('request-ip');
const { Pool } = require('pg');
const { getLeaderboardData, connectDB } = require('./db')

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



let pool

async function getDBcon() {
    pool = await connectDB()
}

getDBcon();

const testConnection = async () => {
    try {
        const result = await pool.query('SELECT * FROM leaderboard');
        console.log('Connection successful! Result:', result.rows);
        return result;
    } catch (e) {
        if (e.toString().indexOf('no pg_hba.conf entry for host') !== -1) {
            throw new Error(`Please use CUBEJS_DB_SSL=true to connect: ${e.toString()}`);
        }
        throw e;
    }
}

app.get('/leaderboard', async (req, res) => {
    try {
        // Fetch top 10 for the last 24 hours based on date_played
        const last24HoursEntries = await getLeaderboardData('last24Hours', 10, 'score');

        // Fetch top 25 all time based on score
        const allTimeEntries = await getLeaderboardData('allTime', 25, 'score');

        res.render('layouts/leaderboard.hbs', { last24HoursEntries, allTimeEntries });
    } catch (error) {
        console.error('Error fetching leaderboard data:', error);
        res.status(500).send('Internal Server Error');
    }
});


//Middleware for parsing URL-encoded data in the body of incoming requests
app.use(express.urlencoded({ extended: true }));
const maxChances = 3; // Set the maximum number of chances
let remainingChances = maxChances; // Initialize the remaining 
let targetNumber;
let bestScore = 0;



const fetchRealEstateData = async () => {
    const options = {
        method: 'GET',
        url: 'https://zillow-working-api.p.rapidapi.com/pro/byzpid',
        params: { zpid: '75670062' },
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


app.post('/check-guess', async (req, res) => {
    const userGuess = parseInt(req.body.userInput);
    const client = await pool.connect();
    testConnection();
    const { address, price, yearBuilt, photos } = global.addressDetails || {};

    try {
        const correctGuess = userGuess === price;
        targetNumber = price;

        let message = ''; // Initialize an empty message

        if (correctGuess) {
            const tries = (maxChances - remainingChances) + 1;

            bestScore = calculateScore(userGuess, price);

            message = `Congratulations! You guessed the correct price in ${tries} tries. You score is${bestScore}!`;

            return res.render('./layouts/play.hbs', {
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

            } else if (userGuess < targetNumber) {
                message = `Try a higher number. Chances remaining: ${remainingChances}`;
            } else {
                message = `Try a lower number. Chances remaining: ${remainingChances}`;
            }
        }
        res.redirect(`/play?message=${encodeURIComponent(message)}&user_input=${userGuess}`);

    } catch (error) {
        console.error('Error retrieving the target number from the database:', error);
        res.status(500).send('Internal Server Error');
    } finally {
        client.release();
    }
});

const port = process.env.port || 3000;
app.use(express.json())

//console.log(__dirname);
//const publicDirectory = path.join(__dirname, './public');


app.get('/', async (req, res) => {
    try {
        remainingChances = 3;
        targetNumber = undefined;

        // Fetch real estate data
        await fetchRealEstateData();

        res.render('./layouts/index.hbs', {
            address: global.addressDetails.address,
            price: global.addressDetails.price,
            yearBuilt: global.addressDetails.yearBuilt,
            photos: global.addressDetails.photos
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});
app.get('/leaderboard', async (req, res) => {
    res.render('./layouts/leaderboard.hbs', {
    });
})

app.get('/play', (request, response) => {
    //console.log('JSON.stringify(request.body)')
    //console.log(JSON.stringify(request.body))
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
