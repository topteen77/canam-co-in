import db from '../db.js';
import { resolveTableNameOrFallback, getColumns } from '../utils/tableResolver.js';

function mapDocument(row) {
  const id = row.id ?? row.firebase_id;
  const leadId = row.lead_id ?? row.leadId;
  const documentType = row.document_type ?? row.documentType;
  const fileName = row.file_name ?? row.fileName;
  const fileType = row.file_type ?? row.fileType;
  const fileData = row.file_data ?? row.fileData;
  const originalSize = row.original_size ?? row.originalSize;
  const compressedSize = row.compressed_size ?? row.compressedSize;
  const uploadedBy = row.uploaded_by ?? row.uploadedBy;
  const uploadedAt = row.uploaded_at ?? row.uploadedAt ?? row.createdAt;
  const createdAt = row.created_at ?? row.createdAt;
  return {
    id,
    leadId,
    documentType,
    fileName,
    fileType,
    fileData,
    originalSize,
    compressedSize,
    uploadedBy,
    uploadedAt,
    createdAt,
  };
}

export const getDocumentsForLead = async (leadId) => {
  try {
    const table = await resolveTableNameOrFallback(['documents', 'Documents'], 'documents');
    const cols = await getColumns(table);
    const leadCol = cols.has('lead_id') ? 'lead_id' : 'leadId';
    const orderCol = cols.has('created_at') ? 'created_at' : (cols.has('uploadedAt') ? 'uploadedAt' : 'createdAt');
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${leadCol}\` = ? ORDER BY \`${orderCol}\` DESC`, [leadId]);
    return (rows || []).map(mapDocument);
  } catch (error) {
    console.error('❌ Error getting documents:', error.message);
    return [];
  }
};

export const getDocumentByType = async (leadId, type) => {
  try {
    const table = await resolveTableNameOrFallback(['documents', 'Documents'], 'documents');
    const cols = await getColumns(table);
    const leadCol = cols.has('lead_id') ? 'lead_id' : 'leadId';
    const typeCol = cols.has('document_type') ? 'document_type' : 'documentType';
    const [rows] = await db.query(`SELECT * FROM ${table} WHERE \`${leadCol}\` = ? AND \`${typeCol}\` = ? LIMIT 1`, [leadId, type]);
    return rows.length > 0 ? mapDocument(rows[0]) : null;
  } catch (error) {
    console.error('❌ Error getting document by type:', error.message);
    return null;
  }
};

export const deleteDocument = async (id) => {
  try {
    const table = await resolveTableNameOrFallback(['documents', 'Documents'], 'documents');
    const cols = await getColumns(table);
    const idCol = cols.has('id') ? 'id' : 'firebase_id';
    await db.execute(`DELETE FROM ${table} WHERE \`${idCol}\` = ?`, [id]);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting document:', error.message);
    throw error;
  }
};

export const getAllDocuments = async () => {
  try {
    const table = await resolveTableNameOrFallback(['documents', 'Documents'], 'documents');
    const cols = await getColumns(table);
    const orderCol = cols.has('created_at') ? 'created_at' : (cols.has('uploadedAt') ? 'uploadedAt' : 'createdAt');
    const [rows] = await db.query(`SELECT * FROM ${table} ORDER BY \`${orderCol}\` DESC LIMIT 100`);
    return (rows || []).map(mapDocument);
  } catch (error) {
    console.error('❌ Error getting all documents:', error.message);
    return [];
  }
};

export const uploadDocument = async (doc) => {
  try {
    const table = await resolveTableNameOrFallback(['documents', 'Documents'], 'documents');
    const cols = await getColumns(table);
    const uniqueId = doc.id || Date.now().toString();

    if (cols.has('firebase_id') && cols.has('leadId')) {
      await db.execute(
        `INSERT INTO ${table} (firebase_id, leadId, documentType, fileName, fileType, fileData, originalSize, compressedSize, uploadedBy, uploadedAt, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          uniqueId,
          doc.leadId ?? null,
          doc.documentType ?? null,
          doc.fileName ?? doc.file_name ?? '',
          doc.fileType ?? doc.file_type ?? null,
          doc.fileData ?? doc.file_data ?? null,
          doc.originalSize ?? doc.original_size ?? 0,
          doc.compressedSize ?? doc.compressed_size ?? 0,
          doc.uploadedBy ?? null,
        ]
      );
    } else {
      await db.execute(
        `INSERT INTO ${table} (id, lead_id, document_type, file_name, file_type, file_data, original_size, compressed_size, uploaded_by, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uniqueId,
          doc.leadId ?? null,
          doc.documentType ?? null,
          doc.fileName ?? doc.file_name ?? '',
          doc.fileType ?? doc.file_type ?? null,
          doc.fileData ?? doc.file_data ?? null,
          doc.originalSize ?? doc.original_size ?? 0,
          doc.compressedSize ?? doc.compressed_size ?? 0,
          doc.uploadedBy ?? null,
        ]
      );
    }
    return { success: true, id: uniqueId };
  } catch (error) {
    console.error('❌ Error uploading document:', error.message);
    throw error;
  }
};
