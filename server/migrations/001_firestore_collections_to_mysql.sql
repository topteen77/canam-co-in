-- Migration: Firestore collections → MySQL
-- Run this against your existing crm_db. Does NOT drop or alter existing tables.
-- Existing tables (users, leads, Attendance, meetings, activity_logs, ctaactivities, documents, lead_tags, notificationpreferences) are assumed to already exist.

-- =============================================================================
-- TRAVEL CLAIMS
-- =============================================================================
CREATE TABLE IF NOT EXISTS travel_claims (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  user_name VARCHAR(255) DEFAULT '',
  user_email VARCHAR(255) NOT NULL,
  month VARCHAR(7) NOT NULL COMMENT 'YYYY-MM',
  year INT NOT NULL,
  trips JSON COMMENT 'Array of trip objects',
  total_distance DECIMAL(12,2) DEFAULT 0,
  total_amount DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(32) DEFAULT 'submitted' COMMENT 'submitted, approved, rejected',
  submitted_at DATETIME NULL,
  approved_at DATETIME NULL,
  approved_by VARCHAR(255) NULL,
  rejection_reason TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_travel_claims_user (user_email),
  INDEX idx_travel_claims_month (month),
  INDEX idx_travel_claims_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- TRAVEL SESSIONS (if used)
-- =============================================================================
CREATE TABLE IF NOT EXISTS travel_sessions (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(255) NULL,
  user_email VARCHAR(255) NULL,
  start_time DATETIME NULL,
  end_time DATETIME NULL,
  start_location JSON NULL,
  end_location JSON NULL,
  distance_km DECIMAL(10,2) NULL,
  payload JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_travel_sessions_user (user_email),
  INDEX idx_travel_sessions_start (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- FIREBASE PROJECTS (multi-tenant / SuperAdmin)
-- =============================================================================
CREATE TABLE IF NOT EXISTS firebase_projects (
  id VARCHAR(128) PRIMARY KEY,
  project_id VARCHAR(128) NOT NULL COMMENT 'Firebase projectId',
  project_name VARCHAR(255) NULL,
  status VARCHAR(32) DEFAULT 'available' COMMENT 'available, assigned',
  assigned_to VARCHAR(128) NULL,
  assigned_at DATETIME NULL,
  payload JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_firebase_projects_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- COMPANIES
-- =============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(128) NULL,
  contact_email VARCHAR(255) NULL,
  admin_name VARCHAR(255) NULL,
  admin_email VARCHAR(255) NULL,
  admin_password VARCHAR(255) NULL,
  firebase_project_id VARCHAR(128) NULL,
  custom_url VARCHAR(512) NULL,
  status VARCHAR(32) DEFAULT 'active',
  branding JSON NULL COMMENT 'primaryColor, secondaryColor etc',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_companies_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- COMPANY USERS
-- =============================================================================
CREATE TABLE IF NOT EXISTS company_users (
  id VARCHAR(128) PRIMARY KEY,
  company_id VARCHAR(128) NOT NULL,
  name VARCHAR(255) NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NULL,
  role VARCHAR(64) DEFAULT 'User',
  status VARCHAR(32) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_company_users_company (company_id),
  INDEX idx_company_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- WEBSITE SIGNUP LEADS
-- =============================================================================
CREATE TABLE IF NOT EXISTS website_signup_leads (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  stage VARCHAR(64) DEFAULT 'Signed Up' COMMENT 'Signed Up, OTP Verified, Details Submitted, MOU Signed, Signup Completed',
  payload JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_website_signup_leads_stage (stage),
  INDEX idx_website_signup_leads_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- IMPORT HISTORY
-- =============================================================================
CREATE TABLE IF NOT EXISTS import_history (
  id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(255) NULL,
  user_email VARCHAR(255) NULL,
  file_name VARCHAR(255) NULL,
  total_rows INT DEFAULT 0,
  success_count INT DEFAULT 0,
  error_count INT DEFAULT 0,
  errors_json JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_import_history_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- EMAIL TEMPLATES
-- =============================================================================
CREATE TABLE IF NOT EXISTS email_templates (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NULL,
  subject VARCHAR(512) NULL,
  body_html TEXT NULL,
  body_text TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  INDEX idx_email_templates_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- EMAIL CAMPAIGNS
-- =============================================================================
CREATE TABLE IF NOT EXISTS email_campaigns (
  id VARCHAR(128) PRIMARY KEY,
  name VARCHAR(255) NULL,
  template_id VARCHAR(128) NULL,
  subject VARCHAR(512) NULL,
  status VARCHAR(32) DEFAULT 'draft' COMMENT 'draft, scheduled, sent',
  scheduled_at DATETIME NULL,
  sent_at DATETIME NULL,
  recipient_count INT DEFAULT 0,
  payload JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255) NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email_campaigns_status (status),
  INDEX idx_email_campaigns_sent (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- FIELD CONFIGS (DatabaseAdmin / dynamic form config)
-- =============================================================================
CREATE TABLE IF NOT EXISTS field_configs (
  id VARCHAR(128) PRIMARY KEY,
  section VARCHAR(128) NULL,
  field_key VARCHAR(128) NULL,
  label VARCHAR(255) NULL,
  type VARCHAR(64) NULL,
  options_json JSON NULL,
  order_index INT DEFAULT 0,
  payload JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_field_configs_section (section)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- CALL LOGS
-- =============================================================================
CREATE TABLE IF NOT EXISTS call_logs (
  id VARCHAR(128) PRIMARY KEY,
  phone_number VARCHAR(64) NOT NULL,
  lead_id VARCHAR(128) NULL,
  lead_name VARCHAR(255) NULL,
  contact_name VARCHAR(255) NULL,
  call_type VARCHAR(32) DEFAULT 'lead' COMMENT 'lead, non-lead',
  timestamp VARCHAR(64) NULL,
  duration INT DEFAULT 0 COMMENT 'seconds',
  notes TEXT NULL,
  outcome VARCHAR(32) NULL COMMENT 'answered, no-answer, busy, voicemail, other',
  user_id VARCHAR(255) NULL,
  user_email VARCHAR(255) NULL,
  user_name VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_call_logs_lead (lead_id),
  INDEX idx_call_logs_user (user_email),
  INDEX idx_call_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- MEETING COMPLETIONS (if separate from meetings table)
-- =============================================================================
CREATE TABLE IF NOT EXISTS meeting_completions (
  id VARCHAR(128) PRIMARY KEY,
  meeting_id VARCHAR(128) NOT NULL,
  username VARCHAR(255) NULL,
  outcome VARCHAR(255) NULL,
  completed_at DATETIME NULL,
  payload JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_meeting_completions_meeting (meeting_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================================
-- NOTIFICATION PREFERENCES (uses user_email; create if missing or add column)
-- =============================================================================
CREATE TABLE IF NOT EXISTS notificationpreferences (
  user_email VARCHAR(255) PRIMARY KEY,
  enabled TINYINT(1) DEFAULT 1,
  sound TINYINT(1) DEFAULT 1,
  vibrate TINYINT(1) DEFAULT 1,
  categories JSON NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- If your table already exists with user_id instead, add: ALTER TABLE notificationpreferences ADD COLUMN user_email VARCHAR(255) UNIQUE NULL; then backfill and use user_email.
