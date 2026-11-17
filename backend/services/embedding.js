const axios = require("axios");

// Talks to the Python FastAPI embedding service (embedding-service/app.py),
// which runs sentence-transformers/all-MiniLM-L6-v2 and returns 384-d vectors.

function embeddingUrl() {
    return process.env.EMBEDDING_URL || "http://localhost:8001";
}

async function embedTexts(texts) {
    const response = await axios.post(`${embeddingUrl()}/embed`, { texts }, { timeout: 30000 });
    return response.data.vectors;
}

async function embedText(text) {
    const [vector] = await embedTexts([text]);
    return vector;
}

// The text that represents a report in vector space: its name + description.
// (Location is kept as a filter/payload field, not mixed into the meaning.)
function reportToText(report) {
    return `${report.Item_Name}. ${report.Description}`;
}

async function checkHealth() {
    const response = await axios.get(`${embeddingUrl()}/health`, { timeout: 3000 });
    return response.data;
}

module.exports = { embedTexts, embedText, reportToText, checkHealth };
