-- =====================================================================
-- 02_migrate_existing.sql
--
-- Upgrades the database created on 2026-11-03 to the final schema.
-- Run ONCE on the existing lost_found_db. No tables are dropped.
--
-- Changes and why:
--   1. Role / Status / Claim_Status were nullable  -> NOT NULL
--      (every row must have a role/state; NULL has no meaning here)
--   2. UNIQUE(Report_ID, Claimant_Student_ID) on CLAIM
--      (stops one student from claiming the same item twice)
--   3. Composite index on ITEM_REPORT(Report_Type, Status)
--      (listing and matching always filter on these two columns)
--   4. Placeholder password hashes replaced with real bcrypt hashes
--   5. Status of reports 1 and 4 corrected: the wallet was returned on
--      2026-11-03 (ITEM_RETURN row 1) before the return trigger existed
-- =====================================================================

USE lost_found_db;

ALTER TABLE STUDENT
    MODIFY Role ENUM('STUDENT', 'ADMIN') NOT NULL DEFAULT 'STUDENT';

ALTER TABLE ITEM_REPORT
    MODIFY Status ENUM('OPEN', 'MATCHED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    ADD INDEX idx_report_type_status (Report_Type, Status);

ALTER TABLE CLAIM
    MODIFY Claim_Status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    ADD CONSTRAINT uq_claim_report_student UNIQUE (Report_ID, Claimant_Student_ID);

-- Demo passwords: students = Student@123, admin = Admin@123 (bcrypt, cost 10)
UPDATE STUDENT
SET Password_Hash = '$2b$10$ZHH3L8Ao9G94G1MbgTyPeOin8CpE0KKFI7moUWjW/955G2v852Ar6'
WHERE Role = 'STUDENT';

UPDATE STUDENT
SET Password_Hash = '$2b$10$f/EbVMJHvIPZ/6KYr3X.me6Pl4YwWPTKWT/cOi2SkorPzeWtF1i.i'
WHERE Role = 'ADMIN';

-- Wallet found (report 4) was handed back to Arun (claim 1 / return 1),
-- so both the FOUND report and Arun's own LOST report (1) are closed.
UPDATE ITEM_REPORT SET Status = 'CLOSED' WHERE Report_ID IN (1, 4);
