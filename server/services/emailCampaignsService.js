import db from '../db.js';
import { resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

const toJson = (v) => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : v);
const fromJson = (r, key, altKey) => {
  const v = r[key] ?? r[altKey];
  return v == null ? null : typeof v === 'string' ? (v ? JSON.parse(v) : null) : v;
};

function normalizeRow(r, cols) {
  const id = r.id ?? r.firebase_id;
  const template_id = r.template_id ?? r.templateId;
  const created_at = r.created_at ?? r.createdAt;
  const created_by = r.created_by ?? r.createdBy;
  const sent_at = r.sent_at ?? r.sentAt;
  const scheduled_at = r.scheduled_at ?? r.scheduledAt;
  const recipient_count = r.recipient_count ?? r.recipientCount;
  const payload = fromJson(r, 'payload', 'payload');
  return {
    ...r,
    id,
    firebase_id: r.firebase_id,
    template_id,
    templateId: template_id,
    created_at,
    createdAt: created_at,
    created_by,
    createdBy: created_by,
    sent_at,
    sentAt: sent_at,
    scheduled_at,
    scheduledAt: scheduled_at,
    recipient_count,
    recipientCount: recipient_count,
    payload,
  };
}

export const getAllEmailCampaigns = async () => {
  try {
    const table = await resolveTableNameOrFallback(['emailcampaigns', 'email_campaigns', 'EmailCampaigns'], 'emailcampaigns');
    const cols = await getColumns(table);
    const orderCol = cols.has('created_at') ? 'created_at' : (cols.has('createdAt') ? 'createdAt' : 'id');
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY \`${orderCol}\` DESC`);
    return (rows || []).map((r) => normalizeRow(r, cols));
  } catch (error) {
    console.error('getAllEmailCampaigns error:', error.message);
    return [];
  }
};

export const getEmailCampaignById = async (id) => {
  try {
    const table = await resolveTableNameOrFallback(['emailcampaigns', 'email_campaigns', 'EmailCampaigns'], 'emailcampaigns');
    const cols = await getColumns(table);
    const idCol = cols.has('id') ? 'id' : 'firebase_id';
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${idCol}\` = ?`, [id]);
    return rows.length ? normalizeRow(rows[0], cols) : null;
  } catch (error) {
    console.error('getEmailCampaignById error:', error.message);
    return null;
  }
};

export const addEmailCampaign = async (data) => {
  const table = await resolveTableNameOrFallback(['emailcampaigns', 'email_campaigns', 'EmailCampaigns'], 'emailcampaigns');
  const cols = await getColumns(table);
  const id = data.id || `ec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  if (cols.has('firebase_id') && cols.has('templateId')) {
    await db.execute(
      `INSERT INTO ${table} (firebase_id, name, templateId, templateName, subject, body, filters, status, recipientCount, createdBy, createdAt, sentAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
      [
        id,
        data.name ?? '',
        data.templateId ?? data.template_id ?? null,
        data.templateName ?? null,
        data.subject ?? '',
        data.body ?? '',
        toJson(data.filters ?? null),
        data.status ?? 'draft',
        data.recipientCount ?? data.recipient_count ?? 0,
        data.createdBy ?? data.created_by ?? null,
        data.sentAt ? new Date(data.sentAt).toISOString().slice(0, 19).replace('T', ' ') : null,
      ]
    );
  } else {
    await db.execute(
      `INSERT INTO ${table} (id, name, template_id, subject, status, scheduled_at, sent_at, recipient_count, payload, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name ?? '',
        data.templateId ?? data.template_id ?? null,
        data.subject ?? '',
        data.status ?? 'draft',
        data.scheduledAt ? new Date(data.scheduledAt).toISOString().slice(0, 19).replace('T', ' ') : null,
        data.sentAt ? new Date(data.sentAt).toISOString().slice(0, 19).replace('T', ' ') : null,
        data.recipientCount ?? data.recipient_count ?? 0,
        toJson(data.payload ?? data),
        data.createdBy ?? data.created_by ?? null,
      ]
    );
  }
  return { success: true, id };
};

export const updateEmailCampaign = async (id, updates) => {
  const table = await resolveTableNameOrFallback(['emailcampaigns', 'email_campaigns', 'EmailCampaigns'], 'emailcampaigns');
  const cols = await getColumns(table);
  const idCol = cols.has('id') ? 'id' : 'firebase_id';
  const fields = [];
  const values = [];
  if (updates.status != null) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.sentAt != null) {
    const sentCol = cols.has('sent_at') ? 'sent_at' : (cols.has('sentAt') ? 'sentAt' : null);
    if (sentCol) {
      fields.push(`\`${sentCol}\` = ?`);
      values.push(new Date(updates.sentAt).toISOString().slice(0, 19).replace('T', ' '));
    }
  }
  if (updates.recipientCount != null) {
    const rcCol = cols.has('recipient_count') ? 'recipient_count' : (cols.has('recipientCount') ? 'recipientCount' : null);
    if (rcCol) {
      fields.push(`\`${rcCol}\` = ?`);
      values.push(updates.recipientCount);
    }
  }
  if (updates.payload != null) {
    if (cols.has('payload')) {
      fields.push('payload = ?');
      values.push(typeof updates.payload === 'object' ? JSON.stringify(updates.payload) : updates.payload);
    }
  }
  if (fields.length === 0) return { success: true };
  values.push(id);
  const setClause = cols.has('updated_at') ? [...fields, 'updated_at = NOW()'].join(', ') : fields.join(', ');
  await db.execute(`UPDATE ${table} SET ${setClause} WHERE \`${idCol}\` = ?`, values);
  return { success: true };
};
