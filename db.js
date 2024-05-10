const { Pool } = require('pg');
const { createSSHTunnel } = require('./sshTunnel.js');

// Create a single Pool instance
const pool = new Pool({
    user: process.env.RDS_DATABASE_User,
    host: process.env.RDS_DATABASE_Host,
    database: process.env.RDS_DATABASE,
    password: process.env.RDS_DATABASE_Password,
    port: process.env.RDS_DATABASE_Port,
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

async function startConnection() {
    if (process.env.NODE_ENV === 'LOCALPROD') {
        let { srcAddr, srcPort } = await createSSHTunnel();
        // Override host and port if using SSH tunnel
        pool.options.host = srcAddr;
        pool.options.port = srcPort;
    }
    try {
        const client = await pool.connect();
        console.log('Connected to database!');
        return client;
    } catch (err) {
        console.error('Error connecting to database:', err);
        throw err;
    }
    async function closeConnection(client) {
        try {
            await client.release();
            console.log('Database client released back to pool');
        } catch (err) {
            console.error('Error releasing database client:', err);
            throw err;
        }
    }
    async function closeConnection(client) {
        try {
            await client.release();
            console.log('Database client released back to pool');
        } catch (err) {
            console.error('Error releasing database client:', err);
            throw err;
        }
    }
}
async function closeConnection(client) {
    try {
        await client.release();
        console.log('Database client released back to pool');
    } catch (err) {
        console.error('Error releasing database client:', err);
        throw err;
    }
}

module.exports = { startConnection, closeConnection };
