import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const db = mysql.createPool({
  // Prefer .env (local). Fallbacks match production so a push without env does not break prod.
  host: process.env.DB_HOST || '65.0.81.36',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'phpadmin',
  password: process.env.DB_PASSWORD || '[vtvHpb-m!UDd843',
  database: process.env.DB_NAME || 'db_nod_crm',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Return DATE/DATETIME/TIMESTAMP as strings so we can treat stored UTC correctly (append 'Z') for APIs
  dateStrings: ['DATE', 'DATETIME', 'TIMESTAMP']
});

export default db;
