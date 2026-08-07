import React, { useState } from 'react';
import apiClient from '../services/apiClient';

interface SimpleDocUploadProps {
  leadId: string;
  documentType: 'companyRegistration' | 'panCard' | 'gstNumber' | 'mou';
  documentLabel: string;
  currentDocument?: any;
  onUploadComplete: (doc: any) => void;
  currentUser: string;
  disabled?: boolean;
}

export const SimpleDocUpload: React.FC<SimpleDocUploadProps> = ({
  leadId,
  documentType,
  documentLabel,
  currentDocument,
  onUploadComplete,
  currentUser,
  disabled = false
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const compressImage = (file: File, maxWidth: number = 1200, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        // For non-image files, convert to base64 directly
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl); // Clean up memory
        
        // Calculate new dimensions
        let { width, height } = img;
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width = (width * maxWidth) / height;
            height = maxWidth;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
        }

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        // 🟢 SAFE FIX: Wrap toDataURL in try/catch as it can fail on some browsers/images
        try {
            const compressedDataUrl = canvas.toDataURL(file.type, quality);
            resolve(compressedDataUrl);
        } catch (e) {
            reject(new Error('Image compression failed'));
        }
      };

      img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to load image'));
      };
      
      img.src = objectUrl;
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type - Extended list including Excel
    const allowedTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    // Also check file extension as fallback
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      setError('Invalid file type. Please select a JPG, PNG, PDF, Word doc (.doc, .docx), or Excel (.xls, .xlsx) file.');
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError(`File size too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum allowed: 5MB.`);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      console.log('🚀 Starting simple upload...');
      
      // Compress and convert to base64
      const base64Data = await compressImage(file);
      console.log('✅ File converted to base64');

      const documentData = {
        leadId,
        documentType,
        fileName: file.name,
        fileType: file.type,
        fileData: base64Data,
        originalSize: file.size,
        compressedSize: base64Data.length,
        uploadedBy: currentUser,
        uploadedAt: new Date().toISOString()
      };

      const res = await apiClient.post('/documents/upload', documentData);
      const id = (res.data as any)?.id ?? (res.data as any)?.insertId ?? String(Date.now());
      const savedDoc = { id, ...documentData };
      console.log('✅ Document saved:', id);

      onUploadComplete(savedDoc);
      setIsUploading(false);
      
      // Clear the file input
      const fileInput = event.target;
      fileInput.value = '';
      
      console.log('✅ Upload completed successfully!');
      
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      setError(`Upload failed: ${error.message}`);
      setIsUploading(false);
    }
  };

  const handleDownload = (dataUrl: string, fileName: string) => {
    try {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error("Download failed:", e);
        alert("Failed to download file. Please try again.");
    }
  };

  const handlePreview = (dataUrl: string, fileName: string, fileType: string) => {
    try {
        const newWindow = window.open();
        if (newWindow) {
          if (fileType.startsWith('image/')) {
            newWindow.document.write(`
              <html>
                <head><title>${fileName}</title></head>
                <body style="margin:0; padding:20px; background:#f5f5f5; text-align:center;">
                  <img src="${dataUrl}" style="max-width:100%; height:auto; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1);" />
                </body>
              </html>
            `);
          } else if (fileType === 'application/pdf') {
            // Check if base64 PDF, otherwise download might be safer for some browsers
             newWindow.document.write(
                `<iframe width='100%' height='100%' src='${dataUrl}'></iframe>`
             );
          } else {
            // For other file types, show download option
            newWindow.document.write(`
              <html>
                <head><title>${fileName}</title></head>
                <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #f5f5f5;">
                  <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: inline-block;">
                    <h2 style="color: #1e293b; margin-bottom: 10px;">${fileName}</h2>
                    <p style="color: #64748b; margin-bottom: 20px;">This file type cannot be previewed in the browser.</p>
                    <p style="color: #64748b; margin-bottom: 30px;">Please download the file to view it.</p>
                    <a href="${dataUrl}" download="${fileName}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; transition: background 0.2s;">⬇️ Download File</a>
                  </div>
                </body>
              </html>
            `);
          }
        } else {
            alert("Pop-up blocked! Please allow pop-ups for this site to view documents.");
        }
    } catch (e) {
        console.error("Preview failed:", e);
        alert("Failed to open preview.");
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">
        {documentLabel}
      </label>
      
      {currentDocument && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-green-700 text-lg">📄</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800 truncate" title={currentDocument.fileName || currentDocument.url}>
                  {currentDocument.fileName || 'Document'}
                </p>
                <p className="text-xs text-green-600">
                  {currentDocument.uploadedAt && (
                    <>
                      Uploaded: {new Date(currentDocument.uploadedAt).toLocaleDateString()}
                      {currentDocument.originalSize && (
                        <span className="ml-2">
                          • {(currentDocument.originalSize / 1024 / 1024).toFixed(2)} MB
                        </span>
                      )}
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {(currentDocument.fileData || currentDocument.url) && (
                <button
                  type="button"
                  onClick={() => {
                    const dataUrl = currentDocument.fileData || currentDocument.url;
                    const fileName = currentDocument.fileName || `document.${currentDocument.fileType?.split('/').pop() || 'pdf'}`;
                    handleDownload(dataUrl, fileName);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  title="Download document"
                >
                  ⬇️ Download
                </button>
              )}
              {(currentDocument.fileData || currentDocument.url) && (
                <button
                  type="button"
                  onClick={() => {
                    const dataUrl = currentDocument.fileData || currentDocument.url;
                    const fileName = currentDocument.fileName || 'Document';
                    const fileType = currentDocument.fileType || '';
                    handlePreview(dataUrl, fileName, fileType);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                  title="Preview document"
                >
                  👁️ Preview
                </button>
              )}
            </div>
          </div>
          {currentDocument.fileType && (
            <p className="text-xs text-slate-500 ml-1">
              File type: {currentDocument.fileType.split('/').pop()?.toUpperCase() || 'Unknown'}
            </p>
          )}
          <p className="text-xs text-slate-400 ml-1 italic">
            💡 Click "Choose File" again to replace this document
          </p>
        </div>
      )}

      <div className="relative">
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {isUploading && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
          <span>Uploading...</span>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
          <span>⚠️ {error}</span>
        </div>
      )}

      <div className="text-xs text-slate-500 space-y-1">
        <p>💡 <strong>Accepted formats:</strong> PDF, JPG, PNG, Word (.doc, .docx), Excel (.xls, .xlsx)</p>
        <p>📦 <strong>Maximum file size:</strong> 5MB</p>
        <p>🔒 Files are compressed and stored securely in the database</p>
      </div>
    </div>
  );
};