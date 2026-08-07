import db from '../db.js';

// Resolve actual table name (EmailTemplates from dump vs email_templates from migration)
let _tableName = null;
async function getTableName() {
  if (_tableName) return _tableName;
  const [rows] = await db.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND LOWER(TABLE_NAME) IN ('email_templates', 'emailtemplates') 
     LIMIT 1`
  );
  if (rows && rows[0]) {
    _tableName = '`' + rows[0].TABLE_NAME + '`';
    return _tableName;
  }
  return '`email_templates`'; // fallback for fresh installs
}

// Get column names for the table
let _columns = null;
async function getColumns() {
  if (_columns) return _columns;
  const table = await getTableName();
  const [rows] = await db.query(`SHOW COLUMNS FROM ${table}`);
  _columns = new Set((rows || []).map((r) => r.Field));
  return _columns;
}

// Parse attachments from JSON string (MySQL TEXT column)
function parseAttachments(val) {
  if (val == null) return null;
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : null;
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Normalize a row to a consistent shape for the API (id, name, subject, body, createdBy, etc.)
function normalizeRow(row) {
  if (!row) return null;
  const cols = row;
  const id = cols.id ?? cols.firebase_id ?? null;
  const body = cols.body ?? cols.body_html ?? cols.body_text ?? '';
  const attachments = parseAttachments(cols.attachments);
  return {
    id: id != null ? String(id) : null,
    firebase_id: cols.firebase_id != null ? String(cols.firebase_id) : null,
    name: cols.name ?? '',
    subject: cols.subject ?? '',
    body: typeof body === 'string' ? body : (body ?? ''),
    body_html: cols.body_html ?? body,
    body_text: cols.body_text ?? (typeof body === 'string' ? body : ''),
    is_system_template: cols.is_system_template ?? cols.isSystemTemplate ?? null,
    isSystemTemplate: !!cols.is_system_template || !!cols.isSystemTemplate,
    created_by: cols.created_by ?? cols.createdBy ?? null,
    createdBy: cols.created_by ?? cols.createdBy ?? null,
    created_at: cols.created_at ?? cols.createdAt ?? null,
    createdAt: cols.created_at ?? cols.createdAt ?? null,
    updated_at: cols.updated_at ?? cols.updatedAt ?? null,
    updatedAt: cols.updated_at ?? cols.updatedAt ?? null,
    attachments: attachments ?? null,
  };
}

export const getAllEmailTemplates = async () => {
  try {
    const table = await getTableName();
    const cols = await getColumns();
    const idCol = cols.has('id') ? 'id' : (cols.has('firebase_id') ? 'firebase_id' : 'id');
    const orderCol = cols.has('created_at') ? 'created_at' : (cols.has('createdAt') ? 'createdAt' : 'name');
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY \`${orderCol}\` DESC`);
    return (rows || []).map(normalizeRow).filter((r) => r && r.id != null);
  } catch (e) {
    console.error('getAllEmailTemplates error:', e.message);
    return [];
  }
};

export const getEmailTemplateById = async (id) => {
  try {
    const table = await getTableName();
    const cols = await getColumns();
    const idCol = cols.has('id') ? 'id' : (cols.has('firebase_id') ? 'firebase_id' : 'id');
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${idCol}\` = ?`, [id]);
    return rows.length ? normalizeRow(rows[0]) : null;
  } catch (e) {
    console.error('getEmailTemplateById error:', e.message);
    return null;
  }
};

export const addEmailTemplate = async (data) => {
  const table = await getTableName();
  const cols = await getColumns();
  const id = data.id || `et_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const name = data.name ?? '';
  const subject = data.subject ?? '';
  const bodyVal = data.bodyHtml ?? data.body_html ?? data.body ?? data.bodyText ?? data.body_text ?? '';
  const attachmentsVal = data.attachments != null
    ? (Array.isArray(data.attachments) ? JSON.stringify(data.attachments) : data.attachments)
    : null;

  if (cols.has('firebase_id') && !cols.has('body_html')) {
    if (cols.has('attachments')) {
      await db.execute(
        `INSERT INTO ${table} (firebase_id, name, subject, body, createdBy, createdAt, updatedAt, attachments) VALUES (?, ?, ?, ?, ?, NOW(), NOW(), ?)`,
        [id, name, subject, bodyVal, data.createdBy ?? null, attachmentsVal]
      );
    } else {
      await db.execute(
        `INSERT INTO ${table} (firebase_id, name, subject, body, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [id, name, subject, bodyVal, data.createdBy ?? null]
      );
    }
  } else {
    await db.execute(
      `INSERT INTO ${table} (id, name, subject, body_html, body_text, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, subject, bodyVal, bodyVal, data.createdBy ?? null]
    );
  }
  return { success: true, id };
};

export const updateEmailTemplate = async (id, updates) => {
  const table = await getTableName();
  const cols = await getColumns();
  const idCol = cols.has('id') ? 'id' : (cols.has('firebase_id') ? 'firebase_id' : 'id');
  const idVal = id != null ? String(id).trim() : null;
  if (!idVal) throw new Error('Template id is required for update');

  const fields = [];
  const values = [];

  if (updates.name != null) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.subject != null) {
    fields.push('subject = ?');
    values.push(updates.subject);
  }
  const bodyVal = updates.bodyHtml ?? updates.body_html ?? updates.body ?? updates.bodyText ?? updates.body_text;
  if (bodyVal != null) {
    if (cols.has('body')) {
      fields.push('body = ?');
      values.push(bodyVal);
    } else {
      fields.push('body_html = ?');
      values.push(bodyVal);
      if (cols.has('body_text')) {
        fields.push('body_text = ?');
        values.push(bodyVal);
      }
    }
  }
  if (updates.attachments !== undefined && cols.has('attachments')) {
    const attVal = Array.isArray(updates.attachments)
      ? JSON.stringify(updates.attachments)
      : (updates.attachments == null ? null : String(updates.attachments));
    fields.push('attachments = ?');
    values.push(attVal);
  }
  if (cols.has('updated_at')) {
    fields.push('updated_at = NOW()');
  } else if (cols.has('updatedAt')) {
    fields.push('updatedAt = NOW()');
  }
  if (fields.length === 0) return { success: true };
  values.push(idVal);
  const [result] = await db.execute(`UPDATE ${table} SET ${fields.join(', ')} WHERE \`${idCol}\` = ?`, values);
  if (result && result.affectedRows === 0) throw new Error('Template not found or no changes applied');
  return { success: true };
};

export const deleteEmailTemplate = async (id) => {
  const table = await getTableName();
  const cols = await getColumns();
  const idCol = cols.has('id') ? 'id' : (cols.has('firebase_id') ? 'firebase_id' : 'id');
  await db.execute(`DELETE FROM ${table} WHERE \`${idCol}\` = ?`, [id]);
  return { success: true };
};
