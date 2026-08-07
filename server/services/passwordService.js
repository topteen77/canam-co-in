import db from '../db.js';
import bcrypt from 'bcryptjs';
import { resolveTableNameOrFallback, getColumns, pickPasswordCol } from '../utils/tableResolver.js';

// --- HELPER: Generate Deterministic Password ---
const generatePassword = (name, email) => {
    const cleanName = (name || email || 'User').split(' ')[0].replace(/[^a-zA-Z]/g, '');
    return `${cleanName}@1234`;
};

async function usersTableAndCols() {
    const table = await resolveTableNameOrFallback(['users', 'Users'], 'users');
    const cols = await getColumns(table);
    return { table, cols };
}

// --- SET DEFAULT PASSWORD ---
export const setDefaultPassword = async (userId, userData) => {
    try {
        const plainPassword = generatePassword(userData.name, userData.email);
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        const { table, cols } = await usersTableAndCols();
        const passwordCol = pickPasswordCol(cols);
        if (!passwordCol) throw new Error('Users table has no password column');
        const idCol = cols.has('id') ? 'id' : 'firebase_id';
        const updatedCol = cols.has('updated_at') ? 'updated_at' : 'updatedAt';

        let updateQuery = `UPDATE ${table} SET \`${passwordCol}\` = ?, status = 'Active', \`${updatedCol}\` = NOW()`;
        const queryParams = [hashedPassword];

        const customPasswordCol = cols.has('customPassword') ? 'customPassword' : (cols.has('custom_password') ? 'custom_password' : null);
        if (customPasswordCol && customPasswordCol !== passwordCol) {
            updateQuery += `, \`${customPasswordCol}\` = ?`;
            queryParams.push(hashedPassword);
        }

        const defaultPasswordCol = cols.has('defaultPassword') ? 'defaultPassword' : (cols.has('default_password') ? 'default_password' : null);
        if (defaultPasswordCol && defaultPasswordCol !== passwordCol) {
            updateQuery += `, \`${defaultPasswordCol}\` = ?`;
            queryParams.push(plainPassword); // Storing plaintext generated password in default password column
        }

        updateQuery += ` WHERE \`${idCol}\` = ?`;
        queryParams.push(userId);

        await db.execute(updateQuery, queryParams);
        return { success: true, defaultPassword: plainPassword };
    } catch (error) {
        console.error('❌ Error setting default password:', error.message);
        throw error;
    }
};

// --- VERIFY PASSWORD (Login Check) ---
export const verifyPassword = async (email, password) => {
    try {
        const { table, cols } = await usersTableAndCols();
        const passwordCol = pickPasswordCol(cols);
        if (!passwordCol) throw new Error('Users table has no password column');
        const emailCol = cols.has('email') ? 'email' : 'userEmail';
        const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${emailCol}\` = ?`, [email]);
        if (rows.length === 0) return { success: false, message: 'User not found' };
        const user = rows[0];
        const storedHash = user[passwordCol];
        if (!storedHash) return { success: false, message: 'Invalid credentials' };
        const isMatch = await bcrypt.compare(password, storedHash);
        if (!isMatch) return { success: false, message: 'Invalid credentials' };
        const id = user.id ?? user.firebase_id;
        const userEmail = user.email ?? user.userEmail;
        return {
            success: true,
            user: { id, name: user.name, email: userEmail, role: user.role, status: user.status }
        };
    } catch (error) {
        console.error('❌ Error verifying password:', error.message);
        throw error;
    }
};

// --- CHANGE PASSWORD ---
export const changePassword = async (email, currentPassword, newPassword) => {
    try {
        const { table, cols } = await usersTableAndCols();
        const passwordCol = pickPasswordCol(cols);
        if (!passwordCol) throw new Error('Users table has no password column');
        const emailCol = cols.has('email') ? 'email' : 'userEmail';
        const idCol = cols.has('id') ? 'id' : 'firebase_id';
        const updatedCol = cols.has('updated_at') ? 'updated_at' : 'updatedAt';
        const customPasswordCol = cols.has('customPassword') ? 'customPassword' : (cols.has('custom_password') ? 'custom_password' : null);

        const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${emailCol}\` = ?`, [email]);
        if (rows.length === 0) return { success: false, message: 'User not found' };
        const user = rows[0];
        const storedHash = user[passwordCol];
        if (!storedHash) return { success: false, message: 'Current password is incorrect' };
        const isMatch = await bcrypt.compare(currentPassword, storedHash);
        if (!isMatch) return { success: false, message: 'Current password is incorrect' };

        const hashed = await bcrypt.hash(newPassword, 10);
        const userId = user.id ?? user.firebase_id;

        let updateQuery = `UPDATE ${table} SET \`${passwordCol}\` = ?, \`${updatedCol}\` = NOW()`;
        const queryParams = [hashed];
        if (customPasswordCol && customPasswordCol !== passwordCol) {
            updateQuery += `, \`${customPasswordCol}\` = ?`;
            queryParams.push(hashed);
        }
        updateQuery += ` WHERE \`${idCol}\` = ?`;
        queryParams.push(userId);

        await db.execute(updateQuery, queryParams);
        return { success: true };
    } catch (error) {
        console.error('❌ Error changing password:', error.message);
        throw error;
    }
};

// --- SET INITIAL PASSWORD ---
export const setInitialPassword = async (email, newPassword) => {
    try {
        const { table, cols } = await usersTableAndCols();
        const passwordCol = pickPasswordCol(cols);
        if (!passwordCol) throw new Error('Users table has no password column');
        const emailCol = cols.has('email') ? 'email' : 'userEmail';
        const idCol = cols.has('id') ? 'id' : 'firebase_id';
        const updatedCol = cols.has('updated_at') ? 'updated_at' : 'updatedAt';
        const customPasswordCol = cols.has('customPassword') ? 'customPassword' : (cols.has('custom_password') ? 'custom_password' : null);

        const [rows] = await db.query(`SELECT \`${idCol}\` as id FROM ${table} WHERE \`${emailCol}\` = ?`, [email]);
        if (rows.length === 0) return { success: false, message: 'User not found' };

        const hashed = await bcrypt.hash(newPassword, 10);

        let updateQuery = `UPDATE ${table} SET \`${passwordCol}\` = ?, \`${updatedCol}\` = NOW()`;
        const queryParams = [hashed];
        //if (customPasswordCol && customPasswordCol !== passwordCol) {
            updateQuery += `, \`${customPasswordCol}\` = ?`;
            queryParams.push(hashed);
        //}
        updateQuery += ` WHERE \`${idCol}\` = ?`;
        queryParams.push(rows[0].id);

        await db.execute(updateQuery, queryParams);
        return { success: true,updmsg:'testsf' };
    } catch (error) {
        console.error('❌ Error setting initial password:', error.message);
        throw error;
    }
};

// --- GENERATE FOR ALL (Bulk Reset) ---
export const generateAllPasswords = async () => {
    try {
        const { table, cols } = await usersTableAndCols();
        const passwordCol = pickPasswordCol(cols);
        if (!passwordCol) throw new Error('Users table has no password column');
        const idCol = cols.has('id') ? 'id' : 'firebase_id';
        const emailCol = cols.has('email') ? 'email' : 'userEmail';

        const customPasswordCol = cols.has('customPassword') ? 'customPassword' : (cols.has('custom_password') ? 'custom_password' : null);
        const defaultPasswordCol = cols.has('defaultPassword') ? 'defaultPassword' : (cols.has('default_password') ? 'default_password' : null);

        const [users] = await db.query(`SELECT \`${idCol}\` as id, name, \`${emailCol}\` as email FROM ${table}`);
        let count = 0;
        for (const user of users || []) {
            const plainPassword = generatePassword(user.name, user.email);
            const hashedPassword = await bcrypt.hash(plainPassword, 10);

            let updateQuery = `UPDATE ${table} SET \`${passwordCol}\` = ?`;
            const queryParams = [hashedPassword];

            if (customPasswordCol && customPasswordCol !== passwordCol) {
                updateQuery += `, \`${customPasswordCol}\` = ?`;
                queryParams.push(hashedPassword);
            }

            if (defaultPasswordCol && defaultPasswordCol !== passwordCol) {
                updateQuery += `, \`${defaultPasswordCol}\` = ?`;
                queryParams.push(plainPassword); // Storing plaintext generated password in default password column
            }

            updateQuery += ` WHERE \`${idCol}\` = ?`;
            queryParams.push(user.id);

            await db.execute(updateQuery, queryParams);
            count++;
        }
        return { success: true, count };
    } catch (error) {
        console.error('❌ Error bulk generating passwords:', error.message);
        throw error;
    }
};