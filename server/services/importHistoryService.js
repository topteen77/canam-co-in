import db from '../db.js';
import { resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

const toJson = (v) => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : v);
const fromJson = (r, key, altKey) => {
  const v = r[key] ?? r[altKey];
  return v == null ? null : typeof v === 'string' ? (v ? JSON.parse(v) : null) : v;
};

function normalizeRow(r, cols) {
  const id = r.id ?? r.firebase_id;
  const user_email = r.user_email ?? r.importedBy ?? r.userEmail;
  const file_name = r.file_name ?? r.fileName;
  const total_rows = r.total_rows ?? r.totalCount ?? 0;
  const success_count = r.success_count ?? r.successCount ?? 0;
  const error_count = r.error_count ?? r.errorCount ?? 0;
  const errors_json = fromJson(r, 'errors_json', 'allResults');
  const created_at = r.created_at ?? r.createdAt ?? r.importDate;
  return {
    ...r,
    id,
    firebase_id: r.firebase_id,
    user_id: r.user_id,
    user_email,
    importedBy: user_email,
    file_name,
    fileName: file_name,
    total_rows,
    totalCount: total_rows,
    success_count,
    successCount: success_count,
    error_count,
    errorCount: error_count,
    errors_json,
    allResults: errors_json,
    created_at,
    createdAt: created_at,
    importDate: created_at,
  };
}

export const getAllImportHistory = async (opts = {}) => {
  try {
    const table = await resolveTableNameOrFallback(['importhistory', 'import_history', 'importHistory'], 'importhistory');
    const cols = await getColumns(table);
    const orderCol = cols.has('created_at') ? 'created_at' : (cols.has('createdAt') ? 'createdAt' : (cols.has('importDate') ? 'importDate' : 'firebase_id'));
    let sql = `SELECT * FROM ${table} ORDER BY \`${orderCol}\` DESC`;
    const params = [];
    if (opts.limit) {
      sql += ' LIMIT ?';
      params.push(opts.limit);
    }
    const [rows] = params.length ? await db.query(sql, params) : await db.query(sql);
    return (rows || []).map((r) => normalizeRow(r, cols));
  } catch (error) {
    console.error('getAllImportHistory error:', error.message);
    return [];
  }
};

export const addImportHistory = async (data) => {
  const table = await resolveTableNameOrFallback(['importhistory', 'import_history', 'importHistory'], 'importhistory');
  const cols = await getColumns(table);
  const id = data.id || `imp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  if (cols.has('firebase_id') && cols.has('importDate')) {
    await db.execute(
      `INSERT INTO ${table} (firebase_id, importDate, importedBy, successCount, duplicateCount, errorCount, totalCount, allResults, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        id,
        data.importDate ?? new Date().toISOString(),
        data.userEmail ?? data.importedBy ?? data.user_email ?? null,
        data.successCount ?? data.success_count ?? 0,
        data.duplicateCount ?? 0,
        data.errorCount ?? data.error_count ?? 0,
        data.totalRows ?? data.totalCount ?? data.total_rows ?? 0,
        toJson(data.errorsJson ?? data.errors ?? data.allResults ?? null),
      ]
    );
  } else {
    await db.execute(
      `INSERT INTO ${table} (id, user_id, user_email, file_name, total_rows, success_count, error_count, errors_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.userId ?? null,
        data.userEmail ?? data.importedBy ?? null,
        data.fileName ?? data.file_name ?? null,
        data.totalRows ?? data.total_rows ?? 0,
        data.successCount ?? data.success_count ?? 0,
        data.errorCount ?? data.error_count ?? 0,
        toJson(data.errorsJson ?? data.errors ?? null),
      ]
    );
  }
  return { success: true, id };
};
