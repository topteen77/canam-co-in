import db from '../db.js';
import { resolveTableName, resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

const ACTIVITY_TABLE_NAMES = ['activity_logs', 'ActivityLogs'];

function normalizeActivityRow(row) {
  if (!row) return null;
  const userId = row.user_id ?? row.userId ?? row.user_id;
  return {
    id: row.id ?? row.firebase_id,
    user_id: userId,
    userId,
    userEmail: row.userEmail ?? row.user_email ?? userId,
    action: row.action ?? row.action_type ?? row.actionType,
    description: row.description ?? '',
    timestamp: row.timestamp ?? row.createdAt ?? row.created_at,
    device: row.device ?? row.device_type ?? row.deviceType ?? null,
    leadName: row.leadName ?? row.lead_name ?? null,
    leadId: row.leadId ?? row.lead_id ?? null,
    details: typeof row.details === 'string' ? (() => { try { return JSON.parse(row.details); } catch { return null; } })() : (row.details || null),
  };
}

export const getAllActivities = async () => {
  try {
    const table = await resolveTableName(ACTIVITY_TABLE_NAMES);
    if (!table) return [];
    const cols = await getColumns(table);
    const timeCol = cols.has('timestamp') ? 'timestamp' : (cols.has('createdAt') ? 'createdAt' : (cols.has('created_at') ? 'created_at' : 'id'));
    const [rows] = await db.query(
      `SELECT * FROM ${table} ORDER BY \`${timeCol}\` DESC`
    );
    return (rows || []).map(normalizeActivityRow);
  } catch (error) {
    console.error('❌ Error getting activities:', error.message);
    return [];
  }
};