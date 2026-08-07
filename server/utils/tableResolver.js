/**
 * Resolve actual table name when DB may have PascalCase (dump) or snake_case (migration).
 * Pass possible names e.g. ['email_campaigns', 'EmailCampaigns'] - returns first that exists.
 */
import db from '../db.js';

const cache = new Map();

export async function resolveTableName(possibleNames) {
  const lower = [...new Set(possibleNames.map((n) => n.toLowerCase()))];
  const key = lower.sort().join(',');
  if (cache.has(key)) return cache.get(key);
  const [rows] = await db.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) IN (?) 
     LIMIT 1`,
    [lower]
  );
  const name = rows && rows[0] ? '`' + rows[0].TABLE_NAME + '`' : null;
  cache.set(key, name);
  return name;
}

/** Get column names for a table (use resolved table name). */
export async function getColumns(tableName) {
  if (!tableName) return new Set();
  const raw = tableName.replace(/`/g, '');
  if (cache.has('cols:' + raw)) return cache.get('cols:' + raw);
  const [rows] = await db.query('SHOW COLUMNS FROM ??', [raw]);
  const cols = new Set((rows || []).map((r) => r.Field));
  cache.set('cols:' + raw, cols);
  return cols;
}

/** Resolve table and return backticked name, or fallback if none found. */
export async function resolveTableNameOrFallback(possibleNames, fallback) {
  const resolved = await resolveTableName(possibleNames);
  return resolved || '`' + fallback + '`';
}

/** Pick the password column from a Set of column names. Prefers standard names, then customPassword/defaultPassword (dump schema). */
export function pickPasswordCol(cols) {
  if (!cols) return null;
  const preferred = ['password', 'password_hash', 'hashed_password', 'customPassword', 'defaultPassword'];
  for (const name of preferred) {
    if (cols.has(name)) return name;
  }
  const lower = (c) => String(c).toLowerCase();
  for (const c of cols) {
    const l = lower(c);
    if (l === 'password' || l === 'password_hash' || l === 'hashed_password' || l === 'custompassword' || l === 'defaultpassword') return c;
  }
  return null;
}
