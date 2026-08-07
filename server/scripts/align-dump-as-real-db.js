/**
 * Align the imported dump.sql as a real MySQL database:
 * - Add PRIMARY KEY on firebase_id (convert TEXT to VARCHAR(255) first)
 * - Run after: mysql -u root -p crm_db < dump.sql
 *
 * Usage: node server/scripts/align-dump-as-real-db.js
 * Requires: .env DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, 'server', '.env') });

const dbName = process.env.DB_NAME || 'crm_db';
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: dbName,
};

// Tables that exist in dump.sql (from grep CREATE TABLE)
const DUMP_TABLES = [
  'Agent_Catagory', 'Agents_', 'Attendance', 'AttendanceRecords', 'CTAActivities',
  'Companies', 'CompanyUsers', 'Contacts', 'Created_on', 'Documents', 'EmailCampaigns',
  'EmailTemplates', 'FieldConfigs', 'FirebaseProjects', 'Followup_', 'Last_Remarks',
  'Lead_Source', 'LeadTags', 'Leads', 'LiveLocations', 'LocationPermissions',
  'MeetingCheckInRecords', 'NotificationPreferences', 'TravelClaims', 'Updated_at',
  'Users', 'WebsiteSignupLeads', 'importHistory', 'onboarding', 'users'
];

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    console.log('Connected to', dbConfig.database);

    for (const table of DUMP_TABLES) {
      try {
        const [cols] = await conn.query('SHOW COLUMNS FROM ??', [table]);
        if (!cols || cols.length === 0) {
          console.log('Skip (missing):', table);
          continue;
        }
        const hasFirebaseId = cols.some((c) => c.Field === 'firebase_id');
        if (!hasFirebaseId) {
          console.log('Skip (no firebase_id):', table);
          continue;
        }
        await conn.query(`ALTER TABLE \`${table}\` MODIFY firebase_id VARCHAR(255) NOT NULL`);
        await conn.query(`ALTER TABLE \`${table}\` ADD PRIMARY KEY (firebase_id)`);
        console.log('OK:', table, '- PRIMARY KEY (firebase_id)');
      } catch (e) {
        if (e.code === 'ER_MULTIPLE_PRI_KEY') {
          console.log('Skip (already has PK):', table);
        } else if (e.code === 'ER_NO_SUCH_TABLE') {
          console.log('Skip (table not found):', table);
        } else {
          console.warn('Error', table, ':', e.message);
        }
      }
    }

    console.log('\nDone. Dump is aligned as a real database (PK on firebase_id).');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
