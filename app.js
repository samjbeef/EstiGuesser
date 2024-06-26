const path = require('path');
require('dotenv').config({
    override: true,
    path: path.join(__dirname, '.env')
});
const { json } = require('express');
const express = require('express');
const postgres = require('postgres');
const exphbs = require('express-handlebars');
var handlebarssam = require('handlebars');
const app = express();
const bodyParser = require('body-parser');
const axios = require("axios");
const { stringify, escape } = require('querystring');
const { request } = require('http');
var requestIp = require('request-ip');
const { Pool } = require('pg');
const { startConnection } = require('./db')
const PostgresConnectionManager = require('./db2');
const { createSSHTunnel } = require('./sshTunnel');
const session = require('express-session');
const Filter = require('bad-words');
const filter = new Filter();
const throttledQueue = require('throttled-queue');
const throttle = throttledQueue(3, 1000);
const fs = require('fs');
const counterFilePath = path.join(__dirname, 'sessionCounter.txt');

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


let dbCon = new PostgresConnectionManager()
// let dbCon

// async function getDBcon() {
//     if (!dbCon) {
//         dbCon = await startConnection();
//     }
//     return dbCon;
// }
const incrementSessionCounter = () => {
    fs.readFile(counterFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading session counter file:', err);
            return;
        }
        let count = parseInt(data, 10);
        count += 1;
        fs.writeFile(counterFilePath, count.toString(), (err) => {
            if (err) {
                console.error('Error writing to session counter file:', err);
            }
        });
    });
};

app.use((req, res, next) => {
    if (!req.session.isInitialized) {
        incrementSessionCounter();
        req.session.isInitialized = true;
        fs.readFile(counterFilePath, 'utf8', (err, data) => {
            if (!err) {
                console.log(`New session created. Total sessions: ${data}`);
            }
        });
    }
    next();
});

async function getLeaderboardData(timeRange, limit, orderBy) {
    //const dbCon = await pool.connect();
    // const client = await getDBcon();
    try {
        let query;
        if (timeRange === 'last24Hours') {
            // Fetch top N entries for the last 24 hours based on date_played
            query = `SELECT name, score, timeplayed FROM leaderboard 
                     WHERE timeplayed >= NOW() - interval '24 hours' 
                     AND score IS NOT NULL AND score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                     ORDER BY ${orderBy} DESC 
                     LIMIT 10`;
        } else if (timeRange === 'allTime') {
            // Fetch top N entries all time based on your sorting logic
            query = `SELECT name, score, timeplayed FROM leaderboard 
                     WHERE score IS NOT NULL AND score::text ~ '^[0-9]+(\\.[0-9]+)?$'
                     ORDER BY ${orderBy} DESC 
                     LIMIT 25`;
        } else {
            throw new Error('Invalid time range specified');
        }
        const result = await dbCon.query(query);
        return result.rows;
    } finally {
        // client.end();
    }
}

app.get('/leaderboard', async (request, response) => {
    try {
        // Fetch top 10 for the last 24 hours based on date_played
        const last24HoursEntries = await getLeaderboardData('last24Hours', 10, 'score');
        // Fetch top 25 all time based on score
        const allTimeEntries = await getLeaderboardData('allTime', 25, 'score');
        handlebarssam.registerHelper("inc", function (value, options) {
            return parseInt(value) + 1;
        });
        response.render('layouts/leaderboard.hbs', { last24HoursEntries, allTimeEntries });
    } catch (error) {
        console.error('Error fetching leaderboard data:', error);
        response.status(500).send('Internal Server Error');
    }

});



//Middleware for parsing URL-encoded data in the body of incoming requests
app.use(express.urlencoded({ extended: true }));
const maxChances = 3; // Set the maximum number of chances
//let remainingChances = maxChances; // Initialize the remaining 
let targetNumber;
let bestScore = 0;


// Array of pre-defined zpid values
// const zpidArray = ['23636433','2064487303','53963326','114584079','2054523516','13538594','6705911','6775238','249837692','337786678','339771029','84239996','84279135','77418705',
// '77432107','75567140','75631637', '75649898', '339427424', '8486721', '338321306', '103845261','42465574', '12128418', '12130662', '37384226', '11520735', '9230261', '32208700', '57896646'];

// // Function to randomly choose a zpid from the array
// const getRandomZpid = () => {
//     const randomIndex = Math.floor(Math.random() * zpidArray.length);
//     return zpidArray[randomIndex];
// };
const fetchRandomAddress = async (request) => {
    try {
        console.log("fetchRandomAddr:  " + request.session.id);

        // Execute the SQL query to select a random address
        // const client = await getDBcon();
        const result = await dbCon.query('SELECT address FROM properties ORDER BY RANDOM() LIMIT 1;');
        // Extract the random address from the query result
        let randomAddress = result.rows[0].address;
        // Trim single quotes from the address string
        randomAddress = randomAddress.replace(/^'|'$/g, '');
        return randomAddress;
    } catch (error) {
        console.error('Error fetching random address:', error);
        throw error;
    }
};

async function moveToInactiveProperties(dbCon, propertyId) {
    try {
        await dbCon.query('BEGIN');

        await dbCon.query(`
        CREATE TABLE IF NOT EXISTS inactiveProperties (
            id SERIAL PRIMARY KEY,
            streetAddress TEXT,
            city TEXT,
            state TEXT,
            yearBuilt INT,
            otherColumns TEXT,
            CONSTRAINT unique_property UNIQUE (streetAddress, city, state)
        );
    `);
        // Move the property to inactiveProperties table
        const moveQuery = `
            INSERT INTO inactiveProperties (streetAddress, city, state, yearBuilt, otherColumns)
            SELECT streetAddress, city, state, yearBuilt, otherColumns
            FROM properties
            WHERE id = $1
            ON CONFLICT (streetAddress, city, state) DO NOTHING;
        `;
        await dbCon.query(moveQuery, [propertyId]);

        await dbCon.query('COMMIT');
    } catch (error) {
        await dbCon.query('ROLLBACK');
        throw error;
    }
}




const fetchRealEstateData = async (request, randomAddress) => {
    try {
        console.log("fetchREData:  " + request.session.id);

        await throttle(async () => {
            const options = {
                method: 'GET',
                url: 'https://zillow-working-api.p.rapidapi.com/pro/byaddress',
                params: { propertyaddress: randomAddress },
                headers: {
                    'X-RapidAPI-Key': process.env.API_KEY,
                    'X-RapidAPI-Host': 'zillow-working-api.p.rapidapi.com',
                },
            };

            const response = await axios.request(options);
            // console.log(response);
            const apiCallsRemaining = response.headers['x-ratelimit-requests-remaining'];

            // Check if remaining API calls are less than 100
            if (apiCallsRemaining < 100) {
                console.error('API calls remaining are less than 100. Stopping the application.');
                process.exit(1); // Exit the process with a non-zero exit code
            }

            const propertyDetails = response.data.propertyDetails;

            const homeType = propertyDetails.homeType;
            const address = propertyDetails.address;
            const price = propertyDetails.price;
            const yearBuilt = propertyDetails.yearBuilt;
            const photos = propertyDetails.originalPhotos || [];
            const beds = response.data.propertyDetails.bedrooms;
            const baths = response.data.propertyDetails.bathrooms;
            const sqft = response.data.propertyDetails.livingArea;
            console.log(baths, sqft, beds);

            request.session.addressDetails = { photos, address, price, yearBuilt, homeType, beds, baths, sqft };
            console.log(address);
            if (price > 0 || photos.length > 15 || homeType === 'SINGLE_FAMILY') {
                request.session.addressDetails = { photos, address, price, yearBuilt, beds, baths, sqft };
            } else {
                // const client = await getDBcon();
                try {
                    await moveToInactiveProperties(request.session.propertyId);
                    console.log(`Property with address '${randomAddress}' moved to inactiveProperties table.`);
                } catch (error) {
                    console.error('Error moving property to inactiveProperties table:', error);
                }
            }
        });
    } catch (error) {
        console.error(error);
        throw error;
    }
};

app.get('/session-count', (req, res) => {
    fs.readFile(counterFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading session counter file:', err);
            res.status(500).send('Error reading session counter');
            return;
        }
        res.send(`Total sessions: ${data}`);
    });
});


// 
app.post('/check-guess', async (request, response) => {
    const userid = request.session.id;
    const userGuess = parseInt(request.body.userInput);
    const { address, price, yearBuilt, photos, beds, baths, sqft } = request.session.addressDetails || {};
    console.log('in the post: ', request.session.addressDetails);

    try {
        const correctGuess = userGuess === price;
        targetNumber = price;

        let message = ''; // Initialize an empty message

        if (correctGuess) {
            const tries = (maxChances - request.session.remainingChances) + 1;
            bestScore = calculateScore(userGuess, price);
            message = `Congratulations! You guessed the correct price in ${tries} tries. Your score is ${bestScore}!`;

            const username = request.session.username;
            const currentTime = new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' });
            await dbCon.query(`
                INSERT INTO leaderboard (name, score, timeplayed)
                VALUES ($1, $2, $3)
            `, [username, bestScore, currentTime]);

            request.session.message = message;
            request.session.showPlayAgain = true;
            console.log("4correctGuess (going to /play) request.session.showPlayAgain=", request.session.showPlayAgain);

            request.session.correctGuess = true;
        } else {
            request.session.remainingChances--;
            request.session.correctGuess = false;

            if (request.session.remainingChances === 0) {
                // message = 'You are out of chances. Game over!';
                const username = request.session.username;
                bestScore = calculateScore(userGuess, price);
                const currentTime = new Date().toISOString();
                await dbCon.query(`
                    INSERT INTO leaderboard (name, score, timeplayed)
                    VALUES ($1, $2, $3)
                `, [username, bestScore, currentTime]);

                request.session.message = message;
                request.session.showPlayAgain = true;
            } else if (userGuess < targetNumber) {
                message = `Try a higher number. Chances remaining: ${request.session.remainingChances}`;
            } else {
                message = `Try a lower number. Chances remaining: ${request.session.remainingChances}`;
            }

            request.session.message = message;
            request.session.userGuess = userGuess;
        }

        response.redirect('/play');

    } catch (error) {
        console.error('Error retrieving the target number from the database:', error);
        response.status(500).send('Internal Server Error');
    }
});


const port = process.env.port || 3000;
app.use(express.json())

//console.log(__dirname);
//const publicDirectory = path.join(__dirname, './public');


app.get('/', async (request, response) => {
    try {
        response.render('./layouts/index.hbs');
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal Server Error');
    }
});
app.get('/leaderboard', async (request, response) => {
    response.render('./layouts/leaderboard.hbs', {
    });
})

app.get('/play-again', (request, response) => {
    request.session.showPlayAgain = false; // Reset showPlayAgain
    request.session.remainingChances = maxChances; // Reset remaining chances
    request.session.addressDetails = null; // Reset address details
    request.session.message = ''; // Clear any previous messages
    request.session.correctGuess = false; // Reset correctGuess
    response.redirect('/play'); // Redirect to /play to start a new game
});

app.get('/play', async (request, response) => {
    try {
        if (!request.session.username) {
            return response.redirect('/signin');
        }

        if (typeof request.session.addressDetails === 'undefined' || request.session.addressDetails === null) {
            const randomAddress = await fetchRandomAddress(request);
            await fetchRealEstateData(request, randomAddress);
            request.session.remainingChances = 3;
            targetNumber = undefined;
        }

        const { address, price, yearBuilt, photos, beds, baths, sqft } = request.session.addressDetails || {};
        const message = request.session.message || ''; // Retrieve the message from the session variable
        const user_input = request.session.userGuess;
        const remainingChancesEqualsZero = request.session.remainingChances === undefined || request.session.remainingChances === 0;
        const showPlayAgain = request.session.showPlayAgain || false;
        const correctGuess = user_input === price;

        if (remainingChancesEqualsZero && !correctGuess) {
            request.session.addressDetails = null;
            const correctGuess = targetNumber || 0;
            const formattedCorrectGuess = correctGuess.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
            });

            const score = calculateScore(user_input, correctGuess);
            if (score > bestScore) {
                bestScore = score;
            }
            request.session.showPlayAgain = true;
            return response.render('./layouts/play.hbs', {
                message: `The correct price was ${formattedCorrectGuess}. Your score is ${bestScore}.`,
                remainingChancesEqualsZero,
                showPlayAgain: true,
                bestScore,
                address,
                price,
                yearBuilt,
                photos,
                beds,
                baths,
                sqft
            });

        }
        else if (request.session.correctGuess) {
            // Here you need to reset the game play variables, and get a new address....then render /play.
            request.session.addressDetails = null;

            const randomAddress = await fetchRandomAddress(request);
            await fetchRealEstateData(request, randomAddress);
            request.session.remainingChances = 3;
            targetNumber = undefined;
            request.session.showPlayAgain = false;



            return response.render('./layouts/play.hbs', {
                message,
                correctGuess: true,
                showPlayAgain,
                address,
                price,
                yearBuilt,
                photos,
                beds,
                baths,
                sqft
            });
            request.session.showPlayAgain = false;
        }
        else {
            console.log("3BRENT request.session.showPlayAgain=", request.session.showPlayAgain);

            return response.render('./layouts/play.hbs', {
                message,
                remainingChancesEqualsZero,
                showPlayAgain,
                address,
                price,
                yearBuilt,
                photos,
                beds,
                baths,
                sqft
            });
        }
    } catch (error) {
        console.error(error);
        return response.status(500).send('Internal Server Error');
    }
});

//     if (!request.session.username) {
//         // console.log(session.addressDetails.address);
//         // Redirect user to the login page if not logged in
//         return response.redirect('/signin');
//     }
//     try {
//         console.log("root:  " + request.session.id);

//         request.session.remainingChances = 3;
//         targetNumber = undefined;

//         // Get a random zpid from the array
//         const randomAddress = await fetchRandomAddress(request);

//         // Fetch real estate data
//         await fetchRealEstateData(request, randomAddress);

//         response.render('./layouts/play.hbs', {
//             address: request.session.addressDetails.address,
//             price: request.session.addressDetails.price,
//             yearBuilt: request.session.addressDetails.yearBuilt,
//             photos: request.session.addressDetails.photos
//         });
//     } catch (error) {
//         console.error(error);
//         response.status(500).send('Internal Server Error');
//     }
//     // Render the game page
//     // response.render('./layouts/play.hbs', { username: request.session.username });
//     const { address, price, yearBuilt, photos } = request.session.addressDetails || {};
//     const message = request.query.message || ''; // Retrieve the message from the query parameter    
//     const user_input = request.query.user_input;
//     const remainingChancesEqualsZero = request.session.remainingChances === undefined || request.session.remainingChances === 0;
//     // Check if remaining chances are zero
//     if (remainingChancesEqualsZero) {
//         // Display the correct guess message here
//         const correctGuess = targetNumber || 0; // Get the correct guess from targetNumber
//         const formattedCorrectGuess = correctGuess.toLocaleString('en-US', {
//             style: 'currency',
//             currency: 'USD',
//         });

//         //Score logic
//         const score = calculateScore(user_input, correctGuess);

//         // Update the best score if the current score is higher
//         if (score > bestScore) {
//             bestScore = score;
//         }

//         response.render('./layouts/play.hbs', {
//             message: `The correct price was ${formattedCorrectGuess}. Your score is ${bestScore}.`,
//             remainingChancesEqualsZero,
//             showPlayAgain: true,
//             bestScore,
//             address,
//             price,
//             yearBuilt,
//             photos
//         });

//     } else {
//         // Display the regular game interface with the message
//         response.render('./layouts/play.hbs', {
//             message,
//             remainingChancesEqualsZero,
//             address,
//             price,
//             yearBuilt,
//             photos
//         });
//     }
// });

// function calculateScore(userGuess, actualPrice) {
//     const priceDifference = Math.abs(actualPrice - userGuess);
//     const score = Math.round(Math.max(0, 100 - (priceDifference / actualPrice) * 100));
//     return score;
// }
function calculateScore(userGuess, actualPrice) {
    const priceDifference = Math.abs(actualPrice - userGuess);
    const score = Math.round(Math.max(0, 1000 - (priceDifference / actualPrice) * 1000));
    return score;
}


app.listen(port, () => {
    console.log("app listening on port 3000");
})

//Username authentication below

// Route for the sign-in page
app.get('/signin', (request, response) => {

    request.session.showPlayAgain = false;

    response.render('./layouts/signin.hbs');
});


// app.post('/login', async (request, response) => {
//     const { username } = request.body;
//     // const client = await getDBcon();
//     console.log(username);


//     try {
//         // Check if the username already exists in the database
//         const { rows } = await dbCon.query('SELECT * FROM users WHERE username = $1', [username]);

//         if (rows.length > 0) {
//             return response.render('./layouts/signin.hbs', { errorMessage: 'Username is already taken. Please try again.' });
//         } else {
//             // Check if the username contains any bad words
//             if (filter.isProfane(username)) {
//                 return response.render('./layouts/signin.hbs', { errorMessage: 'Username contains inappropriate language. Please try again.' });
//             }

//             // If the username is unique and does not contain any bad words, store it in the database
//             await dbCon.query('INSERT INTO users (username) VALUES ($1)', [username]);
//             request.session.username = username; // Store the username in the session
//             response.redirect('/play'); // Redirect to the dashboard or any other page
//         }
//     } catch (error) {
//         console.error('Error during sign-in:', error);
//         response.status(500).send('Internal Server Error');
//     }
//     finally {
//         // client.end;
//     }
// });

app.post('/login', async (request, response) => {
    const { username } = request.body;

    try {
        // Check if the username contains any bad words
        if (filter.isProfane(username)) {
            return response.render('layouts/signin.hbs', { errorMessage: 'Username contains inappropriate language. Please try again.' });
        }

        // Check if the username already exists in the database
        const { rows } = await dbCon.query('SELECT * FROM users WHERE username = $1', [username]);

        if (rows.length > 0) {
            // User exists, log them in
            request.session.username = username; // Store the username in the session
            response.redirect('/play'); // Redirect to the play page
        } else {
            // User does not exist, create a new user
            await dbCon.query('INSERT INTO users (username) VALUES ($1)', [username]);
            request.session.username = username; // Store the username in the session
            response.redirect('/play'); // Redirect to the play page
        }
    } catch (error) {
        console.error('Error during sign-in:', error);
        response.status(500).send('Internal Server Error');
    }
});


