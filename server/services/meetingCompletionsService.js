import db from '../db.js';
import { resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

const toJson = (v) => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : v);
const fromJson = (r, key) => {
  const v = r[key];
  return v == null ? null : typeof v === 'string' ? (v ? JSON.parse(v) : null) : v;
};

export const getMeetingCompletionsByMeetingId = async (meetingId) => {
  try {
    const table = await resolveTableNameOrFallback(['meeting_completions', 'MeetingCompletions'], 'meeting_completions');
    const cols = await getColumns(table);
    const meetingCol = cols.has('meeting_id') ? 'meeting_id' : 'meetingId';
    const orderCol = cols.has('completed_at') ? 'completed_at' : 'completedAt';
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${meetingCol}\` = ? ORDER BY \`${orderCol}\` DESC`, [meetingId]);
    return (rows || []).map((r) => ({ ...r, payload: fromJson(r, 'payload') }));
  } catch (error) {
    console.error('❌ Error getting meeting completions:', error.message);
    return [];
  }
};

export const addMeetingCompletion = async (data) => {
  const table = await resolveTableNameOrFallback(['meeting_completions', 'MeetingCompletions'], 'meeting_completions');
  const cols = await getColumns(table);
  const id = data.id || `mc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const completedAt = data.completedAt ?? data.completed_at
    ? new Date(data.completedAt ?? data.completed_at).toISOString().slice(0, 19).replace('T', ' ')
    : null;
  const idCol = cols.has('id') ? 'id' : 'firebase_id';
  const meetingCol = cols.has('meeting_id') ? 'meeting_id' : 'meetingId';
  const completedCol = cols.has('completed_at') ? 'completed_at' : 'completedAt';
  await db.execute(
    `INSERT INTO ${table} (\`${idCol}\`, \`${meetingCol}\`, username, outcome, \`${completedCol}\`, payload)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.meetingId ?? data.meeting_id, data.username ?? null, data.outcome ?? null, completedAt, toJson(data.payload ?? data)]
  );
  return { success: true, id };
};
