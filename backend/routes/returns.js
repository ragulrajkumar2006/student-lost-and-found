const express = require("express");
const pool = require("../db");
const HttpError = require("../utils/httpError");
const { validate } = require("../utils/validate");
const { authenticate, requireRole } = require("../middleware/auth");
const sync = require("../services/reportSync");

const router = express.Router();
router.use(authenticate);

// GET /api/returns/mine — items returned to the logged-in student
router.get("/mine", async (req, res) => {
    const [returns] = await pool.query(
        `SELECT rt.Return_ID, rt.Returned_Date, rt.Remarks,
                c.Claim_ID, r.Report_ID, r.Item_Name, r.Location
         FROM ITEM_RETURN rt
         JOIN CLAIM c ON c.Claim_ID = rt.Claim_ID
         JOIN ITEM_REPORT r ON r.Report_ID = c.Report_ID
         WHERE c.Claimant_Student_ID = ?
         ORDER BY rt.Returned_Date DESC`,
        [req.user.id]
    );
    res.json({ success: true, count: returns.length, returns });
});

// GET /api/returns — full return history (admin)
router.get("/", requireRole("ADMIN"), async (req, res) => {
    const [returns] = await pool.query(
        `SELECT Return_ID, Returned_Date, Return_Remarks, Claim_ID, Claim_Date,
                Claimant_Name, Claimant_Email, Report_ID, Item_Name, Location, Finder_Name
         FROM vw_claim_history
         WHERE Return_ID IS NOT NULL
         ORDER BY Returned_Date DESC, Return_ID DESC`
    );
    res.json({ success: true, count: returns.length, returns });
});

// POST /api/returns — record the hand-over for an APPROVED claim (admin)
// Calls stored procedure RecordItemReturn; triggers check the claim is
// APPROVED and set the report to CLOSED.
router.post("/", requireRole("ADMIN"), async (req, res) => {
    const data = validate(req.body, {
        claimId: { type: "int", required: true, label: "Claim" },
        returnedDate: { type: "date", notFuture: true, label: "Returned date" },
        remarks: { type: "string", max: 255, label: "Remarks" }
    });

    const [claims] = await pool.query("SELECT * FROM CLAIM WHERE Claim_ID = ?", [data.claimId]);
    const claim = claims[0];
    if (!claim) {
        throw new HttpError(404, "Claim not found");
    }
    if (claim.Claimant_Student_ID === req.user.id) {
        throw new HttpError(403, "You cannot record a return for your own claim");
    }

    // CALL returns [resultSets, okPacket]; the first set holds { Return_ID }
    const [results] = await pool.query("CALL RecordItemReturn(?, ?, ?)", [
        data.claimId,
        data.returnedDate || null,
        data.remarks || null
    ]);
    const returnId = results[0][0].Return_ID;

    const vectorSync = await sync.trySync(sync.refreshPayload, claim.Report_ID);

    res.status(201).json({ success: true, returnId, reportId: claim.Report_ID, vectorSync });
});

module.exports = router;
