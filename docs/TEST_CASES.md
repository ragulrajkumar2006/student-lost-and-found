# Test Cases and Results

All results below were produced on 2026-11-15 on the development machine (macOS, Apple Silicon).
Raw outputs: `docs/test_results.txt` (API), `docs/sql_outputs.txt` (SQL), `docs/vector_demo_output.txt` (Qdrant), `docs/screenshots/` (UI).

## A. Automated API tests — `cd backend && npm test`

Result: **23 / 23 passed**.

| ID | Area | Test | Expected | Result |
|---|---|---|---|---|
| TC01 | Health | MySQL, Qdrant, embedding service reachable | all `up`, HTTP 200 | Pass |
| TC02 | Registration | Register new student | 201, role STUDENT, JWT returned, password stored as `$2b$10$…` bcrypt hash | Pass |
| TC03 | Registration | Duplicate email | 409 "This email is already registered" | Pass |
| TC04 | Validation | Bad name, email, phone, password | 400 with 4 validation messages | Pass |
| TC05 | Login | Wrong password / correct password / admin | 401 "Invalid email or password" / 200 + token / role ADMIN | Pass |
| TC06 | Auth | No token, tampered token, valid token on `/api/auth/me` | 401 / 401 / 200 | Pass |
| TC07 | Authorization | Student calls 4 admin-only routes | 403 on each | Pass |
| TC08 | Validation | Report with missing fields / future date | 400 | Pass |
| TC09 | LOST report | Create LOST report | 201, `vectorSync: synced`, Qdrant payload LOST/OPEN | Pass |
| TC10 | FOUND report + matching | Create FOUND "dark blue sweatshirt" | LOST "navy hoodie" returned as match, only LOST type, score ≥ 0.35 | Pass |
| TC11 | Vector READ | Admin reads vector record | 384 dimensions, payload FOUND | Pass |
| TC12 | Search | Keyword "hoodie" vs semantic "navy hoodie" (FOUND) | keyword misses sweatshirt, semantic finds it | Pass |
| TC13 | Trigger | Claim a LOST report / claim own report | 400 "Only FOUND items can be claimed" / 400 "You cannot claim an item you reported yourself" | Pass |
| TC14 | Claim | Submit claim, then duplicate | 201 PENDING / 409 "You have already claimed this item" | Pass |
| TC15 | Authorization | Student approves a claim | 403 | Pass |
| TC16 | Trigger | Record return before approval | 400 "A return can only be recorded for an APPROVED claim" | Pass |
| TC17 | Approval | Admin approves | claim APPROVED, report MATCHED in MySQL **and** Qdrant | Pass |
| TC18 | Return | Admin records return, then again | 201, report CLOSED in MySQL and Qdrant / 409 duplicate; appears in student's returns | Pass |
| TC19 | Rejection | Reject without reason / with reason | 400 / 200 REJECTED | Pass |
| TC20 | Claim DELETE | Other user withdraws / claimant withdraws | 403 / 200 | Pass |
| TC21 | Sync (update) | Other student edits / owner edits description | 403 / 200, re-embedded, Qdrant point count unchanged (no duplicate) | Pass |
| TC22 | Sync (delete) | Owner deletes report | removed from MySQL and Qdrant | Pass |
| TC23 | Sync | Compare counts | MySQL reports = Qdrant points | Pass |

The tests create their own users and data and delete everything afterwards (verified: 0 test users left, Qdrant point count back to its previous value).

## B. Database-level tests — `docs/sql_outputs.txt`

| ID | Test | Expected | Result |
|---|---|---|---|
| DB01 | Claim own report (INSERT) | ERROR 1644 "You cannot claim an item you reported yourself" | Pass |
| DB02 | Claim a LOST report | ERROR 1644 "Only FOUND items can be claimed" | Pass |
| DB03 | Claim a returned (CLOSED) item | ERROR 1644 "This item has already been returned" | Pass |
| DB04 | Return for a PENDING claim | ERROR 1644 "A return can only be recorded for an APPROVED claim" | Pass |
| DB05 | Same student claims same item twice | ERROR 1062 duplicate on `uq_claim_report_student` | Pass |
| DB06 | `CALL ApproveClaim` with two competing claims | chosen claim APPROVED, other REJECTED, report MATCHED | Pass |
| DB07 | `CALL RecordItemReturn` | report CLOSED | Pass |
| DB08 | DELETE report | claims and return removed by ON DELETE CASCADE | Pass |
| DB09 | `lf_student_demo` reads `vw_item_board` | rows returned | Pass |
| DB10 | `lf_student_demo` reads STUDENT / updates CLAIM | ERROR 1142 SELECT / UPDATE denied | Pass |
| DB11 | `lf_admin_demo` reads CLAIM / drops CLAIM | rows returned / ERROR 1142 DROP denied | Pass |

## C. Vector database — `npm run vector-demo`

| ID | Operation | Result |
|---|---|---|
| VD01 | CREATE point 900001 | inserted, 384 dimensions |
| VD02 | READ by id | payload + vector returned |
| VD03 | UPDATE payload | status OPEN → MATCHED |
| VD04 | UPDATE vector (same id) | point count unchanged — no duplicate |
| VD05 | SIMILARITY SEARCH "red rucksack on the sports field" | top hit = the red backpack point (0.44) |
| VD06 | DELETE | retrieve returns 0 records |
| VD07 | LOST → FOUND matching on real data | Earbuds 0.72, Charger→Power Adapter 0.65, Calculator 0.76, ID card 0.86; Umbrella and Glasses: no match above 0.35 (correct) |
| VD08 | Keyword vs semantic "power adapter" (LOST) | keyword 0 results; semantic finds Laptop Charger |

## D. User-interface walkthrough — `docs/screenshots/`

Performed by driving the real UI in a headless browser (Brave) — forms were typed and buttons clicked.

| ID | Scenario | Screenshot | Result |
|---|---|---|---|
| UI01 | Landing page with live counts | 01_landing | Pass |
| UI02 | Registration form | 02_register | Pass |
| UI03 | Invalid login shows error | 03_login_invalid | Pass |
| UI04 | Student dashboard | 04_student_dashboard | Pass |
| UI05 | Browse items | 05_browse_items | Pass |
| UI06 | Keyword search "charger" in FOUND → 0 results | 06_keyword_search_charger | Pass |
| UI07 | Smart (AI) search "charger" → Power Adapter first | 07_semantic_search_charger | Pass |
| UI08 | Report FOUND umbrella → LOST "Black Umbrella" suggested (0.92) | 08, 09 | Pass |
| UI09 | Report lost form | 10_report_lost_form | Pass |
| UI10 | Item details with claim button and similar items | 11_item_details | Pass |
| UI11 | Matching suggestions page | 12_matching_suggestions | Pass |
| UI12 | Claim form | 13_submit_claim_form | Pass |
| UI13 | My reports / My claims | 14, 15 | Pass |
| UI14 | Student opens /admin → Access denied | 16_student_blocked_from_admin | Pass |
| UI15 | Responsive mobile layout (390 px) | 17_mobile_dashboard | Pass |
| UI16 | Admin dashboard incl. Qdrant sync status | 18_admin_dashboard | Pass |
| UI17 | Admin approves claim → APPROVED | 19, 20 | Pass |
| UI18 | Admin records return → appears in history, item CLOSED | 21, 22, 23 | Pass |
