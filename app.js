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

app.post('/guess', async (req, res) => {
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

dotenv.config()

const connString = `postgres://${process.env.RDS_DATABASE_User}:${process.env.RDS_DATABASE_Password}@${process.env.RDS_DATABASE_Host}:${process.env.RDS_DATABASE_Port}/${process.env.RDS_DATABASE}`
const sql = postgres(connString, {
    password: process.env.RDS_DATABASE_Password,
    user: process.env.RDS_DATABASE_User,
    host: process.env.RDS_DATABASE_Host,
    port: process.env.RDS_DATABASE_Port
})



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

dotenv.config({ path: './.env' });

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
    const user_input = request.body.user_input || request.params.user_input
    response.render('./layouts/play.hbs', {
        stuff: JSON.stringify(user_input)
    });

});

app.listen(port, () => {
    console.log("app listening on port 3000");
})


// AWS HOSTED APP
// http://node1-env.eba-3pukpgtq.us-east-1.elasticbeanstalk.com