# Viva Preparation Guide

Short, honest answers you can give in your own words. Each answer points to the file that proves it.

## 1. Project and design

**Q: What problem does the project solve?**
Lost items on campus are reported on notice boards or WhatsApp groups and are rarely recovered. Our system keeps one structured record of every lost and found item, suggests likely matches automatically, and tracks every claim and return so there is an audit trail.

**Q: Why four tables? What are the relationships?**
- STUDENT 1 — N ITEM_REPORT (a student files many reports; every report has exactly one reporter).
- STUDENT 1 — N CLAIM (a student can make many claims).
- ITEM_REPORT 1 — N CLAIM (a found item can be claimed by several people; admin decides).
- CLAIM 1 — 0..1 ITEM_RETURN (only an approved claim ends in a return; `Claim_ID` is UNIQUE in ITEM_RETURN).
See `docs/diagrams/er_diagram.png`.

**Q: Why are LOST and FOUND in one table instead of two?**
They have exactly the same attributes. One table with a `Report_Type` ENUM avoids duplicate structure, makes listing and searching one query, and makes LOST↔FOUND matching a simple filter on one column.

**Q: Explain ER-to-relational mapping for your design.**
Step 1: each strong entity → a table with its key as the primary key. Step 3 (1:1): RESULTS_IN → foreign key `Claim_ID` placed in ITEM_RETURN (the side with total participation) plus UNIQUE. Step 4 (1:N): REPORTS, MAKES, RECEIVES → foreign key on the N side (`ITEM_REPORT.Student_ID`, `CLAIM.Claimant_Student_ID`, `CLAIM.Report_ID`). No M:N relationships, so no extra relationship table was needed.

**Q: Which normal form are your tables in?**
3NF. Every non-key attribute depends on the whole primary key and nothing else (no partial or transitive dependencies). For example, the claimant's name is not stored in CLAIM — it is fetched with a JOIN on `Claimant_Student_ID`.

**Q: Which constraints did you use?**
PRIMARY KEY on every table, FOREIGN KEY with ON DELETE CASCADE, UNIQUE (`Email`, `ITEM_RETURN.Claim_ID`, and the composite `(Report_ID, Claimant_Student_ID)`), NOT NULL on all required columns, ENUM to restrict values, and triggers for rules a CHECK constraint cannot express (they need to look at other tables).

**Q: What did you change from the first version of the schema, and why?**
`Role`, `Status` and `Claim_Status` were nullable — a NULL status has no meaning, so they became NOT NULL. We added UNIQUE(Report_ID, Claimant_Student_ID) so a student cannot claim the same item twice, and an index on (Report_Type, Status) because almost every query filters on those columns (`database/02_migrate_existing.sql`).

## 2. SQL

**Q: Difference between a nested query and a correlated query?**
A nested query runs once and its result is used by the outer query (Q11: `WHERE Student_ID IN (SELECT ...)`). A correlated subquery refers to a column of the outer row, so it runs once per outer row (Q14: `WHERE I.Student_ID = S.Student_ID`).

**Q: What is a CTE? Why a recursive CTE?**
A CTE (`WITH name AS (...)`) is a named temporary result used to break a big query into readable steps (Q17). A recursive CTE refers to itself; we use it to generate every date in a range (Q18) so days with zero reports still appear — a plain GROUP BY would skip them.

**Q: Why LEFT JOIN in Q8?**
INNER JOIN would drop students who have no reports. LEFT JOIN keeps every student and gives COUNT = 0 for them.

**Q: Explain your stored procedures.**
- `GetLostItems()` — returns all LOST reports.
- `ApproveClaim(id, remarks)` — in one transaction: approves the claim, rejects all other pending claims on the same item. If anything fails it ROLLBACKs.
- `RecordItemReturn(claim, date, remarks)` — inserts the return and returns the new id.

**Q: Why is "reject other claims" in a procedure and not in a trigger?**
MySQL does not allow a trigger on CLAIM to update the CLAIM table itself (error 1442). So the multi-row logic is in `ApproveClaim`, and the trigger only updates ITEM_REPORT.

**Q: Explain your triggers.**
- `AfterClaimApproval` — claim becomes APPROVED → report becomes MATCHED.
- `BeforeClaimInsert` — blocks claims on LOST reports, on your own report, and on CLOSED items (`SIGNAL SQLSTATE '45000'`); fills Claim_Date.
- `BeforeItemReturnInsert` — a return needs an APPROVED claim.
- `AfterItemReturnInsert` — return recorded → report becomes CLOSED.

**Q: Why is approval MATCHED but not CLOSED?**
Approval means the admin believes the claimant is the owner. The item is only closed when it is physically handed over, which is a separate event recorded in ITEM_RETURN.

**Q: Stored function vs procedure?**
A function returns one value and can be used inside a SELECT (`GetStudentReportCount(Student_ID)` in the admin users list). A procedure is called with CALL and can return result sets and do transactions.

## 3. Vector database (Qdrant)

**Q: Why do you need a vector database at all?**
Students describe the same object with different words: "charger" vs "power adapter", "purse" vs "wallet". SQL `LIKE` only finds the same letters. An embedding model converts each description into 384 numbers that represent its meaning; similar meanings give nearby vectors. Qdrant finds the nearest vectors quickly. Demo: keyword search "power adapter" → 0 results, semantic search → Laptop Charger (`docs/vector_demo_output.txt`, section 7).

**Q: Is Qdrant replacing MySQL?**
No. MySQL is the source of truth (all data, constraints, transactions). Qdrant only stores one vector per report plus a small payload for filtering. If Qdrant is lost, `npm run reindex` rebuilds it completely from MySQL.

**Q: How do you keep MySQL and Qdrant in sync?**
Write MySQL first, then Qdrant (`backend/services/reportSync.js`):
- create → embed + upsert (point id = Report_ID),
- text edited → re-embed + upsert with the same id (replaces, no duplicate — tested in TC21),
- status change → payload update only,
- delete → delete point.
If Qdrant is down the report is still saved; the admin "Rebuild index" button repairs any drift. The admin dashboard shows MySQL count vs Qdrant count.

**Q: What does the similarity score mean? Is 0.80 an 80% chance?**
No. It is the cosine similarity between two vectors (1 = same direction/meaning, 0 = unrelated). It is a closeness measure, not a probability. We hide matches below 0.35.

**Q: How do you make sure two LOST reports are never "matched"?**
The Qdrant query has a payload filter: `report_type` must be the opposite type, `status` must be OPEN, and `student_id` must not be the same student. Then results are re-checked against MySQL.

**Q: Which CRUD operations did you implement on Qdrant?**
Create (upsert), Read (retrieve by id, `/api/admin/vector/:id`), Update (payload update and vector replacement), Delete, plus filtered similarity search. All shown in `npm run vector-demo`.

**Q: Why all-MiniLM-L6-v2?**
Small (≈ 80 MB), fast on a laptop CPU, good quality for short sentences, 384 dimensions keep storage small. We normalise vectors so cosine distance works correctly.

**Q: Why a separate Python service?**
The model library (sentence-transformers) is Python. Loading it once in a FastAPI process and calling it over HTTP keeps the Node backend simple and avoids loading the model on every request.

## 4. Backend, authentication, authorization

**Q: How does login work?**
Register: password → bcrypt hash (cost 10) → stored in `Password_Hash`. Login: find user by email, `bcrypt.compare` with the hash; if correct, issue a JWT signed with `JWT_SECRET` containing the user id and role. The frontend sends it in `Authorization: Bearer ...` on every request.

**Q: Why bcrypt and not SHA-256?**
bcrypt is deliberately slow and adds a random salt to each password, so identical passwords get different hashes and brute-forcing is expensive.

**Q: Can a student make themselves admin by editing the token?**
No. Changing the token changes the signature, so `jwt.verify` fails → 401 (tested in TC06). Registration always creates STUDENT; the role is never taken from user input.

**Q: Where is role-based access control enforced?**
Three layers: (1) the UI hides admin pages; (2) the server checks every request with `authenticate` + `requireRole('ADMIN')` (TC07, TC15); (3) MySQL roles — `lf_student_role` can read only the view and cannot read STUDENT or UPDATE CLAIM; `lf_admin_role` can manage data but cannot DROP tables (`docs/sql_outputs.txt`, last section). Also, an admin cannot approve their own claim.

**Q: How do you prevent SQL injection?**
All queries use `?` placeholders; the mysql2 driver escapes values. User input is never concatenated into SQL. Dynamic parts (column names in UPDATE) come from a fixed whitelist, not from the user.

**Q: How are errors handled?**
Express 5 forwards errors from async handlers to one error handler. Validation → 400 with a list of problems, trigger SIGNAL → 400 with the trigger's message, duplicate key → 409, not logged in → 401, wrong role → 403, unknown → 500 without leaking details.

## 5. Things to be ready to demo live

1. Log in as a student → Report found → type "Black folding umbrella" → see the match.
2. Browse → Found → search "charger" (Keyword: 0) → switch to Smart (AI) → Power Adapter.
3. Open an item → "This is mine" → submit claim.
4. Try `/admin` as a student → Access denied.
5. Log in as admin → Manage claims → Approve → item MATCHED → Record return → CLOSED → Return history.
6. Admin dashboard → Qdrant count equals MySQL count → "Rebuild index".
7. Terminal: `npm test` (23 passing) and `npm run vector-demo`.

## 6. Honest limitations (good to mention)

- JWT is stored in localStorage (simple for a mini-project; an httpOnly cookie is safer against XSS).
- If an admin changes a user's role, the old token keeps the old role until it expires (8 h).
- No image upload; matching uses text only.
- The similarity threshold (0.35) was chosen by testing on our demo data, not tuned on a large dataset.
