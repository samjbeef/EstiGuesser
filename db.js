const { Pool } = require('pg')
const { createSSHTunnel } = require('./sshTunnel.js');


async function startConnection() {
    let { srcAddr, srcPort } = {
        srcAddr: process.env.RDS_DATABASE_Host,
        srcPort: process.env.RDS_DATABASE_Port,
    }
    if (process.env.NODE_ENV == 'LOCALPROD') {
        let response = await createSSHTunnel()
        srcAddr = response.srcAddr;
        srcPort = response.srcPort;
    }
    const client = new Pool({
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

