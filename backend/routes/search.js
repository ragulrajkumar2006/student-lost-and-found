const express = require("express");
const pool = require("../db");
const { validate } = require("../utils/validate");
const { authenticate } = require("../middleware/auth");
const sync = require("../services/reportSync");

const router = express.Router();
router.use(authenticate);

// GET /api/search/keyword?q=wallet&type=FOUND
// Classic SQL search: matches the exact words with LIKE
router.get("/keyword", async (req, res) => {
    const data = validate(req.query, {
        q: { type: "string", required: true, min: 2, max: 100, label: "Search text" },
        type: { type: "enum", values: ["LOST", "FOUND"] }
    });

    const pattern = `%${data.q}%`;
    const params = [pattern, pattern, pattern];
    let typeCondition = "";
    if (data.type) {
        typeCondition = "AND r.Report_Type = ?";
        params.push(data.type);
    }

    const [results] = await pool.query(
        `SELECT r.Report_ID, r.Student_ID, r.Item_Name, r.Description, r.Report_Type,
                r.Location, r.Date_Reported, r.Status, s.Name AS Reported_By
         FROM ITEM_REPORT r
         JOIN STUDENT s ON s.Student_ID = r.Student_ID
         WHERE (r.Item_Name LIKE ? OR r.Description LIKE ? OR r.Location LIKE ?)
           AND r.Status <> 'CLOSED'
           ${typeCondition}
         ORDER BY r.Date_Reported DESC`,
        params
    );

    res.json({ success: true, mode: "keyword", query: data.q, count: results.length, results });
});

// GET /api/search/semantic?q=dark purse near library&type=FOUND
// Meaning-based search: the text is embedded and compared with every report
// vector in Qdrant (cosine similarity); full rows come from MySQL.
router.get("/semantic", async (req, res) => {
    const data = validate(req.query, {
        q: { type: "string", required: true, min: 2, max: 300, label: "Search text" },
        type: { type: "enum", values: ["LOST", "FOUND"] },
        limit: { type: "int", min: 1, max: 20 }
    });

    const results = await sync.semanticSearch(data.q, { type: data.type, limit: data.limit || 10 });
    res.json({ success: true, mode: "semantic", query: data.q, count: results.length, results });
});

module.exports = router;
