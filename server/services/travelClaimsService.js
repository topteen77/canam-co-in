import db from '../db.js';
import { resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

const toJson = (v) => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : v);

function normTrips(r) {
  const trips = r.trips ?? r.trips_json;
  return trips ? (typeof trips === 'string' ? JSON.parse(trips) : trips) : [];
}

export const getAllTravelClaims = async () => {
  try {
    const table = await resolveTableNameOrFallback(['travelclaims', 'travel_claims', 'TravelClaims'], 'travelclaims');
    const cols = await getColumns(table);
    const orderCol = cols.has('created_at') ? 'created_at' : 'createdAt';
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY \`${orderCol}\` DESC`);
    return (rows || []).map((r) => ({ ...r, trips: normTrips(r) }));
  } catch (error) {
    console.error('❌ Error getting travel claims:', error.message);
    return [];
  }
};

export const getTravelClaimsByUser = async (userEmail) => {
  try {
    const table = await resolveTableNameOrFallback(['travelclaims', 'travel_claims', 'TravelClaims'], 'travelclaims');
    const cols = await getColumns(table);
    const emailCol = cols.has('user_email') ? 'user_email' : 'userEmail';
    const orderCol = cols.has('created_at') ? 'created_at' : 'createdAt';
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${emailCol}\` = ? ORDER BY \`${orderCol}\` DESC`, [userEmail]);
    return (rows || []).map((r) => ({ ...r, trips: normTrips(r) }));
  } catch (error) {
    console.error('❌ Error getting travel claims by user:', error.message);
    return [];
  }
};

export const addTravelClaim = async (data) => {
  const table = await resolveTableNameOrFallback(['travelclaims', 'travel_claims', 'TravelClaims'], 'travelclaims');
  const cols = await getColumns(table);
  const id = `tc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const pick = (a, b) => (cols.has(a) ? a : (cols.has(b) ? b : a));
  await db.execute(
    `INSERT INTO ${table} (\`${pick('id', 'firebase_id')}\`, \`${pick('user_id', 'userId')}\`, \`${pick('user_name', 'userName')}\`, \`${pick('user_email', 'userEmail')}\`, month, year, trips, \`${pick('total_distance', 'totalDistance')}\`, \`${pick('total_amount', 'totalAmount')}\`, status, \`${pick('submitted_at', 'submittedAt')}\`, \`${pick('created_at', 'createdAt')}\`, \`${pick('updated_at', 'updatedAt')}\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      data.userId ?? data.user_email,
      data.userName ?? '',
      data.userEmail ?? data.user_id,
      data.month,
      data.year,
      toJson(data.trips),
      data.totalDistance ?? 0,
      data.totalAmount ?? 0,
      data.status ?? 'submitted',
      data.submittedAt ? new Date(data.submittedAt).toISOString().slice(0, 19).replace('T', ' ') : null,
    ]
  );
  return { success: true, id };
};

export const updateTravelClaim = async (id, updates) => {
  const table = await resolveTableNameOrFallback(['travelclaims', 'travel_claims', 'TravelClaims'], 'travelclaims');
  const cols = await getColumns(table);
  const fields = [];
  const values = [];
  if (updates.status != null && cols.has('status')) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  const approvedAtCol = cols.has('approved_at') ? 'approved_at' : 'approvedAt';
  if (updates.approvedAt != null && cols.has(approvedAtCol)) {
    fields.push(`\`${approvedAtCol}\` = ?`);
    values.push(new Date(updates.approvedAt).toISOString().slice(0, 19).replace('T', ' '));
  }
  const approvedByCol = cols.has('approved_by') ? 'approved_by' : 'approvedBy';
  if (updates.approvedBy != null && cols.has(approvedByCol)) {
    fields.push(`\`${approvedByCol}\` = ?`);
    values.push(updates.approvedBy);
  }
  const rejectionCol = cols.has('rejection_reason') ? 'rejection_reason' : 'rejectionReason';
  if (updates.rejectionReason != null && cols.has(rejectionCol)) {
    fields.push(`\`${rejectionCol}\` = ?`);
    values.push(updates.rejectionReason);
  }
  if (fields.length === 0) return { success: true };
  const idCol = cols.has('id') ? 'id' : 'firebase_id';
  values.push(id);
  const updatedCol = cols.has('updated_at') ? 'updated_at' : 'updatedAt';
  await db.execute(`UPDATE ${table} SET ${fields.join(', ')}, \`${updatedCol}\` = NOW() WHERE \`${idCol}\` = ?`, values);
  return { success: true };
};
