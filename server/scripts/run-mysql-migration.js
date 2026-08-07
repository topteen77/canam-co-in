/**
 * Run MySQL migration: creates new tables for Firestore collections.
 * Usage: from project root: node server/scripts/run-mysql-migration.js
 * Requires: .env with DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (or defaults to crm_db)
 */
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..'); // server/scripts -> project root
dotenv.config({ path: path.join(root, '.env') });       // project root .env
dotenv.config({ path: path.join(root, 'server', '.env') }); // server/.env

const dbName = process.env.DB_NAME || 'crm_db';
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: dbName,
  multipleStatements: true,
};

const FRESH = process.argv.includes('--fresh');

async function run() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      multipleStatements: true,
    });
    console.log('Connected to MySQL');
    if (FRESH) {
      await conn.query(`DROP DATABASE IF EXISTS \`${dbName.replace(/`/g, '``')}\``);
      console.log('Dropped', dbName, '(fresh)');
    }
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName.replace(/`/g, '``')}\``);
    console.log('Database', dbName, 'ready');
    await conn.query(`USE \`${dbName.replace(/`/g, '``')}\``);

    const sqlPath = path.resolve(__dirname, '../migrations/001_firestore_collections_to_mysql.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await conn.query(sql);
    console.log('Migration completed (all tables created/verified).');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

run();
