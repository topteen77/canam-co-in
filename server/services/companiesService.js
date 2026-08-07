import db from '../db.js';
import { resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

const toJson = (v) => (v == null ? null : typeof v === 'object' ? JSON.stringify(v) : v);
const fromJson = (r, key) => {
  const v = r[key];
  return v == null ? null : typeof v === 'string' ? (v ? JSON.parse(v) : null) : v;
};

async function companiesTable() {
  return resolveTableNameOrFallback(['companies', 'Companies'], 'companies');
}
async function companyUsersTable() {
  return resolveTableNameOrFallback(['companyusers', 'company_users', 'CompanyUsers'], 'companyusers');
}
async function firebaseProjectsTable() {
  return resolveTableNameOrFallback(['firebaseprojects', 'firebase_projects', 'FirebaseProjects'], 'firebaseprojects');
}

// --- COMPANIES ---
export const getAllCompanies = async () => {
  try {
    const table = await companiesTable();
    const cols = await getColumns(table);
    const orderCol = cols.has('created_at') ? 'created_at' : 'createdAt';
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY \`${orderCol}\` DESC`);
    return (rows || []).map((r) => ({ ...r, branding: fromJson(r, 'branding') }));
  } catch (error) {
    console.error('❌ Error getting companies:', error.message);
    return [];
  }
};

export const getCompanyById = async (id) => {
  try {
    const table = await companiesTable();
    const cols = await getColumns(table);
    const idCol = cols.has('id') ? 'id' : 'firebase_id';
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${idCol}\` = ?`, [id]);
    if (!rows.length) return null;
    const r = rows[0];
    return { ...r, branding: fromJson(r, 'branding') };
  } catch (error) {
    console.error('❌ Error getting company:', error.message);
    return null;
  }
};

export const addCompany = async (data) => {
  const table = await companiesTable();
  const cols = await getColumns(table);
  const id = data.id || `co_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const pick = (a, b) => (cols.has(a) ? a : (cols.has(b) ? b : a));
  await db.execute(
    `INSERT INTO ${table} (\`${pick('id', 'firebase_id')}\`, name, subdomain, \`${pick('contact_email', 'contactEmail')}\`, \`${pick('admin_name', 'adminName')}\`, \`${pick('admin_email', 'adminEmail')}\`, \`${pick('admin_password', 'adminPassword')}\`, \`${pick('firebase_project_id', 'firebaseProjectId')}\`, \`${pick('custom_url', 'customUrl')}\`, status, branding, \`${pick('created_at', 'createdAt')}\`, \`${pick('created_by', 'createdBy')}\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [
      id,
      data.name,
      data.subdomain ?? null,
      data.contactEmail ?? null,
      data.adminName ?? null,
      data.adminEmail ?? null,
      data.adminPassword ?? null,
      data.firebaseProjectId ?? null,
      data.customUrl ?? null,
      data.status ?? 'active',
      toJson(data.branding),
      data.createdBy ?? null,
    ]
  );
  return { success: true, id };
};

const companyUpdateMap = {
  name: 'name', subdomain: 'subdomain', contactEmail: 'contact_email', adminName: 'admin_name',
  adminEmail: 'admin_email', customUrl: 'custom_url', status: 'status', branding: 'branding',
  contact_email: 'contact_email', admin_name: 'admin_name', admin_email: 'admin_email', custom_url: 'custom_url'
};

export const updateCompany = async (id, updates) => {
  const table = await companiesTable();
  const cols = await getColumns(table);
  const fields = [];
  const values = [];
  for (const [k, v] of Object.entries(updates)) {
    const col = companyUpdateMap[k] || k;
    if (!col || !cols.has(col)) continue;
    if (!['name', 'subdomain', 'contact_email', 'admin_name', 'admin_email', 'custom_url', 'status', 'branding'].includes(col)) continue;
    fields.push(`\`${col}\` = ?`);
    values.push(col === 'branding' ? toJson(v) : v);
  }
  if (fields.length === 0) return { success: true };
  const idCol = cols.has('id') ? 'id' : 'firebase_id';
  values.push(id);
  const updatedCol = cols.has('updated_at') ? 'updated_at' : 'updatedAt';
  await db.execute(`UPDATE ${table} SET ${fields.join(', ')}, \`${updatedCol}\` = NOW() WHERE \`${idCol}\` = ?`, values);
  return { success: true };
};

export const deleteCompany = async (id) => {
  const table = await companiesTable();
  const cols = await getColumns(table);
  const idCol = cols.has('id') ? 'id' : 'firebase_id';
  await db.execute(`DELETE FROM ${table} WHERE \`${idCol}\` = ?`, [id]);
  return { success: true };
};

// --- COMPANY USERS ---
export const getCompanyUsers = async (companyId) => {
  try {
    const table = await companyUsersTable();
    const cols = await getColumns(table);
    const companyCol = cols.has('company_id') ? 'company_id' : 'companyId';
    const orderCol = cols.has('created_at') ? 'created_at' : 'createdAt';
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${companyCol}\` = ? ORDER BY \`${orderCol}\` DESC`, [companyId]);
    return rows || [];
  } catch (error) {
    console.error('❌ Error getting company users:', error.message);
    return [];
  }
};

export const addCompanyUser = async (data) => {
  const table = await companyUsersTable();
  const cols = await getColumns(table);
  const id = `cu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const idCol = cols.has('id') ? 'id' : 'firebase_id';
  const companyCol = cols.has('company_id') ? 'company_id' : 'companyId';
  await db.execute(
    `INSERT INTO ${table} (\`${idCol}\`, \`${companyCol}\`, name, email, password, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.companyId, data.name ?? '', data.email, data.password ?? null, data.role ?? 'User', data.status ?? 'active']
  );
  return { success: true, id };
};

// --- FIREBASE PROJECTS ---
export const getAllFirebaseProjects = async () => {
  try {
    const table = await firebaseProjectsTable();
    const cols = await getColumns(table);
    const orderCol = cols.has('created_at') ? 'created_at' : 'createdAt';
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY \`${orderCol}\` DESC`);
    return (rows || []).map((r) => ({ ...r, payload: fromJson(r, 'payload') }));
  } catch (error) {
    console.error('❌ Error getting firebase projects:', error.message);
    return [];
  }
};

export const getFirebaseProjectByProjectId = async (projectId) => {
  try {
    const table = await firebaseProjectsTable();
    const cols = await getColumns(table);
    const projectIdCol = cols.has('project_id') ? 'project_id' : 'projectId';
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${projectIdCol}\` = ?`, [projectId]);
    return rows.length ? { ...rows[0], payload: fromJson(rows[0], 'payload') } : null;
  } catch (error) {
    console.error('❌ Error getting firebase project:', error.message);
    return null;
  }
};

export const addFirebaseProject = async (data) => {
  const table = await firebaseProjectsTable();
  const cols = await getColumns(table);
  const id = data.id || `fp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const pick = (a, b) => (cols.has(a) ? a : (cols.has(b) ? b : a));
  await db.execute(
    `INSERT INTO ${table} (\`${pick('id', 'firebase_id')}\`, \`${pick('project_id', 'projectId')}\`, \`${pick('project_name', 'projectName')}\`, status, \`${pick('assigned_to', 'assignedTo')}\`, \`${pick('assigned_at', 'assignedAt')}\`, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.projectId ?? data.project_id,
      data.projectName ?? data.project_name ?? null,
      data.status ?? 'available',
      data.assignedTo ?? data.assigned_to ?? null,
      data.assignedAt ? new Date(data.assignedAt).toISOString().slice(0, 19).replace('T', ' ') : null,
      toJson(data.payload ?? data),
    ]
  );
  return { success: true, id };
};

export const updateFirebaseProject = async (id, updates) => {
  const table = await firebaseProjectsTable();
  const cols = await getColumns(table);
  const fields = [];
  const values = [];
  if (updates.status != null && cols.has('status')) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  const assignedToCol = cols.has('assigned_to') ? 'assigned_to' : (cols.has('assignedTo') ? 'assignedTo' : null);
  if (updates.assignedTo != null && assignedToCol) {
    fields.push(`\`${assignedToCol}\` = ?`);
    values.push(updates.assignedTo);
  }
  const assignedAtCol = cols.has('assigned_at') ? 'assigned_at' : (cols.has('assignedAt') ? 'assignedAt' : null);
  if (updates.assignedAt != null && assignedAtCol) {
    fields.push(`\`${assignedAtCol}\` = ?`);
    values.push(new Date(updates.assignedAt).toISOString().slice(0, 19).replace('T', ' '));
  }
  if (updates.payload != null && cols.has('payload')) {
    fields.push('payload = ?');
    values.push(toJson(updates.payload));
  }
  if (fields.length === 0) return { success: true };
  const idCol = cols.has('id') ? 'id' : 'firebase_id';
  values.push(id);
  const updatedCol = cols.has('updated_at') ? 'updated_at' : 'updatedAt';
  await db.execute(`UPDATE ${table} SET ${fields.join(', ')}, \`${updatedCol}\` = NOW() WHERE \`${idCol}\` = ?`, values);
  return { success: true };
};

export const deleteFirebaseProject = async (id) => {
  const table = await firebaseProjectsTable();
  const cols = await getColumns(table);
  const idCol = cols.has('id') ? 'id' : 'firebase_id';
  await db.execute(`DELETE FROM ${table} WHERE \`${idCol}\` = ?`, [id]);
  return { success: true };
};
