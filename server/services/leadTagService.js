import db from '../db.js';
import { resolveTableNameOrFallback } from '../utils/tableResolver.js';

export const getLeadTags = async () => {
  try {
    const table = await resolveTableNameOrFallback(['leadtags', 'LeadTags'], 'leadtags');
    const [rows] = await db.query(`SELECT name FROM ${table} ORDER BY name ASC`);
    return (rows || []).map((row) => row.name).filter(Boolean);
  } catch (error) {
    console.error('❌ Error getting lead tags:', error.message);
    return [];
  }
};

export const addLeadTag = async (name) => {
  try {
    const table = await resolveTableNameOrFallback(['leadtags', 'LeadTags'], 'leadtags');
    const trimmedName = name.trim();
    if (!trimmedName) return { success: false, message: 'Tag cannot be empty' };
    const [cols] = await db.query('SHOW COLUMNS FROM ??', [table.replace(/`/g, '')]);
    const colSet = new Set((cols || []).map((c) => c.Field));
    if (colSet.has('firebase_id') && !colSet.has('id')) {
      const id = `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.execute(`INSERT INTO ${table} (firebase_id, name, createdAt, updatedAt) VALUES (?, ?, NOW(), NOW())`, [id, trimmedName]);
    } else {
      await db.execute(`INSERT IGNORE INTO ${table} (name) VALUES (?)`, [trimmedName]);
    }
    return { success: true };
  } catch (error) {
    console.error('❌ Error adding lead tag:', error.message);
    throw error;
  }
};
