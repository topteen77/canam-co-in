import db from '../db.js';
import { resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

const toJson = (v) => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : v);
const fromJson = (r, key) => {
  const v = r[key];
  return v == null ? null : typeof v === 'string' ? (v ? JSON.parse(v) : null) : v;
};

export const getAllTravelSessions = async (opts = {}) => {
  try {
    const table = await resolveTableNameOrFallback(['travel_sessions', 'TravelSessions'], 'travel_sessions');
    const cols = await getColumns(table);
    const orderCol = cols.has('start_time') ? 'start_time' : 'startTime';
    let sql = `SELECT * FROM ${table} ORDER BY \`${orderCol}\` DESC`;
    const params = [];
    if (opts.limit) {
      sql += ' LIMIT ?';
      params.push(opts.limit);
    }
    const [rows] = params.length ? await db.query(sql, params) : await db.query(sql);
    return (rows || []).map((r) => ({
      ...r,
      start_location: fromJson(r, 'start_location') ?? fromJson(r, 'startLocation'),
      end_location: fromJson(r, 'end_location') ?? fromJson(r, 'endLocation'),
      payload: fromJson(r, 'payload'),
    }));
  } catch (error) {
    console.error('❌ Error getting travel sessions:', error.message);
    return [];
  }
};

export const addTravelSession = async (data) => {
  const table = await resolveTableNameOrFallback(['travel_sessions', 'TravelSessions'], 'travel_sessions');
  const cols = await getColumns(table);
  const id = data.id || `ts_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const fmt = (d) => (d ? new Date(d).toISOString().slice(0, 19).replace('T', ' ') : null);
  const pick = (a, b) => (cols.has(a) ? a : (cols.has(b) ? b : a));
  await db.execute(
    `INSERT INTO ${table} (\`${pick('id', 'firebase_id')}\`, \`${pick('user_id', 'userId')}\`, \`${pick('user_email', 'userEmail')}\`, \`${pick('start_time', 'startTime')}\`, \`${pick('end_time', 'endTime')}\`, \`${pick('start_location', 'startLocation')}\`, \`${pick('end_location', 'endLocation')}\`, \`${pick('distance_km', 'distanceKm')}\`, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.userId ?? null,
      data.userEmail ?? null,
      fmt(data.startTime ?? data.start_time),
      fmt(data.endTime ?? data.end_time),
      toJson(data.startLocation ?? data.start_location),
      toJson(data.endLocation ?? data.end_location),
      data.distance_km ?? data.distanceKm ?? null,
      toJson(data.payload ?? data),
    ]
  );
  return { success: true, id };
};
