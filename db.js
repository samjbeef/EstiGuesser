

// const { Pool } = require('pg')
// const { Signer } = require("@aws-sdk/rds-signer");
// async function startConnection() {
//     const signerOptions = {
//         credentials: {
//             accessKeyId: process.env.AWS_ACCESS_KEY,
//             secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//         },
//         region: 'us-east-1',
//         hostname: process.env.RDS_DATABASE_Host,
//         port: 5432,
//         username: process.env.RDS_DATABASE_User,
//     }
//     const signer = new Signer(signerOptions)

//     const token = await signer.getAuthToken();
//     console.log(token);

//     const pool = new Pool({
//         host: signerOptions.hostname,
//         port: signerOptions.port,
//         user: signerOptions.username,
//         database: process.env.RDS_DATABASE,
//         password: token,
//         ssl: { rejectUnauthorized: false },
//     })
//     console.log("hello world")
//     await pool.connect();
//     console.log(pool);
//     return pool;
// }

// module.exports = { startConnection };

const { Client } = require('pg')
const { createSSHTunnel } = require('./sshTunnel.js');

async function startConnection() {
    const { srcAddr, srcPort } = await createSSHTunnel();
    console.log("herre");
    const client = new Client({
        user: process.env.RDS_DATABASE_User,
        host: srcAddr,
        database: process.env.RDS_DATABASE,
        password: process.env.RDS_DATABASE_Password,
        port: srcPort,
    })
    client.on('error', (err => {
        console.log(err);
    }))
    client.connect(function (err) {
        if (err)
            console.log(err);
        console.log("Connected!");
    });
    return client;
}
module.exports = { startConnection };

// var db = psql.createConnection({
//     host: srcAddr,
//     port: srcPort,
//     user: 'username',
//     password: '12345',
//     database: '12345'
// });












// const { createTunnel } = require('tunnel-ssh');
// const fs = require('fs');
// const path = require('path');
// require('dotenv').config({
//     override: true,
//     path: path.join(__dirname, '.env')
// });

// async function createSSHTunnel(srcAddr = process.env.EC2_SSH_HOST, srcPort = process.env.EC2_SSH_PORT) {
//     const tunnelOptions = {
//         autoClose: true,
//     };

//     const serverOptions = {
//         port: process.env.EC2_SSH_PORT,
//     };

//     const sshOptions = {
//         host: process.env.EC2_SSH_HOST,
//         port: parseInt(process.env.EC2_SSH_PORT),
//         username: process.env.EC2_SSH_USER,
//         privateKey: fs.readFileSync(path.join(__dirname, 'estiGuessrKey.pem')),
//     };

//     const forwardOptions = {
//         srcAddr: srcAddr,
//         srcPort: srcPort,
//         dstAddr: process.RDS_DATABASE_Host,
//         dstPort: parseInt(process.env.RDS_DATABASE_Port),
//     };

//     try {
//         await createTunnel(
//             tunnelOptions,
//             serverOptions,
//             sshOptions,
//             forwardOptions
//         );
//     } catch (error) {
//         if (error.code === "EADDRINUSE") {
//             // Assume port is uniquely used by SSH tunnel, so existing connection can be reused
//             console.log(`Returning existing SSH tunnel on ${srcAddr}:${srcPort}.`);
//             return { srcAddr, srcPort };
//         } else {
//             throw error;
//         }
//     }

//     console.log(`SSH tunnel successfully created on ${srcAddr}:${srcPort}.`);

//     return { srcAddr, srcPort };
// }

// module.exports = { createSSHTunnel };


















// const { time } = require('console');
// const { readFileSync } = require('fs');
// const { Pool, Client: pgClient } = require('pg');
// module.exports = {
//     getLeaderboardData,
//     makeTunnel2,
// };
// const tunnel = require('tunnel-ssh');
// const { Client } = require("ssh2");






// // var con;

// const dbCreds = {
//     user: process.env.RDS_DATABASE_User,
//     host: process.env.RDS_DATABASE_Host,
//     database: process.env.RDS_DATABASE,
//     password: process.env.RDS_DATABASE_Password,
//     port: process.env.RDS_DATABASE_Port,
// };

// module.exports.connectDB = async () => {
//     console.log("  -> connecting to mysql");

//     // if (global.isProd) {
//     console.log("   -> establishing production connection");
//     con = await createTunnel();
//     // } else {
//     // con = mysql.createConnection(dbCreds);
//     // console.log(dbCreds)
//     //     con.on("error", (err) => {
//     //         console.error("   -> DB connection error:", err);
//     //     });
//     //     con.on("connect", (c) => {
//     //         console.log("   -> Connected to DB successfully");
//     //     });
//     // }
//     return con;
// };

// const pemFile = readFileSync('/Users/samsliefert/Documents/Coding/EstiGuesser/estiGuessrKey.pem').toString();
// const sshConfig = {
//     host: process.env.EC2_SSH_HOST,
//     port: process.env.EC2_SSH_PORT,
//     username: process.env.EC2_SSH_USER,
//     privateKey: pemFile,
// };

// // SSH tunnel configuration
// const sshConfig2 = {
//     username: process.env.EC2_SSH_USER,
//     host: process.env.EC2_SSH_HOST,
//     // agent: process.env.SSH_AUTH_SOCK,
//     port: 22,
//     dstPort: 5432, // Remote PostgreSQL server port
//     localHost: '127.0.0.1',
//     localPort: 5433, // Local port for forwarding
// };

// // Set up the tunnel
// async function makeTunnel2() {
//     tunnel(sshConfig2, async (error, server) => {
//         if (error) {
//             console.log('SSH connection error: ', error);
//             return;
//         }

//         // PostgreSQL connection configuration
//         const pool = new Pool({
//             ...dbCreds,
//             host: 'localhost', // Connect through the local port you've forwarded
//             port: 5433, // This is the local port you've chosen for the SSH tunnel
//         });

//         try {
//             const res = await pool.query('SELECT NOW()');
//             console.log(res.rows);
//         } catch (err) {
//             console.error(err);
//         }
//     })
// };

// const createTunnel = () => {
//     return new Promise((resolve, reject) => {
//         console.log("Creating SSH Tunnel");
//         const sshClient = new Client();
//         sshClient.on("ready", () => {
//             console.log("SSH Connection successful. Attempting to connect to DB.");
//             sshClient.forwardOut(
//                 "localhost",
//                 dbCreds.port,
//                 dbCreds.host,
//                 dbCreds.port,
//                 async (err, stream) => {
//                     console.log("CREATED SSH DB CONNECTION");
//                     if (err) {
//                         console.log("err during db prod conn: ", err);
//                         reject(err);
//                     }
//                     //console.log("Stream object:", stream);
//                     const dbConnection = new Pool({
//                         // host: 'localhost',
//                         // port: stream.localPort,
//                         user: process.env.RDS_DATABASE_User,
//                         password: process.env.RDS_DATABASE_Password,
//                         database: process.env.RDS_DATABASE,
//                         stream: stream,
//                         port: dbCreds.port,
//                     });
//                     console.log(dbConnection.connect)
//                     const x = await dbConnection.connect()

//                     const results = await x.query('SELECT * FROM leaderboard LIMIT 25;')
//                     console.log(results)

//                     resolve(dbConnection);

//                     // console.log("BDS1");
//                     // dbConnection.connect();
//                     // const result = dbConnection.query('SELECT NOW()')
//                     // console.log(result)
//                     // console.log("BDS2");

//                 }
//             );
//         });
//         sshClient.on("error", (err) => {
//             console.log("There was an error while connecting through ssh: ", err);
//         });

//         const pemFile = readFileSync('/Users/samsliefert/Documents/Coding/EstiGuesser/estiGuessrKey.pem').toString();
//         console.log(process.env.EC2_SSH_HOST);
//         console.log(process.env.EC2_SSH_USER);
//         //console.log(pemFile);


//         const sshConfig = {
//             host: process.env.EC2_SSH_HOST,
//             port: process.env.EC2_SSH_PORT,
//             username: process.env.EC2_SSH_USER,
//             privateKey: pemFile,
//         };
//         console.log(
//             `Connecting to DB through SSH tunnel: ${process.env.EC2_SSH_HOST} and username: ${process.env.EC2_SSH_USER}`
//         );
//         sshClient.connect(sshConfig);
//     });
// };


// // export async function getLeaderboardData(client, timeRange, limit, orderBy) {

// async function getLeaderboardData(dbCon, timeRange, limit, orderBy) {
//     try {
//         // console.log(dbConnection);
//         let query;
//         dbCon.connect()
//         console.log(dbCon);
//         // console.log(dbCon)
//         if (timeRange === 'last24Hours') {
//             console.log(timeRange, "hello");
//             // Fetch top N entries for the last 24 hours based on date_played
//             query = `SELECT name, score, timeplayed FROM leaderboard WHERE timeplayed >= NOW() - interval '24 hours' ORDER BY ${orderBy} DESC LIMIT 10`;
//             //console.log(query);
//         } else if (timeRange === 'allTime') {
//             // Fetch top N entries all time based on your sorting logic
//             query = `SELECT name, score, timeplayed FROM leaderboard ORDER BY ${orderBy} DESC LIMIT 25`;
//             console.log(query);

//         } else {
//             throw new Error('Invalid time range specified');
//         }

//         const promResult = dbCon.query(query, [limit])
//         console.log(promResult);
//         return await promResult;
//         // console.log(result);
//     } finally {
//         console.log('does this happen');
//     }
// }

