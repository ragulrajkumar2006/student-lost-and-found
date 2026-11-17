// End-to-end API tests (Node's built-in test runner — no extra libraries).
// Requires MySQL, Qdrant and the embedding service to be running.
// Run: npm test
//
// The tests register two fresh students, run the complete lost -> found ->
// claim -> approve -> return workflow, check MySQL and Qdrant stay in sync,
// and finally delete everything they created.
require("dotenv").config();

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const app = require("../server");
const pool = require("../db");
const vectorStore = require("../services/vectorStore");

let server;
let baseUrl;
const runId = Date.now();
const createdStudentIds = [];
const createdReportIds = [];
const ctx = {};

async function api(method, path, { token, body } = {}) {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` })
        },
        body: body ? JSON.stringify(body) : undefined
    });
    return { status: response.status, body: await response.json() };
}

async function registerStudent(label) {
    const res = await api("POST", "/api/auth/register", {
        body: {
            name: `Test ${label}`,
            email: `test.${label.toLowerCase()}.${runId}@college.edu`,
            phone: "9000000000",
            password: "Testing@123"
        }
    });
    assert.equal(res.status, 201);
    createdStudentIds.push(res.body.user.Student_ID);
    return res.body;
}

async function createReport(token, body) {
    const res = await api("POST", "/api/reports", { token, body });
    if (res.status === 201) createdReportIds.push(res.body.report.Report_ID);
    return res;
}

async function reportStatus(reportId) {
    const [[row]] = await pool.query("SELECT Status FROM ITEM_REPORT WHERE Report_ID = ?", [reportId]);
    return row ? row.Status : null;
}

async function qdrantPoint(reportId) {
    const [point] = await vectorStore.retrievePoints([reportId]);
    return point || null;
}

before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
    if (createdReportIds.length > 0) {
        await vectorStore.deletePoints(createdReportIds).catch(() => {});
    }
    if (createdStudentIds.length > 0) {
        // ON DELETE CASCADE removes their reports, claims and returns
        await pool.query("DELETE FROM STUDENT WHERE Student_ID IN (?)", [createdStudentIds]);
    }
    await pool.end();
    server.close();
});

// ---------------------------------------------------------------- health

test("TC01 health check: MySQL, Qdrant and embedding service are up", async () => {
    const res = await api("GET", "/api/health");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.services, { mysql: "up", qdrant: "up", embedding: "up" });
});

// ---------------------------------------------------------------- authentication

test("TC02 registration creates a STUDENT and returns a JWT", async () => {
    ctx.alice = await registerStudent("Alice");
    assert.equal(ctx.alice.user.Role, "STUDENT");
    assert.ok(ctx.alice.token.split(".").length === 3, "token is a JWT");

    const [[row]] = await pool.query("SELECT Password_Hash FROM STUDENT WHERE Student_ID = ?", [ctx.alice.user.Student_ID]);
    assert.match(row.Password_Hash, /^\$2b\$10\$/, "password stored as bcrypt hash");
    assert.notEqual(row.Password_Hash, "Testing@123");

    ctx.bob = await registerStudent("Bob");
});

test("TC03 duplicate email is rejected with 409", async () => {
    const res = await api("POST", "/api/auth/register", {
        body: { name: "Dup", email: ctx.alice.user.Email, password: "Testing@123" }
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, "This email is already registered");
});

test("TC04 invalid registration input is rejected with 400 and details", async () => {
    const res = await api("POST", "/api/auth/register", {
        body: { name: "X", email: "not-an-email", phone: "123", password: "short" }
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.details.length, 4);
});

test("TC05 login with wrong password fails, correct password succeeds", async () => {
    const wrong = await api("POST", "/api/auth/login", {
        body: { email: ctx.alice.user.Email, password: "Wrong@123" }
    });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error, "Invalid email or password");

    const ok = await api("POST", "/api/auth/login", {
        body: { email: ctx.alice.user.Email, password: "Testing@123" }
    });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);

    const admin = await api("POST", "/api/auth/login", {
        body: { email: "admin@college.edu", password: "Admin@123" }
    });
    assert.equal(admin.status, 200);
    assert.equal(admin.body.user.Role, "ADMIN");
    ctx.adminToken = admin.body.token;
});

test("TC06 protected routes reject missing and tampered tokens", async () => {
    const missing = await api("GET", "/api/auth/me");
    assert.equal(missing.status, 401);

    const tampered = await api("GET", "/api/auth/me", { token: `${ctx.alice.token}x` });
    assert.equal(tampered.status, 401);

    const me = await api("GET", "/api/auth/me", { token: ctx.alice.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.Email, ctx.alice.user.Email);
});

test("TC07 a student cannot access admin-only routes (403)", async () => {
    for (const [method, path] of [
        ["GET", "/api/admin/stats"],
        ["GET", "/api/claims"],
        ["GET", "/api/returns"],
        ["POST", "/api/admin/reindex"]
    ]) {
        const res = await api(method, path, { token: ctx.alice.token });
        assert.equal(res.status, 403, `${method} ${path}`);
    }
});

// ---------------------------------------------------------------- reports + vectors

test("TC08 report validation: missing fields and future dates are rejected", async () => {
    const missing = await createReport(ctx.alice.token, { reportType: "LOST" });
    assert.equal(missing.status, 400);

    const future = await createReport(ctx.alice.token, {
        itemName: "Hoodie", description: "Navy hoodie", reportType: "LOST",
        location: "Seminar Hall", dateReported: "2099-01-01"
    });
    assert.equal(future.status, 400);
    assert.match(future.body.details[0], /future/);
});

test("TC09 creating a LOST report saves it in MySQL and Qdrant", async () => {
    const res = await createReport(ctx.alice.token, {
        itemName: "Navy Hoodie",
        description: "Lost my navy blue hoodie with the college logo on the back",
        reportType: "LOST",
        location: "Seminar Hall",
        dateReported: "2026-11-14"
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.vectorSync, "synced");
    ctx.lostId = res.body.report.Report_ID;

    const point = await qdrantPoint(ctx.lostId);
    assert.equal(point.payload.report_type, "LOST");
    assert.equal(point.payload.status, "OPEN");
});

test("TC10 creating a FOUND report returns the LOST report as a semantic match", async () => {
    const res = await createReport(ctx.bob.token, {
        itemName: "Sweatshirt",
        description: "Found a dark blue sweatshirt with the college emblem printed on it",
        reportType: "FOUND",
        location: "Seminar Hall",
        dateReported: "2026-11-15"
    });
    assert.equal(res.status, 201);
    ctx.foundId = res.body.report.Report_ID;

    const match = res.body.matches.find((m) => m.Report_ID === ctx.lostId);
    assert.ok(match, "Alice's LOST hoodie is suggested as a match");
    assert.ok(match.Similarity >= 0.35);
    assert.ok(res.body.matches.every((m) => m.Report_Type === "LOST"), "only opposite type is suggested");
});

test("TC11 admin can read a stored vector record (384 dimensions)", async () => {
    const res = await api("GET", `/api/admin/vector/${ctx.foundId}`, { token: ctx.adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.dimensions, 384);
    assert.equal(res.body.payload.report_type, "FOUND");
});

test("TC12 keyword search needs the exact word; semantic search understands meaning", async () => {
    const keyword = await api("GET", "/api/search/keyword?q=hoodie&type=FOUND", { token: ctx.alice.token });
    assert.equal(keyword.status, 200);
    assert.ok(!keyword.body.results.some((r) => r.Report_ID === ctx.foundId), "LIKE does not find 'sweatshirt'");

    const semantic = await api("GET", "/api/search/semantic?q=navy%20hoodie&type=FOUND", { token: ctx.alice.token });
    assert.equal(semantic.status, 200);
    assert.ok(semantic.body.results.some((r) => r.Report_ID === ctx.foundId), "semantic search finds the sweatshirt");
});

// ---------------------------------------------------------------- claims + returns

test("TC13 claim rules enforced by trigger: no LOST claims, no claiming your own item", async () => {
    const lostClaim = await api("POST", "/api/claims", {
        token: ctx.bob.token,
        body: { reportId: ctx.lostId, remarks: "Trying to claim a lost report" }
    });
    assert.equal(lostClaim.status, 400);
    assert.equal(lostClaim.body.error, "Only FOUND items can be claimed");

    const ownClaim = await api("POST", "/api/claims", {
        token: ctx.bob.token,
        body: { reportId: ctx.foundId, remarks: "Claiming my own found item" }
    });
    assert.equal(ownClaim.status, 400);
    assert.equal(ownClaim.body.error, "You cannot claim an item you reported yourself");
});

test("TC14 student submits a claim; duplicate claim is rejected", async () => {
    const res = await api("POST", "/api/claims", {
        token: ctx.alice.token,
        body: { reportId: ctx.foundId, remarks: "It has my initials A.T. inside the hood" }
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.claim.Claim_Status, "PENDING");
    ctx.claimId = res.body.claim.Claim_ID;

    const duplicate = await api("POST", "/api/claims", {
        token: ctx.alice.token,
        body: { reportId: ctx.foundId, remarks: "Submitting the same claim again" }
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error, "You have already claimed this item");
});

test("TC15 a student cannot approve claims", async () => {
    const res = await api("PATCH", `/api/claims/${ctx.claimId}/approve`, { token: ctx.alice.token, body: {} });
    assert.equal(res.status, 403);
});

test("TC16 a return cannot be recorded before the claim is approved", async () => {
    const res = await api("POST", "/api/returns", {
        token: ctx.adminToken,
        body: { claimId: ctx.claimId, remarks: "Too early" }
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "A return can only be recorded for an APPROVED claim");
});

test("TC17 admin approval marks the item MATCHED in MySQL and Qdrant", async () => {
    const res = await api("PATCH", `/api/claims/${ctx.claimId}/approve`, {
        token: ctx.adminToken,
        body: { remarks: "Initials verified" }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.claim.Claim_Status, "APPROVED");
    assert.equal(await reportStatus(ctx.foundId), "MATCHED");
    assert.equal((await qdrantPoint(ctx.foundId)).payload.status, "MATCHED");
});

test("TC18 recording the return closes the item in MySQL and Qdrant", async () => {
    const res = await api("POST", "/api/returns", {
        token: ctx.adminToken,
        body: { claimId: ctx.claimId, returnedDate: "2026-11-15", remarks: "Handed over at admin office" }
    });
    assert.equal(res.status, 201);
    assert.equal(await reportStatus(ctx.foundId), "CLOSED");
    assert.equal((await qdrantPoint(ctx.foundId)).payload.status, "CLOSED");

    const again = await api("POST", "/api/returns", {
        token: ctx.adminToken,
        body: { claimId: ctx.claimId }
    });
    assert.equal(again.status, 409);

    const mine = await api("GET", "/api/returns/mine", { token: ctx.alice.token });
    assert.ok(mine.body.returns.some((r) => r.Claim_ID === ctx.claimId));
});

test("TC19 admin rejects a claim (reason required)", async () => {
    const found = await createReport(ctx.bob.token, {
        itemName: "Steel Flask", description: "Silver steel flask found on a bench",
        reportType: "FOUND", location: "Garden", dateReported: "2026-11-15"
    });
    const claim = await api("POST", "/api/claims", {
        token: ctx.alice.token,
        body: { reportId: found.body.report.Report_ID, remarks: "I think this flask is mine" }
    });

    const noReason = await api("PATCH", `/api/claims/${claim.body.claim.Claim_ID}/reject`, {
        token: ctx.adminToken, body: {}
    });
    assert.equal(noReason.status, 400);

    const rejected = await api("PATCH", `/api/claims/${claim.body.claim.Claim_ID}/reject`, {
        token: ctx.adminToken, body: { remarks: "Could not describe the flask" }
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.claim.Claim_Status, "REJECTED");
});

test("TC20 student withdraws own pending claim (DELETE)", async () => {
    const found = await createReport(ctx.bob.token, {
        itemName: "Pencil Box", description: "Green pencil box with geometry set",
        reportType: "FOUND", location: "Room 204", dateReported: "2026-11-15"
    });
    const claim = await api("POST", "/api/claims", {
        token: ctx.alice.token,
        body: { reportId: found.body.report.Report_ID, remarks: "Green box with my compass inside" }
    });
    const other = await api("DELETE", `/api/claims/${claim.body.claim.Claim_ID}`, { token: ctx.bob.token });
    assert.equal(other.status, 403);

    const res = await api("DELETE", `/api/claims/${claim.body.claim.Claim_ID}`, { token: ctx.alice.token });
    assert.equal(res.status, 200);
});

// ---------------------------------------------------------------- update / delete sync

test("TC21 updating a report re-embeds it without creating a duplicate vector", async () => {
    const before = (await vectorStore.collectionInfo()).points_count;

    const forbidden = await api("PUT", `/api/reports/${ctx.lostId}`, {
        token: ctx.bob.token, body: { location: "Elsewhere" }
    });
    assert.equal(forbidden.status, 403);

    const res = await api("PUT", `/api/reports/${ctx.lostId}`, {
        token: ctx.alice.token,
        body: { description: "Navy blue hooded jacket with the college logo, size M" }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.vectorSync, "synced");

    const afterCount = (await vectorStore.collectionInfo()).points_count;
    assert.equal(afterCount, before, "point count unchanged after update");
});

test("TC22 deleting a report removes it from MySQL and Qdrant", async () => {
    const res = await api("DELETE", `/api/reports/${ctx.lostId}`, { token: ctx.alice.token });
    assert.equal(res.status, 200);
    assert.equal(res.body.vectorSync, "synced");
    assert.equal(await reportStatus(ctx.lostId), null);
    assert.equal(await qdrantPoint(ctx.lostId), null);
});

test("TC23 MySQL and Qdrant hold the same number of reports", async () => {
    const res = await api("GET", "/api/admin/vector-status", { token: ctx.adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.inSync, true);
});
