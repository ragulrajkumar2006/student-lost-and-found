const express = require("express");
const pool = require("../db");
const HttpError = require("../utils/httpError");
const { parseId } = require("../utils/validate");
const { authenticate, requireRole } = require("../middleware/auth");
const vectorStore = require("../services/vectorStore");
const sync = require("../services/reportSync");

const router = express.Router();
router.use(authenticate, requireRole("ADMIN"));

// GET /api/admin/stats — dashboard numbers (GROUP BY + aggregates)
router.get("/stats", async (req, res) => {
    const [byTypeAndStatus] = await pool.query(
        `SELECT Report_Type, Status, COUNT(*) AS Total
         FROM ITEM_REPORT
         GROUP BY Report_Type, Status
         ORDER BY Report_Type, Status`
    );
    const [claimsByStatus] = await pool.query(
        "SELECT Claim_Status, COUNT(*) AS Total FROM CLAIM GROUP BY Claim_Status"
    );
    const [topLocations] = await pool.query(
        `SELECT Location, COUNT(*) AS Total
         FROM ITEM_REPORT
         GROUP BY Location
         ORDER BY Total DESC, Location
         LIMIT 5`
    );
    const [[totals]] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM STUDENT WHERE Role = 'STUDENT') AS Students,
                (SELECT COUNT(*) FROM ITEM_REPORT)                    AS Reports,
                (SELECT COUNT(*) FROM CLAIM WHERE Claim_Status = 'PENDING') AS Pending_Claims,
                (SELECT COUNT(*) FROM ITEM_RETURN)                    AS Returns`
    );

    res.json({ success: true, totals, byTypeAndStatus, claimsByStatus, topLocations });
});

// GET /api/admin/students — users with their report counts (stored function)
router.get("/students", async (req, res) => {
    const [students] = await pool.query(
        `SELECT Student_ID, Name, Email, Phone, Role,
                GetStudentReportCount(Student_ID) AS Report_Count
         FROM STUDENT
         ORDER BY Student_ID`
    );
    res.json({ success: true, count: students.length, students });
});

// GET /api/admin/vector-status — is Qdrant in sync with MySQL?
router.get("/vector-status", async (req, res) => {
    const info = await vectorStore.collectionInfo();
    const [[{ total }]] = await pool.query("SELECT COUNT(*) AS total FROM ITEM_REPORT");
    res.json({
        success: true,
        collection: process.env.QDRANT_COLLECTION,
        vectorSize: info.config.params.vectors.size,
        distance: info.config.params.vectors.distance,
        qdrantPoints: info.points_count,
        mysqlReports: total,
        inSync: info.points_count === total
    });
});

// GET /api/admin/vector/:reportId — READ a single vector record from Qdrant
router.get("/vector/:reportId", async (req, res) => {
    const reportId = parseId(req.params.reportId, "report id");
    const [point] = await vectorStore.retrievePoints([reportId], true);
    if (!point) {
        throw new HttpError(404, "No vector stored for this report");
    }
    res.json({
        success: true,
        id: point.id,
        payload: point.payload,
        dimensions: point.vector.length,
        vectorPreview: point.vector.slice(0, 5)
    });
});

// POST /api/admin/reindex — rebuild Qdrant from MySQL (fixes any drift)
router.post("/reindex", async (req, res) => {
    const result = await sync.reindexAll();
    res.json({ success: true, ...result });
});

module.exports = router;
