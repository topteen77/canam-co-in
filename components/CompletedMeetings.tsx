import React, { useState, useEffect, useMemo } from 'react';
import type { MeetingCheckInRecord, Lead } from '../types';

interface CompletedMeetingsProps {
  meetingCheckIns: MeetingCheckInRecord[];
  leads: Lead[];
  currentUser: string | null;
  availableUsers: Array<{ id: string, name: string, email: string, role: string }>;
}

interface MeetingFilters {
  dateFrom: string;
  dateTo: string;
  user: string;
  leadId: string;
  meetingStatus: string;
  meetingOutcome: string;
  searchTerm: string;
}

const CompletedMeetings: React.FC<CompletedMeetingsProps> = ({
  meetingCheckIns,
  leads,
  currentUser,
  availableUsers
}) => {
  const [filters, setFilters] = useState<MeetingFilters>({
    dateFrom: '',
    dateTo: '',
    user: '',
    leadId: '',
    meetingStatus: '',
    meetingOutcome: '',
    searchTerm: ''
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingCheckInRecord | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Filter and sort completed meetings
  const filteredMeetings = useMemo(() => {
    // 🟢 SAFE FIX: Ensure we have an array
    const safeCheckIns = Array.isArray(meetingCheckIns) ? meetingCheckIns : [];

    return safeCheckIns
      .filter(meeting => {
        // Show completed meetings - either has meetingStatus === 'completed' OR has checkOutTime (indicating meeting ended)
        const hasCheckOutTime = meeting.checkOutTime && meeting.checkOutTime.trim() !== '';
        const isCompleted = meeting.meetingStatus === 'completed' || hasCheckOutTime;
        if (!isCompleted) return false;

        // Date filtering
        if (filters.dateFrom) {
          const meetingDate = new Date(meeting.date);
          const fromDate = new Date(filters.dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (!isNaN(meetingDate.getTime()) && meetingDate < fromDate) return false;
        }

        if (filters.dateTo) {
          const meetingDate = new Date(meeting.date);
          const toDate = new Date(filters.dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (!isNaN(meetingDate.getTime()) && meetingDate > toDate) return false;
        }

        // User filtering
        if (filters.user && meeting.username !== filters.user) return false;

        // Lead filtering
        if (filters.leadId && meeting.leadId !== filters.leadId) return false;

        // Meeting status filtering
        if (filters.meetingStatus && meeting.meetingStatus !== filters.meetingStatus) return false;

        // Meeting outcome filtering
        if (filters.meetingOutcome && meeting.meetingOutcome !== filters.meetingOutcome) return false;

        // Search term filtering
        if (filters.searchTerm) {
          const searchTerm = filters.searchTerm.toLowerCase();
          const searchInNotes = (meeting.notes || '').toLowerCase().includes(searchTerm);
          const searchInLeadName = (meeting.leadName || '').toLowerCase().includes(searchTerm);
          const searchInSalesPerson = (meeting.salesPersonName || '').toLowerCase().includes(searchTerm);

          if (!searchInNotes && !searchInLeadName && !searchInSalesPerson) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Sort by most recent first
        // Priority: checkOutTime > checkInTime > date
        const getSortTime = (meeting: MeetingCheckInRecord): number => {
          // Prefer checkOutTime if it exists and is not empty
          if (meeting.checkOutTime && meeting.checkOutTime.trim() !== '') {
            const checkOutDate = new Date(meeting.checkOutTime);
            if (!isNaN(checkOutDate.getTime())) {
              return checkOutDate.getTime();
            }
          }
          // Fallback to checkInTime
          if (meeting.checkInTime) {
            const checkInDate = new Date(meeting.checkInTime);
            if (!isNaN(checkInDate.getTime())) {
              return checkInDate.getTime();
            }
          }
          // Fallback to date
          if (meeting.date) {
            const date = new Date(meeting.date);
            if (!isNaN(date.getTime())) {
              return date.getTime();
            }
          }
          return 0;
        };

        const timeA = getSortTime(a);
        const timeB = getSortTime(b);

        // Sort descending (most recent first)
        return timeB - timeA;
      });
  }, [meetingCheckIns, filters]);

  // Get unique values for filter dropdowns safely
  const uniqueUsers = [...new Set((Array.isArray(meetingCheckIns) ? meetingCheckIns : []).map(m => m.username))];

  const uniqueLeads = (Array.isArray(leads) ? leads : []).filter(lead =>
    (Array.isArray(meetingCheckIns) ? meetingCheckIns : []).some(m => m.leadId === lead.id)
  );

  const uniqueOutcomes = [...new Set((Array.isArray(meetingCheckIns) ? meetingCheckIns : []).map(m => m.meetingOutcome).filter(Boolean))];

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      user: '',
      leadId: '',
      meetingStatus: '',
      meetingOutcome: '',
      searchTerm: ''
    });
  };

  const getUserDisplayName = (email: string): string => {
    if (!email) return 'N/A';

    // 🟢 SAFE FIX: Ensure availableUsers is an array
    const safeUsers = Array.isArray(availableUsers) ? availableUsers : [];

    const user = safeUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (user && user.name && user.name.trim()) {
      return user.name;
    }

    // Simple mapping for common emails to names
    const emailToNameMap: { [key: string]: string } = {
      'iapplyam2b2b@gmail.com': 'Nakul Kathota',
      'canamrakesh@gmail.com': 'Rakesh',
      'amit.iapply@gmail.com': 'Amit Kumar',
      'admin@iapply.com': 'Admin',
      'support@iapply.com': 'Support Team'
    };

    const mappedName = emailToNameMap[email.toLowerCase()];
    if (mappedName) return mappedName;

    const emailPrefix = email.split('@')[0];
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'Asia/Kolkata'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
        hour12: true
      });
    } catch {
      return '';
    }
  };

  const getOutcomeColor = (outcome: string) => {
    if (!outcome) return 'bg-blue-100 text-blue-800';
    switch (outcome) {
      case 'successful': return 'bg-green-100 text-green-800';
      case 'rescheduled': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no_show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const openPhotoModal = (photos: string[], startIndex: number = 0) => {
    setSelectedPhotos(photos);
    setCurrentPhotoIndex(startIndex);
    setShowPhotoModal(true);
  };

  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setSelectedPhotos([]);
    setCurrentPhotoIndex(0);
  };

  const nextPhoto = () => {
    if (selectedPhotos.length === 0) return;
    setCurrentPhotoIndex((prev) => (prev + 1) % selectedPhotos.length);
  };

  const prevPhoto = () => {
    if (selectedPhotos.length === 0) return;
    setCurrentPhotoIndex((prev) => (prev - 1 + selectedPhotos.length) % selectedPhotos.length);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Completed Meetings</h2>
          <p className="text-sm text-slate-600 mt-1">
            View and manage completed meeting records with photos and remarks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-semibold">
              Total: {(Array.isArray(meetingCheckIns) ? meetingCheckIns : []).filter(m => {
                const hasCheckOutTime = m.checkOutTime && m.checkOutTime.trim() !== '';
                return m.meetingStatus === 'completed' || hasCheckOutTime;
              }).length}
            </span>
            {filteredMeetings.length !== (Array.isArray(meetingCheckIns) ? meetingCheckIns : []).filter(m => {
              const hasCheckOutTime = m.checkOutTime && m.checkOutTime.trim() !== '';
              return m.meetingStatus === 'completed' || hasCheckOutTime;
            }).length && (
                <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full font-semibold">
                  Filtered: {filteredMeetings.length}
                </span>
              )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
            </svg>
            Filters
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date From</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date To</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* User */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">User</label>
              <select
                value={filters.user}
                onChange={(e) => setFilters(prev => ({ ...prev, user: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Users</option>
                {uniqueUsers.map(user => (
                  <option key={user} value={user}>
                    {getUserDisplayName(user)}
                  </option>
                ))}
              </select>
            </div>

            {/* Lead */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Lead</label>
              <select
                value={filters.leadId}
                onChange={(e) => setFilters(prev => ({ ...prev, leadId: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Leads</option>
                {uniqueLeads.map(lead => (
                  <option key={lead.id} value={lead.id}>
                    {lead.agencyName}
                  </option>
                ))}
              </select>
            </div>

            {/* Meeting Outcome */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Outcome</label>
              <select
                value={filters.meetingOutcome}
                onChange={(e) => setFilters(prev => ({ ...prev, meetingOutcome: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Outcomes</option>
                {uniqueOutcomes.map(outcome => (
                  <option key={outcome} value={outcome}>
                    {outcome.charAt(0).toUpperCase() + outcome.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search in notes, lead name, sales person..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Filter Actions */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Meetings List */}
      <div className="space-y-4">
        {filteredMeetings.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-12 text-center">
            <div className="mx-auto w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <svg className="h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">No completed meetings found</h3>
            <p className="text-slate-500">Try adjusting your filters or check back later for new meetings.</p>
          </div>
        ) : (
          filteredMeetings.map((meeting) => (
            <div key={`${meeting.username}-${meeting.date}-${meeting.checkInTime}`} className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {meeting.leadName || 'Unknown Lead'}
                    </h3>
                    {meeting.meetingOutcome && (
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getOutcomeColor(meeting.meetingOutcome)}`}>
                        {meeting.meetingOutcome.charAt(0).toUpperCase() + meeting.meetingOutcome.slice(1).replace('_', ' ')}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-600">
                    <div>
                      <span className="font-medium">Date:</span> {formatDate(meeting.date)}
                    </div>
                    <div>
                      <span className="font-medium">Time:</span> {formatTime(meeting.checkInTime)} - {meeting.checkOutTime ? formatTime(meeting.checkOutTime) : 'Ongoing'}
                    </div>
                    <div>
                      <span className="font-medium">User:</span> {getUserDisplayName(meeting.username)}
                    </div>
                    <div>
                      <span className="font-medium">Duration:</span> {meeting.meetingDuration ? `${meeting.meetingDuration} minutes` : 'N/A'}
                    </div>
                    {/* Location Links with Safety Checks */}
                    {meeting.location && (
                      <>
                        <div>
                          <span className="font-medium">Start Location:</span>{' '}
                          {meeting.location.address ? (
                            <a
                              href={`https://www.google.com/maps?q=${meeting.location.latitude},${meeting.location.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
                            >
                              {meeting.location.address}
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          ) : (
                            <span className="text-slate-500">N/A</span>
                          )}
                        </div>
                        {/* End Location Check */}
                        {(meeting.completionPhotoMetadata &&
                          Array.isArray(meeting.completionPhotoMetadata) &&
                          meeting.completionPhotoMetadata.length > 0 &&
                          meeting.completionPhotoMetadata[0]?.location) ? (
                          <div>
                            <span className="font-medium">End Location:</span>{' '}
                            <a
                              href={`https://www.google.com/maps?q=${meeting.completionPhotoMetadata[0].location.latitude},${meeting.completionPhotoMetadata[0].location.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
                            >
                              {meeting.completionPhotoMetadata[0].location.address ||
                                `${meeting.completionPhotoMetadata[0].location.latitude.toFixed(6)}, ${meeting.completionPhotoMetadata[0].location.longitude.toFixed(6)}`
                              }
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        ) : meeting.checkOutTime ? (
                          <div>
                            <span className="font-medium">End Location:</span>{' '}
                            <span className="text-slate-500">Not available</span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Photos Button */}
                  {((meeting.checkInPhotos || []).length > 0 || (meeting.completionPhotos || []).length > 0) && (
                    <button
                      onClick={() => {
                        const allPhotos = [...(meeting.checkInPhotos || []), ...(meeting.completionPhotos || [])];
                        openPhotoModal(allPhotos);
                      }}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                    >
                      📸 Photos ({(meeting.checkInPhotos?.length || 0) + (meeting.completionPhotos?.length || 0)})
                    </button>
                  )}

                  {/* View Details Button */}
                  <button
                    onClick={() => setSelectedMeeting(meeting)}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100"
                  >
                    👁️ View Details
                  </button>
                </div>
              </div>

              {/* Meeting Notes */}
              {meeting.notes && (
                <div className="mt-4 p-3 bg-slate-50 rounded-md">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Meeting Notes:</h4>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap">{meeting.notes}</p>
                </div>
              )}

              {/* Photos Preview */}
              {((meeting.checkInPhotos || []).length > 0 || (meeting.completionPhotos || []).length > 0) && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Photos:</h4>
                  <div className="flex gap-2 flex-wrap">
                    {(meeting.checkInPhotos || []).map((photo, index) => (
                      <button
                        key={`checkin-${index}`}
                        onClick={() => openPhotoModal(meeting.checkInPhotos || [], index)}
                        className="w-16 h-16 rounded-md overflow-hidden border border-slate-200 hover:border-blue-300"
                      >
                        <img src={photo} alt={`Check-in photo ${index + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                    {(meeting.completionPhotos || []).map((photo, index) => (
                      <button
                        key={`completion-${index}`}
                        onClick={() => openPhotoModal(meeting.completionPhotos || [], index)}
                        className="w-16 h-16 rounded-md overflow-hidden border border-slate-200 hover:border-blue-300"
                      >
                        <img src={photo} alt={`Completion photo ${index + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Meeting Details Modal */}
      {selectedMeeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Meeting Details</h3>
                <button
                  onClick={() => setSelectedMeeting(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-slate-700">Lead:</span>
                    <p className="text-slate-900">{selectedMeeting.leadName || 'Unknown Lead'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">User:</span>
                    <p className="text-slate-900">{getUserDisplayName(selectedMeeting.username)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">Date:</span>
                    <p className="text-slate-900">{formatDate(selectedMeeting.date)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">Duration:</span>
                    <p className="text-slate-900">{selectedMeeting.meetingDuration ? `${selectedMeeting.meetingDuration} minutes` : 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">Outcome:</span>
                    <p className="text-slate-900">{selectedMeeting.meetingOutcome || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">Status:</span>
                    <p className="text-slate-900">{selectedMeeting.meetingStatus || 'N/A'}</p>
                  </div>
                </div>

                {selectedMeeting.notes && (
                  <div>
                    <span className="font-medium text-slate-700">Notes:</span>
                    <p className="text-slate-900 mt-1 whitespace-pre-wrap">{selectedMeeting.notes}</p>
                  </div>
                )}

                {((selectedMeeting.checkInPhotos || []).length > 0 || (selectedMeeting.completionPhotos || []).length > 0) && (
                  <div>
                    <span className="font-medium text-slate-700">Photos:</span>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {(selectedMeeting.checkInPhotos || []).map((photo, index) => (
                        <button
                          key={`checkin-${index}`}
                          onClick={() => {
                            const allPhotos = [...(selectedMeeting.checkInPhotos || []), ...(selectedMeeting.completionPhotos || [])];
                            openPhotoModal(allPhotos, index);
                          }}
                          className="aspect-square rounded-md overflow-hidden border border-slate-200 hover:border-blue-300"
                        >
                          <img src={photo} alt={`Check-in photo ${index + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                      {(selectedMeeting.completionPhotos || []).map((photo, index) => (
                        <button
                          key={`completion-${index}`}
                          onClick={() => {
                            const allPhotos = [...(selectedMeeting.checkInPhotos || []), ...(selectedMeeting.completionPhotos || [])];
                            openPhotoModal(allPhotos, (selectedMeeting.checkInPhotos?.length || 0) + index);
                          }}
                          className="aspect-square rounded-md overflow-hidden border border-slate-200 hover:border-blue-300"
                        >
                          <img src={photo} alt={`Completion photo ${index + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center p-4">
            <button
              onClick={closePhotoModal}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            >
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {selectedPhotos.length > 0 && (
              <>
                <img
                  src={selectedPhotos[currentPhotoIndex]}
                  alt={`Photo ${currentPhotoIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />

                {selectedPhotos.length > 1 && (
                  <>
                    <button
                      onClick={prevPhoto}
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300"
                    >
                      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    <button
                      onClick={nextPhoto}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300"
                    >
                      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm">
                      {currentPhotoIndex + 1} of {selectedPhotos.length}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompletedMeetings;