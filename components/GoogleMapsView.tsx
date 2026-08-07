import React, { useEffect, useRef, useState } from 'react';
import apiClient from '../services/apiClient';

// Google Maps types
declare global {
  interface Window {
    google: any;
  }
}

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  address: string;
  salesPerson: string;
  timestamp: string;
}

interface AttendanceRecord {
  id: string;
  username: string;
  displayName: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  latitude: number;
  longitude: number;
  status: string;
  statusColor: string;
}

const GoogleMapsView: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [mapData, setMapData] = useState<MapMarker[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'map' | 'meetings' | 'attendance'>('map');

  // Initialize Google Maps
  useEffect(() => {
    const initMap = () => {
      // 🟢 SAFE FIX: Robust check for map container and API
      if (!mapRef.current) return;
      
      if (!window.google || !window.google.maps) {
        console.warn('⚠️ Google Maps API not loaded yet');
        return;
      }

      console.log('🗺️ Initializing Google Maps...');
      
      try {
        const googleMap = new window.google.maps.Map(mapRef.current, {
          center: { lat: 28.6139, lng: 77.2090 }, // Delhi, India
          zoom: 6,
          mapTypeId: window.google.maps.MapTypeId.ROADMAP,
          styles: [
            {
              featureType: 'poi',
              elementType: 'labels',
              stylers: [{ visibility: 'off' }]
            }
          ]
        });

        setMap(googleMap);
        console.log('✅ Google Maps initialized successfully');
      } catch (mapError) {
        console.error('❌ Error initializing map:', mapError);
        setError('Failed to initialize Google Maps. Please check your internet connection.');
      }
    };

    // Check if Google Maps is already loaded
    if (window.google?.maps) {
      initMap();
    } else {
      // Wait for Google Maps to load
      const checkGoogleMaps = setInterval(() => {
        if (window.google?.maps) {
          console.log('✅ Google Maps loaded, initializing...');
          clearInterval(checkGoogleMaps);
          initMap();
        }
      }, 500); // Check every 500ms

      // Timeout after 10 seconds
      const timeoutId = setTimeout(() => {
        clearInterval(checkGoogleMaps);
        if (!window.google?.maps) {
          setError('Google Maps failed to load. Please refresh the page.');
          setLoading(false);
        }
      }, 10000);
      
      return () => {
          clearInterval(checkGoogleMaps);
          clearTimeout(timeoutId);
      };
    }
  }, []);

  // Load meeting check-ins data
  useEffect(() => {
    const loadMeetingData = async () => {
      try {
        console.log('📊 Loading meeting check-ins...');
        const { data: checkInsRows } = await apiClient.get('/meetings/all');
        const meetingData: MapMarker[] = [];
        (Array.isArray(checkInsRows) ? checkInsRows : []).forEach((row: any) => {
          const lat = row.latitude ?? row.lat;
          const lng = row.longitude ?? row.lng;
          if (typeof lat === 'number' && typeof lng === 'number') {
            meetingData.push({
              id: row.id ?? row.firebase_id ?? '',
              lat,
              lng,
              title: row.salesPerson ?? row.sales_person || 'Unknown',
              address: row.address || 'Unknown Location',
              salesPerson: row.salesPerson ?? row.sales_person || 'Unknown',
              timestamp: row.timestamp ?? row.created_at ?? new Date().toISOString()
            });
          }
        });

        setMapData(meetingData);
        console.log(`✅ Loaded ${meetingData.length} meeting locations`);
      } catch (error) {
        console.error('❌ Error loading meeting data:', error);
        setError('Failed to load meeting data');
      }
    };

    loadMeetingData();
  }, []);

  // Load attendance data
  useEffect(() => {
    const loadAttendanceData = async () => {
      try {
        console.log('📊 Loading attendance data...');
        const { data: attRows } = await apiClient.get('/attendance/all');
        const attendanceRecords: AttendanceRecord[] = [];
        (Array.isArray(attRows) ? attRows : []).forEach((row: any) => {
          const lat = row.latitude ?? row.lat;
          const lng = row.longitude ?? row.lng;
          if (typeof lat === 'number' && typeof lng === 'number') {
            attendanceRecords.push({
              id: row.id ?? row.firebase_id ?? '',
              username: row.username ?? row.user_name || 'Unknown',
              displayName: row.displayName ?? row.display_name ?? row.username ?? 'Unknown',
              date: row.date || '',
              startTime: row.startTime ?? row.start_time ?? row.checkInTime ?? '',
              endTime: row.endTime ?? row.end_time ?? row.checkOutTime ?? '',
              location: row.location ?? row.start_location ?? 'Unknown Location',
              latitude: lat,
              longitude: lng,
              status: row.status || 'Unknown',
              statusColor: row.status === 'Present' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            });
          }
        });

        setAttendanceData(attendanceRecords);
        console.log(`✅ Loaded ${attendanceRecords.length} attendance records`);
      } catch (error) {
        console.error('❌ Error loading attendance data:', error);
        setError('Failed to load attendance data');
      }
    };

    loadAttendanceData();
  }, []);

  // Add markers to map when map and data are ready
  useEffect(() => {
    if (!map || mapData.length === 0 || !window.google?.maps) return;

    console.log('📍 Adding markers to map...');
    
    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    const newMarkers: any[] = [];

    // Add meeting markers
    mapData.forEach((markerData) => {
      try {
        const marker = new window.google.maps.Marker({
            position: { lat: markerData.lat, lng: markerData.lng },
            map: map,
            title: markerData.title,
            icon: {
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
                <text x="12" y="16" text-anchor="middle" fill="white" font-size="10" font-weight="bold">${(markerData.salesPerson || '?').charAt(0).toUpperCase()}</text>
                </svg>
            `)}`,
            scaledSize: new window.google.maps.Size(24, 24),
            anchor: new window.google.maps.Point(12, 12)
            }
        });

        // Add info window
        const infoWindow = new window.google.maps.InfoWindow({
            content: `
            <div class="p-2">
                <h3 class="font-bold text-sm">${markerData.salesPerson}</h3>
                <p class="text-xs text-gray-600">${markerData.address}</p>
                <p class="text-xs text-gray-500">${new Date(markerData.timestamp).toLocaleString()}</p>
            </div>
            `
        });

        marker.addListener('click', () => {
            infoWindow.open(map, marker);
        });

        newMarkers.push(marker);
      } catch (markerError) {
          console.error('Error adding marker:', markerError);
      }
    });

    setMarkers(newMarkers);
    setLoading(false);
    console.log(`✅ Added ${newMarkers.length} markers to map`);
  }, [map, mapData]);

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Map Error</h3>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Maps & Reports</h2>
          <p className="text-slate-600 mt-1">View meeting locations, reports, and attendance data</p>
        </div>
        <div className="text-sm text-slate-500">
          {mapData.length} user locations
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('map')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'map'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Map View
          </button>
          <button
            onClick={() => setActiveTab('meetings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'meetings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Meeting Reports ({mapData.length})
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'attendance'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Daily Attendance ({attendanceData.length})
          </button>
        </nav>
      </div>

      {/* Map View */}
      {activeTab === 'map' && (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-xl font-bold text-slate-800">Google Maps View</h3>
            <p className="text-slate-600 mt-1">Interactive map showing user meeting locations</p>
          </div>
          
          <div className="relative">
            <div
              ref={mapRef}
              className="w-full h-96 rounded-lg"
              style={{ minHeight: '400px' }}
            >
              {loading && (
                <div className="flex items-center justify-center h-full bg-slate-100">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm font-medium text-slate-600">Loading Google Maps...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Map Legend */}
            <div className="absolute bottom-4 left-4 bg-white p-3 rounded-lg shadow-lg">
              <div className="text-sm font-medium text-blue-800 mb-2">Legend</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-slate-600">Meeting Locations</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Meeting Reports */}
      {activeTab === 'meetings' && (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-xl font-bold text-slate-800">Meeting Check-in Reports</h3>
            <p className="text-slate-600 mt-1">Detailed view of all meeting check-ins with location data</p>
          </div>
          <div className="overflow-x-auto">
            {mapData.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Sales Person</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date & Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Google Maps</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {mapData.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {record.salesPerson}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 max-w-xs">
                        <div className="truncate" title={record.address}>
                          {record.address}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {new Date(record.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        <a
                          href={`https://www.google.com/maps?q=$${record.lat},${record.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                          </svg>
                          View on Maps
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center text-slate-500 py-12">
                <svg className="h-16 w-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="text-lg font-medium">No meeting data found</p>
                <p className="text-sm">Meeting check-ins will appear here when users check in for meetings</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attendance Reports */}
      {activeTab === 'attendance' && (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-xl font-bold text-slate-800">Daily Attendance with Location</h3>
            <p className="text-slate-600 mt-1">Attendance records with location tracking</p>
          </div>
          <div className="overflow-x-auto">
            {attendanceData.length > 0 ? (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Username</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Start Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">End Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Google Maps</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {attendanceData.map((record) => (
                    <tr key={record.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">
                        <div>
                          <div className="font-medium">{record.displayName}</div>
                          <div className="text-xs text-slate-500">{record.username}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                        {record.date}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 font-medium">
                        {record.startTime}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 font-medium">
                        {record.endTime}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 max-w-xs">
                        <div className="truncate" title={`${record.location} - ${record.latitude}, ${record.longitude}`}>
                          <div className="font-medium text-slate-900 flex items-center gap-1">
                            <svg className="h-3 w-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                            {record.location}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 font-mono">
                            {record.latitude.toFixed(6)}, {record.longitude.toFixed(6)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${record.statusColor}`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                        <a
                          href={`https://www.google.com/maps?q=$${record.latitude},${record.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                          </svg>
                          View on Maps
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center text-slate-500 p-12">
                <svg className="h-16 w-16 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium">No attendance records found</p>
                <p className="text-sm">No attendance data available for the current filters</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GoogleMapsView;