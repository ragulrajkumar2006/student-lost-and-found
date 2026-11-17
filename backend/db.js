const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Return DATE columns as 'YYYY-MM-DD' strings instead of JS Date objects
    // (avoids timezone shifts when the date is sent to the frontend)
    dateStrings: true
});

module.exports = pool;