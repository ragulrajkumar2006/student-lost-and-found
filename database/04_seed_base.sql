-- =====================================================================
-- 04_seed_base.sql  —  Original sample data (FRESH INSTALL ONLY)
--
-- These are the rows inserted on 2026-11-03. The live database already
-- contains them, so do NOT run this file against it.
-- Demo passwords: students = Student@123, admin = Admin@123
-- =====================================================================

USE lost_found_db;

INSERT INTO STUDENT (Name, Email, Phone, Password_Hash, Role) VALUES
('Arun Kumar',   'arun@gmail.com',    '9876543210', '$2b$10$ZHH3L8Ao9G94G1MbgTyPeOin8CpE0KKFI7moUWjW/955G2v852Ar6', 'STUDENT'),
('Priya Sharma', 'priya@gmail.com',   '9876543211', '$2b$10$ZHH3L8Ao9G94G1MbgTyPeOin8CpE0KKFI7moUWjW/955G2v852Ar6', 'STUDENT'),
('Rahul Raj',    'rahul@gmail.com',   '9876543212', '$2b$10$ZHH3L8Ao9G94G1MbgTyPeOin8CpE0KKFI7moUWjW/955G2v852Ar6', 'STUDENT'),
('Admin User',   'admin@college.edu', '9876543213', '$2b$10$f/EbVMJHvIPZ/6KYr3X.me6Pl4YwWPTKWT/cOi2SkorPzeWtF1i.i', 'ADMIN');

INSERT INTO ITEM_REPORT
(Student_ID, Item_Name, Description, Report_Type, Location, Date_Reported, Status) VALUES
(1, 'Black Wallet',         'Black leather wallet with cards inside',            'LOST',  'Library',   '2026-11-01', 'OPEN'),
(2, 'Blue Water Bottle',    'Blue steel water bottle',                           'FOUND', 'Classroom', '2026-11-02', 'OPEN'),
(3, 'Wireless Earbuds',     'White wireless earbuds in a small case',            'LOST',  'Canteen',   '2026-11-02', 'OPEN'),
(2, 'Black Leather Wallet', 'Dark black leather wallet found near reading area', 'FOUND', 'Library',   '2026-11-03', 'OPEN');

-- Claim 1: Arun claims the found wallet; claim 2: Rahul claims the bottle
INSERT INTO CLAIM (Report_ID, Claimant_Student_ID, Claim_Date, Claim_Status, Remarks) VALUES
(4, 1, '2026-11-03', 'PENDING', 'This wallet belongs to me. It contains my identification cards.'),
(2, 3, '2026-11-03', 'PENDING', 'Testing automatic approval trigger.');

-- UPDATE fires AfterClaimApproval -> reports 4 and 2 become MATCHED
UPDATE CLAIM SET Claim_Status = 'APPROVED',
       Remarks = 'Ownership verified by admin. Claim approved.'
WHERE Claim_ID = 1;
UPDATE CLAIM SET Claim_Status = 'APPROVED' WHERE Claim_ID = 2;

-- INSERT fires AfterItemReturnInsert -> report 4 becomes CLOSED
INSERT INTO ITEM_RETURN (Claim_ID, Returned_Date, Remarks) VALUES
(1, '2026-11-03', 'Wallet successfully returned to Arun Kumar.');

-- Arun's own LOST report for the wallet is closed as well
UPDATE ITEM_REPORT SET Status = 'CLOSED' WHERE Report_ID = 1;
