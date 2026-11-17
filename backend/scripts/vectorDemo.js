// Demonstrates every vector-database operation on Qdrant, step by step:
//   CREATE (insert) -> READ (retrieve) -> UPDATE (payload + vector)
//   -> SIMILARITY SEARCH -> DELETE -> verify deletion
// and then shows semantic LOST <-> FOUND matching on the real reports.
//
// Usage: npm run vector-demo
// A temporary point id (900001) is used so real report vectors are untouched.
require("dotenv").config();

const pool = require("../db");
const vectorStore = require("../services/vectorStore");
const { embedText } = require("../services/embedding");
const sync = require("../services/reportSync");

const DEMO_ID = 900001;

function heading(title) {
    console.log(`\n=== ${title} ${"=".repeat(Math.max(0, 66 - title.length))}`);
}

async function main() {
    const info = await vectorStore.collectionInfo();
    heading("COLLECTION");
    console.log(`Collection : ${process.env.QDRANT_COLLECTION}`);
    console.log(`Vector size: ${info.config.params.vectors.size}, distance: ${info.config.params.vectors.distance}`);
    console.log(`Points     : ${info.points_count}`);

    // CREATE
    heading("1. CREATE (insert a vector record)");
    const text = "Lost a red backpack with physics notes near the basketball court";
    const vector = await embedText(text);
    await vectorStore.upsertPoints([{
        id: DEMO_ID,
        vector,
        payload: { report_id: DEMO_ID, item_name: "Red Backpack", report_type: "LOST", status: "OPEN", demo: true }
    }]);
    console.log(`Inserted point ${DEMO_ID}: "${text}" (${vector.length} dimensions)`);

    // READ
    heading("2. READ (retrieve by id)");
    let [point] = await vectorStore.retrievePoints([DEMO_ID], true);
    console.log("Payload       :", JSON.stringify(point.payload));
    console.log("Vector preview:", point.vector.slice(0, 5).map((v) => v.toFixed(4)).join(", "), "...");

    // UPDATE payload
    heading("3a. UPDATE (payload only)");
    await vectorStore.setPayload(DEMO_ID, { status: "MATCHED" });
    [point] = await vectorStore.retrievePoints([DEMO_ID]);
    console.log("Status after update:", point.payload.status);

    // UPDATE vector (upsert with the same id replaces it - no duplicate)
    heading("3b. UPDATE (new description -> new vector, same id)");
    const newText = "Lost a red college bag containing physics notebooks near the sports ground";
    await vectorStore.upsertPoints([{
        id: DEMO_ID,
        vector: await embedText(newText),
        payload: { ...point.payload, description_version: 2 }
    }]);
    const afterUpdate = await vectorStore.collectionInfo();
    console.log(`Replaced vector for point ${DEMO_ID}: "${newText}"`);
    console.log(`Point count is still ${afterUpdate.points_count} (no duplicate created)`);

    // SEARCH
    heading("4. SIMILARITY SEARCH");
    const query = "found a red rucksack on the sports field";
    const hits = await vectorStore.queryPoints({ query: await embedText(query), limit: 3 });
    console.log(`Query: "${query}"`);
    for (const hit of hits) {
        console.log(`  id=${String(hit.id).padEnd(7)} score=${hit.score.toFixed(4)}  ${hit.payload.item_name} (${hit.payload.report_type})`);
    }

    // DELETE
    heading("5. DELETE");
    await vectorStore.deletePoints([DEMO_ID]);
    const remaining = await vectorStore.retrievePoints([DEMO_ID]);
    console.log(`Deleted point ${DEMO_ID}. Retrieve now returns ${remaining.length} record(s).`);

    // MATCHING on real data
    heading("6. SEMANTIC MATCHING: LOST -> FOUND (real reports)");
    const [lostReports] = await pool.query(
        "SELECT Report_ID FROM ITEM_REPORT WHERE Report_Type = 'LOST' AND Status = 'OPEN' ORDER BY Report_ID"
    );
    for (const { Report_ID } of lostReports) {
        const report = await sync.getReport(Report_ID);
        const matches = await sync.findMatches(report, 3);
        console.log(`\n[LOST #${report.Report_ID}] ${report.Item_Name} — "${report.Description}"`);
        if (matches.length === 0) {
            console.log(`    no FOUND report above the ${sync.MATCH_THRESHOLD} threshold`);
        }
        for (const match of matches) {
            console.log(`    -> FOUND #${match.Report_ID} ${match.Item_Name} @ ${match.Location}  score=${match.Similarity}`);
        }
    }

    heading("7. KEYWORD vs SEMANTIC");
    const phrase = "power adapter";
    const [keywordRows] = await pool.query(
        "SELECT Report_ID, Item_Name FROM ITEM_REPORT WHERE Report_Type = 'LOST' AND (Item_Name LIKE ? OR Description LIKE ?)",
        [`%${phrase}%`, `%${phrase}%`]
    );
    const semanticRows = await sync.semanticSearch(phrase, { type: "LOST", limit: 3 });
    console.log(`Search LOST reports for "${phrase}"`);
    console.log(`  Keyword (LIKE) : ${keywordRows.length} result(s) ${keywordRows.map((r) => `#${r.Report_ID} ${r.Item_Name}`).join(", ")}`);
    console.log(`  Semantic       : ${semanticRows.map((r) => `#${r.Report_ID} ${r.Item_Name} (${r.Similarity})`).join(", ")}`);
}

main()
    .catch((error) => {
        console.error("Demo failed:", error.response ? JSON.stringify(error.response.data) : error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
