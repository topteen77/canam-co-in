import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../services/apiClient';
import { formatTimeIST, formatDateIST, formatDateTimeIST } from '../utils/dateTime';
import type { MeetingCheckInRecord } from '../types';

interface MeetingPhotosAdminProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MeetingPhotosAdmin: React.FC<MeetingPhotosAdminProps> = ({
  isOpen,
  onClose
}) => {
  const [meetingRecords, setMeetingRecords] = useState<MeetingCheckInRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingCheckInRecord | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    accountManager: '',
    meetingOutcome: '',
    hasPhotos: 'all' as 'all' | 'checkin' | 'completion' | 'both'
  });
  const [mobileOverviewOpen, setMobileOverviewOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    let cancelled = false;

    const fetchRecords = async () => {
      try {
        const res = await apiClient.get('/meetings/all');
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        const records = list.map((row: any) => ({
          id: row.id ?? row.firebase_id ?? '',
          ...row,
          checkInPhotos: Array.isArray(row.checkInPhotos) ? row.checkInPhotos : (row.check_in_photos ? (Array.isArray(row.check_in_photos) ? row.check_in_photos : []) : []),
          completionPhotos: Array.isArray(row.completionPhotos) ? row.completionPhotos : (row.completion_photos ? (Array.isArray(row.completion_photos) ? row.completion_photos : []) : [])
        })) as MeetingCheckInRecord[];
        setMeetingRecords(records);
      } catch (err) {
        console.error('Error fetching meeting records:', err);
        if (!cancelled) setMeetingRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRecords();
    return () => { cancelled = true; };
  }, [isOpen]);

  const filteredRecords = useMemo(() => {
    return meetingRecords.filter(record => {
      // 🟢 SAFE FIX: Null checks for all filterable fields
      if (!record) return false;

      // Date filter
      if (filters.dateFrom && record.date < filters.dateFrom) return false;
      if (filters.dateTo && record.date > filters.dateTo) return false;
      
      // Account Manager filter
      if (filters.accountManager && 
          !(record.salesPersonName || '').toLowerCase().includes(filters.accountManager.toLowerCase())) {
        return false;
      }
      
      // Meeting Outcome filter
      if (filters.meetingOutcome && record.meetingOutcome !== filters.meetingOutcome) {
        return false;
      }
      
      // Photo filter
      const hasCheckIn = Array.isArray(record.checkInPhotos) && record.checkInPhotos.length > 0;
      const hasCompletion = Array.isArray(record.completionPhotos) && record.completionPhotos.length > 0;

      if (filters.hasPhotos === 'checkin' && !hasCheckIn) return false;
      if (filters.hasPhotos === 'completion' && !hasCompletion) return false;
      if (filters.hasPhotos === 'both' && (!hasCheckIn && !hasCompletion)) return false;
      
      return true;
    });
  }, [meetingRecords, filters]);

  const uniqueAccountManagers = useMemo(() => {
    const managers = new Set<string>();
    meetingRecords.forEach(record => {
      if (record.salesPersonName) {
        managers.add(record.salesPersonName);
      }
    });
    return Array.from(managers).sort();
  }, [meetingRecords]);

  // Photos overview: stats and flat list of photo URLs for thumbnail grid (support string or { url } object)
  const photosOverview = useMemo(() => {
    const toUrl = (p: unknown): string | null => {
      if (typeof p === 'string' && p.trim()) return p.trim();
      if (p && typeof p === 'object' && 'url' in (p as object) && typeof (p as { url: unknown }).url === 'string') return (p as { url: string }).url;
      return null;
    };
    let totalCheckIn = 0;
    let totalCompletion = 0;
    const allUrls: { url: string; type: 'checkin' | 'completion'; meetingId: string }[] = [];
    filteredRecords.forEach(record => {
      const checkIn = Array.isArray(record.checkInPhotos) ? record.checkInPhotos : [];
      const completion = Array.isArray(record.completionPhotos) ? record.completionPhotos : [];
      const rid = record?.id ?? record?.firebase_id ?? '';
      checkIn.forEach(p => {
        const u = toUrl(p);
        if (u) { totalCheckIn++; allUrls.push({ url: u, type: 'checkin', meetingId: rid }); }
      });
      completion.forEach(p => {
        const u = toUrl(p);
        if (u) { totalCompletion++; allUrls.push({ url: u, type: 'completion', meetingId: rid }); }
      });
    });
    const meetingsWithPhotos = filteredRecords.filter(r => {
      const c = Array.isArray(r.checkInPhotos) && r.checkInPhotos.length > 0;
      const d = Array.isArray(r.completionPhotos) && r.completionPhotos.length > 0;
      return c || d;
    }).length;
    return { totalCheckIn, totalCompletion, meetingsWithPhotos, allUrls };
  }, [filteredRecords]);

  const resetFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      accountManager: '',
      meetingOutcome: '',
      hasPhotos: 'all'
    });
  };

  // Normalize photo item to URL string; only return if it looks like an image URL (avoid opening location/metadata in new tab → blank page)
  const photoToUrl = (p: unknown): string | null => {
    let raw: string | null = null;
    if (typeof p === 'string' && p.trim()) raw = p.trim();
    else if (p && typeof p === 'object' && 'url' in (p as object) && typeof (p as { url: unknown }).url === 'string') raw = (p as { url: string }).url;
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('data:image/') || lower.startsWith('blob:')) return raw;
    return null;
  };

  const openPhotoPreview = (url: string) => {
    setPreviewPhotoUrl(url);
  };

  const getDetailedAddress = async (lat: number, lng: number): Promise<string> => {
    try {
      // Try multiple geocoding services for detailed address
      const services = [
        () => getAddressFromNominatim(lat, lng),
        () => getAddressFromBigDataCloud(lat, lng),
        () => getAddressFromPhoton(lat, lng)
      ];

      const results = [];
      
      for (const service of services) {
        try {
          const address = await service();
          if (address && address.length > 10) {
            results.push(address);
          }
        } catch (error) {
          console.log('Geocoding service failed:', error);
        }
      }

      if (results.length > 0) {
        // Return the most detailed address
        return results.reduce((best, current) => 
          current.length > best.length ? current : best
        );
      }

      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      console.error('Address lookup failed:', error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const getAddressFromNominatim = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&zoom=20&extratags=1&namedetails=1`
      );
      const data = await response.json();
      
      if (data.address) {
        const { 
          house_number, road, house, building, plot, sector, block,
          pedestrian, footway, path, residential, suburb, neighbourhood,
          city, town, village, state, country
        } = data.address;
        
        const parts = [];
        
        if (house_number && road) {
          parts.push(`${house_number} ${road}`);
        } else if (road) {
          parts.push(road);
        } else if (house) {
          parts.push(house);
        } else if (building) {
          parts.push(building);
        } else if (plot) {
          parts.push(`Plot ${plot}`);
        } else if (sector) {
          parts.push(`Sector ${sector}`);
        } else if (block) {
          parts.push(`Block ${block}`);
        }
        
        if (suburb && !parts.includes(suburb)) parts.push(suburb);
        if (neighbourhood && !parts.includes(neighbourhood)) parts.push(neighbourhood);
        if (city && !parts.includes(city)) parts.push(city);
        if (town && !parts.includes(town)) parts.push(town);
        if (village && !parts.includes(village)) parts.push(village);
        if (state && !parts.includes(state)) parts.push(state);
        if (country && !parts.includes(country)) parts.push(country);
        
        return parts.filter(Boolean).join(', ');
      }
      
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      console.log('Nominatim geocoding failed:', error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const getAddressFromBigDataCloud = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
      );
      const data = await response.json();
      
      if (data.localityInfo) {
        const { administrative, informative } = data.localityInfo;
        const parts = [];
        
        if (informative?.name) parts.push(informative.name);
        if (administrative?.[0]?.name) parts.push(administrative[0].name);
        if (administrative?.[1]?.name) parts.push(administrative[1].name);
        if (administrative?.[2]?.name) parts.push(administrative[2].name);
        if (administrative?.[3]?.name) parts.push(administrative[3].name);
        
        return parts.filter(Boolean).join(', ');
      }
      
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      console.log('BigDataCloud geocoding failed:', error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const getAddressFromPhoton = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1`
      );
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const feature = data.features[0];
        const properties = feature.properties;
        
        const parts = [];
        if (properties.housenumber) parts.push(properties.housenumber);
        if (properties.street) parts.push(properties.street);
        if (properties.city) parts.push(properties.city);
        if (properties.state) parts.push(properties.state);
        if (properties.country) parts.push(properties.country);
        
        if (parts.length > 0) {
          return parts.join(', ');
        }
        
        return properties.name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }
      
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      console.log('Photon geocoding failed:', error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const handleMeetingClick = async (record: MeetingCheckInRecord) => {
    setSelectedMeeting(record);
    
    // If location has coordinates but no detailed address, try to get it
    if (record.location && record.location.latitude && record.location.longitude) {
      if (!record.location.address || record.location.address.includes('Google Maps API not configured')) {
        try {
          const detailedAddress = await getDetailedAddress(record.location.latitude, record.location.longitude);
          // Update the record with detailed address (this would need to be saved to database in a real implementation)
          console.log('Detailed address found:', detailedAddress);
        } catch (error) {
          console.error('Failed to get detailed address:', error);
        }
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="modal-content bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-3 sm:p-6 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-lg sm:text-2xl font-bold text-slate-900 truncate pr-2">📸 Meeting Photos Gallery</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-2 flex-shrink-0"
            aria-label="Close"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mobile: compact overview line + collapsible filters so gallery gets space */}
        <div className="sm:hidden flex flex-col border-b border-slate-200 flex-shrink-0">
          {loading ? (
            <div className="px-3 py-2 flex items-center gap-2 text-slate-500 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent" />
              Loading…
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMobileOverviewOpen(!mobileOverviewOpen)}
                className="px-3 py-2 text-left text-sm font-medium text-slate-700 bg-slate-50 flex items-center justify-between"
              >
                <span>📷 {photosOverview.meetingsWithPhotos} mtgs • {photosOverview.totalCheckIn} check-in • {photosOverview.totalCompletion} completion • {photosOverview.allUrls.length} total</span>
                <span className="text-slate-400">{mobileOverviewOpen ? '▲' : '▼'}</span>
              </button>
              {mobileOverviewOpen && (
                <div className="px-3 pb-3 grid grid-cols-2 gap-2 bg-slate-50/80">
                  <div className="bg-white rounded border border-slate-200 p-2">
                    <div className="text-lg font-bold text-indigo-600">{photosOverview.meetingsWithPhotos}</div>
                    <div className="text-xs text-slate-600">Meetings w/ photos</div>
                  </div>
                  <div className="bg-white rounded border border-slate-200 p-2">
                    <div className="text-lg font-bold text-slate-800">{photosOverview.allUrls.length}</div>
                    <div className="text-xs text-slate-600">Total photos</div>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
                className="px-3 py-2 text-left text-sm font-medium text-slate-700 bg-slate-100 flex items-center justify-between border-t border-slate-200"
              >
                <span>Filters {filteredRecords.length}/{meetingRecords.length} meetings</span>
                <span className="text-slate-400">{mobileFiltersOpen ? '▲' : '▼'}</span>
              </button>
              {mobileFiltersOpen && (
                <div className="p-3 space-y-3 bg-slate-50 border-t border-slate-200">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-0.5">Date From</label>
                      <input type="date" value={filters.dateFrom} onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-0.5">Date To</label>
                      <input type="date" value={filters.dateTo} onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-0.5">Account Manager</label>
                    <select value={filters.accountManager} onChange={(e) => setFilters(prev => ({ ...prev, accountManager: e.target.value }))} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded">
                      <option value="">All Managers</option>
                      {uniqueAccountManagers.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-0.5">Has Photos</label>
                    <select value={filters.hasPhotos} onChange={(e) => setFilters(prev => ({ ...prev, hasPhotos: e.target.value as any }))} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded">
                      <option value="all">All Meetings</option>
                      <option value="checkin">Check-in</option>
                      <option value="completion">Completion</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                  <button type="button" onClick={resetFilters} className="w-full py-1.5 text-xs text-slate-600 bg-slate-200 rounded">Reset Filters</button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Desktop: Photos Overview */}
        <div className="hidden sm:block p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50 flex-shrink-0">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">📷 Photos Overview</h3>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent" />
              Loading…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-2xl font-bold text-indigo-600">{photosOverview.meetingsWithPhotos}</div>
                  <div className="text-sm text-slate-600">Meetings with photos</div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-2xl font-bold text-slate-800">{photosOverview.totalCheckIn}</div>
                  <div className="text-sm text-slate-600">Check-in photos</div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-2xl font-bold text-slate-800">{photosOverview.totalCompletion}</div>
                  <div className="text-sm text-slate-600">Completion photos</div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <div className="text-2xl font-bold text-slate-800">{photosOverview.allUrls.length}</div>
                  <div className="text-sm text-slate-600">Total photos</div>
                </div>
              </div>
              {!loading && meetingRecords.length > 0 && photosOverview.allUrls.length === 0 && (
                <p className="text-sm text-slate-500">No photos in current filter. Try &quot;Has Photos&quot; or adjust date range.</p>
              )}
            </>
          )}
        </div>

        {/* Desktop: Filters */}
        <div className="hidden sm:block p-6 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date To
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Account Manager
              </label>
              <select
                value={filters.accountManager}
                onChange={(e) => setFilters(prev => ({ ...prev, accountManager: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Managers</option>
                {uniqueAccountManagers.map(manager => (
                  <option key={manager} value={manager}>{manager}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Meeting Outcome
              </label>
              <select
                value={filters.meetingOutcome}
                onChange={(e) => setFilters(prev => ({ ...prev, meetingOutcome: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Outcomes</option>
                <option value="successful">Successful</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Has Photos
              </label>
              <select
                value={filters.hasPhotos}
                onChange={(e) => setFilters(prev => ({ ...prev, hasPhotos: e.target.value as any }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Meetings</option>
                <option value="checkin">Check-in Photos</option>
                <option value="completion">Completion Photos</option>
                <option value="both">Both Types</option>
              </select>
            </div>
          </div>
          
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-slate-600">
              Showing {filteredRecords.length} of {meetingRecords.length} meetings
            </div>
            <button
              onClick={resetFilters}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Content - flex-1 and min-h so gallery always has space on mobile */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 min-h-[40vh] sm:min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="ml-3 text-slate-600">Loading meeting photos...</span>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📷</div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No meeting photos found</h3>
              <p className="text-slate-600">Try adjusting your filters or check back later.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredRecords.map((record, index) => (
                <div 
                  key={record?.id ?? `meeting-${index}`} 
                  className="bg-white border border-slate-200 rounded-lg p-6 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all duration-200"
                  onClick={() => handleMeetingClick(record)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-900 hover:text-indigo-600 transition-colors">
                        {record.meetingType} - {record.salesPersonName}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {record.leadName} • {formatDateTimeIST(record.checkInTime)}
                      </p>
                      {record.meetingOutcome && (
                        <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                          record.meetingOutcome === 'successful' ? 'bg-green-100 text-green-800' :
                          record.meetingOutcome === 'rescheduled' ? 'bg-yellow-100 text-yellow-800' :
                          record.meetingOutcome === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {record.meetingOutcome.replace('_', ' ').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="text-right text-sm text-slate-500 ml-4">
                      <div className="mb-1">Duration: {record.meetingDuration ? `${record.meetingDuration} min` : 'N/A'}</div>
                      <div className="text-xs text-slate-400">
                        📍 Click to view details
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Location Display */}
                  <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 mt-0.5">📍</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-700 mb-1">Location:</div>
                        <div className="text-sm text-slate-600">
                          {record.location?.address && !record.location.address.includes('Google Maps API not configured') 
                            ? record.location.address 
                            : record.location && typeof record.location.latitude === 'number' && typeof record.location.longitude === 'number'
                              ? `Coordinates: ${record.location.latitude.toFixed(6)}, ${record.location.longitude.toFixed(6)}`
                              : 'Location not available'
                          }
                        </div>
                        {record.location && record.location.address && record.location.address.includes('Google Maps API not configured') && (
                          <div className="text-xs text-amber-600 mt-1">
                            🔄 Click to get detailed street address
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Check-in Photos */}
                  {record.checkInPhotos && record.checkInPhotos.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-slate-700 mb-2">
                        📸 Check-in Photos ({record.checkInPhotos.length})
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {record.checkInPhotos.map((photo, index) => {
                          const url = photoToUrl(photo);
                          if (!url) return null;
                          return (
                          <div key={index} className="relative group">
                            <img
                              src={url}
                              alt={`Check-in photo ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); openPhotoPreview(url); }}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center pointer-events-none">
                              <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Completion Photos */}
                  {record.completionPhotos && record.completionPhotos.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-slate-700 mb-2">
                        📸 Completion Photos ({record.completionPhotos.length})
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        {record.completionPhotos.map((photo, index) => {
                          const url = photoToUrl(photo);
                          if (!url) return null;
                          return (
                          <div key={index} className="relative group">
                            <img
                              src={url}
                              alt={`Completion photo ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); openPhotoPreview(url); }}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center pointer-events-none">
                              <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* No Photos Message */}
                  {(!record.checkInPhotos || record.checkInPhotos.length === 0) && 
                   (!record.completionPhotos || record.completionPhotos.length === 0) && (
                    <div className="text-center py-4 text-slate-500">
                      <div className="text-2xl mb-2">📷</div>
                      <p>No photos uploaded for this meeting</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detailed Meeting Modal — z-[100] so it sits above the gallery overlay (z-50) */}
      {selectedMeeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">
                📋 Meeting Details - {selectedMeeting.meetingType ?? 'Meeting'}
              </h3>
              <button
                onClick={() => setSelectedMeeting(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {/* Meeting Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Sales Person</label>
                    <p className="text-slate-900">{selectedMeeting.salesPersonName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Lead Name</label>
                    <p className="text-slate-900">{selectedMeeting.leadName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Meeting Type</label>
                    <p className="text-slate-900">{selectedMeeting.meetingType}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700">Status</label>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                      selectedMeeting.meetingStatus === 'active' ? 'bg-orange-100 text-orange-800' :
                      selectedMeeting.meetingStatus === 'completed' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {typeof selectedMeeting.meetingStatus === 'string' ? selectedMeeting.meetingStatus.toUpperCase() : (selectedMeeting.meetingStatus ?? 'N/A')}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Check-in Time</label>
                    <p className="text-slate-900">
                      {formatDateTimeIST(selectedMeeting.checkInTime ?? selectedMeeting.check_in_time)}
                    </p>
                  </div>
                  {(selectedMeeting.checkOutTime ?? selectedMeeting.check_out_time) != null && (
                    <div>
                      <label className="text-sm font-medium text-slate-700">Check-out Time</label>
                      <p className="text-slate-900">
                        {formatDateTimeIST(selectedMeeting.checkOutTime ?? selectedMeeting.check_out_time)}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-slate-700">Duration</label>
                    <p className="text-slate-900">
                      {selectedMeeting.meetingDuration ? `${selectedMeeting.meetingDuration} minutes` : 'N/A'}
                    </p>
                  </div>
                  {selectedMeeting.meetingOutcome != null && selectedMeeting.meetingOutcome !== '' && (
                    <div>
                      <label className="text-sm font-medium text-slate-700">Outcome</label>
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                        selectedMeeting.meetingOutcome === 'successful' ? 'bg-green-100 text-green-800' :
                        selectedMeeting.meetingOutcome === 'rescheduled' ? 'bg-yellow-100 text-yellow-800' :
                        selectedMeeting.meetingOutcome === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {typeof selectedMeeting.meetingOutcome === 'string' ? selectedMeeting.meetingOutcome.replace('_', ' ').toUpperCase() : String(selectedMeeting.meetingOutcome)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Enhanced Location Details */}
              <div className="mb-6">
                <label className="text-sm font-medium text-slate-700 mb-2 block">📍 Location Details</label>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-600">
                    {selectedMeeting.location?.address && typeof selectedMeeting.location.address === 'string' && !selectedMeeting.location.address.includes('Google Maps API not configured') 
                      ? selectedMeeting.location.address 
                      : selectedMeeting.location && (typeof (selectedMeeting.location as any).latitude === 'number' || typeof (selectedMeeting.location as any).latitude === 'string') && (typeof (selectedMeeting.location as any).longitude === 'number' || typeof (selectedMeeting.location as any).longitude === 'string')
                        ? `Coordinates: ${Number((selectedMeeting.location as any).latitude).toFixed(6)}, ${Number((selectedMeeting.location as any).longitude).toFixed(6)}`
                        : 'Location not available'
                    }
                  </div>
                  {selectedMeeting.location && selectedMeeting.location.address && selectedMeeting.location.address.includes('Google Maps API not configured') && (
                    <div className="text-xs text-amber-600 mt-2">
                      🔄 Detailed street address will be resolved when clicked
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {(selectedMeeting.notes || selectedMeeting.completionNotes) && (
                <div className="mb-6">
                  <label className="text-sm font-medium text-slate-700 mb-2 block">📝 Notes</label>
                  <div className="space-y-3">
                    {selectedMeeting.notes && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="text-xs font-medium text-blue-700 mb-1">Check-in Notes:</div>
                        <div className="text-sm text-blue-800">{selectedMeeting.notes}</div>
                      </div>
                    )}
                    {selectedMeeting.completionNotes && (
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="text-xs font-medium text-green-700 mb-1">Completion Notes:</div>
                        <div className="text-sm text-green-800">{selectedMeeting.completionNotes}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Photos — use safe arrays so .map never throws */}
              <div className="space-y-4">
                {(() => {
                  const checkInPhotos = Array.isArray(selectedMeeting.checkInPhotos) ? selectedMeeting.checkInPhotos : [];
                  const completionPhotos = Array.isArray(selectedMeeting.completionPhotos) ? selectedMeeting.completionPhotos : [];
                  return (
                    <>
                      {checkInPhotos.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-700 mb-3">
                            📸 Check-in Photos ({checkInPhotos.length})
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {checkInPhotos.map((photo, index) => {
                              const url = photoToUrl(photo);
                              if (!url) return null;
                              return (
                                <div key={index} className="relative group">
                                  <img
                                    src={url}
                                    alt={`Check-in photo ${index + 1}`}
                                    className="w-full h-32 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => openPhotoPreview(url)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {completionPhotos.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-slate-700 mb-3">
                            📸 Completion Photos ({completionPhotos.length})
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {completionPhotos.map((photo, index) => {
                              const url = photoToUrl(photo);
                              if (!url) return null;
                              return (
                                <div key={index} className="relative group">
                                  <img
                                    src={url}
                                    alt={`Completion photo ${index + 1}`}
                                    className="w-full h-32 object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => openPhotoPreview(url)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-end p-6 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setSelectedMeeting(null)}
                className="px-6 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo preview modal — in-app overlay so data URLs and blob URLs display correctly (no blank new tab) */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-[110] p-4"
          onClick={() => setPreviewPhotoUrl(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setPreviewPhotoUrl(null)}
          aria-label="Close photo preview"
        >
          <button
            type="button"
            onClick={() => setPreviewPhotoUrl(null)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={previewPhotoUrl}
            alt="Photo preview"
            className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};