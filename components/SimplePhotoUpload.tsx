import React, { useState, useRef } from 'react';

interface SimplePhotoUploadProps {
  onUploadComplete: (photos: string[]) => void;
  onUploadError: (error: string) => void;
  disabled?: boolean;
}

export const SimplePhotoUpload: React.FC<SimplePhotoUploadProps> = ({
  onUploadComplete,
  onUploadError,
  disabled = false
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    console.log('📸 Files selected:', files.length);
    
    // Validate files
    const validFiles: File[] = [];
    let hasError = false;

    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        onUploadError('Please select only image files');
        hasError = true;
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        onUploadError(`File ${file.name} is too large (max 10MB)`);
        hasError = true;
        return;
      }
      validFiles.push(file);
    });
    
    if (!hasError || validFiles.length > 0) {
        setSelectedFiles(validFiles);
        console.log('✅ Valid files:', validFiles.length);
    }
    
    // Clear input so same files can be selected again if needed
    if (event.target) {
        event.target.value = '';
    }
  };

  const uploadPhotos = async () => {
    if (selectedFiles.length === 0) {
      onUploadError('Please select photos first');
      return;
    }

    console.log('🚀 Starting upload...');
    setUploading(true);

    try {
      const base64Photos = await Promise.all(
        selectedFiles.map(file => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                } else {
                    reject(new Error('Failed to read file data'));
                }
            };
            
            reader.onerror = () => {
                console.error("FileReader error:", reader.error);
                reject(new Error(`Failed to read file: ${file.name}`));
            };
            
            reader.readAsDataURL(file);
          });
        })
      );

      console.log('✅ Photos converted to base64:', base64Photos.length);
      onUploadComplete(base64Photos);
      setSelectedFiles([]);
      
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      onUploadError(`Upload failed: ${error.message || 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const openFileDialog = () => {
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-4 p-4 border-2 border-green-400 rounded-lg bg-green-50">
      <h3 className="text-lg font-bold text-green-800">📸 Simple Photo Upload</h3>
      
      <div className="text-center">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploading}
        />
        
        <button
          type="button"
          onClick={openFileDialog}
          disabled={disabled || uploading}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold transition-colors shadow-sm"
        >
          {uploading ? 'Processing...' : '📸 Select Photos'}
        </button>
      </div>

      {selectedFiles.length > 0 && (
        <div className="text-center animate-fadeIn">
          <p className="text-sm text-green-700 mb-2 font-medium">
            {selectedFiles.length} photo(s) selected
          </p>
          <div className="flex flex-wrap gap-2 justify-center mb-3">
              {selectedFiles.slice(0, 3).map((f, i) => (
                  <span key={i} className="text-xs bg-white px-2 py-1 rounded border border-green-200 text-green-800 truncate max-w-[100px]">
                      {f.name}
                  </span>
              ))}
              {selectedFiles.length > 3 && (
                  <span className="text-xs bg-white px-2 py-1 rounded border border-green-200 text-green-800">
                      +{selectedFiles.length - 3} more
                  </span>
              )}
          </div>
          <button
            type="button"
            onClick={uploadPhotos}
            disabled={uploading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {uploading ? 'Uploading...' : 'Confirm Upload'}
          </button>
        </div>
      )}

      <div className="text-xs text-gray-500 mt-2 border-t border-green-200 pt-2">
        <p>Debug: Files: {selectedFiles.length} | Status: {uploading ? 'Uploading' : 'Idle'}</p>
      </div>
    </div>
  );
};