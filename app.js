const path = require('path');
const { json } = require('express');
const express = require('express');
const postgres = require('postgres');
const dotenv = require('dotenv');
//const Zillow = require('node-zillow');

dotenv.config()

const sql = postgres(`postgres://${process.env.RDS_DATABASE_User}:${process.env.RDS_DATABASE_Password}@${process.env.RDS_DATABASE_Host}:${process.env.RDS_DATABASE_Port}/${process.env.RDS_DATABASE}`, {
    password: process.env.RDS_DATABASE_Password,
    user: process.env.RDS_DATABASE_User,
    host: process.env.RDS_DATABASE_Host,
    port: process.env.RDS_DATABASE_Port
})

dotenv.config({ path: './.env' });

const app = express();
const port = process.env.port || 3000;
app.use(express.json())
//var zwsid = 'X1-ZWz1irozd8ydjf_5886x'
//var zillow = new Zillow(zwsid)

const publicDirectory = path.join(__dirname, './public');
app.use(express.static(publicDirectory));
app.set('View Engine', 'hbs');

app.get('/', (req, res) => {
    res.render("index.hbs")
})

app.get('/getdb', async (req, res) => {
    console.log(JSON.stringify(sql))
    try {
        console.log("shit fuck cock balls")
        const s = await sql`select 1`
        console.log(s)
        res.send(s)
    } catch (e) {
        console.log('error!!!', e)
    }
})

app.listen(port, () => {
    console.log("app listening on port 3000");
})


// AWS HOSTED APP
// http://node1-env.eba-3pukpgtq.us-east-1.elasticbeanstalk.com