const { readFileSync } = require('fs');
const { Pool, Client: pgClient } = require('pg');


const { Client } = require("ssh2");

var con;

const dbCreds = {
    user: process.env.RDS_DATABASE_User,
    host: process.env.RDS_DATABASE_Host,
    database: process.env.RDS_DATABASE,
    password: process.env.RDS_DATABASE_Password,
    port: process.env.RDS_DATABASE_Port,
};

module.exports.connectDB = async () => {
    console.log("  -> connecting to mysql");

    // if (global.isProd) {
    console.log("   -> establishing production connection");
    con = await createTunnel();
    // } else {
    // con = mysql.createConnection(dbCreds);
    // console.log(dbCreds)
    //     con.on("error", (err) => {
    //         console.error("   -> DB connection error:", err);
    //     });
    //     con.on("connect", (c) => {
    //         console.log("   -> Connected to DB successfully");
    //     });
    // }
    return con;
};

const createTunnel = () => {
    return new Promise((resolve, reject) => {
        console.log("Creating SSH Tunnel");
        const sshClient = new Client();
        sshClient.on("ready", () => {
            console.log("SSH Connection successful. Attempting to connect to DB.");
            sshClient.forwardOut(
                "localhost",
                dbCreds.port,
                dbCreds.host,
                dbCreds.port,
                (err, stream) => {
                    console.log("CREATED SSH DB CONNECTION");
                    if (err) {
                        console.log("err during db prod conn: ", err);
                        reject(err);
                    }
                    const dbConnection = new pgClient({
                        // host: 'localhost',
                        // port: stream.localPort,
                        user: process.env.RDS_DATABASE_User,
                        password: process.env.RDS_DATABASE_Password,
                        database: process.env.RDS_DATABASE,
                        stream: stream,
                    });
                    resolve(dbConnection);
                }
            );
        });
        sshClient.on("error", (err) => {
            console.log("There was an error while connecting through ssh: ", err);
        });

        const pemFile = readFileSync('/Users/samsliefert/Documents/Coding/EstiGuesser/estiGuessrKey.pem').toString();
        console.log(process.env.EC2_SSH_HOST);
        console.log(process.env.EC2_SSH_USER);
        console.log(pemFile);


        const sshConfig = {
            host: process.env.EC2_SSH_HOST,
            port: process.env.EC2_SSH_PORT,
            username: process.env.EC2_SSH_USER,
            privateKey: pemFile,
        };
        console.log(
            `Connecting to DB through SSH tunnel: ${process.env.EC2_SSH_HOST} and username: ${process.env.EC2_SSH_USER}`
        );
        sshClient.connect(sshConfig);
    });
};



// export async function getLeaderboardData(timeRange, limit, orderBy) {
//     const client = await pool.connect();
//     try {
//         let query;
//         if (timeRange === 'last24Hours') {
//             // Fetch top N entries for the last 24 hours based on date_played
//             query = `SELECT name, score, timeplayed FROM leaderboard WHERE timeplayed >= NOW() - interval '24 hours' ORDER BY ${orderBy} DESC LIMIT $1`;
//         } else if (timeRange === 'allTime') {
//             // Fetch top N entries all time based on your sorting logic
//             query = `SELECT name, score, timeplayed FROM leaderboard ORDER BY ${orderBy} DESC LIMIT $1`;
//         } else {
//             throw new Error('Invalid time range specified');
//         }

//         const result = await client.query(query, [limit]);
//         return result.rows;
//     } finally {
//         client.release();
//     }
// }

