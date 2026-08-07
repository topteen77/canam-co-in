import db from '../db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { resolveTableNameOrFallback, getColumns, pickPasswordCol } from '../utils/tableResolver.js';

const SECRET_KEY = process.env.JWT_SECRET || 'your_jwt_secret_key';

export const register = async (req, res) => {
  try {
    const table = await resolveTableNameOrFallback(['users', 'Users'], 'users');
    const cols = await getColumns(table);
    const emailCol = cols.has('email') ? 'email' : 'userEmail';
    const passwordCol = pickPasswordCol(cols);
    if (!passwordCol) return res.status(500).json({ error: 'Users table has no password column (expected password, password_hash, hashed_password, customPassword, or defaultPassword)' });

    const [existing] = await db.query(`SELECT * FROM ${table} WHERE \`${emailCol}\` = ?`, [req.body.email]);
    if (existing.length > 0) return res.status(400).json({ error: 'User already exists' });

    const { email, password, name } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    const idCol = cols.has('id') ? 'id' : 'firebase_id';
    const createdCol = cols.has('created_at') ? 'created_at' : 'createdAt';
    const nameCol = cols.has('name') ? 'name' : 'Name';
    const roleCol = cols.has('role') ? 'role' : 'role';
    const statusCol = cols.has('status') ? 'status' : 'status';
    await db.query(
      `INSERT INTO ${table} (\`${idCol}\`, \`${emailCol}\`, \`${passwordCol}\`, \`${nameCol}\`, \`${roleCol}\`, \`${statusCol}\`, \`${createdCol}\`)
       VALUES (?, ?, ?, ?, 'User', 'Pending', NOW())`,
      [userId, email, hashedPassword, name || '']
    );

    res.json({ success: true, message: 'Registration successful. Awaiting approval.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  console.log("🔵 Login Request Received:", req.body.email); // Debug 1

  try {
    if (!resolveTableNameOrFallback || !getColumns) {
       throw new Error("Helper functions (resolveTableNameOrFallback, getColumns) are missing imports!");
    }

    const table = await resolveTableNameOrFallback(['users', 'Users'], 'users');
    console.log(`✅ Table found: ${table}`); 

    const cols = await getColumns(table);
    const emailCol = cols.has('email') ? 'email' : 'userEmail';
    const passwordCol = pickPasswordCol(cols);
    
    if (!passwordCol) {
        console.error("❌ No password column found in DB");
        return res.status(500).json({ error: 'Users table has no password column' });
    }

    const { email, password } = req.body;
    if (!db) throw new Error("Database object 'db' is undefined. Check your imports.");

    const [users] = await db.query(`SELECT * FROM ${table} WHERE \`${emailCol}\` = ?`, [email]);
	
	
    
    if (users.length === 0) {
        console.warn("⚠️ User not found in database"+`SELECT * FROM ${table} WHERE \`${emailCol}\` = [email]`);
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const storedHash = user[passwordCol];
    
    if (!storedHash) {
         console.warn("⚠️ User exists but has no password hash");
         return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, storedHash);
    if (!isMatch) {
        console.warn("⚠️ Password verification failed");
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!SECRET_KEY) {
        throw new Error("SECRET_KEY is undefined! Check your .env file or imports.");
    }

    const userId = user.id ?? user.firebase_id;
    const token = jwt.sign({ id: userId, email: user.email ?? user.userEmail, role: user.role }, SECRET_KEY, { expiresIn: '24h' });

    console.log('✅ Login Successful for user:');
    
    const { [passwordCol]: _, ...userData } = user;
    res.json({ success: true, token, user: { ...userData, id: userId, email: userData.email ?? userData.userEmail } });

  } catch (error) {
    console.error("🔴 REAL ERROR IN TERMINAL:", error); 
    console.error(error.stack);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const table = await resolveTableNameOrFallback(['users', 'Users'], 'users');
    const cols = await getColumns(table);
    const idCol = cols.has('id') ? 'id' : 'firebase_id';
    const [users] = await db.query(`SELECT \`${idCol}\` as id, name, \`${cols.has('email') ? 'email' : 'userEmail'}\` as email, role, status FROM ${table} WHERE \`${idCol}\` = ?`, [req.user.id]);
    res.json(users[0] || {});
  } catch (error) {
    res.status(500).json({ error: 'getMe failed' });
  }
};