import React, { useState, useRef, useEffect } from 'react';
import { UploadIcon } from './icons/UploadIcon';

interface MeetingPhotoUploadProps {
  meetingId: string;
  uploadType: 'checkin' | 'completion';
  onUploadComplete: (photoUrls: string[]) => void;
  onUploadError: (error: string) => void;
  maxPhotos?: number;
  disabled?: boolean;
  existingPhotos?: string[];
}

export const MeetingPhotoUpload: React.FC<MeetingPhotoUploadProps> = ({
  meetingId,
  uploadType,
  onUploadComplete,
  onUploadError,
  maxPhotos = 5,
  disabled = false,
  existingPhotos = []
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>(existingPhotos);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Cleanup camera and preview URLs on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
        });
      }
      // Clean up all preview URLs to prevent memory leaks
      previewUrls.forEach(url => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [cameraStream, previewUrls]);

  // Camera functions
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      setCameraStream(stream);
      setShowCamera(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      onUploadError('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
      });
      setCameraStream(null);
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Check if video has valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      onUploadError('Video dimensions are not available. Please wait for the video to load completely.');
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Additional validation before drawing
    if (canvas.width === 0 || canvas.height === 0) {
      onUploadError('Canvas dimensions are zero. Unable to capture photo.');
      return;
    }

    // Draw the video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Intelligent compression for camera photos
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const cameraQuality = isMobile ? 0.85 : 0.9; // Higher quality for camera photos
    
    // Convert canvas to blob with adaptive quality
    canvas.toBlob((blob) => {
      if (blob) {
        const originalSizeMB = blob.size / (1024 * 1024);
        
        // Apply additional compression if needed
        let finalQuality = cameraQuality;
        let finalBlob = blob;
        
        // If photo is too large, re-compress with lower quality
        if (originalSizeMB > 2) {
          canvas.toBlob((compressedBlob) => {
            if (compressedBlob) {
              const compressedSizeMB = compressedBlob.size / (1024 * 1024);
              console.log(`📸 Camera photo compressed: ${originalSizeMB.toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB`);
              
              const file = new File([compressedBlob], `camera-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
              setSelectedFiles(prev => [...prev, file]);
              
              const previewUrl = URL.createObjectURL(compressedBlob);
              setPreviewUrls(prev => [...prev, previewUrl]);
            }
          }, 'image/jpeg', 0.7);
        } else {
          console.log(`📸 Camera photo captured: ${originalSizeMB.toFixed(2)}MB`);
          
          const file = new File([blob], `camera-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setSelectedFiles(prev => [...prev, file]);
          
          const previewUrl = URL.createObjectURL(blob);
          setPreviewUrls(prev => [...prev, previewUrl]);
        }
      }
    }, 'image/jpeg', cameraQuality);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    const files = fileList ? Array.from(fileList) : [];
    
    console.log(`📸 Files selected from gallery: ${files.length}`);
    
    // Validate file types - no size limits for mobile users
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    const validFiles = files.filter((file: File) => {
      const isValidType = file.type.startsWith('image/');
      
      if (!isValidType) {
        onUploadError('Please select only image files (JPG, PNG, GIF, etc.)');
        return false;
      }
      
      // No size limits for mobile users - we'll compress intelligently
      if (!isMobile && file.size > 50 * 1024 * 1024) { // 50MB limit only for desktop
        onUploadError('File size must be less than 50MB');
        return false;
      }
      
      console.log(`📸 Processing file: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB) - ${isMobile ? 'Mobile' : 'Desktop'}`);
      return true;
    });

    if (validFiles.length === 0) return;

    // Check total photo limit
    const totalPhotos = uploadedPhotos.length + selectedFiles.length + validFiles.length;
    if (totalPhotos > maxPhotos) {
      onUploadError(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    // Create preview URLs first to ensure synchronization
    const newPreviewUrls: string[] = [];
    
    validFiles.forEach((file: File) => {
      try {
        const url = URL.createObjectURL(file);
        console.log(`✅ Created preview URL for ${file.name}`);
        newPreviewUrls.push(url);
      } catch (error) {
        console.error(`❌ Failed to create preview URL for ${file.name}:`, error);
        // Add empty string to maintain array synchronization
        newPreviewUrls.push('');
      }
    });
    
    // Update both selected files and preview URLs together to maintain sync
    setSelectedFiles(prev => {
      const updated = [...prev, ...validFiles];
      console.log(`📸 Updated selected files count: ${updated.length}`);
      return updated;
    });
    
    setPreviewUrls(prev => {
      const updated = [...prev, ...newPreviewUrls];
      console.log(`📱 Updated preview URLs count: ${updated.length}`);
      return updated;
    });
    
    console.log(`📱 Mobile preview setup complete: ${validFiles.length} files selected, ${newPreviewUrls.length} preview URLs created`);
  };

  const removeSelectedFile = (index: number) => {
    console.log(`🗑️ Removing file at index: ${index}`);
    
    setPreviewUrls(prev => {
      // Clean up the URL for the file being removed
      if (prev[index]) {
        URL.revokeObjectURL(prev[index]);
        console.log(`🧹 Cleaned up preview URL at index ${index}`);
      }
      return prev.filter((_, i) => i !== index);
    });
    
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async () => {
    if (selectedFiles.length === 0) return;

      console.log('🚀 Starting photo upload process...');
      setUploading(true);
      setUploadProgress(0);
      
      // Show compression progress
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log(`📱 Processing ${selectedFiles.length} photos on ${isMobile ? 'Mobile' : 'Desktop'} device...`);

    try {
      console.log('📸 Processing photos for optimal storage...');
      
      // Intelligent photo compression based on device and file size
      const processedPhotos = await Promise.all(selectedFiles.map(async (file, index) => {
        return new Promise<string>((resolve, reject) => {
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          const originalSizeMB = file.size / (1024 * 1024);
          
          console.log(`🔧 Compressing photo ${index + 1}: ${originalSizeMB.toFixed(2)}MB (${isMobile ? 'Mobile' : 'Desktop'})`);
          
          // Adaptive compression settings based on file size and device
          let maxSize = 1600;
          let quality = 0.8;
          let targetSizeKB = 500;
          
          if (isMobile) {
            // Mobile optimization - more aggressive compression for larger files
            if (originalSizeMB > 10) {
              maxSize = 1024; // 1024px for very large mobile photos
              quality = 0.6;
              targetSizeKB = 200; // Target 200KB for very large files
            } else if (originalSizeMB > 5) {
              maxSize = 1200; // 1200px for large mobile photos
              quality = 0.7;
              targetSizeKB = 300; // Target 300KB for large files
            } else if (originalSizeMB > 2) {
              maxSize = 1400; // 1400px for medium mobile photos
              quality = 0.75;
              targetSizeKB = 400; // Target 400KB for medium files
            }
          } else {
            // Desktop optimization - less aggressive compression
            if (originalSizeMB > 20) {
              maxSize = 1200;
              quality = 0.7;
              targetSizeKB = 300;
            } else if (originalSizeMB > 10) {
              maxSize = 1400;
              quality = 0.75;
              targetSizeKB = 400;
            }
          }
          
          // Compress and resize the image
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const img = new Image();
          
          const objectUrl = URL.createObjectURL(file);
          
          img.onload = () => {
            // Calculate new dimensions
            let { width, height } = img;
            
            if (width > height) {
              if (width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw the image
            ctx?.drawImage(img, 0, 0, width, height);
            
            // Progressive compression to meet target size
            let finalQuality = quality;
            let compressedBase64 = canvas.toDataURL('image/jpeg', finalQuality);
            let currentSizeKB = (compressedBase64.length * 3/4) / 1024; // Approximate size
            
            // If still too large, reduce quality further
            while (currentSizeKB > targetSizeKB && finalQuality > 0.3) {
              finalQuality -= 0.05;
              compressedBase64 = canvas.toDataURL('image/jpeg', finalQuality);
              currentSizeKB = (compressedBase64.length * 3/4) / 1024;
            }
            
            const finalSizeMB = (compressedBase64.length * 3/4) / (1024 * 1024);
            const compressionRatio = ((originalSizeMB - finalSizeMB) / originalSizeMB * 100).toFixed(1);
            console.log(`✅ Photo ${index + 1} compressed: ${originalSizeMB.toFixed(2)}MB → ${finalSizeMB.toFixed(2)}MB (${compressionRatio}% reduction, ${finalQuality.toFixed(2)} quality)`);
            
            setUploadProgress(prev => prev + (100 / selectedFiles.length));
            URL.revokeObjectURL(objectUrl);
            resolve(compressedBase64);
          };
          
          img.onerror = () => {
            console.error(`❌ Error loading image ${index + 1}`);
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Failed to load image'));
          };
          
          img.src = objectUrl;
        });
      }));
      
      console.log(`✅ ${processedPhotos.length} photos processed and compressed`);
      
      const allPhotos = [...uploadedPhotos, ...processedPhotos];
      
      setUploadedPhotos(allPhotos);
      setSelectedFiles([]);
      // Clear preview URLs safely
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setPreviewUrls([]);
      setUploadProgress(0);
      
      onUploadComplete(allPhotos);
      console.log('🎉 Photos uploaded successfully!');
      
    } catch (error) {
      console.error('❌ Error uploading photos:', error);
      onUploadError(`Failed to upload photos: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (photoUrl: string) => {
    try {
      // Legacy Firebase Storage URLs cannot be deleted via API; remove from local state only
      if (photoUrl.startsWith('https://firebasestorage.googleapis.com')) {
        const updatedPhotos = uploadedPhotos.filter(url => url !== photoUrl);
        setUploadedPhotos(updatedPhotos);
        onUploadComplete(updatedPhotos);
        return;
      }
      const updatedPhotos = uploadedPhotos.filter(url => url !== photoUrl);
      setUploadedPhotos(updatedPhotos);
      onUploadComplete(updatedPhotos);
    } catch (error) {
      console.error('Error deleting photo:', error);
      onUploadError('Failed to delete photo. Please try again.');
    }
  };

  const openFileDialog = () => {
    console.log('📸 Opening file dialog for gallery selection');
    
    // Clear the input first to ensure onChange fires even if same files selected
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };


  return (
    <div className="space-y-4">
      {/* Debug Info */}
      <div className="bg-yellow-100 p-2 rounded text-xs">
        <p>🔧 DEBUG: Component loaded | Files: {selectedFiles.length} | Uploaded: {uploadedPhotos.length} | Uploading: {uploading.toString()}</p>
      </div>
      
      {/* Upload Section */}
      <div className="border-2 border-dashed border-green-400 rounded-lg p-6 text-center bg-green-50">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploading}
          capture="environment"
          // Enable camera capture on mobile when selecting from gallery
        />
        
        <div className="space-y-3">
          <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
            <UploadIcon className="w-6 h-6 text-slate-600" />
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-slate-900">
              Upload Meeting Photos
            </h3>
            <p className="text-sm text-slate-600">
              {uploadType === 'checkin' ? 'Upload photos when checking in' : 'Upload photos when completing meeting'}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              💡 <strong>Smart Compression:</strong> Photos are automatically optimized for fast storage and access.
              {/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
                ? ' Mobile users can upload any size photos!' 
                : ' Desktop users can upload up to 50MB photos.'}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => {
                console.log('🔧 DEBUG: Select photos button clicked');
                openFileDialog();
              }}
              disabled={disabled || uploading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-lg"
            >
              {uploading ? 'Uploading...' : '📸 Select Photos'}
            </button>
            
            <button
              type="button"
              onClick={showCamera ? stopCamera : startCamera}
              disabled={disabled || uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {showCamera ? '📷 Stop Camera' : '📷 Take Photo'}
            </button>
            
            {uploading && (
              <div className="text-center">
                <div className="text-sm text-green-600 mb-2">
                  Uploading photos... {uploadProgress.toFixed(0)}%
                </div>
                <div className="w-full bg-green-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
            
            {selectedFiles.length > 0 && (
              <button
                type="button"
                onClick={uploadPhotos}
                disabled={uploading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} Photo${selectedFiles.length > 1 ? 's' : ''}`}
              </button>
            )}
          </div>
          
          {uploading && (
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Camera Interface */}
      {showCamera && (
        <div className="border-2 border-blue-400 rounded-lg p-4 bg-blue-50">
          <div className="text-center mb-4">
            <h3 className="text-lg font-medium text-blue-800">📷 Camera Mode</h3>
            <p className="text-sm text-blue-600">Position yourself and click capture</p>
          </div>
          
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-w-md mx-auto rounded-lg border-2 border-blue-300"
              style={{ maxHeight: '300px' }}
            />
            
            <div className="flex justify-center gap-4 mt-4">
              <button
                type="button"
                onClick={capturePhoto}
                className="px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors font-semibold"
              >
                📸 Capture Photo
              </button>
              
              <button
                type="button"
                onClick={stopCamera}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                ❌ Close Camera
              </button>
            </div>
          </div>
          
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">Selected Photos ({selectedFiles.length}):</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {selectedFiles.map((file, index) => {
              const previewUrl = previewUrls[index];
              const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
              
              return (
                <div key={`${file.name}-${index}`} className="relative group">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border"
                      onLoad={() => console.log(`✅ Preview loaded for ${file.name}`)}
                      onError={(e) => {
                        console.error(`❌ Preview failed to load for ${file.name}`);
                        // Fallback: try to recreate the URL
                        const newUrl = URL.createObjectURL(file);
                        if (e.currentTarget) {
                          (e.currentTarget as HTMLImageElement).src = newUrl;
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-24 bg-gray-200 rounded-lg border flex items-center justify-center">
                      <span className="text-xs text-gray-500">Loading preview...</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => removeSelectedFile(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors z-10"
                  >
                    ×
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1 rounded-b-lg">
                    <div className="flex justify-between items-center">
                      <span className="truncate">
                        {file.name.length > 12 ? `${file.name.substring(0, 12)}...` : file.name}
                      </span>
                      <span className="ml-1 text-yellow-300">
                        {(file.size / (1024 * 1024)).toFixed(1)}MB
                      </span>
                    </div>
                    <div className="text-xs text-blue-200 mt-1">
                      {isMobile ? '📱 Mobile' : '💻 Desktop'} | {previewUrl ? '✅ Preview' : '⏳ Loading'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Uploaded Photos */}
      {uploadedPhotos.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-slate-700">Uploaded Photos:</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {uploadedPhotos.map((photoUrl, index) => (
              <div key={index} className="relative group">
                <img
                  src={photoUrl}
                  alt={`Uploaded photo ${index + 1}`}
                  className="w-full h-24 object-cover rounded-lg border"
                />
                <button
                  type="button"
                  onClick={() => deletePhoto(photoUrl)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                >
                  ×
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-green-500 bg-opacity-75 text-white text-xs p-1 rounded-b-lg text-center">
                  ✓ {photoUrl.startsWith('data:') ? 'Stored (Base64)' : 'Stored (Firebase)'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photo Count */}
      <div className="text-xs text-slate-500 text-center">
        {uploadedPhotos.length} / {maxPhotos} photos uploaded
      </div>
    </div>
  );
};