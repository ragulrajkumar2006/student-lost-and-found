const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");
const HttpError = require("../utils/httpError");
const { validate } = require("../utils/validate");
const { signToken, authenticate } = require("../middleware/auth");

const router = express.Router();
const BCRYPT_COST = 10;

function publicUser(row) {
    return {
        Student_ID: row.Student_ID,
        Name: row.Name,
        Email: row.Email,
        Phone: row.Phone,
        Role: row.Role
    };
}

// POST /api/auth/register  — new accounts are always STUDENT
router.post("/register", async (req, res) => {
    const data = validate(req.body, {
        name: { type: "string", required: true, min: 2, max: 100 },
        email: { type: "email", required: true },
        phone: { type: "phone" },
        password: { type: "password", required: true }
    });

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_COST);

    const [result] = await pool.query(
        `INSERT INTO STUDENT (Name, Email, Phone, Password_Hash, Role)
         VALUES (?, ?, ?, ?, 'STUDENT')`,
        [data.name, data.email, data.phone || null, passwordHash]
    );

    const user = {
        Student_ID: result.insertId,
        Name: data.name,
        Email: data.email,
        Phone: data.phone || null,
        Role: "STUDENT"
    };

    res.status(201).json({ success: true, token: signToken(user), user });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
    const data = validate(req.body, {
        email: { type: "email", required: true },
        password: { type: "string", required: true, max: 72 }
    });

    const [rows] = await pool.query("SELECT * FROM STUDENT WHERE Email = ?", [data.email]);
    const user = rows[0];

    // Same message whether the email or the password is wrong,
    // so attackers cannot find out which emails are registered.
    const passwordOk = user && await bcrypt.compare(data.password, user.Password_Hash);
    if (!passwordOk) {
        throw new HttpError(401, "Invalid email or password");
    }

    res.json({ success: true, token: signToken(user), user: publicUser(user) });
});

// GET /api/auth/me — profile of the logged-in user
router.get("/me", authenticate, async (req, res) => {
    const [rows] = await pool.query(
        `SELECT Student_ID, Name, Email, Phone, Role,
                GetStudentReportCount(Student_ID) AS Report_Count
         FROM STUDENT WHERE Student_ID = ?`,
        [req.user.id]
    );
    if (rows.length === 0) {
        throw new HttpError(404, "User not found");
    }
    res.json({ success: true, user: rows[0] });
});

module.exports = router;
