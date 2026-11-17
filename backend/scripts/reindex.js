// Rebuilds the Qdrant collection from MySQL (MySQL = source of truth).
// Usage: npm run reindex   (embedding service and Qdrant must be running)
require("dotenv").config();

const pool = require("../db");
const { reindexAll } = require("../services/reportSync");

reindexAll()
    .then((result) => {
        console.log(`Indexed ${result.indexed} reports from MySQL into Qdrant.`);
        console.log(`Removed ${result.removedStale} stale point(s)${result.staleIds.length ? `: ${result.staleIds.join(", ")}` : ""}.`);
    })
    .catch((error) => {
        console.error("Reindex failed:", error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
