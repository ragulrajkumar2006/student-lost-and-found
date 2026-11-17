const HttpError = require("./httpError");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9]{10}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function todayString() {
    // 'en-CA' formats dates as YYYY-MM-DD in local time
    return new Date().toLocaleDateString("en-CA");
}

function isRealDate(value) {
    if (!DATE_PATTERN.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * Validates `source` (usually req.body or req.query) against `rules`.
 * Returns a cleaned object containing only the declared fields, or throws
 * a 400 HttpError listing every problem found.
 *
 * Rule example: { itemName: { type: "string", required: true, max: 100 } }
 * Types: string, email, phone, password, enum, date, int
 */
function validate(source, rules) {
    const errors = [];
    const clean = {};

    for (const [field, rule] of Object.entries(rules)) {
        const label = rule.label || field;
        let value = source ? source[field] : undefined;

        if (typeof value === "string") value = value.trim();

        if (value === undefined || value === null || value === "") {
            if (rule.required) errors.push(`${label} is required`);
            continue;
        }

        switch (rule.type) {
            case "string":
                if (typeof value !== "string") {
                    errors.push(`${label} must be text`);
                } else if (rule.min && value.length < rule.min) {
                    errors.push(`${label} must be at least ${rule.min} characters`);
                } else if (rule.max && value.length > rule.max) {
                    errors.push(`${label} must be at most ${rule.max} characters`);
                }
                break;

            case "email":
                value = String(value).toLowerCase();
                if (!EMAIL_PATTERN.test(value) || value.length > 150) {
                    errors.push(`${label} must be a valid email address`);
                }
                break;

            case "phone":
                if (!PHONE_PATTERN.test(String(value))) {
                    errors.push(`${label} must be a 10-digit number`);
                }
                break;

            case "password":
                if (typeof value !== "string" || value.length < 8 || value.length > 72
                    || !/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
                    errors.push(`${label} must be 8-72 characters and contain a letter and a number`);
                }
                break;

            case "enum":
                value = String(value).toUpperCase();
                if (!rule.values.includes(value)) {
                    errors.push(`${label} must be one of: ${rule.values.join(", ")}`);
                }
                break;

            case "date":
                if (!isRealDate(String(value))) {
                    errors.push(`${label} must be a valid date (YYYY-MM-DD)`);
                } else if (rule.notFuture && value > todayString()) {
                    errors.push(`${label} cannot be in the future`);
                }
                break;

            case "int": {
                const number = Number(value);
                if (!Number.isInteger(number) || number < (rule.min ?? 1) || number > (rule.max ?? 2147483647)) {
                    errors.push(`${label} must be a whole number`);
                }
                value = number;
                break;
            }

            default:
                throw new Error(`Unknown validation type: ${rule.type}`);
        }

        clean[field] = value;
    }

    if (errors.length > 0) {
        throw new HttpError(400, "Validation failed", errors);
    }
    return clean;
}

// Parses a numeric :id route parameter
function parseId(value, label = "id") {
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) {
        throw new HttpError(400, `Invalid ${label}`);
    }
    return id;
}

module.exports = { validate, parseId, todayString };
