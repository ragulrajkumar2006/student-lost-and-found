-- =====================================================================
-- 03_routines.sql  —  Stored procedures, functions and triggers
--
-- Safe to re-run: every object is dropped (if present) and recreated.
-- Run with:  mysql lost_found_db < database/03_routines.sql
--
-- Claim workflow enforced here:
--   FOUND report --(student claims)--> CLAIM PENDING
--   admin approves  -> CLAIM APPROVED, other pending claims REJECTED,
--                      report MATCHED            (ApproveClaim + trigger)
--   item handed over -> ITEM_RETURN row, report CLOSED
--                                               (RecordItemReturn + triggers)
-- =====================================================================

USE lost_found_db;

DROP PROCEDURE IF EXISTS GetLostItems;
DROP PROCEDURE IF EXISTS ApproveClaim;
DROP PROCEDURE IF EXISTS RecordItemReturn;
DROP FUNCTION  IF EXISTS GetStudentReportCount;
DROP FUNCTION  IF EXISTS GetPendingClaimCount;
DROP TRIGGER   IF EXISTS AfterClaimApproval;
DROP TRIGGER   IF EXISTS BeforeClaimInsert;
DROP TRIGGER   IF EXISTS BeforeItemReturnInsert;
DROP TRIGGER   IF EXISTS AfterItemReturnInsert;

DELIMITER //

-- ---------------------------------------------------------------------
-- PROCEDURE GetLostItems()  (original, unchanged)
-- Returns every LOST report.
-- ---------------------------------------------------------------------
CREATE PROCEDURE GetLostItems()
BEGIN
    SELECT *
    FROM ITEM_REPORT
    WHERE Report_Type = 'LOST';
END //

-- ---------------------------------------------------------------------
-- PROCEDURE ApproveClaim(claim, remarks)
-- Approves one claim and rejects all other pending claims for the same
-- item, inside a single transaction. (A trigger on CLAIM cannot update
-- CLAIM itself — MySQL error 1442 — so this logic lives in a procedure.)
-- ---------------------------------------------------------------------
CREATE PROCEDURE ApproveClaim(IN p_claim_id INT, IN p_remarks VARCHAR(255))
BEGIN
    DECLARE v_report_id INT;
    DECLARE v_status    VARCHAR(10);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT Report_ID, Claim_Status
    INTO v_report_id, v_status
    FROM CLAIM
    WHERE Claim_ID = p_claim_id
    FOR UPDATE;

    IF v_report_id IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Claim not found';
    END IF;

    IF v_status <> 'PENDING' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only PENDING claims can be approved';
    END IF;

    UPDATE CLAIM
    SET Claim_Status = 'APPROVED',
        Remarks = COALESCE(p_remarks, Remarks)
    WHERE Claim_ID = p_claim_id;          -- fires AfterClaimApproval

    UPDATE CLAIM
    SET Claim_Status = 'REJECTED',
        Remarks = 'Another claim for this item was approved'
    WHERE Report_ID = v_report_id
      AND Claim_ID <> p_claim_id
      AND Claim_Status = 'PENDING';

    COMMIT;
END //

-- ---------------------------------------------------------------------
-- PROCEDURE RecordItemReturn(claim, date, remarks)
-- Records the physical hand-over. Triggers validate the claim and close
-- the report. Returns the new Return_ID as a one-row result set.
-- ---------------------------------------------------------------------
CREATE PROCEDURE RecordItemReturn(
    IN p_claim_id INT,
    IN p_returned_date DATE,
    IN p_remarks VARCHAR(255)
)
BEGIN
    INSERT INTO ITEM_RETURN (Claim_ID, Returned_Date, Remarks)
    VALUES (p_claim_id, COALESCE(p_returned_date, CURDATE()), p_remarks);

    SELECT LAST_INSERT_ID() AS Return_ID;
END //

-- ---------------------------------------------------------------------
-- FUNCTION GetStudentReportCount(student)  (original, unchanged)
-- Number of reports submitted by a student.
-- ---------------------------------------------------------------------
CREATE FUNCTION GetStudentReportCount(p_student_id INT)
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE report_count INT;

    SELECT COUNT(*)
    INTO report_count
    FROM ITEM_REPORT
    WHERE Student_ID = p_student_id;

    RETURN report_count;
END //

-- ---------------------------------------------------------------------
-- FUNCTION GetPendingClaimCount(report)
-- Number of claims still waiting for an admin decision on a report.
-- ---------------------------------------------------------------------
CREATE FUNCTION GetPendingClaimCount(p_report_id INT)
RETURNS INT
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE pending_count INT;

    SELECT COUNT(*)
    INTO pending_count
    FROM CLAIM
    WHERE Report_ID = p_report_id
      AND Claim_Status = 'PENDING';

    RETURN pending_count;
END //

-- ---------------------------------------------------------------------
-- TRIGGER AfterClaimApproval  (original logic, unchanged)
-- When a claim becomes APPROVED, the item is MATCHED to its owner.
-- It is NOT closed yet: that happens only when the return is recorded.
-- ---------------------------------------------------------------------
CREATE TRIGGER AfterClaimApproval
AFTER UPDATE ON CLAIM
FOR EACH ROW
BEGIN
    IF NEW.Claim_Status = 'APPROVED'
       AND OLD.Claim_Status <> 'APPROVED' THEN

        UPDATE ITEM_REPORT
        SET Status = 'MATCHED'
        WHERE Report_ID = NEW.Report_ID;

    END IF;
END //

-- ---------------------------------------------------------------------
-- TRIGGER BeforeClaimInsert
-- Business rules for a new claim:
--   * only FOUND reports can be claimed
--   * a student cannot claim an item they reported themselves
--   * a CLOSED item cannot be claimed
--   * Claim_Date defaults to today
-- ---------------------------------------------------------------------
CREATE TRIGGER BeforeClaimInsert
BEFORE INSERT ON CLAIM
FOR EACH ROW
BEGIN
    DECLARE v_type     VARCHAR(10);
    DECLARE v_status   VARCHAR(10);
    DECLARE v_owner_id INT;

    SELECT Report_Type, Status, Student_ID
    INTO v_type, v_status, v_owner_id
    FROM ITEM_REPORT
    WHERE Report_ID = NEW.Report_ID;

    IF v_type <> 'FOUND' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only FOUND items can be claimed';
    END IF;

    IF v_owner_id = NEW.Claimant_Student_ID THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You cannot claim an item you reported yourself';
    END IF;

    IF v_status = 'CLOSED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This item has already been returned';
    END IF;

    IF NEW.Claim_Date IS NULL THEN
        SET NEW.Claim_Date = CURDATE();
    END IF;
END //

-- ---------------------------------------------------------------------
-- TRIGGER BeforeItemReturnInsert
-- An item can only be returned against an APPROVED claim.
-- ---------------------------------------------------------------------
CREATE TRIGGER BeforeItemReturnInsert
BEFORE INSERT ON ITEM_RETURN
FOR EACH ROW
BEGIN
    DECLARE v_claim_status VARCHAR(10);

    SELECT Claim_Status INTO v_claim_status
    FROM CLAIM
    WHERE Claim_ID = NEW.Claim_ID;

    IF v_claim_status IS NULL OR v_claim_status <> 'APPROVED' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A return can only be recorded for an APPROVED claim';
    END IF;
END //

-- ---------------------------------------------------------------------
-- TRIGGER AfterItemReturnInsert
-- Once the item is handed over, the report is CLOSED.
-- ---------------------------------------------------------------------
CREATE TRIGGER AfterItemReturnInsert
AFTER INSERT ON ITEM_RETURN
FOR EACH ROW
BEGIN
    UPDATE ITEM_REPORT
    SET Status = 'CLOSED'
    WHERE Report_ID = (SELECT Report_ID FROM CLAIM WHERE Claim_ID = NEW.Claim_ID);
END //

DELIMITER ;
