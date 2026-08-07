/**
 * Uses the SAME database and table/column resolution as the app.
 * Run from project root: node server/scripts/show-users-schema-and-approve.js [email]
 * With no args: prints schema + list of users and the exact SQL to approve.
 * With email: prints the exact UPDATE for that email.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import db from '../db.js';
import { resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

async function main() {
  const emailArg = process.argv[2]; // optional: email to approve

  try {
    const table = await resolveTableNameOrFallback(['users', 'Users'], 'users');
    const cols = await getColumns(table);
    const tableName = table.replace(/`/g, '');
    const emailCol = cols.has('email') ? 'email' : (cols.has('userEmail') ? 'userEmail' : 'email');
    const idCol = cols.has('id') ? 'id' : (cols.has('firebase_id') ? 'firebase_id' : 'id');
    const statusCol = cols.has('status') ? 'status' : 'status';

    console.log('\n=== USERS TABLE (same as login/register uses) ===\n');
    console.log('Table name:', tableName);
    console.log('Email column:', emailCol);
    console.log('ID column:', idCol);
    console.log('Status column:', statusCol);
    console.log('All columns:', [...cols].join(', '));

    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY ${cols.has('created_at') ? 'created_at' : 'createdAt'} DESC`);
    if (!rows || rows.length === 0) {
      console.log('\nNo rows in table.');
      process.exit(0);
      return;
    }

    console.log('\n=== USERS IN TABLE ===\n');
    rows.forEach((r, i) => {
      const email = r[emailCol] ?? r.email ?? r.userEmail ?? '(no email)';
      const status = r[statusCol] ?? r.status ?? r.Status ?? '?';
      const id = r[idCol] ?? r.id ?? r.firebase_id;
      console.log(`${i + 1}. ${email}  |  status: ${status}  |  id: ${id}`);
    });

    console.log('\n=== APPROVE VIA SQL (copy-paste into MySQL) ===\n');
    console.log('-- Use the EXACT table and column names above.\n');

    if (emailArg) {
      const escaped = emailArg.replace(/'/g, "''");
      console.log(`-- Approve this email: ${emailArg}`);
      console.log(`UPDATE \`${tableName}\` SET \`${statusCol}\` = 'Active' WHERE \`${emailCol}\` = '${escaped}';\n`);
    } else {
      const pending = rows.filter(r => (r[statusCol] ?? r.status ?? r.Status) === 'Pending');
      if (pending.length === 0) {
        console.log('(No Pending users. To approve by email, run: node server/scripts/show-users-schema-and-approve.js user@example.com)\n');
      } else {
        console.log('-- Approve by email (replace with the email you want):');
        const exampleEmail = pending[0][emailCol] ?? pending[0].email ?? pending[0].userEmail ?? 'user@example.com';
        const escaped = String(exampleEmail).replace(/'/g, "''");
        console.log(`UPDATE \`${tableName}\` SET \`${statusCol}\` = 'Active' WHERE \`${emailCol}\` = '${escaped}';`);
        console.log('\nOr run: node server/scripts/show-users-schema-and-approve.js ' + exampleEmail + '\n');
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

main();
