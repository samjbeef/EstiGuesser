const fs = require('fs');
const { createTunnel } = require('tunnel-ssh');
const path = require('path');
require('dotenv').config({
    override: true,
    path: path.join(__dirname, '.env')
});


//export
async function createSSHTunnel(srcAddr = "localhost", srcPort = 22) {
    const tunnelOptions = {
        autoClose: true,
    };
    const serverOptions = {
        port: srcPort,
    };
    const sshOptions = {
        host: process.env.EC2_SSH_HOST,
        port: parseInt(process.env.EC2_SSH_PORT),
        username: process.env.EC2_SSH_USER,
        privateKey: fs.readFileSync(path.join(__dirname, 'estiGuessrKey.pem')).toString(),
        passphrase: process.env.AWS_PEMFILE_PASSPHRASE,
    };
    const forwardOptions = {
        srcAddr: srcAddr,
        srcPort: srcPort,
        dstAddr: process.env.RDS_DATABASE_Host,
        dstPort: parseInt(process.env.RDS_DATABASE_Port),
    };
    // console.log("hello", tunnelOptions);
    // console.log("hello", sshOptions);
    // console.log("hello", forwardOptions);


    try {
        await createTunnel(
            tunnelOptions,
            serverOptions,
            sshOptions,
            forwardOptions,
        );
    } catch (error) {
        if (error.code === "EADDRINUSE") {
            // Assume port is uniquely used by SSH tunnel, so existing connection can be reused
            console.log(`Returning existing SSH tunnel on ${srcAddr}:${srcPort}.`);
            return { srcAddr, srcPort };
        } else {
            throw error;
        }
    }
    console.log(`SSH tunnel successfully created on ${srcAddr}:${srcPort}.`);
    return { srcAddr, srcPort };
}
module.exports = { createSSHTunnel };