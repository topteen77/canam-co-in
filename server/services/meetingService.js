import db from '../db.js';
import { resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

const safeJsonParse = (val, fallback) => {
  if (val == null || val === '') return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
};

const mapMeetingRow = (row) => {
  const id = row.id ?? row.firebase_id;
  // Support both camelCase and snake_case column names from DB
  const checkInPhotos = safeJsonParse(row.checkInPhotos ?? row.check_in_photos, []);
  const completionPhotos = safeJsonParse(row.completionPhotos ?? row.completion_photos, []);
  const checkInPhotoMetadata = safeJsonParse(row.checkInPhotoMetadata ?? row.check_in_photo_metadata, {});
  const completionPhotoMetadata = safeJsonParse(row.completionPhotoMetadata ?? row.completion_photo_metadata, {});
  const location = safeJsonParse(row.location ?? row.location, {});
  const photoUploadCount = row.photoUploadCount ?? row.photo_upload_count;
  return {
    ...row,
    id,
    firebase_id: row.firebase_id,
    checkInPhotos: Array.isArray(checkInPhotos) ? checkInPhotos : (checkInPhotos ? [checkInPhotos] : []),
    completionPhotos: Array.isArray(completionPhotos) ? completionPhotos : (completionPhotos ? [completionPhotos] : []),
    checkInPhotoMetadata,
    completionPhotoMetadata,
    location,
    photoUploadCount: typeof photoUploadCount === 'object' ? photoUploadCount : (photoUploadCount != null ? { checkIn: 0, completion: Number(photoUploadCount) } : undefined),
  };
};

export const getAllMeetings = async () => {
  try {
    const table = await resolveTableNameOrFallback(['meetings', 'MeetingCheckInRecords'], 'meetings');
    const cols = await getColumns(table);
    const orderCol = cols.has('createdAt') ? 'createdAt' : (cols.has('created_at') ? 'created_at' : 'checkInTime');
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY \`${orderCol}\` DESC`);
    return (rows || []).map(mapMeetingRow);
  } catch (error) {
    console.error('❌ Service Error (getAllMeetings):', error.message);
    return [];
  }
};

export const getMeetingsByUser = async (userId) => {
  try {
    const table = await resolveTableNameOrFallback(['meetings', 'MeetingCheckInRecords'], 'meetings');
    const cols = await getColumns(table);
    const userCol = cols.has('username') ? 'username' : 'username';
    const orderCol = cols.has('checkInTime') ? 'checkInTime' : 'createdAt';
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${userCol}\` = ? ORDER BY \`${orderCol}\` DESC`, [userId]);
    return (rows || []).map(mapMeetingRow);
  } catch (error) {
    console.error('❌ Service Error (getMeetingsByUser):', error.message);
    return [];
  }
};

export const checkInMeeting = async (data) => {
  try {
    const table = await resolveTableNameOrFallback(['meetings', 'MeetingCheckInRecords'], 'meetings');
    const cols = await getColumns(table);
    const uniqueId = data.id || Date.now().toString();
    const photoCount = typeof data.photoUploadCount === 'object'
      ? ((data.photoUploadCount?.checkIn || 0) + (data.photoUploadCount?.completion || 0))
      : (data.photoUploadCount || 0);

    if (cols.has('firebase_id') && cols.has('salesPersonEmail')) {
      await db.execute(
        `INSERT INTO ${table} (firebase_id, username, salesPersonName, salesPersonEmail, meetingType, notes, leadId, leadName, date, checkInTime, meetingStatus, location, checkInPhotos, checkInPhotoMetadata, photoUploadCount, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uniqueId,
          data.username ?? '',
          data.salesPersonName ?? '',
          data.salesPersonEmail ?? '',
          data.meetingType ?? 'In-Person',
          data.notes ?? '',
          data.leadId ?? '',
          data.leadName ?? '',
          data.date ?? '',
          data.checkInTime ?? new Date().toISOString(),
          'active',
          typeof data.location === 'object' ? JSON.stringify(data.location || {}) : (data.location || '{}'),
          typeof data.checkInPhotos === 'string' ? data.checkInPhotos : JSON.stringify(data.checkInPhotos || []),
          data.checkInPhotoMetadata ? JSON.stringify(data.checkInPhotoMetadata) : '{}',
          typeof photoCount === 'object' ? JSON.stringify(photoCount) : photoCount,
        ]
      );
    } else {
      await db.execute(
        `INSERT INTO ${table} (id, username, salesPersonName, salesPersonEmail, meetingType, notes, leadId, leadName, date, checkInTime, meetingStatus, location, checkInPhotos, checkInPhotoMetadata, photoUploadCount, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uniqueId,
          data.username ?? '',
          data.salesPersonName ?? '',
          data.salesPersonEmail ?? '',
          data.meetingType ?? 'In-Person',
          data.notes ?? '',
          data.leadId ?? '',
          data.leadName ?? '',
          data.date ?? '',
          data.checkInTime ?? '',
          'active',
          JSON.stringify(data.location || {}),
          JSON.stringify(data.checkInPhotos || []),
          JSON.stringify(data.checkInPhotoMetadata || {}),
          photoCount,
        ]
      );
    }
    return { success: true, id: uniqueId };
  } catch (error) {
    console.error('❌ Service Error (checkInMeeting):', error.message);
    throw error;
  }
};

export const completeMeeting = async (id, data) => {
  try {
    const table = await resolveTableNameOrFallback(['meetings', 'MeetingCheckInRecords'], 'meetings');
    const cols = await getColumns(table);
    const idCol = cols.has('id') ? 'id' : 'firebase_id';
    
    // Build dynamic UPDATE query based on what the frontend sends and what columns exist
    const updates = [
      'checkOutTime = ?',
      'meetingDuration = ?',
      'meetingStatus = ?'
    ];
    const values = [
      data.checkOutTime || new Date().toISOString(),
      data.meetingDuration || 0,
      'completed'
    ];

    if (data.meetingOutcome !== undefined) {
      if (cols.has('meetingOutcome')) updates.push('meetingOutcome = ?');
      else if (cols.has('meeting_outcome')) updates.push('meeting_outcome = ?');
      values.push(data.meetingOutcome);
    }
    
    if (data.completionNotes !== undefined) {
      if (cols.has('completionNotes')) updates.push('completionNotes = ?');
      else if (cols.has('completion_notes')) updates.push('completion_notes = ?');
      values.push(data.completionNotes);
    }

    if (data.completionPhotos !== undefined) {
      if (cols.has('completionPhotos')) updates.push('completionPhotos = ?');
      else if (cols.has('completion_photos')) updates.push('completion_photos = ?');
      values.push(typeof data.completionPhotos === 'string' ? data.completionPhotos : JSON.stringify(data.completionPhotos || []));
    }

    if (data.completionPhotoMetadata !== undefined) {
      if (cols.has('completionPhotoMetadata')) updates.push('completionPhotoMetadata = ?');
      else if (cols.has('completion_photo_metadata')) updates.push('completion_photo_metadata = ?');
      values.push(typeof data.completionPhotoMetadata === 'string' ? data.completionPhotoMetadata : JSON.stringify(data.completionPhotoMetadata || []));
    }
    
    if (data.photoUploadCount !== undefined) {
      if (cols.has('photoUploadCount')) updates.push('photoUploadCount = ?');
      else if (cols.has('photo_upload_count')) updates.push('photo_upload_count = ?');
      values.push(typeof data.photoUploadCount === 'object' ? JSON.stringify(data.photoUploadCount) : data.photoUploadCount);
    }

    const query = `
      UPDATE ${table}
      SET ${updates.join(', ')}
      WHERE \`${idCol}\` = ?
    `;
    values.push(id);
    
    await db.execute(query, values);
    return { success: true };
  } catch (error) {
    console.error('❌ Service Error (completeMeeting):', error.message);
    throw error;
  }
};

export const addMeetingCheckIn = checkInMeeting;
export const addMeetingCheckInRecord = checkInMeeting;
export const addMeeting = checkInMeeting;

export const updateMeeting = async (id, data) => {
  if (data.meetingStatus === 'completed' || data.checkOutTime) {
    return completeMeeting(id, data);
  }
  try {
    const table = await resolveTableNameOrFallback(['meetings', 'MeetingCheckInRecords'], 'meetings');
    const cols = await getColumns(table);
    const idCol = cols.has('id') ? 'id' : 'firebase_id';
    const completionNotesCol = cols.has('completionNotes') ? 'completionNotes' : (cols.has('completion_notes') ? 'completion_notes' : null);
    const completionPhotosCol = cols.has('completionPhotos') ? 'completionPhotos' : (cols.has('completion_photos') ? 'completion_photos' : null);
    const updates = [];
    const values = [];
    if (data.completionNotes != null && completionNotesCol) {
      updates.push(`\`${completionNotesCol}\` = ?`);
      values.push(data.completionNotes);
    }
    if (data.completionPhotos != null && completionPhotosCol) {
      updates.push(`\`${completionPhotosCol}\` = ?`);
      values.push(typeof data.completionPhotos === 'string' ? data.completionPhotos : JSON.stringify(data.completionPhotos));
    }
    if (updates.length === 0) return { success: true };
    values.push(id);
    await db.execute(`UPDATE ${table} SET ${updates.join(', ')} WHERE \`${idCol}\` = ?`, values);
    return { success: true };
  } catch (error) {
    console.error('❌ Service Error (updateMeeting):', error.message);
    throw error;
  }
};
