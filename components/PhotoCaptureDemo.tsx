import React, { useState } from 'react';
import { EnhancedPhotoCapture } from './EnhancedPhotoCapture';

interface PhotoMetadata {
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  type: 'meeting_start' | 'meeting_end';
}

export const PhotoCaptureDemo: React.FC = () => {
  const [capturedPhotos, setCapturedPhotos] = useState<Array<{photo: string, metadata: PhotoMetadata}>>([]);
  const [error, setError] = useState<string>('');

  const handlePhotoCapture = (photoData: string, metadata: PhotoMetadata) => {
    console.log('📸 Photo captured with metadata:', metadata);
    setCapturedPhotos(prev => [...prev, { photo: photoData, metadata }]);
    setError('');
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
  };

  // 🟢 SAFE FIX: Robust date formatting helper
  const formatDate = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          📸 Enhanced Photo Capture Demo
        </h1>
        <p className="text-gray-600">
          Test the enhanced photo capture with timestamp and location overlay
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Photo Capture Components */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Meeting Start Photo */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-green-800 mb-4">
            🟢 Meeting Start Photo
          </h2>
          <EnhancedPhotoCapture
            photoType="meeting_start"
            onPhotoCapture={handlePhotoCapture}
            onError={handleError}
            disabled={false}
          />
        </div>

        {/* Meeting End Photo */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-4">
            🔴 Meeting End Photo
          </h2>
          <EnhancedPhotoCapture
            photoType="meeting_end"
            onPhotoCapture={handlePhotoCapture}
            onError={handleError}
            disabled={false}
          />
        </div>
      </div>

      {/* Captured Photos Display */}
      {capturedPhotos.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📷 Captured Photos ({capturedPhotos.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {capturedPhotos.map((item, index) => (
              <div key={index} className="border rounded-lg p-4 bg-gray-50">
                <div className="mb-3">
                  <img
                    src={item.photo}
                    alt={`Captured photo ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg border"
                  />
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      item.metadata.type === 'meeting_start' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {item.metadata.type === 'meeting_start' ? 'START' : 'END'}
                    </span>
                  </div>
                  
                  <div className="text-gray-600">
                    <div className="flex items-center gap-1">
                      <span>📅</span>
                      <span>{formatDate(item.metadata.timestamp)}</span>
                    </div>
                    
                    <div className="flex items-start gap-1 mt-1">
                      <span>📍</span>
                      <span className="text-xs">{item.metadata.location?.address || 'Address not available'}</span>
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-1">
                      GPS: {item.metadata.location?.latitude?.toFixed(6) ?? 'N/A'}, {item.metadata.location?.longitude?.toFixed(6) ?? 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-3">
          📋 How to Use Enhanced Photo Capture
        </h3>
        <ul className="space-y-2 text-blue-700">
          <li className="flex items-start gap-2">
            <span className="font-semibold">1.</span>
            <span>Enable location services when prompted</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">2.</span>
            <span>Allow camera access when prompted</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">3.</span>
            <span>Click "Open Camera" to start the camera</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">4.</span>
            <span>Position yourself clearly in the camera view</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">5.</span>
            <span>Click "Capture Photo" - timestamp and location will be automatically added</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">6.</span>
            <span>Photos are automatically compressed for optimal storage</span>
          </li>
        </ul>
      </div>

      

      {/* Features */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-green-800 mb-3">
          ✨ Enhanced Photo Capture Features
        </h3>
        <div className="grid md:grid-cols-2 gap-4 text-green-700">
          <div>
            <h4 className="font-semibold mb-2">📸 Camera Features:</h4>
            <ul className="space-y-1 text-sm">
              <li>• Real-time camera preview</li>
              <li>• Automatic back camera selection on mobile</li>
              <li>• High-quality photo capture</li>
              <li>• Intelligent compression</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-2">📍 Location & Time Features:</h4>
            <ul className="space-y-1 text-sm">
              <li>• Automatic GPS location capture</li>
              <li>• Real-time timestamp overlay</li>
              <li>• Address resolution from coordinates</li>
              <li>• Visual overlay on captured photos</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};