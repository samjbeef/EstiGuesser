const { Pool } = require('pg');

class PostgresConnectionManager {
    constructor() {
        let { srcAddr, srcPort } = {
            srcAddr: process.env.RDS_DATABASE_Host,
            srcPort: process.env.RDS_DATABASE_Port,
        }
        this.pool = new Pool({
            user: process.env.RDS_DATABASE_User,
            host: srcAddr,
            database: process.env.RDS_DATABASE,
            password: process.env.RDS_DATABASE_Password,
            port: srcPort,
        });
    }

    async getConnection() {
        try {
            const client = await this.pool.connect();
            return client;
        } catch (err) {
            console.error('Error acquiring client from pool', err);
            throw err;
        }
    }

    releaseConnection(client) {
        try {
            client.release();
        } catch (err) {
            console.error('Error releasing client back to pool', err);
        }
    }

    async query(text, params) {
        const client = await this.getConnection();
        try {
            const res = await client.query(text, params);
            return res;
        } finally {
            this.releaseConnection(client);
        }
    }

    async end() {
        await this.pool.end();
    }
}

module.exports = PostgresConnectionManager;
