const HttpError = require("../utils/httpError");

// Friendly messages for UNIQUE constraint violations, keyed by index name
const DUPLICATE_MESSAGES = {
    "STUDENT.Email": "This email is already registered",
    "CLAIM.uq_claim_report_student": "You have already claimed this item",
    "ITEM_RETURN.Claim_ID": "A return has already been recorded for this claim"
};

function notFound(req, res) {
    res.status(404).json({
        success: false,
        error: `Route not found: ${req.method} ${req.originalUrl}`
    });
}

// Express 5 forwards errors thrown in async route handlers here automatically,
// so routes can simply `throw` instead of wrapping everything in try/catch.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err instanceof HttpError) {
        return res.status(err.status).json({
            success: false,
            error: err.message,
            ...(err.details && { details: err.details })
        });
    }

    // Malformed JSON body
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ success: false, error: "Request body is not valid JSON" });
    }

    // SIGNAL SQLSTATE '45000' raised by our triggers / stored procedures
    if (err.sqlState === "45000") {
        return res.status(400).json({ success: false, error: err.sqlMessage });
    }

    if (err.code === "ER_DUP_ENTRY") {
        // MySQL on macOS reports table names in lowercase ("student.Email"), so compare case-insensitively
        const message = err.sqlMessage.toLowerCase();
        const key = Object.keys(DUPLICATE_MESSAGES).find((name) => message.includes(`'${name.toLowerCase()}'`));
        return res.status(409).json({
            success: false,
            error: key ? DUPLICATE_MESSAGES[key] : "Duplicate record"
        });
    }

    if (err.code === "ER_NO_REFERENCED_ROW_2") {
        return res.status(400).json({ success: false, error: "Referenced record does not exist" });
    }

    console.error(err);
    res.status(500).json({ success: false, error: "Internal server error" });
}

module.exports = { notFound, errorHandler };
