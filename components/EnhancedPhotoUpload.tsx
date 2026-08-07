import React, { useState, useRef } from 'react';

interface EnhancedPhotoUploadProps {
  onUploadComplete: (photos: string[], fileSize?: string) => void;
  onUploadError: (error: string) => void;
  disabled?: boolean;
  maxFileSize?: number; // in MB
  compressionQuality?: number; // 0.1 to 1.0
  showCameraInGallery?: boolean; // Show camera option in file picker
}

export const EnhancedPhotoUpload: React.FC<EnhancedPhotoUploadProps> = ({
  onUploadComplete,
  onUploadError,
  disabled = false,
  maxFileSize = 50, // 50MB default
  compressionQuality = 0.7, // 70% quality
  showCameraInGallery = false
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image compression function
  const compressImage = (file: File, quality: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        // Calculate new dimensions (max 1920x1080 for performance)
        const maxWidth = 1920;
        const maxHeight = 1080;
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }
        
        // 🟢 SAFE FIX: Guard against zero dimensions
        if (width <= 0 || height <= 0) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Invalid image dimensions'));
            return;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        try {
            ctx?.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedDataUrl);
        } catch (e) {
            reject(e);
        } finally {
            // 🟢 SAFE FIX: Cleanup memory
            URL.revokeObjectURL(objectUrl);
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
    const fileList = event.target.files;
    const files = fileList ? Array.from(fileList) : [];
    console.log('📸 Files selected:', files.length);
    
    // Validate files
    const validFiles = files.filter((file: File) => {
      if (!file.type.startsWith('image/')) {
        onUploadError('Please select only image files');
        return false;
      }
      if (file.size > maxFileSize * 1024 * 1024) {
        onUploadError(`File size must be less than ${maxFileSize}MB. Large files will be compressed.`);
        return false;
      }
      return true;
    });
    
    if (validFiles.length === 0) {
      // Clear input if no valid files
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }
    
    setSelectedFiles(validFiles);
    console.log('✅ Valid files:', validFiles.length);
    
    // Automatically upload when files are selected
    // Note: We need to pass the files directly because state updates are async
    // and setSelectedFiles won't have updated 'selectedFiles' in time for this call
    await uploadPhotos(validFiles);
    
    // Clear the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadPhotos = async (filesToUpload?: File[]) => {
    // 🟢 SAFE FIX: Ensure we use the passed files or fallback to state
    const files = filesToUpload || selectedFiles;
    
    if (!files || files.length === 0) {
      onUploadError('Please select photos first');
      return;
    }

    console.log('🚀 Starting upload with compression...');
    setUploading(true);
    setCompressionProgress(0);

    try {
      const compressedPhotos: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`📸 Compressing photo ${i + 1}/${files.length}: ${file.name}`);
        
        try {
          // Compress the image
          const compressedDataUrl = await compressImage(file, compressionQuality);
          compressedPhotos.push(compressedDataUrl);
          
          // Update progress
          setCompressionProgress(((i + 1) / files.length) * 100);
          
          console.log(`✅ Photo ${i + 1} compressed successfully`);
        } catch (error) {
          console.error(`❌ Failed to compress photo ${i + 1}:`, error);
          // Fallback to original if compression fails
          const reader = new FileReader();
          const fallbackPromise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });
          
          try {
             const fallbackDataUrl = await fallbackPromise;
             compressedPhotos.push(fallbackDataUrl);
          } catch (readError) {
              console.error('Failed to read file even without compression', readError);
          }
        }
      }

      console.log('✅ All photos compressed:', compressedPhotos.length);
      
      // Calculate total size after compression
      const totalSize = compressedPhotos.reduce((total, photo) => {
        // Base64 data URL size calculation (approximately)
        const base64Size = photo.length * 0.75; // Base64 is ~33% larger than binary
        return total + base64Size;
      }, 0);
      const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
      const fileSizeText = `${totalSizeMB}MB`;
      
      onUploadComplete(compressedPhotos, fileSizeText);
      setSelectedFiles([]);
      setCompressionProgress(0);
      
    } catch (error) {
      console.error('❌ Upload error:', error);
      onUploadError(`Upload failed: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const getFileSizeText = (file: File) => {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return `${sizeInMB}MB`;
  };

  const getCompressionWarning = () => {
    const largeFiles = selectedFiles.filter(file => file.size > 5 * 1024 * 1024); // 5MB
    if (largeFiles.length > 0) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-semibold">Large photos detected!</p>
              <p className="text-sm">
                {largeFiles.length} photo(s) will be compressed to improve performance. 
                Original quality will be maintained as much as possible.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4 p-4 border-2 border-green-400 rounded-lg bg-green-50">
      <h3 className="text-lg font-bold text-green-800">📸 Enhanced Photo Upload</h3>
      
      <div className="text-center">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          capture={showCameraInGallery ? "environment" : undefined}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <button
          type="button"
          onClick={openFileDialog}
          disabled={disabled || uploading}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
        >
          {uploading ? 'Processing...' : '📸 Select Photos'}
        </button>
      </div>

      {getCompressionWarning()}

      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-semibold text-green-800">Selected Photos:</h4>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📷</span>
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-gray-500">({getFileSizeText(file)})</span>
                </div>
                {file.size > 5 * 1024 * 1024 && (
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                    Will compress
                  </span>
                )}
              </div>
            ))}
          </div>
          
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Compressing photos...</span>
                <span>{Math.round(compressionProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${compressionProgress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            {/* Note: The main upload logic is now automatic in handleFileSelect.
                This manual button is only needed if automatic upload failed or was cancelled.
                We can hide it if we want fully automatic behavior, but it's good to keep as a fallback. */}
            <button
              type="button"
              onClick={() => uploadPhotos()}
              disabled={disabled || uploading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
            >
              {uploading ? 'Processing...' : '📤 Retry Upload'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedFiles([])}
              disabled={uploading}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="text-xs text-gray-600 bg-white p-2 rounded border">
        <p><strong>📋 Upload Guidelines:</strong></p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>Maximum file size: {maxFileSize}MB per photo</li>
          <li>Large photos will be automatically compressed</li>
          <li>Compression maintains quality while reducing file size</li>
          <li>Multiple photos supported</li>
        </ul>
      </div>
    </div>
  );
};