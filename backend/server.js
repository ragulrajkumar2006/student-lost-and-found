require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");
const axios = require("axios");
const embedding = require("./services/embedding");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const REQUIRED_ENV = ["DB_HOST", "DB_USER", "DB_NAME", "QDRANT_URL", "QDRANT_COLLECTION", "JWT_SECRET"];
const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missing.length > 0) {
    console.error(`Missing environment variables in .env: ${missing.join(", ")}`);
    process.exit(1);
}

const app = express();

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000" }));
app.use(express.json({ limit: "100kb" }));

// Home API
app.get("/", (req, res) => {
    res.json({
        message: "Lost and Found API is running"
    });
});

// Test MySQL connection
app.get("/api/test-db", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT DATABASE() AS database_name"
        );

        res.json({
            success: true,
            message: "MySQL connected successfully",
            database: rows[0].database_name
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Test Qdrant connection
app.get("/api/test-qdrant", async (req, res) => {
    try {
        const response = await axios.get(
            `${process.env.QDRANT_URL}/collections`
        );

        res.json({
            success: true,
            message: "Qdrant connected successfully",
            collections: response.data.result.collections
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Combined health check for all three dependencies
app.get("/api/health", async (req, res) => {
    const check = async (fn) => {
        try {
            await fn();
            return "up";
        } catch {
            return "down";
        }
    };

    const services = {
        mysql: await check(() => pool.query("SELECT 1")),
        qdrant: await check(() => axios.get(`${process.env.QDRANT_URL}/collections`, { timeout: 3000 })),
        embedding: await check(() => embedding.checkHealth())
    };
    const healthy = Object.values(services).every((status) => status === "up");

    res.status(healthy ? 200 : 503).json({ success: healthy, services });
});

// Public numbers for the landing page (no login needed)
app.get("/api/stats/public", async (req, res) => {
    const [[stats]] = await pool.query(
        `SELECT SUM(Report_Type = 'LOST')  AS Lost,
                SUM(Report_Type = 'FOUND') AS Found,
                (SELECT COUNT(*) FROM ITEM_RETURN) AS Returned
         FROM ITEM_REPORT`
    );
    res.json({
        success: true,
        lost: Number(stats.Lost) || 0,
        found: Number(stats.Found) || 0,
        returned: Number(stats.Returned) || 0
    });
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/claims", require("./routes/claims"));
app.use("/api/returns", require("./routes/returns"));
app.use("/api/search", require("./routes/search"));
app.use("/api/admin", require("./routes/admin"));

app.use(notFound);
app.use(errorHandler);

// Port 5000 is used by macOS AirPlay Receiver, so default to 5001
const PORT = process.env.PORT || 5001;

// Only start listening when run directly (tests import the app instead)
if (require.main === module) {
    // Express 5 passes listen errors (e.g. port in use) to this callback
    app.listen(PORT, (error) => {
        if (error) {
            console.error(`Failed to start server on port ${PORT}: ${error.message}`);
            process.exit(1);
        }
        console.log(`Backend running at http://localhost:${PORT}`);
    });
}

module.exports = app;
