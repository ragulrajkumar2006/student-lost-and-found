const express = require("express");
const pool = require("../db");
const HttpError = require("../utils/httpError");
const { validate, parseId } = require("../utils/validate");
const { authenticate, requireRole } = require("../middleware/auth");
const sync = require("../services/reportSync");

const router = express.Router();
router.use(authenticate);

async function loadClaim(id) {
    const [rows] = await pool.query("SELECT * FROM CLAIM WHERE Claim_ID = ?", [id]);
    if (rows.length === 0) {
        throw new HttpError(404, "Claim not found");
    }
    return rows[0];
}

// POST /api/claims — "this FOUND item is mine"
// Business rules (FOUND only, not your own item, not already returned)
// are enforced by the BeforeClaimInsert trigger in MySQL.
router.post("/", async (req, res) => {
    const data = validate(req.body, {
        reportId: { type: "int", required: true, label: "Report" },
        remarks: { type: "string", required: true, min: 10, max: 255, label: "Proof of ownership" }
    });

    const [result] = await pool.query(
        `INSERT INTO CLAIM (Report_ID, Claimant_Student_ID, Claim_Date, Claim_Status, Remarks)
         VALUES (?, ?, CURDATE(), 'PENDING', ?)`,
        [data.reportId, req.user.id, data.remarks]
    );

    res.status(201).json({ success: true, claim: await loadClaim(result.insertId) });
});

// GET /api/claims/mine — claims made by the logged-in student
router.get("/mine", async (req, res) => {
    const [claims] = await pool.query(
        `SELECT c.Claim_ID, c.Claim_Date, c.Claim_Status, c.Remarks,
                r.Report_ID, r.Item_Name, r.Location, r.Status AS Report_Status,
                rt.Returned_Date
         FROM CLAIM c
         JOIN ITEM_REPORT r ON r.Report_ID = c.Report_ID
         LEFT JOIN ITEM_RETURN rt ON rt.Claim_ID = c.Claim_ID
         WHERE c.Claimant_Student_ID = ?
         ORDER BY c.Claim_Date DESC, c.Claim_ID DESC`,
        [req.user.id]
    );
    res.json({ success: true, count: claims.length, claims });
});

// DELETE /api/claims/:id — a student withdraws their own PENDING claim
router.delete("/:id", async (req, res) => {
    const claim = await loadClaim(parseId(req.params.id, "claim id"));

    if (claim.Claimant_Student_ID !== req.user.id) {
        throw new HttpError(403, "You can only withdraw your own claims");
    }
    if (claim.Claim_Status !== "PENDING") {
        throw new HttpError(409, "Only PENDING claims can be withdrawn");
    }

    await pool.query("DELETE FROM CLAIM WHERE Claim_ID = ?", [claim.Claim_ID]);
    res.json({ success: true, message: "Claim withdrawn" });
});

// ----- Admin-only below ---------------------------------------------------

// GET /api/claims?status=PENDING — all claims with claimant, item and return info
router.get("/", requireRole("ADMIN"), async (req, res) => {
    const filters = validate(req.query, {
        status: { type: "enum", values: ["PENDING", "APPROVED", "REJECTED"] }
    });

    const [claims] = await pool.query(
        `SELECT h.*, c.Claimant_Student_ID
         FROM vw_claim_history h
         JOIN CLAIM c ON c.Claim_ID = h.Claim_ID
         ${filters.status ? "WHERE h.Claim_Status = ?" : ""}
         ORDER BY FIELD(h.Claim_Status, 'PENDING', 'APPROVED', 'REJECTED'), h.Claim_Date DESC`,
        filters.status ? [filters.status] : []
    );
    res.json({ success: true, count: claims.length, claims });
});

// An admin must never decide on a claim they made themselves
function assertNotOwnClaim(claim, user) {
    if (claim.Claimant_Student_ID === user.id) {
        throw new HttpError(403, "You cannot approve or reject your own claim");
    }
}

// PATCH /api/claims/:id/approve — calls stored procedure ApproveClaim
// (approves this claim, rejects the other pending claims, trigger marks item MATCHED)
router.patch("/:id/approve", requireRole("ADMIN"), async (req, res) => {
    const claim = await loadClaim(parseId(req.params.id, "claim id"));
    assertNotOwnClaim(claim, req.user);

    const data = validate(req.body, { remarks: { type: "string", max: 255 } });

    await pool.query("CALL ApproveClaim(?, ?)", [claim.Claim_ID, data.remarks || null]);
    const vectorSync = await sync.trySync(sync.refreshPayload, claim.Report_ID);

    res.json({ success: true, claim: await loadClaim(claim.Claim_ID), vectorSync });
});

// PATCH /api/claims/:id/reject
router.patch("/:id/reject", requireRole("ADMIN"), async (req, res) => {
    const claim = await loadClaim(parseId(req.params.id, "claim id"));
    assertNotOwnClaim(claim, req.user);

    const data = validate(req.body, {
        remarks: { type: "string", required: true, min: 3, max: 255, label: "Reason" }
    });

    const [result] = await pool.query(
        `UPDATE CLAIM SET Claim_Status = 'REJECTED', Remarks = ?
         WHERE Claim_ID = ? AND Claim_Status = 'PENDING'`,
        [data.remarks, claim.Claim_ID]
    );
    if (result.affectedRows === 0) {
        throw new HttpError(409, "Only PENDING claims can be rejected");
    }

    res.json({ success: true, claim: await loadClaim(claim.Claim_ID) });
});

module.exports = router;
