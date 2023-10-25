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

//const { TwitterApi } = require('twitter-api-v2');
//const Zillow = require('node-zillow');

//Setting default layout and extension name
// app.engine('hbs', exphbs.engine({
//     defaultLayout: 'index',
//     extname: '.hbs'
// }));
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

// app.get('/', function (request, response) {

//     var clientIp = requestIp.getClientIp(request);
//     console.log(clientIp);

// });

/*dotenv.config()

const connString = `postgres://${process.env.RDS_DATABASE_User}:${process.env.RDS_DATABASE_Password}@${process.env.RDS_DATABASE_Host}:${process.env.RDS_DATABASE_Port}/${process.env.RDS_DATABASE}`
const sql = postgres(connString, {
    password: process.env.RDS_DATABASE_Password,
    user: process.env.RDS_DATABASE_User,
    host: process.env.RDS_DATABASE_Host,
    port: process.env.RDS_DATABASE_Port
})
*/
//REPLACED WITH CONNECTION POOLING BELOW
//dotenv.config({ path: './.env' });

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


//Tweaked the guess handler to include the guessing game logic

/*app.post('/guess', async (req, res) => {
    console.log(JSON.stringify(req.body.testfield));
    var user_input = JSON.stringify(req.body.testfield);
    console.log(user_input);
    var user_input = user_input.replaceAll('"', '');
    console.log(user_input);
    // res.render("./layouts/play.hbs", { name: "testfield" });
    console.log(JSON.stringify(sql));
    console.log(connString);
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/307
    res.redirect(303, `/play?user_input=${user_input}`) // https://stackoverflow.com/questions/38810114/node-js-with-express-how-to-redirect-a-post-request
    // console.log(JSON.stringify(req.body.testfield));
    try {
        console.log("shit fuck cock balls")
        const s = await sql`INSERT INTO test_1 (column1,column2,column3) VALUES ('hello', 'twins', ${user_input})`
        console.log(s)
        // res.send(s)
    } catch (e) {
        console.log('error!!!', e)
    }
    // app.get('/play', (req, res) => {
    //     res.render('play', {
    //         stuff: "Fucking hell"
    //     })
    // });
});
*/

app.post('/check-guess', async (req, res) => {
  const userGuess = parseInt(req.body.userInput);
  const client = await pool.connect();

  try {
      const { rows } = await client.query('SELECT price FROM test_1');
      if (rows.length > 0) {
          const result = rows[0];
          targetNumber = result.price;

          let message = ''; // Initialize an empty message

          if (userGuess === targetNumber) {
                const points = (maxChances - remainingChances) + 1;
                message = `Congratulations! You guessed the correct price in ${points} tries.`;                
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
        
      } else {
          console.error('No data found in the result set.');
          res.status(500).send('Internal Server Error');
      }
  } catch (error) {
      console.error('Error retrieving the target number from the database:', error);
      res.status(500).send('Internal Server Error');
  } finally {
      client.release();
  }
});



// const client = new TwitterApi({
//     appKey: 'Twitter_API_Key',
//     appSecret: 'Twitter_API_Key_Secret',
//     accessToken: 'Twitter_Bearer_Token',
// });

// client.v2.singleTweet('1455477974489251841', {
//     'tweet.fields': [
//         'organic_metrics',
//     ],
// }).then((val) => {
//     console.log(val)
// }).catch((err) => {
//     console.log(err)
// })


//const app = express();
const port = process.env.port || 3000;
app.use(express.json())
// app.set("view options", { layout: '.' })


// var zwsid = Zillow_API_Key
// var zillow = new Zillow(zwsid)
console.log(__dirname);
const publicDirectory = path.join(__dirname, './public');

app.get('/', (req, res) => {
    res.render("./layouts/index.hbs")
})

// app.get('/getdb', async (req, res) => {
//     console.log(JSON.stringify(sql))
//     console.log(connString)
//     // console.log(JSON.stringify(req.body.testfield));
//     try {
//         console.log("shit fuck cock balls")
//         const s = await sql`INSERT INTO test_1 (column1,column2,column3) VALUES ('hello', 'twins', '1234534')`
//         console.log(s)
//         res.send(s)
//     } catch (e) {
//         console.log('error!!!', e)
//     }
// })

app.get('/play', (request, response) => {
    console.log('JSON.stringify(request.body)')
    console.log(JSON.stringify(request.body))
    const message = request.query.message || ''; // Retrieve the message from the query parameter
    const user_input = request.body.user_input || request.params.user_input

    // Check if remaining chances are zero
    if (remainingChances === 0) {
      // Display the correct guess message here
      const correctGuess = targetNumber; // Get the correct guess from targetNumber
      const formattedCorrectGuess = correctGuess.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
    });
    response.render('./layouts/play.hbs', {
      message: `The correct price was ${formattedCorrectGuess}.`, // Append the correct guess to the existing message
      user_input
    });
    

  } else {
    // Display the regular game interface with the message
    response.render('./layouts/play.hbs', {
        message,
        stuff: JSON.stringify(user_input)
    });
  }
});

app.listen(port, () => {
    console.log("app listening on port 3000");
})


// AWS HOSTED APP
// http://node1-env.eba-3pukpgtq.us-east-1.elasticbeanstalk.com