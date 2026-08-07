import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import apiClient from '../services/apiClient';
import type { Lead } from '../types';
import { formatTimeIST } from '../utils/dateTime';
import { MeetingPhotoUpload } from './MeetingPhotoUpload';
import { SimplePhotoUpload } from './SimplePhotoUpload';
import { EnhancedPhotoCapture } from './EnhancedPhotoCapture';

interface MeetingCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableUsers: Array<{ id: string, name: string, email: string, role: string }>;
  currentUser: string | null;
  userLeads?: Lead[];
}

export const MeetingCheckInModal: React.FC<MeetingCheckInModalProps> = ({
  isOpen,
  onClose,
  availableUsers,
  currentUser,
  userLeads = []
}) => {
  const [selectedSalesPerson, setSelectedSalesPerson] = useState('');
  const [salesPersonEmail, setSalesPersonEmail] = useState('');
  const [meetingType, setMeetingType] = useState('Portal Training meeting');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [selectedLead, setSelectedLead] = useState('');
  const [location, setLocation] = useState<{ latitude: number, longitude: number, address: string } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewLeadForm, setShowNewLeadForm] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);
  const [checkInPhotos, setCheckInPhotos] = useState<string[]>([]);
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [checkInPhotoMetadata, setCheckInPhotoMetadata] = useState<any[]>([]);
  const [completionPhotoMetadata, setCompletionPhotoMetadata] = useState<any[]>([]);

  const [meetingOutcome, setMeetingOutcome] = useState<'successful' | 'rescheduled' | 'cancelled' | 'no_show' | 'other'>('successful');

  // Remove individual photos
  const removeCheckInPhoto = (index: number) => {
    setCheckInPhotos(prev => prev.filter((_, i) => i !== index));
    setCheckInPhotoMetadata(prev => prev.filter((_, i) => i !== index));
  };

  const removeCompletionPhoto = (index: number) => {
    setCompletionPhotos(prev => prev.filter((_, i) => i !== index));
    setCompletionPhotoMetadata(prev => prev.filter((_, i) => i !== index));
  };

  const [photoUploadCount, setPhotoUploadCount] = useState({ checkIn: 0, completion: 0 });
  const [leadSearchTerm, setLeadSearchTerm] = useState('');
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);

  // 🟢 SAFE FIX: Array check
  const safeUserLeads = Array.isArray(userLeads) ? userLeads : [];

  // Filter leads based on search term
  const filteredLeads = safeUserLeads.filter(lead =>
    (lead.agencyName || '').toLowerCase().includes(leadSearchTerm.toLowerCase()) ||
    (lead.status || '').toLowerCase().includes(leadSearchTerm.toLowerCase())
  );

  // Get selected lead data for display
  const selectedLeadData = safeUserLeads.find(lead => lead.id === selectedLead);

  useEffect(() => {
    if (isOpen) {
      // Auto-capture location when modal opens
      getCurrentLocation();
      // Check for active meetings
      checkActiveMeeting();
      // Check photo upload limits
      checkPhotoUploadLimits();
    }
  }, [isOpen]);

  const checkPhotoUploadLimits = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: rows } = await apiClient.get('/meetings/all');
      const list = Array.isArray(rows) ? rows : [];
      let checkInCount = 0;
      let completionCount = 0;
      list
        .filter((r: any) => (r.username === currentUser || r.Username === currentUser) && (r.date === today || r.Date === today))
        .forEach((r: any) => {
          const pc = r.photoUploadCount ?? r.photo_upload_count;
          if (pc) {
            checkInCount += (typeof pc === 'object' ? pc.checkIn : pc) || 0;
            completionCount += (typeof pc === 'object' ? pc.completion : 0) || 0;
          }
        });
      setPhotoUploadCount({ checkIn: checkInCount, completion: completionCount });
    } catch (error) {
      console.error('Error checking photo upload limits:', error);
    }
  };

  const checkActiveMeeting = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: rows } = await apiClient.get('/meetings/all');
      const list = Array.isArray(rows) ? rows : [];
      const active = list
        .filter((r: any) => (r.username === currentUser || r.Username === currentUser) && (r.date === today || r.Date === today) && (r.meetingStatus === 'active' || r.meeting_status === 'active'))
        .sort((a: any, b: any) => new Date(b.checkInTime || b.check_in_time || 0).getTime() - new Date(a.checkInTime || a.check_in_time || 0).getTime())[0];
      if (active) {
        setActiveMeeting({ id: active.id ?? active.firebase_id, ...active });
      } else {
        setActiveMeeting(null);
      }
    } catch (error) {
      console.error('Error checking active meeting:', error);
      setActiveMeeting(null);
    }
  };

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      // Fallback location immediately
      setLocation({
        latitude: 30.7410,
        longitude: 76.7818,
        address: 'Chandigarh, India (Geolocation Not Supported)'
      });
      return;
    }

    setIsGettingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60000
        });
      });

      const { latitude, longitude } = position.coords;

      // Get address from coordinates using reverse geocoding
      const address = await getAddressFromCoordinates(latitude, longitude);

      setLocation({
        latitude,
        longitude,
        address
      });
    } catch (error) {
      console.error('Error getting location:', error);
      // Set a default location instead of showing error
      setLocation({
        latitude: 30.7410, // Default to Chandigarh coordinates
        longitude: 76.7818,
        address: 'Chandigarh, India (Default Location - GPS Failed)'
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

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

      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (e) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalesPerson) {
      alert('Please select a sales person');
      return;
    }

    if (!location) {
      alert('Please wait for location to be captured or try again');
      return;
    }

    setIsSubmitting(true);
    try {
      // Intelligent photo optimization for database storage
      let optimizedPhotos = checkInPhotos;
      if (checkInPhotos.length > 0) {
        const totalSize = checkInPhotos.reduce((total, photo) => total + photo.length, 0);
        const totalSizeMB = totalSize / (1024 * 1024);

        // More generous size limits with intelligent optimization
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const maxSizeMB = isMobile ? 3 : 5; // 3MB for mobile, 5MB for desktop

        if (totalSizeMB > maxSizeMB) {
          // Keep the best photos based on size and quality
          const photoWithSize = checkInPhotos.map((photo, index) => ({
            photo,
            index,
            size: photo.length,
            sizeMB: photo.length / (1024 * 1024)
          }));

          // Sort by size (smaller first for better compression ratio)
          photoWithSize.sort((a, b) => a.size - b.size);

          // Keep photos that fit within limit, prioritizing smaller ones
          let currentSize = 0;
          optimizedPhotos = [];

          for (const item of photoWithSize) {
            if (currentSize + item.size <= maxSizeMB * 1024 * 1024) {
              optimizedPhotos.push(item.photo);
              currentSize += item.size;
            }
          }

          // If still no photos fit, keep the smallest one
          if (optimizedPhotos.length === 0 && photoWithSize.length > 0) {
            optimizedPhotos = [photoWithSize[0].photo];
          }
        }
      }

      const now = new Date();
      await apiClient.post('/meetings/check-in', {
        username: currentUser,
        salesPersonName: selectedSalesPerson,
        salesPersonEmail: salesPersonEmail || selectedSalesPerson,
        meetingType: meetingType,
        notes: meetingNotes,
        leadId: selectedLead || null,
        leadName: selectedLeadData?.agencyName || null,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address
        },
        checkInTime: now.toISOString(),
        meetingStatus: 'active',
        checkInPhotos: optimizedPhotos,
        checkInPhotoMetadata: checkInPhotoMetadata,
        photoUploadCount: {
          checkIn: photoUploadCount.checkIn + (optimizedPhotos.length > 0 ? 1 : 0),
          completion: photoUploadCount.completion
        },
        createdBy: currentUser,
        createdAt: now.toISOString(),
        date: now.toISOString().split('T')[0]
      });

      alert('Meeting started successfully!');
      onClose();

      // Reset form
      setSelectedSalesPerson('');
      setSalesPersonEmail('');
      setMeetingType('Portal Training meeting');
      setMeetingNotes('');
      setSelectedLead('');
      setLocation(null);
      setShowNewLeadForm(false);
      // Refresh active meeting status
      checkActiveMeeting();
    } catch (error) {
      console.error('Error recording meeting check-in:', error);

      let errorMessage = 'Error recording meeting check-in. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          errorMessage = 'Permission denied. Please check your user permissions.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your internet connection.';
        } else if (error.message.includes('quota')) {
          errorMessage = 'Database quota exceeded. Please try again later.';
        }
      }

      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndMeeting = async () => {
    if (!activeMeeting) {
      console.error('No active meeting to end');
      return;
    }

    setIsEndingMeeting(true);

    try {
      const now = new Date();
      const startTime = new Date(activeMeeting.checkInTime);
      const durationMinutes = Math.round((now.getTime() - startTime.getTime()) / (1000 * 60));

      const updateData = {
        checkOutTime: now.toISOString(),
        meetingDuration: durationMinutes,
        meetingStatus: 'completed',
        completionPhotos: completionPhotos,
        completionPhotoMetadata: completionPhotoMetadata,
        meetingOutcome: meetingOutcome,
        photoUploadCount: {
          checkIn: activeMeeting.photoUploadCount?.checkIn || 0,
          completion: (activeMeeting.photoUploadCount?.completion || 0) + (completionPhotos.length > 0 ? 1 : 0)
        },
        leadId: activeMeeting.leadId || null,
        leadName: activeMeeting.leadName || null
      };

      await apiClient.put(`/meetings/update/${activeMeeting.id}`, updateData);

      alert(`Meeting ended successfully! Duration: ${durationMinutes} minutes`);
      setActiveMeeting(null);
      onClose();

    } catch (error) {
      console.error('❌ Error ending meeting:', error);
      const err = error as Error;
      alert(`Error ending meeting: ${err.message || 'Unknown error'}. Please try again.`);
    } finally {
      setIsEndingMeeting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal title={activeMeeting ? "Meeting Check-out" : "Meeting Check-in"} onClose={onClose}>
      {activeMeeting && (
        <div className="mb-4 p-4 bg-orange-50 border-2 border-orange-300 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🟠</span>
            <div>
              <p className="text-lg font-bold text-orange-800">
                MEETING IN PROGRESS
              </p>
              <p className="text-sm text-orange-700">
                <strong>Active Meeting:</strong> {activeMeeting.meetingType} with {activeMeeting.salesPersonName}
              </p>
              <p className="text-xs text-orange-600 mt-1">
                Started at: {formatTimeIST(activeMeeting.checkInTime)}
              </p>
              <div className="mt-2 p-2 bg-orange-100 rounded text-xs text-orange-800">
                ⚠️ Complete this meeting before starting a new one
              </div>
            </div>
          </div>
        </div>
      )}

      {!activeMeeting ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="salesPerson" className="block text-sm font-medium text-slate-700 mb-1">
              Sales Person Name *
            </label>
            <input
              type="text"
              id="salesPerson"
              value={selectedSalesPerson}
              onChange={(e) => setSelectedSalesPerson(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter sales person name..."
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Enter the full name of the sales person conducting the meeting
            </p>
          </div>

          <div>
            <label htmlFor="salesPersonEmail" className="block text-sm font-medium text-slate-700 mb-1">
              Sales Person Email (Optional)
            </label>
            <input
              type="email"
              id="salesPersonEmail"
              value={salesPersonEmail}
              onChange={(e) => setSalesPersonEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter sales person email..."
            />
            <p className="text-xs text-slate-500 mt-1">
              Optional: Enter the email address of the sales person
            </p>
          </div>

          <div>
            <label htmlFor="meetingType" className="block text-sm font-medium text-slate-700 mb-1">
              Meeting Type
            </label>
            <select
              id="meetingType"
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="Portal Training meeting">Portal Training meeting</option>
              <option value="Portal demo meeting">Portal demo meeting</option>
              <option value="Fresh walking - 1st meeting">Fresh walking - 1st meeting</option>
              <option value="Agent Review meeting">Agent Review meeting</option>
              <option value="Follow-up Meeting">Follow-up Meeting</option>
              <option value="Demo">Demo</option>
              <option value="Team Meeting">Team Meeting</option>
              <option value="Presentation">Presentation</option>
              <option value="Training Session">Training Session</option>
            </select>
          </div>

          {/* Lead Selection with Search */}
          <div>
            <label htmlFor="lead" className="block text-sm font-medium text-slate-700 mb-1">
              Select Lead (Optional)
            </label>
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  id="lead"
                  value={selectedLead ? (selectedLeadData?.agencyName + (selectedLeadData?.status ? ' - ' + selectedLeadData.status : '')) : leadSearchTerm}
                  onChange={(e) => {
                    setLeadSearchTerm(e.target.value);
                    setSelectedLead('');
                    setShowLeadDropdown(true);
                  }}
                  onFocus={() => setShowLeadDropdown(true)}
                  onBlur={() => {
                    setTimeout(() => setShowLeadDropdown(false), 200);
                  }}
                  placeholder="Search and select a lead..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Dropdown List */}
                {showLeadDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredLeads.length > 0 ? (
                      filteredLeads.map((lead) => (
                        <div
                          key={lead.id}
                          onClick={() => {
                            setSelectedLead(lead.id);
                            setLeadSearchTerm('');
                            setShowLeadDropdown(false);
                          }}
                          className="px-3 py-2 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-b-0"
                        >
                          <div className="font-medium text-slate-900">{lead.agencyName}</div>
                          <div className="text-sm text-slate-500">
                            Status: {lead.status}
                            {lead.accountManager && (
                              <span className="ml-2">• AM: {lead.accountManager}</span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-slate-500 text-sm">
                        {leadSearchTerm ? 'No leads found matching your search' : 'No leads available'}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Clear selection button */}
              {selectedLead && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLead('');
                    setLeadSearchTerm('');
                  }}
                  className="text-sm text-red-600 hover:text-red-800 underline"
                >
                  Clear Selection
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowNewLeadForm(!showNewLeadForm)}
                className="text-sm text-indigo-600 hover:text-indigo-800 underline"
              >
                {showNewLeadForm ? 'Cancel' : '+ Add New Lead'}
              </button>
            </div>
          </div>

          {/* Location Display */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Current Location
            </label>
            <div className="p-3 bg-slate-50 rounded-lg border">
              {isGettingLocation ? (
                <div className="flex items-center gap-2 text-slate-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                  <span>Getting your location...</span>
                </div>
              ) : location ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-green-600">
                    <span>📍</span>
                    <span className="font-medium">{location.address}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    Coordinates: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <span>❌</span>
                  <span>Location not available</span>
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    className="ml-2 text-xs text-indigo-600 hover:text-indigo-800 underline"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-1">
              Meeting Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={meetingNotes}
              onChange={(e) => setMeetingNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Add any notes about the meeting..."
            />
          </div>

          {/* Photo Upload Section - Always show for check-in */}
          <div className="border-2 border-green-400 bg-green-50 p-4 rounded-lg">
            <label className="block text-lg font-bold text-green-800 mb-2">
              📸 MEETING PHOTOS (CHECK-IN) - NOW AVAILABLE!
            </label>
            <div className="text-sm text-green-700 mb-4">
              Upload photos when checking in. You can upload photos {2 - photoUploadCount.checkIn} more time(s) today.
            </div>
            <div className="bg-white p-4 rounded border-2 border-green-300">
              <div className="text-center py-4">
                <div className="text-4xl mb-4">📸</div>
                <p className="text-lg font-semibold text-green-800 mb-4">Enhanced Photo Capture with Timestamp & Location</p>
                <div className="bg-blue-100 p-3 rounded mb-4">
                  <p className="text-sm text-blue-800">
                    📸 Capture photos with real-time timestamp and location overlay. Photos are automatically compressed and stored securely.
                  </p>
                </div>

                {/* Enhanced Photo Capture */}
                <EnhancedPhotoCapture
                  photoType="meeting_start"
                  onPhotoCapture={(photoData, metadata) => {
                    console.log('📸 Enhanced photo captured:', { photoData: photoData.substring(0, 50) + '...', metadata });
                    setCheckInPhotos(prev => [...prev, photoData]);
                    setCheckInPhotoMetadata(prev => [...prev, metadata]);
                  }}
                  onError={(error) => {
                    console.error('❌ Enhanced photo capture error:', error);
                    alert(`Photo Capture Error: ${error}`);
                  }}
                  location={location || undefined}
                  disabled={photoUploadCount.checkIn >= 2}
                />

                {/* Alternative Upload Options */}
                <div className="mt-6 space-y-4">
                  <div className="p-4 border-2 border-orange-400 bg-orange-50 rounded-lg">
                    <h4 className="text-lg font-bold text-orange-800 mb-2">📁 Alternative: File Upload</h4>
                    <SimplePhotoUpload
                      onUploadComplete={(photos) => {
                        console.log('📸 File upload completed:', photos);
                        setCheckInPhotos(prev => [...prev, ...photos]);
                      }}
                      onUploadError={(error) => {
                        console.error('❌ File upload error:', error);
                        alert(`File Upload Error: ${error}`);
                      }}
                      disabled={photoUploadCount.checkIn >= 2}
                    />
                  </div>

                  <div className="p-4 border-2 border-purple-400 bg-purple-50 rounded-lg">
                    <h4 className="text-lg font-bold text-purple-800 mb-2">📷 Advanced Upload</h4>
                    <MeetingPhotoUpload
                      meetingId={`checkin_${Date.now()}`}
                      uploadType="checkin"
                      onUploadComplete={(photos) => {
                        console.log('📸 Advanced upload completed:', photos);
                        setCheckInPhotos(prev => [...prev, ...photos]);
                      }}
                      onUploadError={(error) => {
                        console.error('❌ Advanced upload error:', error);
                        alert(`Advanced Upload Error: ${error}`);
                      }}
                      maxPhotos={5}
                      disabled={photoUploadCount.checkIn >= 2}
                    />
                  </div>
                </div>

                {/* Display uploaded check-in photos */}
                {checkInPhotos.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-green-700">
                        ✅ {checkInPhotos.length} check-in photo(s) uploaded
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCheckInPhotos([]);
                          setCheckInPhotoMetadata([]);
                        }}
                        className="text-xs text-red-600 hover:text-red-800 underline"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                      {checkInPhotos.map((photo, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={photo}
                            alt={`Check-in photo ${index + 1}`}
                            className="w-full h-24 object-cover rounded border-2 border-green-300"
                          />
                          <button
                            type="button"
                            onClick={() => removeCheckInPhoto(index)}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                            title="Remove photo"
                          >
                            ×
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center rounded-b">
                            Photo {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-2 border-blue-400 bg-blue-50 p-2 rounded mt-4">
                  <p className="text-xs text-blue-800">
                    📊 Current photos: {checkInPhotos.length} | Upload count: {photoUploadCount.checkIn}/2
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isGettingLocation || !location}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Recording...' : 'Record Check-in'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {/* Meeting Checkout Form */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <h3 className="text-lg font-bold text-blue-800 mb-4">Complete Current Meeting</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Meeting Outcome
                </label>
                <select
                  value={meetingOutcome}
                  onChange={(e) => setMeetingOutcome(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="successful">✅ Successful</option>
                  <option value="rescheduled">🔄 Rescheduled</option>
                  <option value="cancelled">❌ Cancelled</option>
                  <option value="no_show">👻 No Show</option>
                  <option value="other">📝 Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Meeting Photos (Completion)
                </label>
                <div className="text-xs text-slate-500 mb-2">
                  Upload photos when completing meeting. You can upload photos {2 - photoUploadCount.completion} more time(s) today.
                </div>

                <div className="bg-white p-4 rounded border-2 border-green-300">
                  <EnhancedPhotoCapture
                    photoType="meeting_completion"
                    onPhotoCapture={(photoData, metadata) => {
                      setCompletionPhotos(prev => [...prev, photoData]);
                      setCompletionPhotoMetadata(prev => [...prev, metadata]);
                    }}
                    onError={(error) => alert(`Photo Capture Error: ${error}`)}
                    location={location || undefined}
                    disabled={photoUploadCount.completion >= 2}
                  />

                  {/* Alternative Upload Options for Completion */}
                  <div className="mt-4 space-y-4">
                    <div className="p-3 border border-orange-200 bg-orange-50 rounded">
                      <h4 className="text-sm font-bold text-orange-800 mb-2">Alternative: File Upload</h4>
                      <SimplePhotoUpload
                        onUploadComplete={(photos) => {
                          setCompletionPhotos(prev => [...prev, ...photos]);
                          // Create dummy metadata for uploaded files
                          const meta = photos.map(() => ({
                            timestamp: new Date().toISOString(),
                            location: location ? { latitude: location.latitude, longitude: location.longitude, address: location.address } : null
                          }));
                          setCompletionPhotoMetadata(prev => [...prev, ...meta]);
                        }}
                        onUploadError={(error) => alert(`File Upload Error: ${error}`)}
                        disabled={photoUploadCount.completion >= 2}
                      />
                    </div>
                  </div>

                  {/* Display uploaded completion photos */}
                  {completionPhotos.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-green-700">
                          ✅ {completionPhotos.length} completion photo(s) uploaded
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setCompletionPhotos([]);
                            setCompletionPhotoMetadata([]);
                          }}
                          className="text-xs text-red-600 hover:text-red-800 underline"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                        {completionPhotos.map((photo, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={photo}
                              alt={`Completion photo ${index + 1}`}
                              className="w-full h-24 object-cover rounded border-2 border-green-300"
                            />
                            <button
                              type="button"
                              onClick={() => removeCompletionPhoto(index)}
                              className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                              title="Remove photo"
                            >
                              ×
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 text-center rounded-b">
                              Photo {index + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="completionNotes" className="block text-sm font-medium text-slate-700 mb-1">
                  Meeting Completion Notes (Optional)
                </label>
                <textarea
                  id="completionNotes"
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Add any notes about the meeting completion..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleEndMeeting}
                  disabled={isEndingMeeting}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                >
                  {isEndingMeeting ? 'Completing...' : '✅ Complete Meeting'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};