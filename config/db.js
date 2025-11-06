import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0
});

// Handle pool errors
pool.on('error', (err) => {
    console.error('❌ Pool error:', err.message);
});

// Test connection on startup
pool.getConnection()
    .then((connection) => {
        console.log('✅ Database pool initialized successfully');
        connection.release();
    })
    .catch((err) => {
        console.error('❌ Failed to initialize pool:', err.message);
    });

export default pool;
