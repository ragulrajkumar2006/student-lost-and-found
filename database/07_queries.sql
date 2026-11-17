-- =====================================================================
-- 07_queries.sql  —  Demonstration queries for the report / viva
--
-- Run:  mysql -t -v lost_found_db < database/07_queries.sql
-- Output is saved in docs/sql_outputs.txt
--
-- Everything that changes data either works on a temporary row that is
-- removed again, or runs inside a transaction that is rolled back, so the
-- demo data is left exactly as it was.
-- =====================================================================

USE lost_found_db;

-- ---------------------------------------------------------------------
-- 7.1  SIMPLE QUERIES: SELECT, WHERE, ORDER BY
-- ---------------------------------------------------------------------

-- Q1. All OPEN found items, newest first
SELECT Report_ID, Item_Name, Location, Date_Reported
FROM ITEM_REPORT
WHERE Report_Type = 'FOUND' AND Status = 'OPEN'
ORDER BY Date_Reported DESC;

-- Q2. Items reported in the Library or Canteen during November 2026
SELECT Report_ID, Item_Name, Report_Type, Location, Date_Reported
FROM ITEM_REPORT
WHERE Location IN ('Library', 'Canteen')
  AND Date_Reported BETWEEN '2026-11-01' AND '2026-11-30'
ORDER BY Location, Date_Reported;

-- Q3. Keyword search with LIKE (what the 'Keyword search' page runs)
SELECT Report_ID, Item_Name, Description
FROM ITEM_REPORT
WHERE Item_Name LIKE '%card%' OR Description LIKE '%card%';

-- ---------------------------------------------------------------------
-- 7.1  GROUP BY + AGGREGATE FUNCTIONS
-- ---------------------------------------------------------------------

-- Q4. Number of reports of each type and status
SELECT Report_Type, Status, COUNT(*) AS Total
FROM ITEM_REPORT
GROUP BY Report_Type, Status
ORDER BY Report_Type, Status;

-- Q5. Locations with more than one report (HAVING), with first/last dates
SELECT Location,
       COUNT(*)            AS Total_Reports,
       MIN(Date_Reported)  AS First_Report,
       MAX(Date_Reported)  AS Last_Report
FROM ITEM_REPORT
GROUP BY Location
HAVING COUNT(*) > 1
ORDER BY Total_Reports DESC;

-- Q6. Claim outcome summary with percentage of all claims
SELECT Claim_Status,
       COUNT(*) AS Total,
       ROUND(100 * COUNT(*) / (SELECT COUNT(*) FROM CLAIM), 1) AS Percent
FROM CLAIM
GROUP BY Claim_Status;

-- ---------------------------------------------------------------------
-- JOIN QUERIES
-- ---------------------------------------------------------------------

-- Q7. INNER JOIN: every report with the name of the student who filed it
SELECT r.Report_ID, r.Item_Name, r.Report_Type, s.Name AS Reported_By
FROM ITEM_REPORT r
INNER JOIN STUDENT s ON s.Student_ID = r.Student_ID
ORDER BY r.Report_ID;

-- Q8. LEFT JOIN: reports per user, including users with zero reports
SELECT s.Name, s.Role, COUNT(r.Report_ID) AS Total_Reports
FROM STUDENT s
LEFT JOIN ITEM_REPORT r ON r.Student_ID = s.Student_ID
GROUP BY s.Student_ID, s.Name, s.Role
ORDER BY Total_Reports DESC, s.Name;

-- Q9. Four-table JOIN: full claim history (claimant, item, finder, return)
SELECT c.Claim_ID,
       cs.Name        AS Claimant,
       r.Item_Name,
       fs.Name        AS Found_By,
       c.Claim_Status,
       rt.Returned_Date
FROM CLAIM c
JOIN STUDENT cs     ON cs.Student_ID = c.Claimant_Student_ID
JOIN ITEM_REPORT r  ON r.Report_ID   = c.Report_ID
JOIN STUDENT fs     ON fs.Student_ID = r.Student_ID
LEFT JOIN ITEM_RETURN rt ON rt.Claim_ID = c.Claim_ID
ORDER BY c.Claim_ID;

-- Q10. Self-join style pairing: OPEN lost and found items at the SAME location
--      (a simple rule-based match, compared later with the vector search)
SELECT l.Report_ID AS Lost_ID,  l.Item_Name AS Lost_Item,
       f.Report_ID AS Found_ID, f.Item_Name AS Found_Item,
       l.Location
FROM ITEM_REPORT l
JOIN ITEM_REPORT f
  ON f.Location = l.Location
 AND f.Report_Type = 'FOUND'
 AND f.Status = 'OPEN'
WHERE l.Report_Type = 'LOST' AND l.Status = 'OPEN';

-- ---------------------------------------------------------------------
-- 7.5  NESTED QUERIES
-- ---------------------------------------------------------------------

-- Q11. Students who have reported at least one LOST item (IN subquery)
SELECT Name
FROM STUDENT
WHERE Student_ID IN (
    SELECT Student_ID FROM ITEM_REPORT WHERE Report_Type = 'LOST'
);

-- Q12. FOUND items nobody has claimed yet (NOT EXISTS)
SELECT r.Report_ID, r.Item_Name, r.Location
FROM ITEM_REPORT r
WHERE r.Report_Type = 'FOUND'
  AND NOT EXISTS (SELECT 1 FROM CLAIM c WHERE c.Report_ID = r.Report_ID);

-- Q13. The most recently reported item(s) (scalar subquery)
SELECT Report_ID, Item_Name, Date_Reported
FROM ITEM_REPORT
WHERE Date_Reported = (SELECT MAX(Date_Reported) FROM ITEM_REPORT);

-- ---------------------------------------------------------------------
-- 7.4  CORRELATED QUERIES
-- (the inner query refers to the outer row, so it runs once per row)
-- ---------------------------------------------------------------------

-- Q14. Students with more reports than the average student
SELECT S.Name,
       (SELECT COUNT(*) FROM ITEM_REPORT I WHERE I.Student_ID = S.Student_ID) AS Total_Reports
FROM STUDENT S
WHERE (SELECT COUNT(*) FROM ITEM_REPORT I WHERE I.Student_ID = S.Student_ID)
      >
      (SELECT AVG(Report_Count)
       FROM (SELECT COUNT(*) AS Report_Count FROM ITEM_REPORT GROUP BY Student_ID) AS Report_Summary);

-- Q15. For each report, its most recent claim date (correlated in SELECT list)
SELECT r.Report_ID, r.Item_Name,
       (SELECT MAX(c.Claim_Date) FROM CLAIM c WHERE c.Report_ID = r.Report_ID) AS Latest_Claim
FROM ITEM_REPORT r
WHERE r.Report_Type = 'FOUND'
ORDER BY r.Report_ID;

-- Q16. Students who have BOTH lost and found something (correlated EXISTS)
SELECT s.Name
FROM STUDENT s
WHERE EXISTS (SELECT 1 FROM ITEM_REPORT r WHERE r.Student_ID = s.Student_ID AND r.Report_Type = 'LOST')
  AND EXISTS (SELECT 1 FROM ITEM_REPORT r WHERE r.Student_ID = s.Student_ID AND r.Report_Type = 'FOUND');

-- ---------------------------------------------------------------------
-- COMMON TABLE EXPRESSIONS
-- ---------------------------------------------------------------------

-- Q17. CTE: per-student activity summary (reports filed + claims made)
WITH report_counts AS (
    SELECT Student_ID, COUNT(*) AS Reports
    FROM ITEM_REPORT
    GROUP BY Student_ID
),
claim_counts AS (
    SELECT Claimant_Student_ID AS Student_ID, COUNT(*) AS Claims
    FROM CLAIM
    GROUP BY Claimant_Student_ID
)
SELECT s.Name,
       COALESCE(rc.Reports, 0) AS Reports_Filed,
       COALESCE(cc.Claims, 0)  AS Claims_Made
FROM STUDENT s
LEFT JOIN report_counts rc ON rc.Student_ID = s.Student_ID
LEFT JOIN claim_counts  cc ON cc.Student_ID = s.Student_ID
WHERE s.Role = 'STUDENT'
ORDER BY Reports_Filed DESC;

-- Q18. RECURSIVE CTE: one row for EVERY day from 1 to 15 Nov 2026,
--      with the number of LOST/FOUND reports that day (days with none show 0).
--      A plain GROUP BY would skip the empty days entirely.
WITH RECURSIVE calendar (Day) AS (
    SELECT DATE('2026-11-01')
    UNION ALL
    SELECT Day + INTERVAL 1 DAY FROM calendar WHERE Day < '2026-11-15'
)
SELECT c.Day,
       COUNT(CASE WHEN r.Report_Type = 'LOST'  THEN 1 END) AS Lost,
       COUNT(CASE WHEN r.Report_Type = 'FOUND' THEN 1 END) AS Found
FROM calendar c
LEFT JOIN ITEM_REPORT r ON r.Date_Reported = c.Day
GROUP BY c.Day
ORDER BY c.Day;

-- Q19. RECURSIVE CTE: running total of reports, day by day
WITH RECURSIVE days (Day, N) AS (
    SELECT MIN(Date_Reported), 1 FROM ITEM_REPORT
    UNION ALL
    SELECT Day + INTERVAL 1 DAY, N + 1 FROM days
    WHERE Day < (SELECT MAX(Date_Reported) FROM ITEM_REPORT)
)
SELECT d.Day,
       (SELECT COUNT(*) FROM ITEM_REPORT r WHERE r.Date_Reported <= d.Day) AS Cumulative_Reports
FROM days d;

-- ---------------------------------------------------------------------
-- 7.2  UPDATE  and  7.3  DELETE  (on a temporary row)
-- ---------------------------------------------------------------------

-- Q20. INSERT a temporary report, UPDATE it, then DELETE it
INSERT INTO ITEM_REPORT (Student_ID, Item_Name, Description, Report_Type, Location, Date_Reported)
VALUES (3, 'Temp Keychain', 'Silver keychain with two keys', 'FOUND', 'Parking Lot', '2026-11-15');
SET @temp_id = LAST_INSERT_ID();

SELECT Report_ID, Item_Name, Location, Status FROM ITEM_REPORT WHERE Report_ID = @temp_id;

UPDATE ITEM_REPORT
SET Location = 'Parking Lot - Gate 2',
    Description = 'Silver keychain with two keys and a small torch'
WHERE Report_ID = @temp_id;

SELECT Report_ID, Item_Name, Location, Description FROM ITEM_REPORT WHERE Report_ID = @temp_id;

DELETE FROM ITEM_REPORT WHERE Report_ID = @temp_id;

SELECT COUNT(*) AS Rows_Left_With_Temp_ID FROM ITEM_REPORT WHERE Report_ID = @temp_id;

-- Q21. UPDATE with a subquery (inside a transaction, then rolled back):
--      close every FOUND report whose claim has already been returned
START TRANSACTION;
UPDATE ITEM_REPORT
SET Status = 'CLOSED'
WHERE Report_ID IN (
    SELECT c.Report_ID FROM CLAIM c JOIN ITEM_RETURN rt ON rt.Claim_ID = c.Claim_ID
);
SELECT ROW_COUNT() AS Rows_Already_Closed_Or_Updated;
ROLLBACK;

-- Q22. DELETE with a subquery (rolled back): remove REJECTED claims older than 30 days
START TRANSACTION;
DELETE FROM CLAIM
WHERE Claim_Status = 'REJECTED'
  AND Claim_Date < (SELECT CURDATE() - INTERVAL 30 DAY);
SELECT ROW_COUNT() AS Old_Rejected_Claims_Deleted;
ROLLBACK;

-- ---------------------------------------------------------------------
-- 8.1  STORED PROCEDURES AND FUNCTIONS
-- ---------------------------------------------------------------------

-- Q23. Procedure: all LOST reports
CALL GetLostItems();

-- Q24. Function: report count per student
SELECT Student_ID, Name, GetStudentReportCount(Student_ID) AS Report_Count
FROM STUDENT;

-- Q25. Function: pending claims per FOUND report
SELECT Report_ID, Item_Name, GetPendingClaimCount(Report_ID) AS Pending_Claims
FROM ITEM_REPORT
WHERE Report_Type = 'FOUND';

-- ---------------------------------------------------------------------
-- 8.2  TRIGGERS + PROCEDURES: full claim workflow on temporary rows
-- ---------------------------------------------------------------------

-- Q26. Temporary FOUND report (by Priya) with two competing claims
INSERT INTO ITEM_REPORT (Student_ID, Item_Name, Description, Report_Type, Location, Date_Reported)
VALUES (2, 'Temp Headphones', 'Black over-ear headphones', 'FOUND', 'Music Room', '2026-11-15');
SET @rep = LAST_INSERT_ID();

INSERT INTO CLAIM (Report_ID, Claimant_Student_ID, Claim_Date, Remarks)
VALUES (@rep, 1, NULL, 'Arun: they have a scratch on the left cup');   -- Claim_Date filled by trigger
SET @claim_arun = LAST_INSERT_ID();
INSERT INTO CLAIM (Report_ID, Claimant_Student_ID, Claim_Date, Remarks)
VALUES (@rep, 3, '2026-11-15', 'Rahul: I think they are mine');
SET @claim_rahul = LAST_INSERT_ID();

SELECT Claim_ID, Claimant_Student_ID, Claim_Date, Claim_Status FROM CLAIM WHERE Report_ID = @rep;

-- Q27. BeforeClaimInsert trigger blocks invalid claims
--      (each statement below fails with the trigger's message)
-- INSERT INTO CLAIM (Report_ID, Claimant_Student_ID, Claim_Date) VALUES (@rep, 2, CURDATE());
--   -> ERROR 1644 (45000): You cannot claim an item you reported yourself
-- INSERT INTO CLAIM (Report_ID, Claimant_Student_ID, Claim_Date) VALUES (3, 2, CURDATE());
--   -> ERROR 1644 (45000): Only FOUND items can be claimed

-- Q28. ApproveClaim procedure: approves Arun, auto-rejects Rahul;
--      AfterClaimApproval trigger sets the report to MATCHED
CALL ApproveClaim(@claim_arun, 'Scratch on left cup confirmed');

SELECT Claim_ID, Claimant_Student_ID, Claim_Status, Remarks FROM CLAIM WHERE Report_ID = @rep;
SELECT Report_ID, Item_Name, Status FROM ITEM_REPORT WHERE Report_ID = @rep;

-- Q29. RecordItemReturn procedure: BeforeItemReturnInsert checks the claim is
--      APPROVED, AfterItemReturnInsert sets the report to CLOSED
CALL RecordItemReturn(@claim_arun, '2026-11-15', 'Collected from admin office');

SELECT Report_ID, Item_Name, Status FROM ITEM_REPORT WHERE Report_ID = @rep;

-- Remove the temporary rows (ON DELETE CASCADE removes the claims and return)
DELETE FROM ITEM_REPORT WHERE Report_ID = @rep;
SELECT (SELECT COUNT(*) FROM CLAIM WHERE Report_ID = @rep) AS Claims_Left,
       (SELECT COUNT(*) FROM ITEM_RETURN WHERE Claim_ID IN (@claim_arun, @claim_rahul)) AS Returns_Left;

-- ---------------------------------------------------------------------
-- VIEWS AND DATABASE-LEVEL RBAC
-- ---------------------------------------------------------------------

-- Q30. Public item board view (no email / phone / password exposed)
SELECT * FROM vw_item_board WHERE Status <> 'CLOSED' ORDER BY Date_Reported DESC LIMIT 5;

-- Q31. Privileges of the two MySQL roles
SHOW GRANTS FOR 'lf_student_role';
SHOW GRANTS FOR 'lf_admin_role';
