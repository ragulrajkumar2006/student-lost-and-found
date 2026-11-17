-- =====================================================================
-- 06_rbac_views.sql  —  Role-based access control inside MySQL
--
-- The application stores each user's role in STUDENT.Role and the
-- backend checks it on every request (JWT + middleware). This script
-- adds a second, database-level layer using MySQL roles:
--
--   lf_student_role : read the public item board (a VIEW that hides
--                     e-mail / phone / password hash), create reports
--                     and claims, call read-only routines
--   lf_admin_role   : full data access on lost_found_db plus all routines
--
-- Two local demo accounts show the roles in action. Their passwords are
-- demo values for a local machine only.
-- =====================================================================

USE lost_found_db;

-- ---------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------

-- Public item board: no personal contact data exposed
CREATE OR REPLACE VIEW vw_item_board AS
SELECT  r.Report_ID,
        r.Item_Name,
        r.Description,
        r.Report_Type,
        r.Location,
        r.Date_Reported,
        r.Status,
        s.Name AS Reported_By
FROM ITEM_REPORT r
JOIN STUDENT s ON s.Student_ID = r.Student_ID;

-- Admin view: full claim history with claimant, item and return details
CREATE OR REPLACE VIEW vw_claim_history AS
SELECT  c.Claim_ID,
        c.Claim_Date,
        c.Claim_Status,
        c.Remarks          AS Claim_Remarks,
        cs.Name            AS Claimant_Name,
        cs.Email           AS Claimant_Email,
        r.Report_ID,
        r.Item_Name,
        r.Location,
        fs.Name            AS Finder_Name,
        rt.Return_ID,
        rt.Returned_Date,
        rt.Remarks         AS Return_Remarks
FROM CLAIM c
JOIN STUDENT cs     ON cs.Student_ID = c.Claimant_Student_ID
JOIN ITEM_REPORT r  ON r.Report_ID   = c.Report_ID
JOIN STUDENT fs     ON fs.Student_ID = r.Student_ID
LEFT JOIN ITEM_RETURN rt ON rt.Claim_ID = c.Claim_ID;

-- ---------------------------------------------------------------------
-- Roles and privileges
-- ---------------------------------------------------------------------
CREATE ROLE IF NOT EXISTS 'lf_student_role', 'lf_admin_role';

-- Student role: least privilege
GRANT SELECT          ON lost_found_db.vw_item_board TO 'lf_student_role';
GRANT INSERT          ON lost_found_db.ITEM_REPORT   TO 'lf_student_role';
GRANT INSERT          ON lost_found_db.CLAIM         TO 'lf_student_role';
GRANT EXECUTE ON PROCEDURE lost_found_db.GetLostItems          TO 'lf_student_role';
GRANT EXECUTE ON FUNCTION  lost_found_db.GetStudentReportCount TO 'lf_student_role';

-- Admin role: full data management on this database only
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE, SHOW VIEW
    ON lost_found_db.* TO 'lf_admin_role';

-- ---------------------------------------------------------------------
-- Demo accounts (localhost only)
-- ---------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'lf_student_demo'@'localhost' IDENTIFIED BY 'StudentDemo#2026';
CREATE USER IF NOT EXISTS 'lf_admin_demo'@'localhost'   IDENTIFIED BY 'AdminDemo#2026';

GRANT 'lf_student_role' TO 'lf_student_demo'@'localhost';
GRANT 'lf_admin_role'   TO 'lf_admin_demo'@'localhost';

SET DEFAULT ROLE 'lf_student_role' TO 'lf_student_demo'@'localhost';
SET DEFAULT ROLE 'lf_admin_role'   TO 'lf_admin_demo'@'localhost';

-- Inspect with:
--   SHOW GRANTS FOR 'lf_student_role';
--   SHOW GRANTS FOR 'lf_admin_role';
