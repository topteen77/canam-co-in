import db from '../db.js';
import { resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

const DEFAULT_PREFERENCES = {
  enabled: true,
  sound: true,
  vibrate: true,
  categories: {
    meeting_reminders: true,
    lead_updates: true,
    task_alerts: true,
    system_notifications: true,
    followup_reminders: true,
  },
};

export const getPreferences = async (userId) => {
  try {
    const table = await resolveTableNameOrFallback(['notificationpreferences', 'NotificationPreferences'], 'notificationpreferences');
    const cols = await getColumns(table);
    const userCol = cols.has('user_email') ? 'user_email' : (cols.has('userId') ? 'userId' : 'user_email');
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${userCol}\` = ?`, [userId]);
    if (!rows.length) {
      return { userId, ...DEFAULT_PREFERENCES, updatedAt: new Date() };
    }
    const row = rows[0];
    let categories = DEFAULT_PREFERENCES.categories;
    if (row.categories) {
      try {
        categories = typeof row.categories === 'string' ? JSON.parse(row.categories) : row.categories;
      } catch (_) {}
    }
    const updatedAt = row.updated_at ?? row.updatedAt;
    return {
      userId: row.user_email ?? row.userId ?? userId,
      enabled: !!row.enabled,
      sound: !!row.sound,
      vibrate: !!row.vibrate,
      categories,
      updatedAt: updatedAt != null ? updatedAt : new Date(),
    };
  } catch (error) {
    return { userId, ...DEFAULT_PREFERENCES, updatedAt: new Date() };
  }
};

export const savePreferences = async (data) => {
  try {
    const table = await resolveTableNameOrFallback(['notificationpreferences', 'NotificationPreferences'], 'notificationpreferences');
    const cols = await getColumns(table);
    const categoriesJson = JSON.stringify(data.categories || {});
    const uid = data.userId ?? data.user_email ?? '';

    if (cols.has('user_email')) {
      await db.execute(
        `INSERT INTO ${table} (user_email, enabled, sound, vibrate, categories, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           enabled = VALUES(enabled),
           sound = VALUES(sound),
           vibrate = VALUES(vibrate),
           categories = VALUES(categories),
           updated_at = NOW()`,
        [uid, data.enabled, data.sound, data.vibrate, categoriesJson]
      );
    } else {
      await db.execute(
        `INSERT INTO ${table} (firebase_id, userId, enabled, sound, vibrate, categories, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           enabled = VALUES(enabled),
           sound = VALUES(sound),
           vibrate = VALUES(vibrate),
           categories = VALUES(categories),
           updatedAt = NOW()`,
        [uid, uid, data.enabled, data.sound, data.vibrate, categoriesJson]
      );
    }
    return { success: true };
  } catch (error) {
    console.error('❌ Error saving preferences:', error.message);
    throw error;
  }
};
