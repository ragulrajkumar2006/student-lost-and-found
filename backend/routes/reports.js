const express = require("express");
const pool = require("../db");
const HttpError = require("../utils/httpError");
const { validate, parseId } = require("../utils/validate");
const { authenticate } = require("../middleware/auth");
const sync = require("../services/reportSync");

const router = express.Router();
router.use(authenticate);

const REPORT_TYPES = ["LOST", "FOUND"];
const STATUSES = ["OPEN", "MATCHED", "CLOSED"];

// Only the reporter or an admin may change a report
function assertCanModify(report, user) {
    if (report.Student_ID !== user.id && user.role !== "ADMIN") {
        throw new HttpError(403, "You can only modify your own reports");
    }
}

async function loadReport(id) {
    const report = await sync.getReport(id);
    if (!report) {
        throw new HttpError(404, "Report not found");
    }
    return report;
}

// GET /api/reports?type=LOST&status=OPEN&q=wallet&location=library
// Keyword search + filters, newest first
router.get("/", async (req, res) => {
    const filters = validate(req.query, {
        type: { type: "enum", values: REPORT_TYPES },
        status: { type: "enum", values: STATUSES },
        q: { type: "string", max: 100 },
        location: { type: "string", max: 150 }
    });

    const conditions = [];
    const params = [];

    if (filters.type) {
        conditions.push("r.Report_Type = ?");
        params.push(filters.type);
    }
    if (filters.status) {
        conditions.push("r.Status = ?");
        params.push(filters.status);
    }
    if (filters.q) {
        conditions.push("(r.Item_Name LIKE ? OR r.Description LIKE ? OR r.Location LIKE ?)");
        const pattern = `%${filters.q}%`;
        params.push(pattern, pattern, pattern);
    }
    if (filters.location) {
        conditions.push("r.Location LIKE ?");
        params.push(`%${filters.location}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const [reports] = await pool.query(
        `SELECT r.Report_ID, r.Student_ID, r.Item_Name, r.Description, r.Report_Type,
                r.Location, r.Date_Reported, r.Status, s.Name AS Reported_By,
                GetPendingClaimCount(r.Report_ID) AS Pending_Claims
         FROM ITEM_REPORT r
         JOIN STUDENT s ON s.Student_ID = r.Student_ID
         ${where}
         ORDER BY r.Date_Reported DESC, r.Report_ID DESC
         LIMIT 200`,
        params
    );

    res.json({ success: true, count: reports.length, reports });
});

// GET /api/reports/mine — the logged-in student's own reports
router.get("/mine", async (req, res) => {
    const [reports] = await pool.query(
        `SELECT r.*,
                COUNT(c.Claim_ID) AS Total_Claims,
                CAST(COALESCE(SUM(c.Claim_Status = 'PENDING'), 0) AS UNSIGNED) AS Pending_Claims
         FROM ITEM_REPORT r
         LEFT JOIN CLAIM c ON c.Report_ID = r.Report_ID
         WHERE r.Student_ID = ?
         GROUP BY r.Report_ID
         ORDER BY r.Date_Reported DESC, r.Report_ID DESC`,
        [req.user.id]
    );
    res.json({ success: true, count: reports.length, reports });
});

// GET /api/reports/:id — details; owner/admin also see the claims on it
router.get("/:id", async (req, res) => {
    const report = await loadReport(parseId(req.params.id, "report id"));
    const isOwnerOrAdmin = report.Student_ID === req.user.id || req.user.role === "ADMIN";

    const [claimRows] = await pool.query(
        `SELECT c.Claim_ID, c.Claimant_Student_ID, c.Claim_Date, c.Claim_Status, c.Remarks,
                s.Name AS Claimant_Name
         FROM CLAIM c JOIN STUDENT s ON s.Student_ID = c.Claimant_Student_ID
         WHERE c.Report_ID = ?
         ORDER BY c.Claim_Date DESC`,
        [report.Report_ID]
    );

    res.json({
        success: true,
        report,
        claims: isOwnerOrAdmin ? claimRows : undefined,
        myClaim: claimRows.find((claim) => claim.Claimant_Student_ID === req.user.id) || null
    });
});

// GET /api/reports/:id/matches — semantic suggestions of the opposite type
router.get("/:id/matches", async (req, res) => {
    const report = await loadReport(parseId(req.params.id, "report id"));
    const matches = await sync.findMatches(report);
    res.json({ success: true, report, threshold: sync.MATCH_THRESHOLD, matches });
});

// POST /api/reports — create a LOST or FOUND report
// 1) save in MySQL  2) embed + store in Qdrant  3) return suggested matches
router.post("/", async (req, res) => {
    const data = validate(req.body, {
        itemName: { type: "string", required: true, min: 2, max: 100, label: "Item name" },
        description: { type: "string", required: true, min: 5, max: 1000, label: "Description" },
        reportType: { type: "enum", required: true, values: REPORT_TYPES, label: "Report type" },
        location: { type: "string", required: true, min: 2, max: 150, label: "Location" },
        dateReported: { type: "date", required: true, notFuture: true, label: "Date" }
    });

    const [result] = await pool.query(
        `INSERT INTO ITEM_REPORT
            (Student_ID, Item_Name, Description, Report_Type, Location, Date_Reported, Status)
         VALUES (?, ?, ?, ?, ?, ?, 'OPEN')`,
        [req.user.id, data.itemName, data.description, data.reportType, data.location, data.dateReported]
    );

    const report = await sync.getReport(result.insertId);
    const vectorSync = await sync.trySync(sync.indexReport, report.Report_ID);

    let matches = [];
    if (vectorSync === "synced") {
        matches = await sync.findMatches(report).catch(() => []);
    }

    res.status(201).json({ success: true, report, vectorSync, matches });
});

// PUT /api/reports/:id — edit a report (owner while OPEN, or admin)
router.put("/:id", async (req, res) => {
    const report = await loadReport(parseId(req.params.id, "report id"));
    assertCanModify(report, req.user);

    const isAdmin = req.user.role === "ADMIN";
    if (!isAdmin && report.Status !== "OPEN") {
        throw new HttpError(409, "Only OPEN reports can be edited");
    }

    const data = validate(req.body, {
        itemName: { type: "string", min: 2, max: 100, label: "Item name" },
        description: { type: "string", min: 5, max: 1000, label: "Description" },
        location: { type: "string", min: 2, max: 150, label: "Location" },
        dateReported: { type: "date", notFuture: true, label: "Date" },
        // Students may only close their own report ("I got it back");
        // admins may set any status.
        status: { type: "enum", values: isAdmin ? STATUSES : ["OPEN", "CLOSED"], label: "Status" }
    });

    const columns = {
        itemName: "Item_Name",
        description: "Description",
        location: "Location",
        dateReported: "Date_Reported",
        status: "Status"
    };
    const fields = Object.keys(data);
    if (fields.length === 0) {
        throw new HttpError(400, "Nothing to update");
    }

    const setClause = fields.map((field) => `${columns[field]} = ?`).join(", ");
    await pool.query(
        `UPDATE ITEM_REPORT SET ${setClause} WHERE Report_ID = ?`,
        [...fields.map((field) => data[field]), report.Report_ID]
    );

    // Text changed -> new embedding (same point id, so no duplicate);
    // otherwise only the payload needs refreshing.
    const textChanged = "itemName" in data || "description" in data;
    const vectorSync = await sync.trySync(
        textChanged ? sync.indexReport : sync.refreshPayload,
        report.Report_ID
    );

    res.json({ success: true, report: await sync.getReport(report.Report_ID), vectorSync });
});

// DELETE /api/reports/:id — owner or admin; removes MySQL row (claims cascade) and the vector
router.delete("/:id", async (req, res) => {
    const report = await loadReport(parseId(req.params.id, "report id"));
    assertCanModify(report, req.user);

    if (req.user.role !== "ADMIN") {
        const [[{ approved }]] = await pool.query(
            "SELECT COUNT(*) AS approved FROM CLAIM WHERE Report_ID = ? AND Claim_Status = 'APPROVED'",
            [report.Report_ID]
        );
        if (approved > 0) {
            throw new HttpError(409, "This report has an approved claim and is kept for the records");
        }
    }

    await pool.query("DELETE FROM ITEM_REPORT WHERE Report_ID = ?", [report.Report_ID]);
    const vectorSync = await sync.trySync(sync.removeReport, report.Report_ID);

    res.json({ success: true, message: "Report deleted", reportId: report.Report_ID, vectorSync });
});

module.exports = router;
