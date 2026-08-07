import db from '../db.js';
import { resolveTableName, resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

const toJson = (v) => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : v);
const fromJson = (r, key) => {
  const v = r[key];
  return v == null ? null : typeof v === 'string' ? (v ? JSON.parse(v) : null) : v;
};

const SIGNUP_TABLE_NAMES = ['websitesignupleads', 'website_signup_leads', 'WebsiteSignupLeads'];

export const getAllWebsiteSignupLeads = async (opts = {}) => {
  try {
    // If table doesn't exist, return [] so frontend shows empty state instead of error
    const table = await resolveTableName(SIGNUP_TABLE_NAMES);
    if (!table) return [];
    const cols = await getColumns(table);
    const orderCol = cols.has('created_at') ? 'created_at' : 'createdAt';
    let sql = `SELECT * FROM ${table} ORDER BY \`${orderCol}\` DESC`;
    const params = [];
    if (opts.limit) {
      sql += ' LIMIT ?';
      params.push(opts.limit);
    }
    const [rows] = params.length ? await db.query(sql, params) : await db.query(sql);
    return (rows || []).map((r) => ({ ...r, payload: fromJson(r, 'payload') }));
  } catch (error) {
    console.error('❌ Error getting website signup leads:', error.message);
    return [];
  }
};

export const addWebsiteSignupLead = async (data) => {
  const table = await resolveTableNameOrFallback(SIGNUP_TABLE_NAMES, 'websitesignupleads');
  const cols = await getColumns(table);
  const id = data.id || `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const idCol = cols.has('id') ? 'id' : 'firebase_id';
  await db.execute(
    `INSERT INTO ${table} (\`${idCol}\`, name, email, phone, stage, payload) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.name ?? null, data.email ?? null, data.phone ?? null, data.stage ?? 'Signed Up', toJson(data.payload ?? data)]
  );
  return { success: true, id };
};

export const updateWebsiteSignupLead = async (id, updates) => {
  const table = await resolveTableNameOrFallback(SIGNUP_TABLE_NAMES, 'websitesignupleads');
  const cols = await getColumns(table);
  const fields = [];
  const values = [];
  if (updates.stage != null && cols.has('stage')) {
    fields.push('stage = ?');
    values.push(updates.stage);
  }
  if (updates.name != null && cols.has('name')) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.email != null && cols.has('email')) {
    fields.push('email = ?');
    values.push(updates.email);
  }
  if (updates.phone != null && cols.has('phone')) {
    fields.push('phone = ?');
    values.push(updates.phone);
  }
  if (updates.payload != null && cols.has('payload')) {
    fields.push('payload = ?');
    values.push(typeof updates.payload === 'object' ? JSON.stringify(updates.payload) : updates.payload);
  }
  if (fields.length === 0) return { success: true };
  const idCol = cols.has('id') ? 'id' : 'firebase_id';
  values.push(id);
  const updatedCol = cols.has('updated_at') ? 'updated_at' : 'updatedAt';
  await db.execute(`UPDATE ${table} SET ${fields.join(', ')}, \`${updatedCol}\` = NOW() WHERE \`${idCol}\` = ?`, values);
  return { success: true };
};
