// An error that carries an HTTP status code, e.g. throw new HttpError(404, "Report not found").
// The central error handler (middleware/errorHandler.js) turns it into a JSON response.
class HttpError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

module.exports = HttpError;
