import db from '../db.js';
import { resolveTableName, resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

// Helper: Format for MySQL (YYYY-MM-DD HH:mm:ss). Always store UTC.
// Treat "YYYY-MM-DD HH:mm:ss" and ISO without Z as UTC so we don't use server local time.
const formatDate = (d) => {
    if (!d) return null;
    try {
        let s = typeof d === 'string' ? d.trim() : String(d);
        if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
            return s; // already UTC SQL format, store as-is
        }
        if (s.indexOf('T') !== -1 && !s.endsWith('Z') && s.indexOf('+') === -1 && s.length >= 19) {
            s = s.slice(0, 19) + 'Z';
        } else if (s.indexOf('T') === -1 && s.length >= 19) {
            s = s.replace(' ', 'T') + 'Z';
        }
        const date = new Date(s);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().slice(0, 19).replace('T', ' ');
    } catch (e) {
        return null;
    }
};

// Normalize DB datetime (UTC) to ISO string with Z for consistent parsing
const toISO = (val) => {
    if (val == null || val === '') return null;
    if (typeof val === 'object' && val instanceof Date) return val.toISOString();
    const s = String(val).trim();
    if (!s) return null;
    if (s.indexOf('T') !== -1 && (s.endsWith('Z') || s.indexOf('+') !== -1)) return s;
    const sql = s.replace(' ', 'T');
    return sql.length >= 19 ? sql.slice(0, 19) + 'Z' : (sql.length >= 10 ? sql + 'T00:00:00Z' : null);
};

// Convert UTC datetime to Indian Standard Time (IST) ISO string for API: "...+05:30"
const toISTISO = (val) => {
    const iso = toISO(val);
    if (!iso) return null;
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        const pad = (n) => String(n).padStart(2, '0');
        const ist = new Date(d.getTime() + 330 * 60 * 1000); // UTC + 5h 30m
        const y = ist.getUTCFullYear(), m = ist.getUTCMonth(), day = ist.getUTCDate();
        const h = ist.getUTCHours(), min = ist.getUTCMinutes(), sec = ist.getUTCSeconds();
        return `${y}-${pad(m + 1)}-${pad(day)}T${pad(h)}:${pad(min)}:${pad(sec)}+05:30`;
    } catch (e) {
        return iso;
    }
};

const ATTENDANCE_TABLE_NAMES = ['attendance', 'attendancerecords', 'Attendance', 'AttendanceRecords', 'attendance_records'];

// Resolve Attendance table name — dump.sql uses Attendance / AttendanceRecords (case-insensitive)
async function getAttendanceTable() {
    return resolveTableNameOrFallback(ATTENDANCE_TABLE_NAMES, 'attendance');
}

// Cache: does Attendance table have numeric `id` as PK? (set after migration 002)
let _hasIdColumn = null;
async function attendanceHasIdColumn() {
    if (_hasIdColumn !== null) return _hasIdColumn;
    try {
        const table = await getAttendanceTable();
        const cols = await getColumns(table);
        _hasIdColumn = cols && cols.has('id');
        return _hasIdColumn;
    } catch (e) {
        return false;
    }
}

// Use id for WHERE when value looks numeric (after migration); else firebase_id for legacy
function whereIdClause(hasId, id) {
    const isNumeric = hasId && (typeof id === 'number' || (typeof id === 'string' && /^\d+$/.test(id)));
    return isNumeric ? ['id', id] : ['firebase_id', id];
}

// Pick column name that exists (camelCase or snake_case), case-insensitive
function pickCol(cols, ...names) {
    for (const n of names) {
        if (cols && cols.has(n)) return n;
    }
    const nLower = (names[0] || '').toLowerCase();
    for (const c of cols || []) {
        if (c && String(c).toLowerCase() === nLower) return c;
    }
    return names[0];
}

// Return true only if the table has this column (pickCol returns first arg when missing)
function hasColumn(cols, ...names) {
    if (!cols) return false;
    for (const n of names) {
        if (cols.has(n)) return true;
    }
    const nLower = (names[0] || '').toLowerCase();
    for (const c of cols) {
        if (c && String(c).toLowerCase() === nLower) return true;
    }
    return false;
}

// --- READ (Get All Records) ---
export const getAllAttendanceRecords = async () => {
    try {
        const table = await resolveTableName(ATTENDANCE_TABLE_NAMES);
        if (!table) return [];
        const cols = await getColumns(table);
        const hasId = cols && cols.has('id');
        const idCol = pickCol(cols, 'id', 'id');
        const fbIdCol = pickCol(cols, 'firebase_id', 'firebase_id');
        const checkInCol = pickCol(cols, 'checkInTime', 'check_in_time');
        const hasCheckOut = hasColumn(cols, 'checkOutTime', 'check_out_time');
        const checkOutCol = hasCheckOut ? pickCol(cols, 'checkOutTime', 'check_out_time') : null;
        const startLocCol = pickCol(cols, 'start_location', 'startLocation');
        const endLocCol = pickCol(cols, 'end_location', 'endLocation');
        const createdCol = pickCol(cols, 'createdAt', 'created_at');
        const idSelect = hasId ? `\`${idCol}\`, \`${fbIdCol}\`,` : `\`${fbIdCol}\` as id,`;
        const workingCol = pickCol(cols, 'workingHours', 'working_hours');
        const checkOutSelect = hasCheckOut && checkOutCol ? `\`${checkOutCol}\` as checkOutTime,` : '';
        const [rows] = await db.query(`
            SELECT 
                ${idSelect}
                username,
                date,
                \`${checkInCol}\` as checkInTime,
                ${checkOutSelect}
                status,
                action,
                \`${workingCol}\` as workingHours,
                \`${startLocCol}\` as start_location,
                \`${endLocCol}\` as end_location,
                \`${createdCol}\` as createdAt
            FROM ${table} 
            ORDER BY \`${checkInCol}\` DESC
        `);

        const safeJson = (val, fallback) => {
            if (val == null || val === '') return fallback;
            if (typeof val === 'object') return val;
            try { return JSON.parse(val); } catch (e) { return fallback; }
        };
        const getVal = (r, ...keys) => {
            for (const k of keys) {
                if (r[k] !== undefined && r[k] !== null) return r[k];
                const key = Object.keys(r || {}).find((x) => String(x).toLowerCase() === String(k).toLowerCase());
                if (key) return r[key];
            }
            return null;
        };
        return (rows || []).map(row => {
            const rowId = getVal(row, 'id', 'firebase_id');
            const fbId = getVal(row, 'firebase_id', 'id');
            const startLoc = safeJson(getVal(row, 'start_location', 'startLocation'), null);
            let endLoc = safeJson(getVal(row, 'end_location', 'endLocation'), null);
            const checkIn = toISTISO(getVal(row, 'checkInTime', 'check_in_time')) || row.checkInTime;
            let checkOut = toISTISO(getVal(row, 'checkOutTime', 'check_out_time')) || row.checkOutTime;
            const action = String(getVal(row, 'action') || '').toLowerCase();
            if (!checkOut && action === 'end-day' && checkIn) {
                checkOut = checkIn;
            }
            // End-day rows may have end location stored in start_location when end_location column is missing
            if (action === 'end-day' && !endLoc && startLoc) {
                endLoc = startLoc;
            }
            return {
                ...row,
                id: rowId != null && rowId !== '' ? String(rowId) : (fbId != null ? String(fbId) : null),
                firebase_id: fbId != null ? String(fbId) : rowId,
                checkInTime: checkIn,
                checkOutTime: checkOut,
                startLocation: startLoc,
                endLocation: endLoc
            };
        });
    } catch (error) {
        console.error('❌ Service Error (getAllAttendanceRecords):', error.message);
        return [];
    }
};

// --- CREATE (Start Day or End Day row) ---
export const addAttendanceRecord = async (record) => {
    try {
        const table = await getAttendanceTable();
        const cols = await getColumns(table);
        const hasId = cols && cols.has('id');
        const checkInCol = pickCol(cols, 'checkInTime', 'check_in_time');
        const checkOutCol = hasColumn(cols, 'checkOutTime', 'check_out_time') ? pickCol(cols, 'checkOutTime', 'check_out_time') : null;
        const startLocCol = pickCol(cols, 'start_location', 'startLocation');
        const endLocCol = pickCol(cols, 'end_location', 'endLocation');
        const workingCol = pickCol(cols, 'workingHours', 'working_hours');
        const createdCol = pickCol(cols, 'createdAt', 'created_at');
        const createdByCol = pickCol(cols, 'createdBy', 'created_by');
        const actionVal = record.action || 'start-day';
        const isEndDay = String(actionVal).toLowerCase() === 'end-day';
        const startLocJson = JSON.stringify(record.location || record.startLocation || {});
        const endLocJson = record.endLocation != null ? JSON.stringify(record.endLocation) : null;
        const workingHoursVal = record.workingHours != null && record.workingHours !== '' ? Number(record.workingHours) : null;

        const insertCols = [];
        const placeholders = [];
        const values = [];
        let generatedFbId = null;

        if (!hasId) {
            generatedFbId = `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const fbIdCol = pickCol(cols, 'firebase_id', 'firebase_id');
            insertCols.push(`\`${fbIdCol}\``);
            placeholders.push('?');
            values.push(generatedFbId);
        }
        insertCols.push('username', 'date', `\`${checkInCol}\``, 'status', 'action');
        placeholders.push('?, ?, ?, ?, ?');
        values.push(record.username, record.date, formatDate(record.checkInTime), record.status || (isEndDay ? 'ended' : 'started'), actionVal);

        // End-day: store end time in check_out_time when column exists so Reports show correct end time (not same as start)
        if (isEndDay && checkOutCol && record.checkInTime) {
            insertCols.push(`\`${checkOutCol}\``);
            placeholders.push('?');
            values.push(formatDate(record.checkInTime));
        }

        if (cols.has(startLocCol)) {
            insertCols.push(`\`${startLocCol}\``);
            placeholders.push('?');
            values.push(isEndDay && !record.startLocation ? (endLocJson || '{}') : startLocJson);
        }
        if (endLocCol && cols.has(endLocCol) && endLocJson) {
            insertCols.push(`\`${endLocCol}\``);
            placeholders.push('?');
            values.push(endLocJson);
        }
        if (workingCol && cols.has(workingCol) && workingHoursVal != null && !isNaN(workingHoursVal)) {
            insertCols.push(`\`${workingCol}\``);
            placeholders.push('?');
            values.push(workingHoursVal);
        }
        if (createdCol && cols.has(createdCol)) {
            insertCols.push(`\`${createdCol}\``);
            placeholders.push('NOW()');
        }
        if (createdByCol && cols.has(createdByCol) && record.username) {
            insertCols.push(`\`${createdByCol}\``);
            placeholders.push('?');
            values.push(record.username);
        }

        const query = `INSERT INTO ${table} (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})`;
        const [result] = await db.execute(query, values);
        return { success: true, id: hasId ? result.insertId : generatedFbId };
    } catch (error) {
        console.error('❌ Service Error (addAttendanceRecord):', error.message);
        throw error;
    }
};

// --- UPDATE (End Day / Check Out) ---
export const updateAttendanceRecord = async (id, updates) => {
    const rawId = id == null ? '' : String(id).trim();
    if (!rawId || rawId === 'undefined' || rawId === 'null') {
        throw new Error('Attendance record id is missing or invalid. Cannot update.');
    }
    try {
        const table = await getAttendanceTable();
        const cols = await getColumns(table);
        const hasId = cols && cols.has('id');
        const checkOutCol = pickCol(cols, 'checkOutTime', 'check_out_time');
        const endLocCol = pickCol(cols, 'end_location', 'endLocation');
        const workingCol = pickCol(cols, 'workingHours', 'working_hours');
        const fields = [];
        const values = [];

        if (updates.checkOutTime && cols.has(checkOutCol)) {
            fields.push(`\`${checkOutCol}\` = ?`);
            values.push(formatDate(updates.checkOutTime));
        }
        if ((updates.endLocation || updates.end_location) && cols.has(endLocCol)) {
            const endLoc = updates.endLocation || updates.end_location;
            fields.push(`\`${endLocCol}\` = ?`);
            values.push(JSON.stringify(endLoc));
        }
        if (updates.status && cols.has('status')) {
            fields.push('status = ?');
            values.push(updates.status);
        }
        if (updates.workingHours !== undefined && cols.has(workingCol)) {
            fields.push(`\`${workingCol}\` = ?`);
            values.push(updates.workingHours);
        }
        if (updates.action && cols.has('action')) {
            fields.push('action = ?');
            values.push(updates.action);
        }

        if (fields.length === 0) {
            return { success: true };
        }

        const [whereCol, whereVal] = whereIdClause(hasId, id);
        const query = `UPDATE ${table} SET ${fields.join(', ')} WHERE \`${whereCol}\` = ?`;
        values.push(whereVal);

        const [result] = await db.execute(query, values);

        if (result.affectedRows === 0) {
            throw new Error('Record not found');
        }

        return { success: true, affectedRows: result.affectedRows };

    } catch (error) {
        console.error('❌ Service Error (updateAttendanceRecord):', error.message);
        throw error;
    }
};

// --- Get single record by ID (supports numeric id or legacy firebase_id) ---
export const getAttendanceRecordById = async (id) => {
    try {
        const table = await getAttendanceTable();
        const cols = await getColumns(table);
        const hasId = cols && cols.has('id');
        const idCol = pickCol(cols, 'id', 'id');
        const fbIdCol = pickCol(cols, 'firebase_id', 'firebase_id');
        const checkInCol = pickCol(cols, 'checkInTime', 'check_in_time');
        const checkOutCol = pickCol(cols, 'checkOutTime', 'check_out_time');
        const startLocCol = pickCol(cols, 'start_location', 'startLocation');
        const endLocCol = pickCol(cols, 'end_location', 'endLocation');
        const workingCol = pickCol(cols, 'workingHours', 'working_hours');
        const idSelect = hasId ? `\`${idCol}\`, \`${fbIdCol}\`,` : `\`${fbIdCol}\` as id,`;
        const [whereCol, whereVal] = whereIdClause(hasId, id);
        const [rows] = await db.query(`
            SELECT 
                ${idSelect}
                username,
                date,
                \`${checkInCol}\` as checkInTime,
                \`${checkOutCol}\` as checkOutTime,
                status,
                action,
                \`${workingCol}\` as workingHours,
                \`${startLocCol}\` as start_location,
                \`${endLocCol}\` as end_location
            FROM ${table} 
            WHERE \`${whereCol}\` = ?
        `, [whereVal]);

        if (!rows || rows.length === 0) return null;

        const row = rows[0];
        const safeJson = (val, fallback) => {
            if (val == null || val === '') return fallback;
            if (typeof val === 'object') return val;
            try { return JSON.parse(val); } catch (e) { return fallback; }
        };
        return {
            ...row,
            id: row.id != null ? row.id : row.firebase_id,
            checkInTime: toISTISO(row.checkInTime) || row.checkInTime,
            checkOutTime: toISTISO(row.checkOutTime) || row.checkOutTime,
            startLocation: safeJson(row.start_location, null),
            endLocation: safeJson(row.end_location, null)
        };
    } catch (error) {
        console.error('❌ Service Error (getAttendanceRecordById):', error.message);
        return null;
    }
};