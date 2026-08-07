import apiClient from './apiClient';

export interface Document {
  id: string;
  leadId: string;
  documentType: 'companyRegistration' | 'panCard' | 'gstNumber' | 'mou';
  fileName: string;
  fileType: string;
  fileData: string; // base64 data
  originalSize: number;
  compressedSize: number;
  uploadedBy: string;
  uploadedAt: string;
  createdAt: any;
}

// Get documents for a specific lead
export const getDocumentsForLead = async (leadId: string): Promise<Document[]> => {
  try {
    const response = await apiClient.get(`/documents/lead/${leadId}`);
    return response.data;
  } catch (error) {
    console.error('Error getting documents for lead:', error);
    return [];
  }
};

// Get documents by type for a lead
export const getDocumentsByType = async (leadId: string, documentType: string): Promise<Document | null> => {
  try {
    const response = await apiClient.get(`/documents/type/${leadId}/${documentType}`);
    // API returns empty string or null if not found
    return response.data ? response.data : null;
  } catch (error) {
    console.error('Error getting document by type:', error);
    return null;
  }
};

// Delete a document
export const deleteDocument = async (documentId: string): Promise<boolean> => {
  try {
    const response = await apiClient.delete(`/documents/${documentId}`);
    return response.data.success;
  } catch (error) {
    console.error('Error deleting document:', error);
    return false;
  }
};

// Get all documents (for admin purposes)
export const getAllDocuments = async (): Promise<Document[]> => {
  try {
    const response = await apiClient.get('/documents/all');
    return response.data;
  } catch (error) {
    console.error('Error getting all documents:', error);
    return [];
  }
};