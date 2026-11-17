-- =====================================================================
-- 05_seed_demo.sql  —  Additional demonstration data
--
-- Adds one more student and several LOST/FOUND pairs that are worded
-- DIFFERENTLY on purpose (e.g. "charger" vs "power adapter"), so that
-- semantic search finds matches that keyword search would miss.
-- Run after 03_routines.sql (the claim triggers validate these rows).
-- Run 'npm run reindex' in backend/ afterwards to load vectors into Qdrant.
-- =====================================================================

USE lost_found_db;

INSERT INTO STUDENT (Name, Email, Phone, Password_Hash, Role) VALUES
('Sneha Iyer', 'sneha@gmail.com', '9876543214',
 '$2b$10$ZHH3L8Ao9G94G1MbgTyPeOin8CpE0KKFI7moUWjW/955G2v852Ar6', 'STUDENT');

SET @arun  = (SELECT Student_ID FROM STUDENT WHERE Email = 'arun@gmail.com');
SET @priya = (SELECT Student_ID FROM STUDENT WHERE Email = 'priya@gmail.com');
SET @rahul = (SELECT Student_ID FROM STUDENT WHERE Email = 'rahul@gmail.com');
SET @sneha = (SELECT Student_ID FROM STUDENT WHERE Email = 'sneha@gmail.com');

INSERT INTO ITEM_REPORT
(Student_ID, Item_Name, Description, Report_Type, Location, Date_Reported) VALUES
(@rahul, 'Laptop Charger',
 'Grey Dell laptop charger with a long black cable, left on the desk',              'LOST',  'Computer Lab 3', '2026-11-10'),
(@priya, 'Power Adapter',
 'Found a laptop power adapter with a long cable near the computers',               'FOUND', 'Computer Lab 3', '2026-11-11'),
(@sneha, 'Scientific Calculator',
 'Casio fx-991EX scientific calculator with my name written on the back',           'LOST',  'Exam Hall B',    '2026-11-11'),
(@arun,  'Calculator',
 'Casio calculator found under a desk after the mid-semester exam',                 'FOUND', 'Exam Hall B',    '2026-11-12'),
(@sneha, 'Earbuds Case',
 'White charging case with bluetooth earphones inside, left on a canteen table',    'FOUND', 'Canteen',        '2026-11-12'),
(@arun,  'College ID Card',
 'My student identity card attached to a blue lanyard',                             'LOST',  'Main Gate',      '2026-11-13'),
(@rahul, 'ID Card with Lanyard',
 'Student ID card on a blue neck strap picked up near the main entrance',           'FOUND', 'Main Gate',      '2026-11-13'),
(@priya, 'Black Umbrella',
 'Black foldable umbrella with a curved wooden handle',                             'LOST',  'Auditorium',     '2026-11-14'),
(@sneha, 'Reading Glasses',
 'Black framed spectacles inside a brown zip case',                                 'LOST',  'Library',        '2026-11-14');

-- Claims waiting for an admin decision (BeforeClaimInsert validates each)
INSERT INTO CLAIM (Report_ID, Claimant_Student_ID, Claim_Date, Claim_Status, Remarks) VALUES
((SELECT Report_ID FROM ITEM_REPORT WHERE Item_Name = 'Power Adapter'),        @rahul, '2026-11-12', 'PENDING',
 'It is my Dell charger, the cable has a small tear near the plug.'),
((SELECT Report_ID FROM ITEM_REPORT WHERE Item_Name = 'Calculator'),           @sneha, '2026-11-12', 'PENDING',
 'My name SNEHA is written on the back in marker.'),
((SELECT Report_ID FROM ITEM_REPORT WHERE Item_Name = 'ID Card with Lanyard'), @arun,  '2026-11-14', 'PENDING',
 'The ID card has my photo and SRN on it.'),
((SELECT Report_ID FROM ITEM_REPORT WHERE Item_Name = 'Earbuds Case'),         @priya, '2026-11-13', 'REJECTED',
 'Claimant could not describe the earbuds or the case.');
