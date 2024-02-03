const path = require('path');
const { json } = require('express');
const express = require('express');
const postgres = require('postgres');
const dotenv = require('dotenv');
const exphbs = require('express-handlebars');
const app = express();
const bodyParser = require('body-parser');
const axios = require("axios");
const { stringify } = require('querystring');
const { request } = require('http');
var requestIp = require('request-ip');
const { Pool } = require('pg');
dotenv.config()


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

require('dotenv').config({
    override: true,
    path: path.join(__dirname, '.env')
});

const pool = new Pool({
    user: process.env.RDS_DATABASE_User,
    host: process.env.RDS_DATABASE_Host,
    database: process.env.RDS_DATABASE,
    password: process.env.RDS_DATABASE_Password,
    port: process.env.RDS_DATABASE_Port
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
            'X-RapidAPI-Key': '63f40f9d1emsh674f475b71f0f17p174a6fjsn88f33fbb2dfd',
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
    const { address, price, yearBuilt, photos } = global.addressDetails || {};

    try {
        const correctGuess = userGuess === price;
        targetNumber = price;

        let message = ''; // Initialize an empty message

        if (correctGuess) {
            const tries = (maxChances - remainingChances) + 1;

            //TODO: Add scoring algorithm
            /*const priceDifference = Math.abs(price - userGuess);
            const points = Math.round(Math.max(0, 100 - (priceDifference / price) * 100));

            if (points > bestScore) {
                bestScore = points; // Update the best score if the current score is higher
            }

            You score is${points}!
            */

            message = `Congratulations! You guessed the correct price in ${tries} tries.`;

            return res.render('./layouts/play.hbs', {
                message,
                userGuess: userGuess,
                showPlayAgain: true,
                //bestScore,
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

console.log(__dirname);
const publicDirectory = path.join(__dirname, './public');

/*app.get('/', (req, res) => {
    remainingChances = 3;
    targetNumber = undefined;
    res.render("./layouts/index.hbs")
})
*/

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

app.get('/play', (request, response) => {
    console.log('JSON.stringify(request.body)')
    console.log(JSON.stringify(request.body))
    const { address, price, yearBuilt, photos } = global.addressDetails || {};
    const message = request.query.message || ''; // Retrieve the message from the query parameter
    const user_input = request.body.user_input || request.params.user_input
    const remainingChancesEqualsZero = remainingChances === undefined || remainingChances === 0;
    // Check if remaining chances are zero
    if (remainingChancesEqualsZero) {
        // Display the correct guess message here
        const correctGuess = targetNumber || 0; // Get the correct guess from targetNumber
        const formattedCorrectGuess = correctGuess.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
        });

        //TODO: Add score logic
        // Calculate the score
        /*const priceDifference = Math.abs(price - correctGuess);
        const score = Math.round(Math.max(0, 100 - (priceDifference / price) * 100));

        // Update the best score if the current score is higher
        if (score > bestScore) {
            bestScore = score;
        }
        Your score is ${score}.

        */
        response.render('./layouts/play.hbs', {
            message: `The correct price was ${formattedCorrectGuess}.`,
            user_input,
            remainingChancesEqualsZero,
            showPlayAgain: true,
            address,
            price,
            yearBuilt,
            photos
        });

    } else {
        // Display the regular game interface with the message
        response.render('./layouts/play.hbs', {
            message,
            stuff: JSON.stringify(user_input),
            remainingChancesEqualsZero,
            address,
            price,
            yearBuilt,
            photos
        });
    }
});

app.listen(port, () => {
    console.log("app listening on port 3000");
})
