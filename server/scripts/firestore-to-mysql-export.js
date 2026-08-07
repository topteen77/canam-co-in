/**
 * One-time Firestore → MySQL export.
 * Reads all listed Firestore collections and inserts/upserts into MySQL.
 *
 * Requires .env:
 *   - Firebase Admin: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   - MySQL: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 *
 * Usage (from project root):
 *   node server/scripts/firestore-to-mysql-export.js
 *   node server/scripts/firestore-to-mysql-export.js --dry-run   # log only, no MySQL writes
 */

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, 'server', '.env') });

const DRY_RUN = process.argv.includes('--dry-run');

function toSqlDatetime(val) {
  if (val == null) return null;
  if (val.toDate && typeof val.toDate === 'function') return val.toDate().toISOString().slice(0, 19).replace('T', ' ');
  if (val instanceof Date) return val.toISOString().slice(0, 19).replace('T', ' ');
  if (typeof val === 'string') return new Date(val).toISOString().slice(0, 19).replace('T', ' ');
  return null;
}

function toJson(val) {
  if (val == null) return null;
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

async function main() {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('Missing Firebase Admin env: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });

  const firestore = getFirestore();
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'crm_db',
  };

  let conn;
  if (!DRY_RUN) {
    try {
      conn = await mysql.createConnection(dbConfig);
      console.log('Connected to MySQL:', dbConfig.database);
    } catch (e) {
      console.error('MySQL connection failed:', e.message);
      process.exit(1);
    }
  } else {
    console.log('DRY RUN – no MySQL writes');
  }

  const run = async (name, fn) => {
    try {
      const count = await fn(conn, firestore);
      console.log(`✅ ${name}: ${count} rows`);
      return count;
    } catch (e) {
      console.error(`❌ ${name}:`, e.message);
      return 0;
    }
  };

  let total = 0;

  // --- Users (Firestore "Users" → users) ---
  total += await run('Users → users', async (conn, db) => {
    const snap = await db.collection('Users').get();
    if (!snap.size) return 0;
    for (const doc of snap.docs) {
      const d = doc.data();
      const id = doc.id;
      const email = d.email || id;
      const name = d.name || d.displayName || email.split('@')[0] || '';
      const role = d.role || 'User';
      const status = d.status || (d.approvalStatus === 'approved' ? 'Active' : 'Pending');
      const createdAt = toSqlDatetime(d.created_at || d.createdAt);
      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO users (id, email, name, role, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), role = VALUES(role), status = VALUES(status)`,
          [id, email, name, role, status, createdAt || new Date().toISOString().slice(0, 19).replace('T', ' ')],
        );
      }
    }
    return snap.size;
  });

  // --- TravelClaims → travel_claims ---
  total += await run('TravelClaims → travel_claims', async (conn, db) => {
    const snap = await db.collection('TravelClaims').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const id = doc.id;
      const submittedAt = toSqlDatetime(d.submittedAt || d.submitted_at);
      const approvedAt = toSqlDatetime(d.approvedAt || d.approved_at);
      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO travel_claims (id, user_id, user_name, user_email, month, year, trips, total_distance, total_amount, status, submitted_at, approved_at, approved_by, rejection_reason)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE user_name = VALUES(user_name), trips = VALUES(trips), total_distance = VALUES(total_distance), total_amount = VALUES(total_amount), status = VALUES(status), approved_at = VALUES(approved_at), approved_by = VALUES(approved_by), rejection_reason = VALUES(rejection_reason)`,
          [
            id,
            d.userId || d.user_email || '',
            d.userName || d.user_name || '',
            d.userEmail || d.user_email || d.userId || '',
            d.month || '',
            d.year || 0,
            toJson(d.trips),
            d.totalDistance ?? d.total_distance ?? 0,
            d.totalAmount ?? d.total_amount ?? 0,
            d.status || 'submitted',
            submittedAt,
            approvedAt,
            d.approvedBy || d.approved_by || null,
            d.rejectionReason || d.rejection_reason || null,
          ],
        );
      }
    }
    return snap.size;
  });

  // --- CallLogs → call_logs ---
  total += await run('CallLogs → call_logs', async (conn, db) => {
    const snap = await db.collection('CallLogs').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const id = doc.id;
      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO call_logs (id, phone_number, lead_id, lead_name, contact_name, call_type, timestamp, duration, notes, outcome, user_id, user_email, user_name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE notes = VALUES(notes)`,
          [
            id,
            d.phoneNumber || d.phone_number || '',
            d.leadId || d.lead_id || null,
            d.leadName || d.lead_name || null,
            d.contactName || d.contact_name || null,
            d.callType || d.call_type || 'lead',
            d.timestamp || null,
            d.duration ?? 0,
            d.notes || '',
            d.outcome || 'answered',
            d.userId || d.user_email || null,
            d.userEmail || d.user_email || null,
            d.userName || d.user_name || null,
          ],
        );
      }
    }
    return snap.size;
  });

  // --- Companies → companies ---
  total += await run('Companies → companies', async (conn, db) => {
    const snap = await db.collection('Companies').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const id = doc.id;
      const createdAt = toSqlDatetime(d.createdAt || d.created_at);
      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO companies (id, name, subdomain, contact_email, admin_name, admin_email, admin_password, firebase_project_id, custom_url, status, branding, created_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), subdomain = VALUES(subdomain), contact_email = VALUES(contact_email), status = VALUES(status), branding = VALUES(branding)`,
          [
            id,
            d.name || '',
            d.subdomain || null,
            d.contactEmail || d.contact_email || null,
            d.adminName || d.admin_name || null,
            d.adminEmail || d.admin_email || null,
            d.adminPassword || d.admin_password || null,
            d.firebaseProjectId || d.firebase_project_id || null,
            d.customUrl || d.custom_url || null,
            d.status || 'active',
            toJson(d.branding),
            createdAt,
            d.createdBy || d.created_by || null,
          ],
        );
      }
    }
    return snap.size;
  });

  // --- CompanyUsers → company_users ---
  total += await run('CompanyUsers → company_users', async (conn, db) => {
    const snap = await db.collection('CompanyUsers').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const id = doc.id;
      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO company_users (id, company_id, name, email, password, role, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), status = VALUES(status)`,
          [
            id,
            d.companyId || d.company_id || '',
            d.name || '',
            d.email || '',
            d.password || null,
            d.role || 'User',
            d.status || 'active',
          ],
        );
      }
    }
    return snap.size;
  });

  // --- FirebaseProjects → firebase_projects ---
  total += await run('FirebaseProjects → firebase_projects', async (conn, db) => {
    const snap = await db.collection('FirebaseProjects').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const id = doc.id;
      const assignedAt = toSqlDatetime(d.assignedAt || d.assigned_at);
      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO firebase_projects (id, project_id, project_name, status, assigned_to, assigned_at, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE project_name = VALUES(project_name), status = VALUES(status), assigned_to = VALUES(assigned_to), assigned_at = VALUES(assigned_at)`,
          [
            id,
            d.projectId || d.project_id || id,
            d.projectName || d.project_name || null,
            d.status || 'available',
            d.assignedTo || d.assigned_to || null,
            assignedAt,
            toJson(d),
          ],
        );
      }
    }
    return snap.size;
  });

  // --- WebsiteSignupLeads → website_signup_leads ---
  total += await run('WebsiteSignupLeads → website_signup_leads', async (conn, db) => {
    const snap = await db.collection('WebsiteSignupLeads').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const id = doc.id;
      const createdAt = toSqlDatetime(d.createdAt || d.created_at);
      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO website_signup_leads (id, name, email, phone, stage, payload)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), stage = VALUES(stage)`,
          [id, d.name || null, d.email || null, d.phone || null, d.stage || 'Signed Up', toJson(d)],
        );
      }
    }
    return snap.size;
  });

  // --- importHistory → import_history ---
  total += await run('importHistory → import_history', async (conn, db) => {
    const snap = await db.collection('importHistory').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const id = doc.id;
      const createdAt = toSqlDatetime(d.createdAt || d.created_at);
      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO import_history (id, user_id, user_email, file_name, total_rows, success_count, error_count, errors_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE success_count = VALUES(success_count), error_count = VALUES(error_count)`,
          [
            id,
            d.userId || d.user_email || null,
            d.userEmail || d.user_email || null,
            d.fileName || d.file_name || null,
            d.totalRows ?? d.total_rows ?? 0,
            d.successCount ?? d.success_count ?? 0,
            d.errorCount ?? d.error_count ?? 0,
            toJson(d.errors || d.errorsJson || d.errors_json),
          ],
        );
      }
    }
    return snap.size;
  });

  // --- EmailTemplates → email_templates ---
  total += await run('EmailTemplates → email_templates', async (conn, db) => {
    const snap = await db.collection('EmailTemplates').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const id = doc.id;
      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO email_templates (id, name, subject, body_html, body_text, created_by)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE name = VALUES(name), subject = VALUES(subject), body_html = VALUES(body_html), body_text = VALUES(body_text)`,
          [
            id,
            d.name || '',
            d.subject || '',
            d.bodyHtml || d.body_html || '',
            d.bodyText || d.body_text || '',
            d.createdBy || d.created_by || null,
          ],
        );
      }
    }
    return snap.size;
  });

  // --- EmailCampaigns → email_campaigns ---
  total += await run('EmailCampaigns → email_campaigns', async (conn, db) => {
    const snap = await db.collection('EmailCampaigns').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const id = doc.id;
      const scheduledAt = toSqlDatetime(d.scheduledAt || d.scheduled_at);
      const sentAt = toSqlDatetime(d.sentAt || d.sent_at);
      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO email_campaigns (id, name, template_id, subject, status, scheduled_at, sent_at, recipient_count, payload, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), sent_at = VALUES(sent_at), recipient_count = VALUES(recipient_count)`,
          [
            id,
            d.name || '',
            d.templateId || d.template_id || null,
            d.subject || '',
            d.status || 'draft',
            scheduledAt,
            sentAt,
            d.recipientCount ?? d.recipient_count ?? 0,
            toJson(d),
            d.createdBy || d.created_by || null,
          ],
        );
      }
    }
    return snap.size;
  });

  // --- FieldConfigs → field_configs ---
  total += await run('FieldConfigs → field_configs', async (conn, db) => {
    const snap = await db.collection('FieldConfigs').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const id = doc.id;
      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO field_configs (id, section, field_key, label, type, options_json, order_index, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE section = VALUES(section), label = VALUES(label), type = VALUES(type), options_json = VALUES(options_json), order_index = VALUES(order_index)`,
          [
            id,
            d.section || null,
            d.field_key || d.fieldKey || null,
            d.label || null,
            d.type || null,
            toJson(d.options || d.options_json),
            d.order_index ?? d.orderIndex ?? 0,
            toJson(d),
          ],
        );
      }
    }
    return snap.size;
  });

  // --- TravelSessions → travel_sessions ---
  total += await run('TravelSessions → travel_sessions', async (conn, db) => {
    const snap = await db.collection('TravelSessions').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const id = doc.id;
      const startTime = toSqlDatetime(d.startTime || d.start_time);
      const endTime = toSqlDatetime(d.endTime || d.end_time);
      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO travel_sessions (id, user_id, user_email, start_time, end_time, start_location, end_location, distance_km, payload)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE end_time = VALUES(end_time), end_location = VALUES(end_location), distance_km = VALUES(distance_km)`,
          [
            id,
            d.userId || d.user_id || null,
            d.userEmail || d.user_email || null,
            startTime,
            endTime,
            toJson(d.startLocation || d.start_location),
            toJson(d.endLocation || d.end_location),
            d.distance_km ?? d.distanceKm ?? null,
            toJson(d),
          ],
        );
      }
    }
    return snap.size;
  });

  // --- MeetingCompletions → meeting_completions ---
  total += await run('MeetingCompletions → meeting_completions', async (conn, db) => {
    const snap = await db.collection('MeetingCompletions').get();
    for (const doc of snap.docs) {
      const d = doc.data();
      const id = doc.id;
      const completedAt = toSqlDatetime(d.completedAt || d.completed_at);
      if (!DRY_RUN) {
        await conn.execute(
          `INSERT INTO meeting_completions (id, meeting_id, username, outcome, completed_at, payload)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE outcome = VALUES(outcome), completed_at = VALUES(completed_at)`,
          [id, d.meetingId || d.meeting_id || '', d.username || null, d.outcome || null, completedAt, toJson(d)],
        );
      }
    }
    return snap.size;
  });

  if (conn) await conn.end();
  console.log('\nTotal documents exported:', total);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
