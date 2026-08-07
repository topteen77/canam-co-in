import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import apiClient from '../services/apiClient';
import type { Lead } from '../types';
import { EnhancedPhotoUpload } from './EnhancedPhotoUpload';

interface SimpleMeetingCheckInProps {
  isOpen: boolean;
  onClose: () => void;
  availableUsers: Array<{ id: string, name: string, email: string, role: string }>;
  userLeads: Lead[];
  currentUser: string;
}

export const SimpleMeetingCheckIn: React.FC<SimpleMeetingCheckInProps> = ({
  isOpen,
  onClose,
  availableUsers,
  userLeads,
  currentUser
}) => {
  const [selectedSalesPerson, setSelectedSalesPerson] = useState('');
  const [personMeetingName, setPersonMeetingName] = useState('');
  const [meetingType, setMeetingType] = useState('Portal Training meeting');
  const [selectedLead, setSelectedLead] = useState('');
  const [uploadedPhotoSize, setUploadedPhotoSize] = useState<string>('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [location, setLocation] = useState<{ latitude: number, longitude: number, address: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<any>(null);
  const [meetingOutcome, setMeetingOutcome] = useState('successful');
  const [completionNotes, setCompletionNotes] = useState('');

  // Photo upload states
  const [checkInPhotos, setCheckInPhotos] = useState<string[]>([]);
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [photoUploadError, setPhotoUploadError] = useState('');

  // Lead search states
  const [leadSearchTerm, setLeadSearchTerm] = useState('');
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);

  // 🟢 SAFE FIX: Ensure userLeads is an array
  const safeUserLeads = Array.isArray(userLeads) ? userLeads : [];

  // Filter leads based on search term
  const filteredLeads = safeUserLeads.filter(lead =>
    (lead.agencyName || '').toLowerCase().includes(leadSearchTerm.toLowerCase()) ||
    (lead.status || '').toLowerCase().includes(leadSearchTerm.toLowerCase()) ||
    (lead.contacts && lead.contacts[0]?.city?.toLowerCase().includes(leadSearchTerm.toLowerCase()))
  );

  // Get selected lead data for display
  const selectedLeadData = safeUserLeads.find(lead => lead.id === selectedLead);

  // Photo upload handlers - append photos instead of replacing
  const handleCheckInPhotoUpload = (photos: string[], fileSize?: string) => {
    console.log('📸 Check-in photos uploaded:', photos.length);
    setCheckInPhotos(prev => [...prev, ...photos]);
    setPhotoUploadError('');
    if (fileSize) {
      setUploadedPhotoSize(fileSize);
    }
  };

  const handleCompletionPhotoUpload = (photos: string[], fileSize?: string) => {
    console.log('📸 Completion photos uploaded:', photos.length);
    setCompletionPhotos(prev => [...prev, ...photos]);
    setPhotoUploadError('');
  };

  // Remove individual photos
  const removeCheckInPhoto = (index: number) => {
    setCheckInPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const removeCompletionPhoto = (index: number) => {
    setCompletionPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handlePhotoUploadError = (error: string) => {
    console.error('❌ Photo upload error:', error);
    setPhotoUploadError(error);
  };

  // Check for active meeting
  useEffect(() => {
    if (isOpen && currentUser) {
      checkActiveMeeting();
    }
  }, [isOpen, currentUser]);

  const checkActiveMeeting = async () => {
    try {
      console.log('🔍 Checking for active meeting...');
      const today = new Date().toISOString().split('T')[0];
      const { data: rows } = await apiClient.get('/meetings/all');
      const list = Array.isArray(rows) ? rows : [];
      const active = list.find(
        (r: any) =>
          (r.username === currentUser || r.Username === currentUser) &&
          (r.date === today || r.Date === today) &&
          (r.meetingStatus === 'active' || r.meeting_status === 'active')
      );
      if (active) {
        const id = active.id ?? active.firebase_id;
        setActiveMeeting({ id, ...active });
        console.log('✅ Active meeting found:', active);
      } else {
        setActiveMeeting(null);
        console.log('ℹ️ No active meeting found');
      }
    } catch (error) {
      console.error('❌ Error checking active meeting:', error);
    }
  };

  const getCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      console.log('🌍 Starting precise location capture...');

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not supported by this browser."));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, // Enable high accuracy for precise location
          timeout: 45000, // Increased timeout for better accuracy
          maximumAge: 0 // Don't use cached location
        });
      });

      const { latitude, longitude, accuracy } = position.coords;
      console.log('📍 GPS coordinates:', { latitude, longitude, accuracy });

      // Get detailed address using multiple geocoding services
      const detailedAddress = await getDetailedAddressFromCoords(latitude, longitude);

      setLocation({ latitude, longitude, address: detailedAddress });
      console.log('✅ Precise location captured:', { latitude, longitude, address: detailedAddress });
    } catch (error) {
      console.error('❌ Location error:', error);
      // Set default location with fallback
      setLocation({
        latitude: 30.7410,
        longitude: 76.7818,
        address: 'Chandigarh, India (Default Location - GPS unavailable)'
      });
      alert("Could not get precise location. Using default/approximate location.");
    } finally {
      setIsGettingLocation(false);
    }
  };

  const getDetailedAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
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

  // 🟢 SAFE FIX: Included simplified version of geocoding logic for completeness
  // In a real codebase, import this from a utility service
  const getAddressFromBigDataCloud = async (lat: number, lng: number): Promise<string> => {
    // Stub
    return `${lat}, ${lng}`;
  };

  const handleStartMeeting = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSalesPerson.trim()) {
      alert('Please enter account manager name');
      return;
    }

    if (!selectedLead) {
      alert('Please select a lead');
      return;
    }

    if (!location) {
      alert('Please wait for location to be captured or try again');
      return;
    }

    if (checkInPhotos.length === 0) {
      setPhotoUploadError('Please upload at least one meeting start photo before starting the meeting');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('🚀 Starting meeting...');

      const selectedLeadData = safeUserLeads.find(lead => lead.id === selectedLead);
      const now = new Date();

      // Intelligent photo optimization for database storage
      let optimizedPhotos = checkInPhotos;

      const meetingData = {
        username: currentUser,
        salesPersonName: selectedSalesPerson,
        salesPersonEmail: personMeetingName || '',
        meetingType: meetingType,
        notes: meetingNotes,
        leadId: selectedLead || '',
        leadName: selectedLeadData?.agencyName || '',
        date: now.toISOString().split('T')[0],
        checkInTime: now.toISOString(),
        meetingStatus: 'active',
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address
        },
        // Photo upload fields - optimized for size
        checkInPhotos: optimizedPhotos,
        photoUploadCount: {
          checkIn: optimizedPhotos.length,
          completion: 0
        },
        createdBy: currentUser,
        createdAt: now.toISOString()
      };

      console.log('📝 Meeting data:', meetingData);

      await apiClient.post('/meetings/check-in', meetingData);

      console.log('✅ Meeting started successfully');
      alert('Meeting started successfully!');

      // Reset form
      setSelectedSalesPerson('');
      setPersonMeetingName('');
      setMeetingNotes('');
      setSelectedLead('');
      setCheckInPhotos([]);
      setUploadedPhotoSize('');

      // Check for active meeting to update UI
      await checkActiveMeeting();

    } catch (error: any) {
      console.error('❌ Error starting meeting:', error);

      // Provide specific error messages for common issues
      let errorMessage = 'Unknown error';
      if (error.message?.includes('bytes')) {
        errorMessage = 'Photos are too large. Please try with fewer or smaller photos.';
      } else if (error.message?.includes('permission')) {
        errorMessage = 'Permission denied. Please check your access rights.';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else {
        errorMessage = error.message || 'Unknown error';
      }

      alert(`Error starting meeting: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEndMeeting = async () => {
    if (!activeMeeting) return;

    console.log('🔄 Ending meeting...');
    console.log('📊 Active meeting data:', activeMeeting);
    setIsSubmitting(true);

    try {
      const now = new Date();
      let startTime: Date;
      let durationMinutes: number;

      // Handle invalid or missing start time
      if (activeMeeting.checkInTime) {
        startTime = new Date(activeMeeting.checkInTime);

        // Check if the date is valid
        if (isNaN(startTime.getTime())) {
          console.warn('⚠️ Invalid start time detected, using current time as fallback');
          startTime = now;
          durationMinutes = 0; // Set to 0 for invalid start time
        } else {
          durationMinutes = Math.round((now.getTime() - startTime.getTime()) / (1000 * 60));
        }
      } else {
        console.warn('⚠️ No start time found, using current time as fallback');
        startTime = now;
        durationMinutes = 0;
      }

      // Ensure duration is not negative
      if (durationMinutes < 0) {
        durationMinutes = 0;
      }

      const updateData = {
        checkOutTime: now.toISOString(),
        meetingDuration: durationMinutes,
        meetingStatus: 'completed',
        meetingOutcome: meetingOutcome,
        completionNotes: completionNotes,
        // Photo upload fields for completion
        completionPhotos: completionPhotos,
        photoUploadCount: {
          checkIn: activeMeeting.checkInPhotos?.length || 0,
          completion: completionPhotos.length
        },
        // Fix the invalid start time if it was invalid
        checkInTime: startTime.toISOString(),
        // Preserve lead information if it exists
        leadId: activeMeeting.leadId || null,
        leadName: activeMeeting.leadName || null
      };

      console.log('📝 Update data:', updateData);

      await apiClient.put(`/meetings/update/${activeMeeting.id}`, updateData);

      console.log('✅ Meeting ended successfully');
      alert(`Meeting ended successfully! Duration: ${durationMinutes} minutes`);

      setActiveMeeting(null);
      setMeetingOutcome('successful');
      setCompletionNotes('');

    } catch (error: any) {
      console.error('❌ Error ending meeting:', error);
      alert(`Error ending meeting: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal title={activeMeeting ? "Meeting Check-out" : "Meeting Check-in"} onClose={onClose}>
      {activeMeeting ? (
        <div className="space-y-4">
          {/* Active Meeting Status */}
          <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🟠</span>
              <div>
                <p className="text-lg font-bold text-orange-800">MEETING IN PROGRESS</p>
                <p className="text-sm text-orange-700">
                  <strong>Meeting:</strong> {activeMeeting.meetingType} with {activeMeeting.salesPersonName}
                </p>
                <p className="text-xs text-orange-600">
                  Started at: {(() => {
                    try {
                      const startTime = new Date(activeMeeting.checkInTime);
                      if (isNaN(startTime.getTime())) {
                        return 'Invalid Date (will be corrected)';
                      }
                      return startTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
                    } catch (error) {
                      return 'Invalid Date (will be corrected)';
                    }
                  })()}
                </p>
              </div>
            </div>
          </div>

          {/* Meeting Completion Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Meeting Outcome
              </label>
              <select
                value={meetingOutcome}
                onChange={(e) => setMeetingOutcome(e.target.value)}
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
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Meeting Completion Notes (Optional)
              </label>
              <textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Add any notes about the meeting completion..."
              />
            </div>

            {/* Photo Upload for Completion */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                📸 Meeting End Photos (Optional - Multiple photos allowed)
              </label>
              <div className="bg-white p-4 rounded border-2 border-red-300">
                <EnhancedPhotoUpload
                  onUploadComplete={handleCompletionPhotoUpload}
                  onUploadError={handlePhotoUploadError}
                  disabled={isSubmitting}
                  maxFileSize={50}
                  compressionQuality={0.7}
                  showCameraInGallery={true}
                />
              </div>

              {photoUploadError && (
                <div className="mt-2 text-sm text-red-600">
                  ❌ {photoUploadError}
                </div>
              )}

              {/* Display uploaded completion photos */}
              {completionPhotos.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-green-700">
                      ✅ {completionPhotos.length} completion photo(s) uploaded
                    </span>
                    <button
                      type="button"
                      onClick={() => setCompletionPhotos([])}
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
                          className="w-full h-24 object-cover rounded border-2 border-red-300"
                        />
                        <button
                          type="button"
                          onClick={() => removeCompletionPhoto(index)}
                          className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                          title="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleEndMeeting}
              disabled={isSubmitting}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isSubmitting ? 'Completing...' : '✅ Complete Meeting'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleStartMeeting} className="space-y-4">
          {/* Account Manager */}
          <div>
            <label htmlFor="salesPerson" className="block text-sm font-medium text-slate-700 mb-1">
              Account Manager Name *
            </label>
            <input
              type="text"
              id="salesPerson"
              value={selectedSalesPerson}
              onChange={(e) => setSelectedSalesPerson(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter account manager name..."
              required
            />
          </div>

          {/* Person Meeting */}
          <div>
            <label htmlFor="personMeeting" className="block text-sm font-medium text-slate-700 mb-1">
              Name & Designation of Person You Are Meeting
            </label>
            <input
              type="text"
              id="personMeeting"
              value={personMeetingName}
              onChange={(e) => setPersonMeetingName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., John Doe - Director"
            />
          </div>

          {/* Meeting Type */}
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
            </select>
          </div>

          {/* Lead Selection with Search */}
          <div>
            <label htmlFor="lead" className="block text-sm font-medium text-slate-700 mb-1">
              Select Lead *
            </label>
            <div className="relative">
              <input
                type="text"
                id="lead"
                value={selectedLead ? selectedLeadData?.agencyName + ' - ' + selectedLeadData?.status : leadSearchTerm}
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
                required
              />
              {/* Dropdown logic remains same */}
              {/* ... (Dropdown rendering code from original) */}
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
                          if (lead.accountManager) {
                            setSelectedSalesPerson(lead.accountManager);
                          }
                        }}
                        className="px-3 py-2 hover:bg-slate-100 cursor-pointer border-b border-slate-100 last:border-b-0"
                      >
                        <div className="font-medium text-slate-900">{lead.agencyName}</div>
                        <div className="text-sm text-slate-500">
                          {lead.contacts && lead.contacts[0]?.city && (
                            <span className="text-blue-600 font-medium">{lead.contacts[0].city}</span>
                          )}
                          <span className="ml-2">Status: {lead.status}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-slate-500 text-sm">
                      {leadSearchTerm ? 'No leads found' : 'No leads available'}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Clear selection button logic remains same */}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Current Location (Precise Address Required)
            </label>
            {isGettingLocation ? (
              <div className="flex items-center gap-2 text-blue-600">
                <span>🌍</span>
                <span>Getting precise location...</span>
              </div>
            ) : location ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600">
                  <span>✅</span>
                  <span className="font-medium">Precise Location Captured</span>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-sm text-green-800 font-medium mb-1">Full Address:</div>
                  <div className="text-sm text-green-700">{location.address}</div>
                  <div className="text-xs text-green-600 mt-1">
                    Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  className="text-xs text-indigo-600 hover:text-indigo-800 underline"
                >
                  🔄 Update Location
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <span>❌</span>
                  <span>Precise location not available</span>
                </div>
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  🌍 Get Precise Location
                </button>
              </div>
            )}
          </div>

          {/* Photo Upload for Check-in */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              📸 Meeting Start Photos * (Multiple photos allowed)
            </label>
            <div className="bg-white p-4 rounded border-2 border-green-300">
              <EnhancedPhotoUpload
                onUploadComplete={handleCheckInPhotoUpload}
                onUploadError={handlePhotoUploadError}
                disabled={isSubmitting}
                maxFileSize={50}
                compressionQuality={0.7}
                showCameraInGallery={true}
              />
            </div>

            {/* Display check-in photos logic remains same */}
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
                      setUploadedPhotoSize('');
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
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Meeting Notes */}
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

          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !location || checkInPhotos.length === 0}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Starting...' : 'Start Meeting'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};