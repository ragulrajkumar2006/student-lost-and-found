const pool = require("../db");
const vectorStore = require("./vectorStore");
const { embedText, embedTexts, reportToText } = require("./embedding");

// Keeps Qdrant in step with MySQL and runs the semantic matching.
//
// Rule: MySQL is the source of truth. We always write MySQL first; Qdrant is
// a search index built FROM MySQL. If Qdrant is briefly unavailable, the
// report is still saved and the admin can rebuild the index (reindexAll).

// Minimum cosine similarity to count as a "possible match". Scores are a
// measure of closeness in meaning, NOT probabilities.
const MATCH_THRESHOLD = 0.35;
const SEARCH_THRESHOLD = 0.2;

const REPORT_COLUMNS = `
    r.Report_ID, r.Student_ID, r.Item_Name, r.Description, r.Report_Type,
    r.Location, r.Date_Reported, r.Status, s.Name AS Reported_By`;

async function getReport(reportId) {
    const [rows] = await pool.query(
        `SELECT ${REPORT_COLUMNS}
         FROM ITEM_REPORT r JOIN STUDENT s ON s.Student_ID = r.Student_ID
         WHERE r.Report_ID = ?`,
        [reportId]
    );
    return rows[0] || null;
}

// Fetches full report rows from MySQL for the given ids, keeping the given order
async function getReportsByIds(ids) {
    if (ids.length === 0) return [];
    const [rows] = await pool.query(
        `SELECT ${REPORT_COLUMNS}
         FROM ITEM_REPORT r JOIN STUDENT s ON s.Student_ID = r.Student_ID
         WHERE r.Report_ID IN (?)`,
        [ids]
    );
    const byId = new Map(rows.map((row) => [row.Report_ID, row]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
}

function buildPayload(report) {
    return {
        report_id: report.Report_ID,
        student_id: report.Student_ID,
        item_name: report.Item_Name,
        report_type: report.Report_Type,
        location: report.Location,
        date_reported: report.Date_Reported,
        status: report.Status
    };
}

// CREATE / UPDATE in Qdrant: embed the report text and upsert it under its Report_ID
async function indexReport(reportId) {
    const report = await getReport(reportId);
    if (!report) return;
    const vector = await embedText(reportToText(report));
    await vectorStore.upsertPoints([{ id: report.Report_ID, vector, payload: buildPayload(report) }]);
}

// UPDATE in Qdrant: refresh payload only (status/location/date changed, text did not)
async function refreshPayload(reportId) {
    const report = await getReport(reportId);
    if (!report) return;
    await vectorStore.setPayload(report.Report_ID, buildPayload(report));
}

// DELETE in Qdrant
async function removeReport(reportId) {
    await vectorStore.deletePoints([reportId]);
}

// Runs a Qdrant sync step without failing the user's request.
// Returns "synced" or "failed" so the API response can say what happened.
async function trySync(step, reportId) {
    try {
        await step(reportId);
        return "synced";
    } catch (error) {
        console.warn(`Qdrant sync failed for report ${reportId}: ${error.message}`);
        return "failed";
    }
}

// Joins Qdrant hits with fresh MySQL rows and attaches the similarity score
async function hydrate(points) {
    const reports = await getReportsByIds(points.map((point) => point.id));
    const scores = new Map(points.map((point) => [point.id, point.score]));
    return reports.map((report) => ({
        ...report,
        Similarity: Number(scores.get(report.Report_ID).toFixed(4))
    }));
}

/**
 * Suggested matches for a report: the closest reports of the OPPOSITE type
 * (LOST <-> FOUND) that are still OPEN and were not reported by the same student.
 * Uses the report's own stored vector as the query (Qdrant "query by id").
 */
async function findMatches(report, limit = 5) {
    const oppositeType = report.Report_Type === "LOST" ? "FOUND" : "LOST";
    const request = {
        query: report.Report_ID,
        limit,
        scoreThreshold: MATCH_THRESHOLD,
        filter: {
            must: [
                { key: "report_type", match: { value: oppositeType } },
                { key: "status", match: { value: "OPEN" } }
            ],
            must_not: [{ key: "student_id", match: { value: report.Student_ID } }]
        }
    };

    let points;
    try {
        points = await vectorStore.queryPoints(request);
    } catch (error) {
        // The report has no vector yet (e.g. Qdrant was down when it was created):
        // index it now and try once more.
        if (error.response && error.response.status === 404) {
            await indexReport(report.Report_ID);
            points = await vectorStore.queryPoints(request);
        } else {
            throw error;
        }
    }

    // Re-check against MySQL (source of truth) in case Qdrant's copy is stale
    const matches = await hydrate(points);
    return matches.filter((match) => match.Status === "OPEN" && match.Report_Type === oppositeType);
}

/**
 * Free-text semantic search, e.g. "black purse near library".
 * Optional type filter; closed (already returned) items are excluded.
 */
async function semanticSearch(text, { type, limit = 10 } = {}) {
    const vector = await embedText(text);
    const filter = { must_not: [{ key: "status", match: { value: "CLOSED" } }] };
    if (type) {
        filter.must = [{ key: "report_type", match: { value: type } }];
    }

    const points = await vectorStore.queryPoints({
        query: vector,
        filter,
        limit,
        scoreThreshold: SEARCH_THRESHOLD
    });
    const results = await hydrate(points);
    return results.filter((report) => report.Status !== "CLOSED");
}

/**
 * Rebuilds the whole Qdrant collection from MySQL:
 * upserts every report (batched embeddings) and deletes points whose
 * report no longer exists. Safe to run any time.
 */
async function reindexAll() {
    const [reports] = await pool.query(
        `SELECT ${REPORT_COLUMNS}
         FROM ITEM_REPORT r JOIN STUDENT s ON s.Student_ID = r.Student_ID
         ORDER BY r.Report_ID`
    );

    const batchSize = 32;
    for (let start = 0; start < reports.length; start += batchSize) {
        const batch = reports.slice(start, start + batchSize);
        const vectors = await embedTexts(batch.map(reportToText));
        await vectorStore.upsertPoints(batch.map((report, i) => ({
            id: report.Report_ID,
            vector: vectors[i],
            payload: buildPayload(report)
        })));
    }

    const validIds = new Set(reports.map((report) => report.Report_ID));
    const staleIds = (await vectorStore.listAllIds()).filter((id) => !validIds.has(id));
    if (staleIds.length > 0) {
        await vectorStore.deletePoints(staleIds);
    }

    return { indexed: reports.length, removedStale: staleIds.length, staleIds };
}

module.exports = {
    getReport,
    getReportsByIds,
    indexReport,
    refreshPayload,
    removeReport,
    trySync,
    findMatches,
    semanticSearch,
    reindexAll,
    MATCH_THRESHOLD
};
