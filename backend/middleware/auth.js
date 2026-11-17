const jwt = require("jsonwebtoken");
const HttpError = require("../utils/httpError");

// Creates a signed JWT after a successful login/registration.
// The token stores who the user is (sub) and their role; it is signed with
// JWT_SECRET so the client cannot change the role without breaking the signature.
function signToken(user) {
    return jwt.sign(
        { role: user.Role, name: user.Name },
        process.env.JWT_SECRET,
        {
            subject: String(user.Student_ID),
            expiresIn: process.env.JWT_EXPIRES_IN || "8h"
        }
    );
}

// Authentication: is there a valid token? Sets req.user = { id, role, name }.
function authenticate(req, res, next) {
    const [scheme, token] = (req.headers.authorization || "").split(" ");

    if (scheme !== "Bearer" || !token) {
        throw new HttpError(401, "Login required");
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: Number(payload.sub), role: payload.role, name: payload.name };
    } catch {
        throw new HttpError(401, "Session expired or invalid. Please log in again.");
    }

    next();
}

// Authorization: does the logged-in user have one of the allowed roles?
// Usage: router.get("/stats", authenticate, requireRole("ADMIN"), handler)
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            throw new HttpError(403, "You do not have permission to perform this action");
        }
        next();
    };
}

module.exports = { signToken, authenticate, requireRole };
