/**
 * Import dump.sql into MySQL using .env credentials.
 * Runs one statement at a time; reconnects on connection failure so one bad statement doesn't stop the rest.
 * Run from project root: node server/scripts/import-dump.js
 */
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
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
  multipleStatements: true,
};

async function getConnection() {
  const c = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    multipleStatements: true,
  });
  await c.query(`CREATE DATABASE IF NOT EXISTS \`${dbName.replace(/`/g, '``')}\``);
  await c.query(`USE \`${dbName.replace(/`/g, '``')}\``);
  return c;
}

function isConnectionError(e) {
  const m = (e && e.message) || '';
  return /ECONNRESET|connection closed|closed state|Connection lost/i.test(m);
}

const FRESH = process.argv.includes('--fresh');

async function main() {
  let conn = await getConnection();
  if (FRESH) {
    console.log('Dropping database', dbName, 'for fresh import...');
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName.replace(/`/g, '``')}\``);
    await conn.query(`CREATE DATABASE \`${dbName.replace(/`/g, '``')}\``);
    await conn.query(`USE \`${dbName.replace(/`/g, '``')}\``);
    console.log('Database recreated.');
  }
  console.log('Database', dbName, 'ready');

  const dumpPath = path.join(root, 'dump.sql');
  if (!fs.existsSync(dumpPath)) {
    console.error('dump.sql not found at', dumpPath);
    process.exit(1);
  }
  console.log('Reading dump.sql...');
  const sql = fs.readFileSync(dumpPath, 'utf8');
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));
  console.log('Statements:', statements.length, '- executing one by one (reconnect on failure)');

  let done = 0;
  let skipped = 0;
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ';';
    try {
      await conn.query(stmt);
      done++;
    } catch (e) {
      if (isConnectionError(e)) {
        try {
          if (conn) await conn.end();
        } catch (_) {}
        conn = await getConnection();
        try {
          await conn.query(stmt);
          done++;
        } catch (e2) {
          skipped++;
          if (skipped <= 5) console.warn('  Skip', i + 1, ':', e2.message.slice(0, 70));
        }
      } else {
        skipped++;
        if (skipped <= 5) console.warn('  Skip', i + 1, ':', e.message.slice(0, 70));
      }
    }
    if ((i + 1) % 500 === 0) console.log('  ', i + 1, '/', statements.length, '- ok:', done, 'skip:', skipped);
  }
  try {
    if (conn) await conn.end();
  } catch (_) {}
  console.log('Import completed. OK:', done, 'Skipped:', skipped);
}

main().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
