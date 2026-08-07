import db from '../db.js';
import { resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

function normalizeRow(row, cols) {
  if (!row) return null;
  const id = row.id ?? row.firebase_id;
  const details = row.details ?? (typeof row.details === 'string' ? (row.details ? JSON.parse(row.details) : {}) : {});
  return {
    ...row,
    id,
    firebase_id: row.firebase_id,
    user_id: row.user_id ?? row.userId,
    userId: row.userId ?? row.user_id,
    user_name: row.user_name ?? row.userName,
    userName: row.userName ?? row.user_name,
    user_email: row.user_email ?? row.userEmail,
    userEmail: row.userEmail ?? row.user_email,
    contact_info: row.contact_info ?? row.contactInfo,
    contactInfo: row.contactInfo ?? row.contact_info,
    lead_id: row.lead_id ?? row.leadId,
    leadId: row.leadId ?? row.lead_id,
    lead_name: row.lead_name ?? row.leadName,
    leadName: row.leadName ?? row.lead_name,
    created_at: row.created_at ?? row.createdAt,
    createdAt: row.created_at ?? row.createdAt,
    details: typeof details === 'object' ? details : (details ? JSON.parse(details) : {}),
  };
}

export const addCTA = async (data) => {
  try {
    const table = await resolveTableNameOrFallback(['ctaactivities', 'CTAActivities'], 'ctaactivities');
    const cols = await getColumns(table);
    const uniqueId = data.id || Date.now().toString();
    const detailsJson = data.details ? JSON.stringify(data.details) : '{}';
    const timestamp = data.timestamp
      ? new Date(data.timestamp).toISOString().slice(0, 19).replace('T', ' ')
      : new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (cols.has('firebase_id') && cols.has('userId')) {
      await db.execute(
        `INSERT INTO ${table} (firebase_id, userId, userName, userEmail, action, contactInfo, leadId, leadName, device, timestamp, details, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uniqueId,
          data.userId ?? '',
          data.userName ?? '',
          data.userEmail ?? '',
          data.action ?? '',
          data.contactInfo ?? '',
          data.leadId ?? '',
          data.leadName ?? 'Unknown',
          data.device ?? 'desktop',
          timestamp,
          detailsJson,
        ]
      );
    } else {
      await db.execute(
        `INSERT INTO ${table} (id, user_id, user_name, user_email, action, contact_info, lead_id, lead_name, device, timestamp, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uniqueId,
          data.userId ?? '',
          data.userName ?? '',
          data.userEmail ?? '',
          data.action ?? '',
          data.contactInfo ?? '',
          data.leadId ?? '',
          data.leadName ?? 'Unknown',
          data.device ?? 'desktop',
          timestamp,
          detailsJson,
        ]
      );
    }
    return { success: true, id: uniqueId };
  } catch (error) {
    console.error('❌ Service Error (addCTA):', error.message);
    throw error;
  }
};

export const updateCTA = async (id, updates) => {
  try {
    const table = await resolveTableNameOrFallback(['ctaactivities', 'CTAActivities'], 'ctaactivities');
    const cols = await getColumns(table);
    const idCol = cols.has('id') ? 'id' : (cols.has('firebase_id') ? 'firebase_id' : 'id');
    const fields = [];
    const values = [];
    if (updates.duration !== undefined) {
      fields.push('duration = ?');
      values.push(updates.duration);
    }
    if (updates.endTimestamp) {
      const endTime = new Date(updates.endTimestamp).toISOString().slice(0, 19).replace('T', ' ');
      const endCol = cols.has('end_timestamp') ? 'end_timestamp' : (cols.has('endTimestamp') ? 'endTimestamp' : null);
      if (endCol) {
        fields.push(`\`${endCol}\` = ?`);
        values.push(endTime);
      }
    }
    if (updates.messageText) {
      const msgCol = cols.has('message_text') ? 'message_text' : (cols.has('messageText') ? 'messageText' : null);
      if (msgCol) {
        fields.push(`\`${msgCol}\` = ?`);
        values.push(updates.messageText);
      }
    }
    if (fields.length === 0) return { success: true };
    values.push(id);
    await db.execute(`UPDATE ${table} SET ${fields.join(', ')} WHERE \`${idCol}\` = ?`, values);
    return { success: true };
  } catch (error) {
    console.error('❌ Service Error (updateCTA):', error.message);
    throw error;
  }
};

export const getCTAReport = async () => {
  try {
    const table = await resolveTableNameOrFallback(['ctaactivities', 'CTAActivities'], 'ctaactivities');
    const cols = await getColumns(table);
    const orderCol = cols.has('timestamp') ? 'timestamp' : (cols.has('created_at') ? 'created_at' : 'timestamp');
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY \`${orderCol}\` DESC LIMIT 100`);
    return (rows || []).map((row) => normalizeRow(row, cols));
  } catch (error) {
    console.error('❌ Service Error (getCTAReport):', error.message);
    return [];
  }
};
