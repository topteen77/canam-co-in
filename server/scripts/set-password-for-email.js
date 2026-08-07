/**
 * Set a login password for a user by email (same bcrypt as the app).
 * Run from project root: node server/scripts/set-password-for-email.js <email> <password>
 * Example: node server/scripts/set-password-for-email.js 7814300713.chd@gmail.com MySecurePass123
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import db from '../db.js';
import { resolveTableNameOrFallback, getColumns, pickPasswordCol } from '../utils/tableResolver.js';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log('Usage: node server/scripts/set-password-for-email.js <email> <password>');
    console.log('Example: node server/scripts/set-password-for-email.js 7814300713.chd@gmail.com MySecurePass123');
    process.exit(1);
  }

  try {
    const table = await resolveTableNameOrFallback(['users', 'Users'], 'users');
    const cols = await getColumns(table);
    const emailCol = cols.has('email') ? 'email' : (cols.has('userEmail') ? 'userEmail' : 'email');
    const passwordCol = pickPasswordCol(cols);
    if (!passwordCol) {
      console.error('Users table has no password column (expected password, password_hash, or hashed_password).');
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `UPDATE ${table} SET \`${passwordCol}\` = ? WHERE \`${emailCol}\` = ?`,
      [hashedPassword, email.trim().toLowerCase()]
    );

    if (result.affectedRows === 0) {
      console.log('No user found with that email. Check the address or create the user first.');
      process.exit(1);
    }

    console.log('Password updated for:', email);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
