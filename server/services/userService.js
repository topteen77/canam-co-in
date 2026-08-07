import db from '../db.js';
import bcrypt from 'bcryptjs';
import { resolveTableNameOrFallback, getColumns, pickPasswordCol } from '../utils/tableResolver.js';

function normalizeUserRow(row, passwordCol = null) {
  if (!row) return null;
  const id = row.id ?? row.firebase_id;
  const name = row.name ?? row.Name ?? '';
  const email = row.email ?? row.userEmail ?? '';
  const role = row.role ?? '';
  const status = row.status ?? '';
  const created_at = row.created_at ?? row.createdAt ?? row.lastUpdated;
  const out = { ...row, id, name, email, role, status, created_at };
  if (passwordCol && row[passwordCol] !== undefined) out.password = row[passwordCol];
  return out;
}

export const getAllUsers = async () => {
  try {
    const table = await resolveTableNameOrFallback(['users', 'Users'], 'users');
    const [rows] = await db.query(`SELECT * FROM ${table}`);
    return (rows || []).map(normalizeUserRow);
  } catch (error) {
    console.error('❌ Error getting users:', error.message);
    return [];
  }
};

export const registerUser = async (user) => {
  const table = await resolveTableNameOrFallback(['users', 'Users'], 'users');
  const cols = await getColumns(table);
  const passwordCol = pickPasswordCol(cols);
  if (!passwordCol) throw new Error('Users table has no password column');
  const hashedPassword = await bcrypt.hash(user.password, 10);
  const uniqueId = user.id || Date.now().toString();

  if (cols.has('firebase_id') && !cols.has('signup_method')) {
    await db.execute(
      `INSERT INTO ${table} (firebase_id, name, email, \`${passwordCol}\`, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [uniqueId, user.name, user.email, hashedPassword, 'User', 'Pending']
    );
  } else {
    await db.execute(
      `INSERT INTO ${table} (id, name, email, \`${passwordCol}\`, role, status, signup_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [uniqueId, user.name, user.email, hashedPassword, 'User', 'Pending', user.signupMethod || 'email']
    );
  }
  return { success: true, id: uniqueId };
};

export const createUser = async (data) => {
  const table = await resolveTableNameOrFallback(['users', 'Users'], 'users');
  const cols = await getColumns(table);
  const passwordCol = pickPasswordCol(cols);
  if (!passwordCol) throw new Error('Users table has no password column');
  const tempPassword = `Temp${Date.now()}!`;
  const hashedPassword = await bcrypt.hash(tempPassword, 10);
  const id = data.id || Date.now().toString();
  const name = data.name || (data.email || '').split('@')[0];
  const email = (data.email || '').toLowerCase();
  const role = data.role || 'Pending';
  const status = data.status || 'Pending';

  if (cols.has('firebase_id') && !cols.has('signup_method')) {
    await db.execute(
      `INSERT INTO ${table} (firebase_id, name, email, \`${passwordCol}\`, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [id, name, email, hashedPassword, role, status]
    );
  } else {
    await db.execute(
      `INSERT INTO ${table} (id, name, email, \`${passwordCol}\`, role, status, signup_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [id, name, email, hashedPassword, role, status, 'Manual']
    );
  }
  return { success: true, id, defaultPassword: tempPassword };
};

export const getUserByEmail = async (email, options = {}) => {
  try {
    const table = await resolveTableNameOrFallback(['users', 'Users'], 'users');
    const cols = await getColumns(table);
    const emailCol = cols.has('email') ? 'email' : (cols.has('userEmail') ? 'userEmail' : 'email');
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${emailCol}\` = ?`, [email]);
    const passwordCol = options.includePassword ? pickPasswordCol(cols) : null;
    return rows.length ? normalizeUserRow(rows[0], passwordCol) : null;
  } catch (error) {
    console.error('❌ Error getting user:', error.message);
    return null;
  }
};

export const getUserById = async (id) => {
  try {
    const table = await resolveTableNameOrFallback(['users', 'Users'], 'users');
    const cols = await getColumns(table);
    const idCol = cols.has('id') ? 'id' : 'firebase_id';
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${idCol}\` = ?`, [id]);
    return rows.length ? normalizeUserRow(rows[0]) : null;
  } catch (error) {
    console.error('❌ Error getting user by id:', error.message);
    return null;
  }
};

export const updateUser = async (id, updates) => {
  try {
    const table = await resolveTableNameOrFallback(['users', 'Users'], 'users');
    const cols = await getColumns(table);

    // --- helpers: resolve columns case-insensitively ---
    const resolveCol = (preferredNames = []) => {
      for (const name of preferredNames) {
        if (cols.has(name)) return name;
      }
      const lower = (s) => String(s || '').toLowerCase();
      for (const name of preferredNames) {
        const want = lower(name);
        for (const c of cols) {
          if (lower(c) === want) return c;
        }
      }
      return null;
    };

    const roleCol = resolveCol(['role', 'Role', 'user_role', 'userRole']);
    const statusCol = resolveCol(['status', 'Status']);
    const nameCol = resolveCol(['name', 'Name']);
    const emailCol = resolveCol(['email', 'userEmail', 'Email']);
    const phoneCol = resolveCol(['phone', 'Phone']);
    const profilePictureCol = resolveCol(['profile_picture', 'profilePicture']);
    const defaultPasswordCol = resolveCol(['default_password', 'defaultPassword']);
    const passwordGeneratedAtCol = resolveCol(['password_generated_at', 'passwordGeneratedAt']);
    const passwordResetAtCol = resolveCol(['password_reset_at', 'passwordResetAt']);
    const passwordResetRequestedCol = resolveCol(['password_reset_requested', 'passwordResetRequested']);
    const updatedAtCol = resolveCol(['updated_at', 'updatedAt']);

    // IMPORTANT: Some DBs include both `id` and `firebase_id`, but many rows have `id` = NULL.
    // So we try both identifiers (id first, then firebase_id) to ensure updates hit the row.
    const idCol = resolveCol(['id']);
    const firebaseIdCol = resolveCol(['firebase_id']);
    const whereCols = [idCol, firebaseIdCol].filter(Boolean);
    if (whereCols.length === 0) throw new Error('Users table has no id/firebase_id column to update by');

    const setClause = [];
    const values = [];
    const mappings = [
      ['role', roleCol],
      ['status', statusCol],
      ['name', nameCol],
      ['email', emailCol],
      ['phone', phoneCol],
      ['profile_picture', profilePictureCol],
      ['defaultPassword', defaultPasswordCol],
      ['passwordGeneratedAt', passwordGeneratedAtCol],
      ['password_reset_at', passwordResetAtCol],
      ['password_reset_requested', passwordResetRequestedCol],
    ];

    for (const [key, col] of mappings) {
      if (updates[key] !== undefined && col) {
        setClause.push(`\`${col}\` = ?`);
        values.push(updates[key]);
      }
    }

    // Hash the default password if provided
    if (updates.defaultPassword) {
      let mainPasswordCol = pickPasswordCol(cols);
      if (cols.has('customPassword')) mainPasswordCol = 'customPassword';
      else if (cols.has('custom_password')) mainPasswordCol = 'custom_password';

      const hashedPassword = await bcrypt.hash(updates.defaultPassword, 10);
      
      if (mainPasswordCol) {
        setClause.push(`\`${mainPasswordCol}\` = ?`);
        values.push(hashedPassword);
      }
      
      if (cols.has('customPassword') && 'customPassword' !== mainPasswordCol) {
        setClause.push(`\`customPassword\` = ?`);
        values.push(hashedPassword);
      } else if (cols.has('custom_password') && 'custom_password' !== mainPasswordCol) {
        setClause.push(`\`custom_password\` = ?`);
        values.push(hashedPassword);
      }
    }

    if (updatedAtCol) setClause.push(`\`${updatedAtCol}\` = NOW()`);
    if (setClause.length === 0) return { success: true };

    const rawId = id == null ? '' : String(id).trim();
    if (!rawId || rawId === 'undefined' || rawId === 'null') throw new Error('User id is missing or invalid. Cannot update.');

    let updated = false;
    let lastResult = null;
    for (const whereCol of whereCols) {
      // eslint-disable-next-line no-await-in-loop
      const [result] = await db.execute(
        `UPDATE ${table} SET ${setClause.join(', ')} WHERE \`${whereCol}\` = ?`,
        [...values, rawId]
      );
      lastResult = result;
      if (result && result.affectedRows > 0) {
        updated = true;
        break;
      }
    }

    if (!updated) {
      const tried = whereCols.map((c) => `\`${c}\``).join(', ');
      throw new Error(`No user row updated (checked ${tried}). The id may not match the DB row.`);
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error updating user:', error.message);
    throw error;
  }
};

export const loginUser = async (email, password) => {
  try {
    const user = await getUserByEmail(email, { includePassword: true });
    if (!user || user.password === undefined) return { success: false, message: 'User not found' };
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return { success: false, message: 'Invalid credentials' };
    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  } catch (error) {
    console.error('❌ Error logging in:', error.message);
    throw error;
  }
};
