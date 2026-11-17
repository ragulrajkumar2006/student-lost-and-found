-- =====================================================================
-- Student Lost and Found Item Tracking System
-- 01_schema.sql  —  DDL (fresh install)
--
-- Creates the database and the four relational tables with all keys
-- and constraints. The live database was originally created with the
-- same structure; 02_migrate_existing.sql brings an existing copy up to
-- this final version without dropping any data.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS lost_found_db;
USE lost_found_db;

-- ---------------------------------------------------------------------
-- STUDENT: every user of the system (students and administrators)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS STUDENT (
    Student_ID     INT AUTO_INCREMENT PRIMARY KEY,
    Name           VARCHAR(100) NOT NULL,
    Email          VARCHAR(150) NOT NULL UNIQUE,
    Phone          VARCHAR(15),
    Password_Hash  VARCHAR(255) NOT NULL,              -- bcrypt hash, never plaintext
    Role           ENUM('STUDENT', 'ADMIN') NOT NULL DEFAULT 'STUDENT'
);

-- ---------------------------------------------------------------------
-- ITEM_REPORT: a LOST or FOUND report submitted by a student
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ITEM_REPORT (
    Report_ID      INT AUTO_INCREMENT PRIMARY KEY,
    Student_ID     INT NOT NULL,
    Item_Name      VARCHAR(100) NOT NULL,
    Description    TEXT NOT NULL,
    Report_Type    ENUM('LOST', 'FOUND') NOT NULL,
    Location       VARCHAR(150) NOT NULL,
    Date_Reported  DATE NOT NULL,
    Status         ENUM('OPEN', 'MATCHED', 'CLOSED') NOT NULL DEFAULT 'OPEN',

    CONSTRAINT fk_report_student
        FOREIGN KEY (Student_ID) REFERENCES STUDENT(Student_ID)
        ON DELETE CASCADE,

    INDEX idx_report_type_status (Report_Type, Status)
);

-- ---------------------------------------------------------------------
-- CLAIM: a student says "this FOUND item is mine"
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS CLAIM (
    Claim_ID             INT AUTO_INCREMENT PRIMARY KEY,
    Report_ID            INT NOT NULL,
    Claimant_Student_ID  INT NOT NULL,
    Claim_Date           DATE NOT NULL,
    Claim_Status         ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    Remarks              VARCHAR(255),

    CONSTRAINT fk_claim_report
        FOREIGN KEY (Report_ID) REFERENCES ITEM_REPORT(Report_ID)
        ON DELETE CASCADE,
    CONSTRAINT fk_claim_student
        FOREIGN KEY (Claimant_Student_ID) REFERENCES STUDENT(Student_ID)
        ON DELETE CASCADE,

    -- A student can claim a particular item only once
    CONSTRAINT uq_claim_report_student UNIQUE (Report_ID, Claimant_Student_ID)
);

-- ---------------------------------------------------------------------
-- ITEM_RETURN: the physical hand-over of an item for an approved claim
-- (one claim -> zero or one return, enforced by UNIQUE on Claim_ID)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ITEM_RETURN (
    Return_ID      INT AUTO_INCREMENT PRIMARY KEY,
    Claim_ID       INT NOT NULL UNIQUE,
    Returned_Date  DATE NOT NULL,
    Remarks        VARCHAR(255),

    CONSTRAINT fk_return_claim
        FOREIGN KEY (Claim_ID) REFERENCES CLAIM(Claim_ID)
        ON DELETE CASCADE
);
