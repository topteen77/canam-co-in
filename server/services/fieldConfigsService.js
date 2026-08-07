import db from '../db.js';
import { resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

const toJson = (v) => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : v);
const fromJson = (r, key, altKey) => {
  const v = r[key] ?? r[altKey];
  return v == null ? null : typeof v === 'string' ? (v ? JSON.parse(v) : null) : v;
};

function normalizeRow(r, cols) {
  const label = r.label ?? r.displayName;
  const type = r.type ?? r.fieldType;
  const options_json = fromJson(r, 'options_json', 'options');
  const section = r.section ?? r.category;
  const field_key = r.field_key ?? r.fieldKey ?? r.id;
  const id = r.id ?? r.firebase_id;
  return {
    ...r,
    id,
    firebase_id: r.firebase_id,
    section,
    field_key,
    label,
    displayName: label,
    type,
    fieldType: type,
    options_json,
    options: options_json,
    order_index: r.order_index ?? r.orderIndex ?? 0,
    orderIndex: r.order_index ?? r.orderIndex ?? 0,
    payload: fromJson(r, 'payload', 'payload'),
  };
}

export const getAllFieldConfigs = async () => {
  try {
    const table = await resolveTableNameOrFallback(['fieldconfigs', 'field_configs', 'FieldConfigs'], 'fieldconfigs');
    const cols = await getColumns(table);
    const orderA = cols.has('section') ? 'section' : (cols.has('category') ? 'category' : 'id');
    const orderB = cols.has('order_index') ? 'order_index' : (cols.has('orderIndex') ? 'orderIndex' : 'id');
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY \`${orderA}\`, \`${orderB}\`, id`);
    return (rows || []).map((r) => normalizeRow(r, cols));
  } catch (error) {
    console.error('getAllFieldConfigs error:', error.message);
    return [];
  }
};

export const getFieldConfigById = async (id) => {
  try {
    const table = await resolveTableNameOrFallback(['fieldconfigs', 'field_configs', 'FieldConfigs'], 'fieldconfigs');
    const cols = await getColumns(table);
    const idCol = cols.has('id') ? 'id' : 'firebase_id';
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${idCol}\` = ?`, [id]);
    if (!rows.length) return null;
    return normalizeRow(rows[0], cols);
  } catch (error) {
    console.error('getFieldConfigById error:', error.message);
    return null;
  }
};

export const setFieldConfig = async (id, data) => {
  const table = await resolveTableNameOrFallback(['fieldconfigs', 'field_configs', 'FieldConfigs'], 'fieldconfigs');
  const cols = await getColumns(table);
  const existing = await getFieldConfigById(id);
  const label = data.label ?? data.displayName ?? null;
  const type = data.type ?? data.fieldType ?? null;
  const optionsVal = toJson(data.options_json ?? data.options ?? null);
  const section = data.section ?? data.category ?? null;
  const fieldKey = data.field_key ?? data.fieldKey ?? data.id ?? null;
  const orderIdx = data.order_index ?? data.orderIndex ?? 0;

  if (existing) {
    if (cols.has('label')) {
      await db.execute(
        `UPDATE ${table} SET section = ?, field_key = ?, label = ?, type = ?, options_json = ?, order_index = ?, payload = ?, updated_at = NOW() WHERE id = ?`,
        [section, fieldKey, label, type, optionsVal, orderIdx, toJson(data.payload ?? null), id]
      );
    } else {
      await db.execute(
        `UPDATE ${table} SET category = ?, displayName = ?, fieldType = ?, options = ? WHERE id = ? OR firebase_id = ?`,
        [section, label, type, optionsVal, id, id]
      );
    }
    return { success: true, id };
  }
  if (cols.has('firebase_id') && cols.has('displayName')) {
    await db.execute(
      `INSERT INTO ${table} (firebase_id, id, displayName, fieldType, required, category, options) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, fieldKey ?? id, label, type, data.required ?? null, section, optionsVal]
    );
  } else {
    await db.execute(
      `INSERT INTO ${table} (id, section, field_key, label, type, options_json, order_index, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, section, fieldKey, label, type, optionsVal, orderIdx, toJson(data.payload ?? null)]
    );
  }
  return { success: true, id };
};

export const updateFieldConfig = async (id, updates) => {
  const table = await resolveTableNameOrFallback(['fieldconfigs', 'field_configs', 'FieldConfigs'], 'fieldconfigs');
  const cols = await getColumns(table);
  const idCol = cols.has('id') ? 'id' : 'firebase_id';
  const fields = [];
  const values = [];
  if (updates.section != null || updates.category != null) {
    const col = cols.has('section') ? 'section' : 'category';
    fields.push(`\`${col}\` = ?`);
    values.push(updates.section ?? updates.category);
  }
  if (updates.label != null || updates.displayName != null) {
    const col = cols.has('label') ? 'label' : 'displayName';
    fields.push(`\`${col}\` = ?`);
    values.push(updates.label ?? updates.displayName);
  }
  if (updates.type != null || updates.fieldType != null) {
    const col = cols.has('type') ? 'type' : 'fieldType';
    fields.push(`\`${col}\` = ?`);
    values.push(updates.type ?? updates.fieldType);
  }
  if (updates.options_json != null || updates.options != null) {
    const col = cols.has('options_json') ? 'options_json' : 'options';
    fields.push(`\`${col}\` = ?`);
    values.push(toJson(updates.options_json ?? updates.options));
  }
  if (updates.order_index != null || updates.orderIndex != null) {
    if (cols.has('order_index')) {
      fields.push('order_index = ?');
      values.push(updates.order_index ?? updates.orderIndex);
    }
  }
  if (fields.length === 0) return { success: true };
  values.push(id);
  const setClause = cols.has('updated_at') ? [...fields, 'updated_at = NOW()'].join(', ') : fields.join(', ');
  await db.execute(`UPDATE ${table} SET ${setClause} WHERE \`${idCol}\` = ?`, values);
  return { success: true };
};
