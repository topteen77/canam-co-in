/**
 * Leads service — schema aligned with dump.sql (database: iapply_crm).
 * Table: Leads (PascalCase in dump). Identifier: firebase_id or id (both text).
 * dump.sql columns are camelCase (agencyName, leadSource, contacts, followUps, etc.).
 * resolveColumnName maps camelCase → actual DB column names for writes.
 */
import db from '../db.js';

const toJson = (data) => JSON.stringify(data || []);

// Convert snake_case key to camelCase (e.g. agency_name → agencyName)
function snakeToCamel(s) {
  if (!s || typeof s !== 'string') return s;
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
// Normalize row keys to camelCase for frontend (dump.sql uses camelCase; support both)
function normalizeRowToCamel(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const key = /_/.test(k) ? snakeToCamel(k) : k;
    out[key] = v;
  }
  return out;
}

// Resolve actual table name — dump.sql uses Leads (case-insensitive)
let _leadsTableName = null;
async function getLeadsTable() {
    if (_leadsTableName) return _leadsTableName;
    const [rows] = await db.query(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'leads' LIMIT 1"
    );
    if (rows && rows[0]) {
        _leadsTableName = '`' + rows[0].TABLE_NAME + '`';
        return _leadsTableName;
    }
    throw new Error("Leads table not found. Use database from dump.sql (iapply_crm).");
}

// Get actual column names from the table (supports both camelCase and snake_case schemas)
let _leadsColumns = null;
async function getLeadsColumns() {
    if (_leadsColumns) return _leadsColumns;
    const table = await getLeadsTable();
    const [rows] = await db.query(`SHOW COLUMNS FROM ${table}`);
    _leadsColumns = new Set((rows || []).map((r) => r.Field));
    return _leadsColumns;
}

// camelCase -> snake_case (e.g. agencyName -> agency_name)
function camelToSnake(str) {
    return str.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

// Resolve DB column name: use key if it exists, else try snake_case, else case-insensitive match
async function resolveColumnName(key) {
    const columns = await getLeadsColumns();
    if (columns.has(key)) return key;
    const snake = camelToSnake(key);
    if (columns.has(snake)) return snake;
    const keyLower = key.toLowerCase();
    for (const c of columns) {
        if (c && String(c).toLowerCase() === keyLower) return c;
    }
    return null;
}

// Get value from row by column name (case-insensitive) — MySQL drivers can return different key casing
function getRowVal(row, colName) {
    if (row[colName] !== undefined && row[colName] !== null) return row[colName];
    const key = Object.keys(row || {}).find((k) => k.toLowerCase() === colName.toLowerCase());
    return key ? row[key] : undefined;
}

// Parse JSON columns so frontend gets arrays/objects (MySQL TEXT columns come as strings)
function parseJsonField(val, fallback) {
    if (val == null || val === '') return fallback;
    if (typeof val === 'object' && !Array.isArray(val)) return val;
    if (Array.isArray(val)) return val;
    try {
        const parsed = JSON.parse(val);
        return parsed != null ? parsed : fallback;
    } catch (e) {
        return fallback;
    }
}

export const getAllLeads = async () => {
    const table = await getLeadsTable();
    const cols = await getLeadsColumns();
    const colList = [...cols];
    const idCol = colList.find((c) => c.toLowerCase() === 'id') || 'id';
    const firebaseIdCol = colList.find((c) => c.toLowerCase() === 'firebase_id') || 'firebase_id';
    const orderCol = (await resolveColumnName('createdAt')) || 'createdAt';
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY \`${orderCol}\` DESC`);
    return rows.map((r) => {
        const idVal = getRowVal(r, idCol);
        const firebaseVal = getRowVal(r, firebaseIdCol);
        const rawId = idVal ?? firebaseVal ?? '';
        const idStr = (rawId !== '' && rawId != null && String(rawId).trim() !== '' && String(rawId) !== 'null')
            ? String(rawId).trim()
            : (firebaseVal != null && String(firebaseVal).trim() !== '')
                ? String(firebaseVal).trim()
                : String(rawId ?? '').trim();
        const normalized = normalizeRowToCamel(r);
        const out = { ...normalized, id: idStr || null, firebase_id: firebaseVal };
        let followUpsRaw = parseJsonField(out.followUps, []);
        out.followUps = Array.isArray(followUpsRaw) ? followUpsRaw.map((f) => {
            if (!f || typeof f !== 'object') return f;
            const type = (f.type === 'Meeting' || String(f.type || '').toLowerCase() === 'meeting') ? 'Meeting' : (f.type || 'Call');
            const status = (f.status === 'Done' || String(f.status || '').toLowerCase() === 'done') ? 'Done' : (f.status === 'Planned' || String(f.status || '').toLowerCase() === 'planned') ? 'Planned' : (f.status || 'Planned');
            return { ...f, type, status };
        }) : [];
        out.contacts = parseJsonField(out.contacts, []);
        out.tags = parseJsonField(out.tags, []);
        out.countryInterest = parseJsonField(out.countryInterest, []);
        if (out.agencyDocuments != null) out.agencyDocuments = parseJsonField(out.agencyDocuments, undefined);
        return out;
    });
};

const ADD_LEAD_KEYS = [
    'agencyName', 'status', 'agentCategory', 'leadSource', 'tags', 'accountManager', 'salesPerson',
    'contacts', 'followUps', 'countryInterest', 'agencyDocuments', 'remarks', 'websiteLink', 'icpScore', 'createdBy',
    'onboardingDate', 'applicants'
];

export const addLead = async (lead) => {
    const table = await getLeadsTable();
    const cols = await getLeadsColumns();
    const firebaseIdCol = cols && [...cols].find((c) => String(c).toLowerCase() === 'firebase_id');
    // Generate a stable id for new leads (table has no auto_increment; id/firebase_id are TEXT and often NULL)
    const generatedId = lead.firebase_id || lead.id || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const insertCols = [];
    const placeholders = [];
    const values = [];
    if (firebaseIdCol) {
        insertCols.push(firebaseIdCol);
        placeholders.push('?');
        values.push(generatedId);
    }
    for (const key of ADD_LEAD_KEYS) {
        const col = await resolveColumnName(key);
        if (!col) continue;
        insertCols.push(col);
        placeholders.push('?');
        if (key === 'agencyName') values.push(lead.agencyName || '');
        else if (key === 'status') values.push(lead.status || 'New');
        else if (key === 'agentCategory') values.push(lead.agentCategory || 'Beginner');
        else if (key === 'leadSource') values.push(lead.leadSource || 'Website');
        else if (key === 'tags') values.push(toJson(lead.tags));
        else if (key === 'accountManager') values.push(lead.accountManager || null);
        else if (key === 'salesPerson') values.push(lead.salesPerson || null);
        else if (key === 'contacts') values.push(toJson(lead.contacts));
        else if (key === 'followUps') values.push(toJson(lead.followUps));
        else if (key === 'countryInterest') values.push(toJson(lead.countryInterest));
        else if (key === 'agencyDocuments') values.push(toJson(lead.agencyDocuments));
        else if (key === 'remarks') values.push(lead.remarks || '');
        else if (key === 'websiteLink') values.push(lead.websiteLink || '');
        else if (key === 'icpScore') values.push(lead.icpScore ?? 0);
        else if (key === 'createdBy') values.push(lead.createdBy || 'System');
        else if (key === 'onboardingDate') values.push(lead.onboardingDate || null);
        else if (key === 'applicants') values.push(lead.applicants || null);
        else values.push(null);
    }
    const createdAtCol = await resolveColumnName('createdAt');
    const updatedAtCol = await resolveColumnName('updatedAt');
    if (createdAtCol) { insertCols.push(createdAtCol); placeholders.push('NOW()'); }
    if (updatedAtCol) { insertCols.push(updatedAtCol); placeholders.push('NOW()'); }
    const query = `INSERT INTO ${table} (${insertCols.map((c) => '`' + c + '`').join(', ')}) VALUES (${placeholders.join(', ')})`;
    const [result] = await db.execute(query, values);
    // Return stable id for frontend (insertId is 0 when table has no auto_increment)
    const returnedId = result.insertId && result.insertId > 0 ? String(result.insertId) : generatedId;
    return { success: true, id: returnedId, firebase_id: generatedId };
};

export const updateLead = async (id, updates) => {
    const rawId = id == null ? '' : String(id).trim();
    if (!rawId || rawId === 'undefined' || rawId === 'null') {
        throw new Error('Lead id is missing or invalid. Cannot update.');
    }

    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
        if (key === 'id' || key === 'firebase_id') continue;
        const col = await resolveColumnName(key);
        if (!col) continue;
        fields.push(`\`${col}\` = ?`);
        values.push(value === undefined || value === null ? null : (typeof value === 'object' ? JSON.stringify(value) : value));
    }
    if (fields.length === 0) return { success: true };
    const updatedAtCol = (await resolveColumnName('updatedAt')) || (await resolveColumnName('updated_at')) || 'updatedAt';
    fields.push(`\`${updatedAtCol}\` = NOW()`);
    const table = await getLeadsTable();
    const cols = await getLeadsColumns();
    const colList = [...cols];
    const idCol = colList.find((c) => c.toLowerCase() === 'id');
    const firebaseIdCol = colList.find((c) => c.toLowerCase() === 'firebase_id');

    const runUpdate = (whereCol, whereVal) => {
        const q = `UPDATE ${table} SET ${fields.join(', ')} WHERE \`${whereCol}\` = ?`;
        return db.execute(q, [...values, whereVal]);
    };

    const isNumericId = /^\d+$/.test(rawId);
    // iapply_crm: id column is TEXT — always pass string for id column so WHERE id = ? matches
    const idValAsString = rawId;
    const idValAsNumber = isNumericId ? parseInt(rawId, 10) : null;
    let result;
    if (firebaseIdCol && !isNumericId) {
        [result] = await runUpdate(firebaseIdCol, rawId);
    }
    if ((!result || result.affectedRows === 0) && idCol) {
        [result] = await runUpdate(idCol, idValAsString);
    }
    if ((!result || result.affectedRows === 0) && idCol && idValAsNumber != null) {
        [result] = await runUpdate(idCol, idValAsNumber);
    }
    if ((!result || result.affectedRows === 0) && firebaseIdCol) {
        [result] = await runUpdate(firebaseIdCol, rawId);
    }
    if (!result || result.affectedRows === 0) {
        throw new Error('No lead found with this id or row was not changed. Check that the lead exists and the id is correct.');
    }
    return { success: true };
};


export const appendFollowUp = async (id, newFollowUp) => {
    const rawId = id == null ? '' : String(id).trim();
    if (!rawId || rawId === 'undefined' || rawId === 'null') {
        throw new Error('Lead id is missing or invalid. Cannot add follow-up.');
    }

    const table = await getLeadsTable();
    const cols = await getLeadsColumns();
    const colList = [...cols];
    const idCol = colList.find((c) => c.toLowerCase() === 'id');
    const firebaseIdCol = colList.find((c) => c.toLowerCase() === 'firebase_id');
    const followUpsCol = (await resolveColumnName('followUps')) || 'followUps';
    
    // 1. Fetch current follow-ups
    let query = `SELECT \`${followUpsCol}\` FROM ${table} WHERE `;
    let whereCol = idCol || firebaseIdCol || 'id';
    query += `\`${whereCol}\` = ?`;
    
    // We try id first, then firebase_id if needed, but for simplicity let's use the first available
    const [rows] = await db.query(query, [rawId]);
    
    if (!rows || rows.length === 0) {
        // Try the other column if it exists
        if (idCol && firebaseIdCol) {
            const otherCol = whereCol === idCol ? firebaseIdCol : idCol;
            const [rows2] = await db.query(`SELECT \`${followUpsCol}\` FROM ${table} WHERE \`${otherCol}\` = ?`, [rawId]);
            if (rows2 && rows2.length > 0) return await proceedWithAppend(rawId, otherCol, rows2[0][followUpsCol], newFollowUp);
        }
        throw new Error('Lead not found');
    }

    return await proceedWithAppend(rawId, whereCol, rows[0][followUpsCol], newFollowUp);
};

async function proceedWithAppend(id, whereCol, followUpsRaw, newFollowUp) {
    const table = await getLeadsTable();
    const followUpsCol = (await resolveColumnName('followUps')) || 'followUps';
    let currentFollowUps = parseJsonField(followUpsRaw, []);
    if (!Array.isArray(currentFollowUps)) currentFollowUps = [];
    
    const updatedFollowUps = [...currentFollowUps, newFollowUp];
    const updatedAtCol = (await resolveColumnName('updatedAt')) || 'updatedAt';
    
    const q = `UPDATE ${table} SET \`${followUpsCol}\` = ?, \`${updatedAtCol}\` = NOW() WHERE \`${whereCol}\` = ?`;
    await db.execute(q, [JSON.stringify(updatedFollowUps), id]);
    return { success: true };
}

export const deleteLead = async (id) => {
    const table = await getLeadsTable();
    const cols = await getLeadsColumns();
    const colList = [...cols];
    const idCol = colList.find((c) => c.toLowerCase() === 'id');
    const firebaseIdCol = colList.find((c) => c.toLowerCase() === 'firebase_id');
    const whereVal = /^\d+$/.test(String(id)) ? parseInt(id, 10) : String(id);
    if (idCol) {
        const [result] = await db.execute(`DELETE FROM ${table} WHERE \`${idCol}\` = ?`, [whereVal]);
        if (result.affectedRows > 0) return { success: true };
    }
    if (firebaseIdCol) {
        await db.execute(`DELETE FROM ${table} WHERE \`${firebaseIdCol}\` = ?`, [String(id)]);
    }
    return { success: true };
};