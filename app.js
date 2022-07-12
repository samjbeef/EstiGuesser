const { json } = require('express');
const express = require('express');
const mariadb = require('mariadb');
const Zillow = require('node-zillow')

const app = express();
const port = process.env.port || 3000;
app.use(express.json())
var pool =
    mariadb.createPool({
        host: '127.0.0.1',
        port: 3306,
        user: 'root',
        password: '1818',
        database: 'js-Estiguessr'
    });

var zwsid = 'X1-ZWz1irozd8ydjf_5886x'
var zillow = new Zillow(zwsid)

var parameters = {
    zpid: 1111111
};

// // http://node1-env.eba-3pukpgtq.us-east-1.elasticbeanstalk.com
// // To start from terminal: node app.js

app.get('/', (req, res) => {
    console.log("/");
    res.send("happy fathers day daddddddd eooohoooo");
})


app.get('/test', (req, res) => {
    console.log("/test");
    path = require('path');
    var x = path.join(__dirname, 'web.html');

    res.sendFile(x);
    // res.sendFile('/Users/samsliefert/Documents/Coding/Starter/web.html');
})

app.get('/main', (req, res) => {
    console.log("/main");
    path = require('path');
    var x = path.join(__dirname, 'main.html');

    res.sendFile(x);
    // res.sendFile('/Users/samsliefert/Documents/Coding/Starter/web.html');
})
app.get('/signIn', (req, res) => {
    console.log("/signIn");
    path = require('path');
    var x = path.join(__dirname, 'signIn.html');

    res.sendFile(x);
    // res.sendFile('/Users/samsliefert/Documents/Coding/Starter/web.html');
})
app.get('/sam', (req, res) => {
    console.log("/sam");
    res.json({ Hello: "world", myNumber: 4 });
})

function revealMessage() {
    document.getElementById("hiddenMessage").style.display = 'block';
}

app.listen(port, () => {
    console.log("WHATSUPPPPP");
});

app.post('/dbwrite', async (req, res) => {

    let conn;
    try {

        conn = await pool.getConnection();
        const rows = await conn.query("SELECT 1 as val");
        console.log(JSON.stringify(rows));
        // rows: [ {val: 1}, meta: ... ]

        const res = await conn.query("INSERT INTO first_table value (?, ?, ?)", [1, "mariadb", 5]);
        // res: { affectedRows: 1, insertId: 1, warningStatus: 0 }

    } catch (e) {
        console.log(e);
    }

    finally {
        if (conn) conn.release(); //release to pool
    }
})
