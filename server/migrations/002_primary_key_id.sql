-- Migration: Use `id` as primary key instead of `firebase_id`
-- Run after 001 and after align-dump-as-real-db.js (or on a DB that already has firebase_id as PK).
-- New records will get an auto-generated numeric id; firebase_id is kept nullable for legacy rows.
--
-- Option A: Run this script manually for each table (uncomment the block for the table you need).
-- Option B: Use the Node script 002_primary_key_id.js to apply to all tables with firebase_id.

-- =============================================================================
-- ATTENDANCE
-- =============================================================================
-- Step 1: Drop existing primary key (firebase_id)
-- ALTER TABLE Attendance DROP PRIMARY KEY;
-- Step 2: Add id as new primary key (MySQL will assign 1, 2, 3... to existing rows)
-- ALTER TABLE Attendance ADD COLUMN id INT NOT NULL AUTO_INCREMENT FIRST, ADD PRIMARY KEY (id);
-- Step 3: Allow new rows without firebase_id; keep uniqueness for legacy lookups
-- ALTER TABLE Attendance MODIFY firebase_id VARCHAR(255) NULL;
-- ALTER TABLE Attendance ADD UNIQUE KEY uk_Attendance_firebase_id (firebase_id);

-- =============================================================================
-- LEADS (table name may be Leads or leads depending on DB)
-- =============================================================================
-- ALTER TABLE Leads DROP PRIMARY KEY;
-- ALTER TABLE Leads ADD COLUMN id INT NOT NULL AUTO_INCREMENT FIRST, ADD PRIMARY KEY (id);
-- ALTER TABLE Leads MODIFY firebase_id VARCHAR(255) NULL;
-- ALTER TABLE Leads ADD UNIQUE KEY uk_Leads_firebase_id (firebase_id);

-- Repeat the same pattern for other exported tables: MeetingCheckInRecords, CTAActivities,
-- Documents, Users, EmailTemplates, EmailCampaigns, etc. Or run 002_primary_key_id.js.
