/**
 * Migration: Add `id` INT AUTO_INCREMENT as primary key; keep firebase_id for legacy.
 * Run after: dump.sql + align-dump-as-real-db.js (tables have firebase_id as PK).
 *
 * For each table that has firebase_id as PK:
 *   1. DROP PRIMARY KEY
 *   2. ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY
 *   3. Make firebase_id nullable; add UNIQUE so lookups by firebase_id still work
 *
 * Usage: node server/scripts/002_primary_key_id.js
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

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crm_db',
};

async function main() {
  let conn;
  try {
    conn = await mysql.createConnection(dbConfig);
    console.log('Connected to', dbConfig.database);

    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
      [dbConfig.database]
    );

    for (const { TABLE_NAME: table } of tables || []) {
      try {
        const [cols] = await conn.query('SHOW COLUMNS FROM ??', [table]);
        const colSet = new Set((cols || []).map((c) => c.Field));
        const hasFirebaseId = colSet.has('firebase_id');
        const hasId = colSet.has('id');

        if (!hasFirebaseId) continue;

        const [pk] = await conn.query(
          `SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE 
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY'`,
          [dbConfig.database, table]
        );
        const pkCol = pk && pk[0] ? pk[0].COLUMN_NAME : null;

        if (pkCol === 'id' && hasId) {
          console.log('Skip (already has id as PK):', table);
          continue;
        }

        if (pkCol !== 'firebase_id') {
          console.log('Skip (PK is not firebase_id):', table, 'PK=', pkCol);
          continue;
        }

        await conn.query(`ALTER TABLE \`${table}\` DROP PRIMARY KEY`);
        await conn.query(
          `ALTER TABLE \`${table}\` ADD COLUMN id INT NOT NULL AUTO_INCREMENT FIRST, ADD PRIMARY KEY (id)`
        );
        await conn.query(`ALTER TABLE \`${table}\` MODIFY firebase_id VARCHAR(255) NULL`);
        const ukName = `uk_${table.replace(/[^a-zA-Z0-9_]/g, '_')}_firebase_id`;
        try {
          await conn.query(`ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${ukName}\` (firebase_id)`);
        } catch (e) {
          if (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_DUP_ENTRY') {
            console.log('  (unique key on firebase_id already exists or nulls)');
          } else throw e;
        }
        console.log('OK:', table, '- id added as PK, firebase_id nullable+unique');
      } catch (e) {
        if (e.code === 'ER_MULTIPLE_PRI_KEY') {
          console.log('Skip (already has id PK?):', table);
        } else {
          console.warn('Error', table, ':', e.message);
        }
      }
    }

    console.log('\nDone. Tables now use id as primary key; firebase_id kept for legacy.');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
