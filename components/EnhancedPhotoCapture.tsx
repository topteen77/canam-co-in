import React, { useState, useRef, useEffect } from 'react';
import apiClient from '../services/apiClient';

interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

interface PhotoMetadata {
  timestamp: string;
  location: Location;
  type: 'meeting_start' | 'meeting_end';
}

interface EnhancedPhotoCaptureProps {
  onPhotoCapture: (photoData: string, metadata: PhotoMetadata) => void;
  onError: (error: string) => void;
  photoType: 'meeting_start' | 'meeting_end';
  disabled?: boolean;
  location?: Location;
}

export const EnhancedPhotoCapture: React.FC<EnhancedPhotoCaptureProps> = ({
  onPhotoCapture,
  onError,
  photoType,
  disabled = false,
  location
}) => {
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(location || null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Get current location
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      onError('Geolocation is not supported by this browser');
      return;
    }

    setIsGettingLocation(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      const { latitude, longitude } = position.coords;

      // Get address from coordinates
      const address = await getAddressFromCoordinates(latitude, longitude);

      const locationData: Location = {
        latitude,
        longitude,
        address
      };

      setCurrentLocation(locationData);
      console.log('📍 Location obtained:', locationData);
    } catch (error) {
      console.error('Error getting location:', error);
      onError('Unable to get location. Please enable location services.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Get address from coordinates using OpenStreetMap Nominatim
  const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string> => {
    try {
      const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "YOUR_API_KEY";

      if (GOOGLE_API_KEY && GOOGLE_API_KEY !== "YOUR_API_KEY") {
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`);
        const data = await response.json();
        if (data.status === "OK" && data.results && data.results.length > 0) {
          return data.results[0].formatted_address;
        }
      }

      // Fallback to OpenStreetMap if Google API fails or is not configured
      const osmResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const osmData = await osmResponse.json();
      if (osmData && osmData.display_name) {
        return osmData.display_name;
      }

      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (e) {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };


  // Start camera
  const startCamera = async () => {
    try {
      // Get location first
      if (!currentLocation) {
        await getCurrentLocation();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      setCameraStream(stream);
      setShowCamera(true);
      setVideoReady(false); // Reset video ready state

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Add event listener to detect when video is ready
        const video = videoRef.current;
        const onLoadedMetadata = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            setVideoReady(true);
            console.log('📹 Video ready:', { width: video.videoWidth, height: video.videoHeight });
          }
        };

        // Remove previous listener if any
        video.removeEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('loadedmetadata', onLoadedMetadata);

        // Also check if metadata is already loaded
        if (video.readyState >= 1 && video.videoWidth > 0 && video.videoHeight > 0) {
          setVideoReady(true);
        }
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      onError('Unable to access camera. Please check permissions.');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
        // 🟢 SAFE FIX: Ensure track is stopped completely
        track.enabled = false;
      });
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
    setVideoReady(false);
  };

  // Draw overlay with timestamp and location
  const drawOverlay = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    // 🟢 SAFE FIX: Guard against zero dimensions
    if (canvas.width === 0 || canvas.height === 0) return;

    const now = new Date();
    const timestamp = now.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const typeText = photoType === 'meeting_start' ? 'MEETING START' : 'MEETING END';
    const locationText = currentLocation ? currentLocation.address : 'Location unavailable';

    // Set overlay style
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Meeting type overlay
    ctx.fillStyle = photoType === 'meeting_start' ? '#10B981' : '#EF4444';
    ctx.fillRect(20, 20, 200, 60);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(typeText, 30, 45);

    // Timestamp overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(20, canvas.height - 120, 300, 100);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`📅 ${timestamp}`, 30, canvas.height - 85);

    ctx.font = '14px Arial';
    ctx.fillText(`📍 ${locationText}`, 30, canvas.height - 60);

    if (currentLocation) {
      ctx.font = '12px Arial';
      ctx.fillText(`GPS: ${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}`, 30, canvas.height - 35);
    }

    // Add watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('Agent Follow-up CRM', canvas.width - 20, canvas.height - 20);
  };

  // Capture photo with overlay
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !overlayCanvasRef.current || !currentLocation) {
      onError('Camera or location not ready');
      return;
    }

    if (!videoReady) {
      onError('Video is not ready yet. Please wait for the camera to load completely.');
      return;
    }

    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const overlayCanvas = overlayCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const overlayCtx = overlayCanvas.getContext('2d');

      if (!ctx || !overlayCtx) {
        throw new Error('Canvas context not available');
      }

      // Check if video has valid dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error('Video dimensions are not available. Please wait for the video to load completely.');
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      overlayCanvas.width = video.videoWidth;
      overlayCanvas.height = video.videoHeight;

      // Additional validation before drawing
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas dimensions are zero. Unable to capture photo.');
      }

      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Draw overlay on separate canvas
      drawOverlay(overlayCanvas, overlayCtx);

      // Create final composite image
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvas.width;
      finalCanvas.height = canvas.height;
      const finalCtx = finalCanvas.getContext('2d');

      if (!finalCtx) {
        throw new Error('Final canvas context not available');
      }

      // Draw original photo
      finalCtx.drawImage(canvas, 0, 0);

      // Draw overlay
      finalCtx.drawImage(overlayCanvas, 0, 0);

      // Convert to blob
      finalCanvas.toBlob((blob) => {
        if (blob) {
          // Convert to base64
          const reader = new FileReader();
          reader.onload = () => {
            const photoData = reader.result as string;

            const metadata: PhotoMetadata = {
              timestamp: new Date().toISOString(),
              location: currentLocation,
              type: photoType
            };

            onPhotoCapture(photoData, metadata);
            setIsCapturing(false);
          };
          reader.onerror = () => {
            onError('Failed to convert image to base64');
            setIsCapturing(false);
          };
          reader.readAsDataURL(blob);
        } else {
          // 🟢 SAFE FIX: Fallback if toBlob fails
          console.error('Failed to create photo blob');
          onError('Failed to generate image file');
          setIsCapturing(false);
        }
      }, 'image/jpeg', 0.9);

    } catch (error) {
      console.error('Error capturing photo:', error);
      onError(`Failed to capture photo: ${error}`);
      setIsCapturing(false);
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [cameraStream]); // Added cameraStream dependency to cleanup when stream changes

  // Get location on component mount if not provided
  useEffect(() => {
    if (!currentLocation && !isGettingLocation) {
      getCurrentLocation();
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Camera Controls */}
      <div className="text-center space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            📸 {photoType === 'meeting_start' ? 'Meeting Start Photo' : 'Meeting End Photo'}
          </h3>
          <p className="text-sm text-gray-600">
            Capture a photo with timestamp and location overlay
          </p>
        </div>

        {/* Location Status */}
        <div className="p-3 bg-gray-50 rounded-lg border">
          {isGettingLocation ? (
            <div className="flex items-center justify-center gap-2 text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Getting location...</span>
            </div>
          ) : currentLocation ? (
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <span>📍</span>
                <span className="font-medium text-sm">{currentLocation.address}</span>
              </div>
              <div className="text-xs text-gray-500">
                GPS: {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 text-red-600">
              <span>❌</span>
              <span>Location not available</span>
              <button
                type="button"
                onClick={getCurrentLocation}
                className="ml-2 text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Camera Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!showCamera ? (
            <button
              type="button"
              onClick={startCamera}
              disabled={disabled || isGettingLocation}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              📷 Open Camera
            </button>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={disabled || isCapturing || !currentLocation || !videoReady}
                className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-lg"
              >
                {isCapturing ? '📸 Capturing...' :
                  !videoReady ? '⏳ Loading Camera...' :
                    '📸 Capture Photo'}
              </button>

              <button
                type="button"
                onClick={stopCamera}
                disabled={disabled}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                ❌ Close Camera
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Camera Interface */}
      {showCamera && (
        <div className="border-2 border-blue-400 rounded-lg p-4 bg-blue-50">
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-w-md mx-auto rounded-lg border-2 border-blue-300"
              style={{ maxHeight: '400px' }}
            />

            {/* Preview overlay */}
            {currentLocation && (
              <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-2 rounded text-xs">
                <div className="font-bold text-green-400">
                  {photoType === 'meeting_start' ? 'MEETING START' : 'MEETING END'}
                </div>
                <div>📅 {new Date().toLocaleString()}</div>
                <div>📍 {currentLocation.address.substring(0, 30)}...</div>
              </div>
            )}
          </div>

          {/* Video Status */}
          {showCamera && (
            <div className="mt-2 text-center">
              {videoReady ? (
                <div className="text-green-600 text-sm">
                  ✅ Camera ready for capture
                </div>
              ) : (
                <div className="text-amber-600 text-sm">
                  ⏳ Initializing camera... Please wait
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hidden canvases */}
      <canvas ref={canvasRef} className="hidden" />
      <canvas ref={overlayCanvasRef} className="hidden" />

      {/* Instructions */}
      <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">
        <p><strong>Instructions:</strong></p>
        <ul className="list-disc list-inside space-y-1 mt-1">
          <li>Ensure location services are enabled</li>
          <li>Allow camera access when prompted</li>
          <li>Position yourself clearly in the camera view</li>
          <li>The photo will include timestamp and location overlay</li>
          <li>Photos are automatically compressed for optimal storage</li>
        </ul>
      </div>
    </div>
  );
};