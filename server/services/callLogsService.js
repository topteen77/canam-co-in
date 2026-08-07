import db from '../db.js';
import { resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

function normalizeCallLogRow(row) {
  if (!row) return null;
  return {
    id: row.id ?? row.firebase_id,
    phone_number: row.phone_number ?? row.phoneNumber,
    lead_id: row.lead_id ?? row.leadId,
    lead_name: row.lead_name ?? row.leadName,
    contact_name: row.contact_name ?? row.contactName,
    call_type: row.call_type ?? row.callType,
    timestamp: row.timestamp,
    duration: row.duration,
    notes: row.notes,
    outcome: row.outcome,
    user_id: row.user_id ?? row.userId,
    user_email: row.user_email ?? row.userEmail,
    user_name: row.user_name ?? row.userName,
    created_at: row.created_at ?? row.createdAt,
  };
}

export const getAllCallLogs = async (opts = {}) => {
  try {
    const table = await resolveTableNameOrFallback(['call_logs', 'CallLogs'], 'call_logs');
    const cols = await getColumns(table);
    const orderCol = cols.has('created_at') ? 'created_at' : (cols.has('createdAt') ? 'createdAt' : 'created_at');
    let sql = `SELECT * FROM ${table} ORDER BY \`${orderCol}\` DESC`;
    const params = [];
    if (opts.limit) {
      sql += ' LIMIT ?';
      params.push(opts.limit);
    }
    const [rows] = params.length ? await db.query(sql, params) : await db.query(sql);
    return (rows || []).map(normalizeCallLogRow);
  } catch (error) {
    console.error('❌ Error getting call logs:', error.message);
    return [];
  }
};

export const getCallLogsByLead = async (leadId) => {
  try {
    const table = await resolveTableNameOrFallback(['call_logs', 'CallLogs'], 'call_logs');
    const cols = await getColumns(table);
    const leadCol = cols.has('lead_id') ? 'lead_id' : 'leadId';
    const orderCol = cols.has('created_at') ? 'created_at' : 'createdAt';
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${leadCol}\` = ? ORDER BY \`${orderCol}\` DESC`, [leadId]);
    return (rows || []).map(normalizeCallLogRow);
  } catch (error) {
    console.error('❌ Error getting call logs by lead:', error.message);
    return [];
  }
};

export const getCallLogsByUser = async (userEmail) => {
  try {
    const table = await resolveTableNameOrFallback(['call_logs', 'CallLogs'], 'call_logs');
    const cols = await getColumns(table);
    const emailCol = cols.has('user_email') ? 'user_email' : 'userEmail';
    const orderCol = cols.has('created_at') ? 'created_at' : 'createdAt';
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${emailCol}\` = ? ORDER BY \`${orderCol}\` DESC`, [userEmail]);
    return (rows || []).map(normalizeCallLogRow);
  } catch (error) {
    console.error('❌ Error getting call logs by user:', error.message);
    return [];
  }
};

export const addCallLog = async (data) => {
  try {
    const table = await resolveTableNameOrFallback(['call_logs', 'CallLogs'], 'call_logs');
    const cols = await getColumns(table);
    const id = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pick = (a, b) => (cols.has(a) ? a : (cols.has(b) ? b : null));
    const pairs = [
      [pick('id', 'firebase_id'), id],
      [pick('phone_number', 'phoneNumber'), data.phoneNumber ?? ''],
      [pick('lead_id', 'leadId'), data.leadId ?? null],
      [pick('lead_name', 'leadName'), data.leadName ?? ''],
      [pick('contact_name', 'contactName'), data.contactName ?? ''],
      [pick('call_type', 'callType'), data.callType ?? 'lead'],
      [pick('timestamp', 'createdAt'), data.timestamp ?? null],
      [pick('duration', 'duration'), data.duration ?? 0],
      [pick('notes', 'notes'), data.notes ?? ''],
      [pick('outcome', 'outcome'), data.outcome ?? 'answered'],
      [pick('user_id', 'userId'), data.userId ?? data.userEmail ?? null],
      [pick('user_email', 'userEmail'), data.userEmail ?? data.userId ?? null],
      [pick('user_name', 'userName'), data.userName ?? null],
    ].filter(([c]) => c);
    const colList = pairs.map(([c]) => c);
    const values = pairs.map(([, v]) => v);
    await db.execute(
      `INSERT INTO ${table} (\`${colList.join('`, `')}\`) VALUES (${colList.map(() => '?').join(', ')})`,
      values
    );
    return { success: true, id };
  } catch (error) {
    console.error('❌ Error adding call log:', error.message);
    throw error;
  }
};
