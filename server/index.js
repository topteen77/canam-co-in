import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import fs from 'fs';
import https from 'https';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import Joi from 'joi';
import { createTransport } from 'nodemailer';

// --- IMPORTS FOR SERVICES ---
import db from './db.js'; // 👈 IMPORTING DB HERE
import * as attendanceService from './services/attendanceService.js';
import * as meetingService from './services/meetingService.js';
import * as leadController from './controllers/leadController.js';
import * as userService from './services/userService.js'; 
import * as activityService from './services/activityService.js'; 
import * as ctaService from './services/ctaService.js'
import * as documentService from './services/documentService.js';
import * as emailService from './services/emailService.js';
import * as leadTagService from './services/leadTagService.js';
import * as authController from './controllers/authController.js';
import * as notificationService from './services/notificationService.js';
import * as passwordService from './services/passwordService.js';
import * as travelClaimsService from './services/travelClaimsService.js';
import * as callLogsService from './services/callLogsService.js';
import * as companiesService from './services/companiesService.js';
import * as websiteSignupLeadsService from './services/websiteSignupLeadsService.js';
import * as importHistoryService from './services/importHistoryService.js';
import * as emailTemplatesService from './services/emailTemplatesService.js';
import * as emailCampaignsService from './services/emailCampaignsService.js';
import * as fieldConfigsService from './services/fieldConfigsService.js';
import * as travelSessionsService from './services/travelSessionsService.js';
import * as meetingCompletionsService from './services/meetingCompletionsService.js';
import jwt from 'jsonwebtoken';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

const app = express();
const PORT = process.env.PORT || 5001;

if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}
if (process.env.FORCE_HTTPS === '1' || process.env.FORCE_HTTPS === 'true') {
  app.use((req, res, next) => {
    if (req.secure) return next();
    const host = req.get('host') || req.hostname || 'localhost';
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  });
}

const corsOrigins = [
  'https://agent-follow-up-crm.web.app', 
    'http://localhost:5173', 
    'http://localhost:3000',
    'http://127.0.0.1:5173', 
    'http://43.204.23.58:3000',
	'http://43.204.23.58:5001',
  'https://canam.co.in:3000/',
  'https://canam.co.in:5001/',
  ...(process.env.PUBLIC_SITE_ORIGIN ? [process.env.PUBLIC_SITE_ORIGIN] : []),
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : []),
];
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// --- 🔎 DEBUG ROUTE (Now placed safely AFTER db import) ---
app.get('/api/leads/debug', async (req, res) => {
  try {
    console.log("🔍 Checking SQL Connection...");
    const [rows] = await db.execute('SELECT * FROM `Leads` LIMIT 1');
    res.json(rows);
  } catch (error) {
    console.error("🔥 DEBUG ERROR:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- ATTENDANCE ROUTES (Consolidated and Fixed) ---

// ✅ GET ALL ATTENDANCE RECORDS
app.get('/api/attendance/all', async (req, res) => {
  try {
    console.log('📊 Fetching all attendance records...');
    const records = await attendanceService.getAllAttendanceRecords();
    console.log(`✅ Found ${records.length} attendance records`);
    res.json(records);
  } catch (error) { 
    console.error('❌ Error in /api/attendance/all:', error);
    res.status(500).json({ error: error.message }); 
  }
});

// ✅ ADD ATTENDANCE RECORD (Start Day)
app.post('/api/attendance/add', async (req, res) => {
  try {
    console.log('➕ Adding attendance record:', req.body);
    const result = await attendanceService.addAttendanceRecord(req.body);
    console.log('✅ Attendance record added:', result);
    res.json(result);
  } catch (error) { 
    console.error('❌ Error in /api/attendance/add:', error);
    res.status(500).json({ error: error.message }); 
  }
});

// ✅ UPDATE ATTENDANCE RECORD (End Day / Check Out) - FIXED ENDPOINT
app.put('/api/attendance/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📝 Updating attendance record ID:', id, 'with data:', req.body);
    
    const result = await attendanceService.updateAttendanceRecord(id, req.body);
    console.log('✅ Update result:', result);
    
    res.json(result);
  } catch (e) {
    console.error('❌ Error in /api/attendance/update:', e);
    res.status(500).json({ error: e.message });
  }
});

// ✅ GET SINGLE ATTENDANCE RECORD BY ID
app.get('/api/attendance/:id', async (req, res) => {
  try {
    const record = await attendanceService.getAttendanceRecordById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(record);
  } catch (error) {
    console.error('❌ Error in /api/attendance/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- REMOVE DUPLICATE/LEGACY ATTENDANCE ROUTES ---
// Delete these legacy routes as they conflict with the ones above
/*
export const getAllAttendance = async (req, res) => { ... } // CONFLICT
export const checkIn = async (req, res) => { ... } // CONFLICT  
export const checkOut = async (req, res) => { ... } // CONFLICT
*/

// --- MEETING ROUTES (Add missing /all endpoint) ---

// ✅ GET ALL MEETING RECORDS (This endpoint is missing but frontend expects it)
app.get('/api/meetings/all', async (req, res) => {
  try {
    console.log('📊 Fetching all meeting records...');
    let records;
    if (meetingService.getAllMeetings) {
      records = await meetingService.getAllMeetings();
    } else if (meetingService.getAllMeetingRecords) {
      records = await meetingService.getAllMeetingRecords();
    } else {
      records = [];
    }
    console.log(`✅ Found ${records.length} meeting records`);
    res.json(records);
  } catch (error) {
    console.error('❌ Error in /api/meetings/all:', error.message);
    // Return 200 with empty array so frontend does not break
    res.json([]);
  }
});

app.get('/api/meetings/user/:userId', async (req, res) => {
  try {
    const records = await meetingService.getMeetingsByUser(req.params.userId);
    res.json(records);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/meetings/add', async (req, res) => {
  try {
    await meetingService.addMeeting(req.body);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/meetings/update/:id', async (req, res) => {
  try {
    await meetingService.updateMeeting(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ✅ ADD MEETING CHECK-IN (Frontend expects this endpoint)
app.post('/api/meetings/check-in', async (req, res) => {
  try {
    console.log('🤝 Meeting check-in received:', req.body);
    
    // Try different service function names
    let result;
    if (meetingService.addMeetingCheckIn) {
      result = await meetingService.addMeetingCheckIn(req.body);
    } else if (meetingService.addMeetingCheckInRecord) {
      result = await meetingService.addMeetingCheckInRecord(req.body);
    } else {
      // Fallback to generic addMeeting
      result = await meetingService.addMeeting(req.body);
    }
    
    res.json(result || { success: true });
  } catch (error) {
    console.error('❌ Error in /api/meetings/check-in:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- PASSWORD ROUTES ---

// 1. Set Default Password (for single user)
app.post('/api/password/set-default', async (req, res) => {
  try {
      // req.body = { userId, userData }
      const result = await passwordService.setDefaultPassword(req.body.userId, req.body.userData);
      res.json(result);
  } catch (e) {
      res.status(500).json({ error: e.message });
  }
});

// 2. Verify Password (Login helper)
app.post('/api/password/verify', async (req, res) => {
  try {
      const result = await passwordService.verifyPassword(req.body.email, req.body.password);
      if (result.success) {
          res.json(result);
      } else {
          res.status(401).json(result);
      }
  } catch (e) {
      res.status(500).json({ error: e.message });
  }
});

// 3. Reset All Passwords (Admin only)
app.post('/api/password/generate-all', async (req, res) => {
  try {
      const result = await passwordService.generateAllPasswords();
      res.json(result);
  } catch (e) {
      res.status(500).json({ error: e.message });
  }
});

// 4. Change password (user: current + new)
app.post('/api/password/change', async (req, res) => {
  try {
    const { email, currentPassword, newPassword } = req.body;
    const result = await passwordService.changePassword(email, currentPassword, newPassword);
    if (result.success) res.json(result);
    else res.status(400).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 5. Set initial password (no current required)
app.post('/api/password/set-initial', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    const result = await passwordService.setInitialPassword(email, newPassword);
    if (result.success) res.json(result);
    else res.status(400).json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- USER ROUTES ---
app.get('/api/users', async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/api/users/by-email/:email', async (req, res) => {
  try {
    const user = await userService.getUserByEmail(req.params.email);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.put('/api/users/:id', async (req, res) => {
  try {
    await userService.updateUser(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});
app.post('/api/users', async (req, res) => {
  try {
    const result = await userService.createUser(req.body);
    res.status(201).json(result);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- MIDDLEWARE: Protect Routes ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-this', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

app.post('/api/auth/login', authController.login);
app.post('/api/auth/register', authController.register);
app.get('/api/auth/me', authenticateToken, authController.getMe);

// --- ACTIVITY LOG ROUTES ---
app.get('/api/activities', async (req, res) => {
  try {
    const activities = await activityService.getAllActivities();
    res.json(activities);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- LEAD TAG ROUTES ---

// 1. Get all tags
app.get('/api/tags', async (req, res) => {
  const tags = await leadTagService.getLeadTags();
  res.json(tags);
});

// 2. Add a new tag
app.post('/api/tags', async (req, res) => {
  try {
      // Frontend sends { name: "Hot" }
      const result = await leadTagService.addLeadTag(req.body.name);
      res.json(result);
  } catch (e) {
      res.status(500).json({ error: e.message });
  }
});

// --- CTA TRACKING ROUTES ---
app.post('/api/cta/add', async (req, res) => {
  try {
    const result = await ctaService.addCTAActivity(req.body);
    res.json(result);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/cta/update/:id', async (req, res) => {
  try {
    await ctaService.updateCTAActivity(req.params.id, req.body);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/cta/recent', async (req, res) => {
  try {
    const activities = await ctaService.getRecentActivities();
    res.json(activities);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// --- DOCUMENT ROUTES ---
// Get all docs for a lead
app.get('/api/documents/lead/:leadId', async (req, res) => {
  const docs = await documentService.getDocumentsForLead(req.params.leadId);
  res.json(docs);
});

// Get specific doc type
app.get('/api/documents/type/:leadId/:type', async (req, res) => {
  const doc = await documentService.getDocumentByType(req.params.leadId, req.params.type);
  res.json(doc); // Returns null if not found, which handles the "empty string" case
});

// Delete doc
app.delete('/api/documents/:id', async (req, res) => {
  try {
      await documentService.deleteDocument(req.params.id);
      res.json({ success: true });
  } catch (e) {
      res.status(500).json({ error: e.message });
  }
});

// Upload doc
app.post('/api/documents/upload', async (req, res) => {
  try {
      const result = await documentService.uploadDocument(req.body);
      res.json(result);
  } catch (e) {
      res.status(500).json({ error: e.message });
  }
});

// Get all (Admin)
app.get('/api/documents/all', async (req, res) => {
  const docs = await documentService.getAllDocuments();
  res.json(docs);
});

// --- EMAIL ROUTES ---
app.post('/api/email/send', async (req, res) => {
  try {
      const result = await emailService.sendEmail(req.body);
      if (result.success) {
          res.json(result);
      } else {
          res.status(500).json(result);
      }
  } catch (error) {
      res.status(500).json({ error: error.message });
  }
});

// --- NOTIFICATION PREFERENCES ROUTES ---

// 1. Get Preferences
app.get('/api/preferences/:userId', async (req, res) => {
  const prefs = await notificationService.getPreferences(req.params.userId);
  res.json(prefs);
});

// 2. Save Preferences
app.post('/api/preferences/save', async (req, res) => {
  try {
      await notificationService.savePreferences(req.body);
      res.json({ success: true });
  } catch (e) {
      res.status(500).json({ error: e.message });
  }
});

// --- LEADS ROUTES ---
app.get('/api/leads/all', leadController.getAllLeads);
app.post('/api/leads/add', leadController.addLead);
app.put('/api/leads/update/:id', leadController.updateLead);
app.post('/api/leads/:id/followups', leadController.appendFollowUp);
app.delete('/api/leads/delete/:id', leadController.deleteLead);

app.post('/api/auth/sync-user', async (req, res) => {
  try {
    const { resolveTableNameOrFallback } = await import('./utils/tableResolver.js');
    const table = await resolveTableNameOrFallback(['users', 'Users'], 'users');
    const { id, email, name, role, status } = req.body;
    await db.query(
      `INSERT INTO ${table} (id, email, name, role, status, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE name = VALUES(name), last_active = NOW()`,
      [id, email, name, role, status]
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Sync error:", error);
    res.status(500).json({ error: error.message });
  }
});

// --- TRAVEL CLAIMS ---
app.get('/api/travel-claims', async (req, res) => {
  try {
    const list = await travelClaimsService.getAllTravelClaims();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/api/travel-claims/user/:userEmail', async (req, res) => {
  try {
    const list = await travelClaimsService.getTravelClaimsByUser(req.params.userEmail);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/travel-claims', async (req, res) => {
  try {
    const result = await travelClaimsService.addTravelClaim(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.put('/api/travel-claims/:id', async (req, res) => {
  try {
    await travelClaimsService.updateTravelClaim(req.params.id, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- CALL LOGS ---
app.get('/api/call-logs', async (req, res) => {
  try {
    const list = await callLogsService.getAllCallLogs({ limit: req.query.limit ? parseInt(req.query.limit, 10) : null });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/api/call-logs/lead/:leadId', async (req, res) => {
  try {
    const list = await callLogsService.getCallLogsByLead(req.params.leadId);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/call-logs', async (req, res) => {
  try {
    const result = await callLogsService.addCallLog(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- COMPANIES (SuperAdmin / multi-tenant) ---
app.get('/api/companies', async (req, res) => {
  try {
    const list = await companiesService.getAllCompanies();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/api/companies/:id', async (req, res) => {
  try {
    const company = await companiesService.getCompanyById(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/companies', async (req, res) => {
  try {
    const result = await companiesService.addCompany(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.put('/api/companies/:id', async (req, res) => {
  try {
    await companiesService.updateCompany(req.params.id, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.delete('/api/companies/:id', async (req, res) => {
  try {
    await companiesService.deleteCompany(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/api/companies/:id/users', async (req, res) => {
  try {
    const list = await companiesService.getCompanyUsers(req.params.id);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/companies/:id/users', async (req, res) => {
  try {
    const result = await companiesService.addCompanyUser({ ...req.body, companyId: req.params.id });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- FIREBASE PROJECTS (projects in MySQL) ---
app.get('/api/firebase-projects', async (req, res) => {
  try {
    const list = await companiesService.getAllFirebaseProjects();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/firebase-projects', async (req, res) => {
  try {
    const result = await companiesService.addFirebaseProject(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.put('/api/firebase-projects/:id', async (req, res) => {
  try {
    await companiesService.updateFirebaseProject(req.params.id, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.delete('/api/firebase-projects/:id', async (req, res) => {
  try {
    await companiesService.deleteFirebaseProject(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- WEBSITE SIGNUP LEADS ---
app.get('/api/website-signup-leads', async (req, res) => {
  try {
    const list = await websiteSignupLeadsService.getAllWebsiteSignupLeads({ limit: req.query.limit ? parseInt(req.query.limit, 10) : null });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/website-signup-leads', async (req, res) => {
  try {
    const result = await websiteSignupLeadsService.addWebsiteSignupLead(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.put('/api/website-signup-leads/:id', async (req, res) => {
  try {
    await websiteSignupLeadsService.updateWebsiteSignupLead(req.params.id, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- IMPORT HISTORY ---
app.get('/api/import-history', async (req, res) => {
  try {
    const list = await importHistoryService.getAllImportHistory({ limit: req.query.limit ? parseInt(req.query.limit, 10) : 50 });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/import-history', async (req, res) => {
  try {
    const result = await importHistoryService.addImportHistory(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- EMAIL TEMPLATES ---
app.get('/api/email-templates', async (req, res) => {
  try {
    const list = await emailTemplatesService.getAllEmailTemplates();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/api/email-templates/:id', async (req, res) => {
  try {
    const template = await emailTemplatesService.getEmailTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/email-templates', async (req, res) => {
  try {
    const result = await emailTemplatesService.addEmailTemplate(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.put('/api/email-templates/:id', async (req, res) => {
  try {
    await emailTemplatesService.updateEmailTemplate(req.params.id, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.delete('/api/email-templates/:id', async (req, res) => {
  try {
    await emailTemplatesService.deleteEmailTemplate(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- EMAIL CAMPAIGNS ---
app.get('/api/email-campaigns', async (req, res) => {
  try {
    const list = await emailCampaignsService.getAllEmailCampaigns();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/email-campaigns', async (req, res) => {
  try {
    const result = await emailCampaignsService.addEmailCampaign(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.put('/api/email-campaigns/:id', async (req, res) => {
  try {
    await emailCampaignsService.updateEmailCampaign(req.params.id, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- FIELD CONFIGS ---
app.get('/api/field-configs', async (req, res) => {
  try {
    const list = await fieldConfigsService.getAllFieldConfigs();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.get('/api/field-configs/:id', async (req, res) => {
  try {
    const config = await fieldConfigsService.getFieldConfigById(req.params.id);
    if (!config) return res.status(404).json({ error: 'Field config not found' });
    res.json(config);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/field-configs', async (req, res) => {
  try {
    const { id, ...data } = req.body;
    const configId = id || `fc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await fieldConfigsService.setFieldConfig(configId, { ...data, id: configId });
    res.json({ success: true, id: configId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.put('/api/field-configs/:id', async (req, res) => {
  try {
    await fieldConfigsService.updateFieldConfig(req.params.id, req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- TRAVEL SESSIONS ---
app.get('/api/travel-sessions', async (req, res) => {
  try {
    const list = await travelSessionsService.getAllTravelSessions({ limit: req.query.limit ? parseInt(req.query.limit, 10) : null });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/travel-sessions', async (req, res) => {
  try {
    const result = await travelSessionsService.addTravelSession(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- MEETING COMPLETIONS ---
app.get('/api/meeting-completions/meeting/:meetingId', async (req, res) => {
  try {
    const list = await meetingCompletionsService.getMeetingCompletionsByMeetingId(req.params.meetingId);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/meeting-completions', async (req, res) => {
  try {
    const result = await meetingCompletionsService.addMeetingCompletion(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- DATABASE DEBUG ROUTE ---
app.get('/api/debug/attendance', async (req, res) => {
  try {
    const records = await attendanceService.getAllAttendanceRecords();
    res.json((records || []).slice(0, 10));
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- START SERVER ---
const useHttps = process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH;
const httpsPort = process.env.HTTPS_PORT ? parseInt(process.env.HTTPS_PORT, 10) : PORT;

function startListening() {
  if (useHttps) {
    try {
      const keyPath = path.isAbsolute(process.env.SSL_KEY_PATH)
        ? process.env.SSL_KEY_PATH
        : path.resolve(__dirname, '..', process.env.SSL_KEY_PATH);
      const certPath = path.isAbsolute(process.env.SSL_CERT_PATH)
        ? process.env.SSL_CERT_PATH
        : path.resolve(__dirname, '..', process.env.SSL_CERT_PATH);
      const key = fs.readFileSync(keyPath, 'utf8');
      const cert = fs.readFileSync(certPath, 'utf8');
      const httpsServer = https.createServer({ key, cert }, app);
      httpsServer.listen(httpsPort, '0.0.0.0', () => {
        console.log(`✅ HTTPS server running on port ${httpsPort}`);
        console.log(`   - https://localhost:${httpsPort}`);
      });
    } catch (err) {
      console.error('❌ HTTPS failed (check SSL_KEY_PATH / SSL_CERT_PATH):', err.message);
      process.exit(1);
    }
    // Optional: also listen on HTTP to redirect to HTTPS
    if (process.env.HTTP_REDIRECT_PORT && parseInt(process.env.HTTP_REDIRECT_PORT, 10) !== httpsPort) {
      const httpPort = parseInt(process.env.HTTP_REDIRECT_PORT, 10);
      const redirectApp = express();
      redirectApp.set('trust proxy', 1);
      redirectApp.use((req, res) => {
        const host = req.get('host') || req.hostname || 'localhost';
        res.redirect(301, `https://${host.replace(/:\d+$/, '')}:${httpsPort}${req.originalUrl}`);
      });
      redirectApp.listen(httpPort, '0.0.0.0', () => {
        console.log(`   HTTP redirect server on port ${httpPort} -> HTTPS ${httpsPort}`);
      });
    }
  } else {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`   - Local: http://localhost:${PORT}`);
      console.log(`   - Network: http://127.0.0.1:${PORT}`);
    });
  }
}

startListening();