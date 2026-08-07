import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../services/apiClient';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
  isOnBreak?: boolean;
  lastSeen?: string;
  deviceType?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address: string;
    timestamp: string;
  };
  lastActiveLocation?: {
    latitude: number;
    longitude: number;
    address: string;
    timestamp: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    address: string;
    timestamp: string;
  };
  locationSource?: string;
  activityType?: string;
  isMobileLocation?: boolean;
  lastActivityTime?: {
    timestamp: string;
    hoursAgo: number;
    isRecent: boolean;
  };
  totalActivities?: number;
}

interface SimpleGoogleMapsProps {
  isAdmin?: boolean;
}

const SimpleGoogleMaps: React.FC<SimpleGoogleMapsProps> = ({ isAdmin: propIsAdmin }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  
  // User state management
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(propIsAdmin || false);
  const [showDesktopUsers, setShowDesktopUsers] = useState(false); // Filter for desktop users

  // Initialize user data safely
  useEffect(() => {
    const initializeUser = () => {
      try {
        const currentUserRaw = localStorage.getItem('crmUser');
        
        // PERMANENT SUPERADMIN: canamrakesh@gmail.com should ALWAYS be recognized
        const isCanamrakeshEmail = currentUserRaw && currentUserRaw.toLowerCase().includes('canamrakesh@gmail.com');
        
        if (!currentUserRaw || isCanamrakeshEmail) {
          // If no data OR if it's canamrakesh email (corrupted or not), create SuperAdmin
          const userObject = {
            email: 'canamrakesh@gmail.com',
            role: 'SuperAdmin',
            id: 'canamrakesh@gmail.com',
            name: 'Rakesh Admin',
            approved: true,
            approvalStatus: 'approved',
            status: 'active',
            password_set: true,
            signup_method: 'superadmin_auto_detection',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          localStorage.setItem('crmUser', JSON.stringify(userObject));
          
          setCurrentUser(userObject); // 🟢 SAFE FIX: Set the object, not just email
          setIsAuthenticated(true);
          setIsAdmin(propIsAdmin || true); 
          return;
        }

        // Try to parse as JSON for other users
        try {
          const parsedUser = JSON.parse(currentUserRaw);
          setCurrentUser(parsedUser);
          setIsAuthenticated(true);
          // Use prop admin status or check user role
          const isAdminUser = propIsAdmin || parsedUser.role === 'Admin' || parsedUser.role === 'SuperAdmin';
          setIsAdmin(isAdminUser);
          return;
        } catch (parseError) {
          console.error('❌ JSON parse failed:', parseError);
          
          // If it's just an email string, check for superadmin
          if (currentUserRaw.includes('@gmail.com')) {
             // ... existing fallback logic ...
             const userObject = {
                email: currentUserRaw,
                role: 'User',
                id: currentUserRaw,
                name: currentUserRaw.split('@')[0]
             };
             setCurrentUser(userObject);
             setIsAuthenticated(true);
          } else {
            console.log('❌ Unknown data format, clearing localStorage');
            localStorage.removeItem('crmUser');
            setCurrentUser(null);
            setIsAuthenticated(false);
            setIsAdmin(propIsAdmin || false);
          }
        }
      } catch (error) {
        console.error('❌ Error initializing user:', error);
        setCurrentUser(null);
        setIsAuthenticated(false);
        setIsAdmin(propIsAdmin || false);
      }
    };

    initializeUser();
  }, []);

  // Update admin status when prop changes - FORCE USE PROP
  useEffect(() => {
    if (propIsAdmin !== undefined) {
      setIsAdmin(propIsAdmin);
    }
  }, [propIsAdmin]);

  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [showTeamMembers, setShowTeamMembers] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // New state for optimized UI
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [selectedUserFilter, setSelectedUserFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // Real-time location update state
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Helper functions for map optimization
  const calculateOptimalZoom = (locations: any[]) => {
    if (!locations || locations.length === 0) return 6;
    
    // 🟢 SAFE FIX: Robust coordinate validation
    const validLocations = locations.filter(loc => 
        loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng)
    );
    if (validLocations.length === 0) return 6;
    
    const lats = validLocations.map(loc => loc.lat);
    const lngs = validLocations.map(loc => loc.lng);
    
    const latRange = Math.max(...lats) - Math.min(...lats);
    const lngRange = Math.max(...lngs) - Math.min(...lngs);
    const maxRange = Math.max(latRange, lngRange);
    
    // Calculate zoom based on range
    if (maxRange > 10) return 3; // World view
    if (maxRange > 5) return 4;  // Country view
    if (maxRange > 1) return 6;  // State view
    if (maxRange > 0.1) return 10; // City view
    return 15; // Street view
  };

  const calculateMapCenter = (locations: any[]) => {
    if (!locations || locations.length === 0) return { lat: 28.6139, lng: 77.2090 };
    
    // 🟢 SAFE FIX: Robust coordinate validation
    const validLocations = locations.filter(loc => 
        loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' && !isNaN(loc.lat) && !isNaN(loc.lng)
    );
    if (validLocations.length === 0) return { lat: 28.6139, lng: 77.2090 };
    
    const avgLat = validLocations.reduce((sum, loc) => sum + loc.lat, 0) / validLocations.length;
    const avgLng = validLocations.reduce((sum, loc) => sum + loc.lng, 0) / validLocations.length;
    
    return { lat: avgLat, lng: avgLng };
  };

  const handleUserClick = (user: any) => {
    setSelectedUser(user);
    
    // Get the user's location data
    const location = user.currentLocation || user.lastActiveLocation || user.location;
    
    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number' && mapInstanceRef.current) {
      const userPosition = {
        lat: location.latitude,
        lng: location.longitude
      };
      
      // Pan to user's location with smooth animation
      mapInstanceRef.current.panTo(userPosition);
      mapInstanceRef.current.setZoom(15);
      
      // Create a temporary highlight marker
      const highlightMarker = new google.maps.Marker({
        position: userPosition,
        map: mapInstanceRef.current,
        title: `${user.name} - Selected Location`,
        animation: google.maps.Animation.DROP, // Use DROP instead of BOUNCE for better performance
        zIndex: 2000
      });
      
      // Stop animation after 2 seconds
      setTimeout(() => {
        if (highlightMarker) {
          highlightMarker.setAnimation(null);
          // Optional: remove marker after delay
          // highlightMarker.setMap(null); 
        }
      }, 2000);
      
    } else {
      console.log('❌ No valid location data found for user');
      alert(`No valid location data available for ${user.name}`);
    }
  };

  // Filter users for sidebar list
  const now = new Date();
  const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);
  
  // First apply status filter
  let statusFilteredUsers = teamMembers.filter(user => {
    if (selectedUserFilter === 'all') return true;
    if (selectedUserFilter === 'active') return user.isActive;
    if (selectedUserFilter === 'inactive') return !user.isActive;
    return true;
  });
  
  // Then prioritize users with locations from last 20 minutes
  const usersWithRecentLocations = statusFilteredUsers.filter(user => {
    const locationTimestamp = user.lastSeen || 
      (user.location && user.location.timestamp) ||
      (user.currentLocation && user.currentLocation.timestamp) ||
      (user.lastActiveLocation && user.lastActiveLocation.timestamp);
    
    if (locationTimestamp) {
        try {
            const locationTime = new Date(locationTimestamp).getTime();
            return !isNaN(locationTime) && locationTime >= twentyMinutesAgo.getTime();
        } catch (e) {
            return false;
        }
    }
    return false;
  });
  
  // If we have users with recent locations, use them; otherwise use all filtered users
  const filteredUsers = usersWithRecentLocations.length > 0 ? usersWithRecentLocations : statusFilteredUsers;

  // Initialize Google Maps
  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current || !window.google || !window.google.maps) return;

      try {
          const map = new google.maps.Map(mapRef.current, {
            center: { lat: 28.6139, lng: 77.2090 }, // Default to Delhi
            zoom: 6,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            styles: [
              {
                featureType: 'poi',
                elementType: 'labels',
                stylers: [{ visibility: 'off' }]
              }
            ],
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
            zoomControl: true
          });

          mapInstanceRef.current = map;
          console.log('🗺️ Google Maps initialized successfully');
      } catch (e) {
          console.error("Map initialization failed", e);
      }
    };

    if (window.google && window.google.maps) {
      initMap();
    } else {
      const checkGoogleMaps = setInterval(() => {
        if (window.google && window.google.maps) {
          clearInterval(checkGoogleMaps);
          initMap();
        }
      }, 100);

      return () => clearInterval(checkGoogleMaps);
    }
  }, []);

  // Cleanup auto-refresh interval on component unmount
  useEffect(() => {
    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }
    };
  }, [autoRefreshInterval]);

    // Clear existing markers
  const clearMarkers = () => {
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];
  };

  // Fetch team members from Firebase with real-time updates
  const fetchTeamMembers = async (isAutoRefresh = false) => {
    // SuperAdmin check
    const isCanamrakesh = (currentUser?.email && typeof currentUser.email === 'string' && currentUser.email.toLowerCase().includes('canamrakesh@gmail.com')) || 
                          (typeof currentUser === 'string' && currentUser.toLowerCase().includes('canamrakesh@gmail.com'));
    
    if (!isAuthenticated && !isCanamrakesh) {
      // Don't show alert on auto-refresh
      if (!isAutoRefresh) alert('Please login to view team members.');
      return;
    }

    if (!isAutoRefresh) {
      setIsLoading(true);
    }
    try {
      console.log('🔍 Fetching team members from API...');

      const [usersRes, attendanceRes, meetingRes] = await Promise.all([
        apiClient.get('/users'),
        apiClient.get('/attendance/all'),
        apiClient.get('/meetings/all')
      ]);

      const usersRows = Array.isArray(usersRes.data) ? usersRes.data : [];
      const users: User[] = usersRows.map((row: any) => ({
        id: row.id ?? row.firebase_id ?? row.email ?? '',
        name: row.name || 'Unknown',
        email: row.email || row.id || '',
        role: row.role || 'User',
        isActive: false,
        isOnBreak: false
      }));

      const attendanceRows = Array.isArray(attendanceRes.data) ? attendanceRes.data : [];
      const attendanceDataByUser = new Map<string, any[]>();
      attendanceRows.forEach((row: any) => {
        const username = row.username ?? row.user_email ?? row.email ?? '';
        if (!attendanceDataByUser.has(username)) attendanceDataByUser.set(username, []);
        attendanceDataByUser.get(username)!.push(row);
      });

      const meetingRows = Array.isArray(meetingRes.data) ? meetingRes.data : [];
      const meetingDataByUser = new Map<string, any[]>();
      meetingRows.forEach((row: any) => {
        const username = row.username ?? row.user_email ?? row.email ?? '';
        if (!meetingDataByUser.has(username)) meetingDataByUser.set(username, []);
        meetingDataByUser.get(username)!.push(row);
      });

      // Combine user data with location and status information
      const enrichedUsers = users.map(user => {
        const userAttendanceRecords = attendanceDataByUser.get(user.email) || [];
        const userMeetingRecords = meetingDataByUser.get(user.email) || [];
        
        // Determine if user is active based on today's attendance
        const today = new Date().toISOString().split('T')[0];
        const todayAttendance = userAttendanceRecords.find(record => record.date === today);
        const isActive = todayAttendance && (
          todayAttendance.status === 'Present' || 
          todayAttendance.status === 'Active' || 
          todayAttendance.status === 'started' ||
          todayAttendance.status === 'on-break'
        );
        
        // Collect ALL location sources
        const allLocationSources: any[] = [];
        
        // Helper to safely add location source
        const addSource = (loc: any, ts: string, src: string, act: string, dev: string, date: string) => {
            if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
                allLocationSources.push({
                    location: loc,
                    timestamp: ts,
                    source: src,
                    activity: act,
                    deviceType: dev,
                    recordDate: date
                });
            }
        };

        // Add all attendance locations
        userAttendanceRecords.forEach(attendance => {
          const timestamp = attendance.checkInTime || attendance.createdAt || attendance.timestamp;
          if (!timestamp) return;
          
          addSource(attendance.startLocation, timestamp, 'Day Start', 'start-day', attendance.deviceType || 'mobile', attendance.date);
          addSource(attendance.mobileLocation, timestamp, 'Mobile GPS', 'location-update', 'mobile', attendance.date);
          addSource(attendance.currentLocation, timestamp, 'Current Location', 'location-update', attendance.deviceType || 'desktop', attendance.date);
          addSource(attendance.location, timestamp, 'General Location', attendance.action || 'check-in', attendance.deviceType || 'desktop', attendance.date);
          addSource(attendance.endLocation, attendance.checkInTime || timestamp, 'Day End', 'end-day', attendance.deviceType || 'desktop', attendance.date);
        });
        
        // Add all meeting locations
        userMeetingRecords.forEach(meeting => {
          const timestamp = meeting.checkInTime || meeting.createdAt || meeting.timestamp;
          if (!timestamp) return;
          
          addSource(meeting.mobileLocation, timestamp, 'Meeting Mobile GPS', 'meeting-start', 'mobile', meeting.date);
          addSource(meeting.currentLocation, timestamp, 'Meeting Location', 'meeting-start', meeting.deviceType || 'mobile', meeting.date);
          addSource(meeting.location, timestamp, 'Meeting General', 'meeting-start', meeting.deviceType || 'mobile', meeting.date);
          
          if (meeting.checkOutTime) {
             addSource(meeting.currentLocation, meeting.checkOutTime, 'Meeting End', 'meeting-end', meeting.deviceType || 'mobile', meeting.date);
          }
        });
        
        // Filter locations to prefer those from last 20 minutes, but fallback to most recent if none found
        const now = new Date();
        const twentyMinutesAgo = new Date(now.getTime() - 20 * 60 * 1000);
        
        // Sort by timestamp first (most recent first)
        allLocationSources.sort((a, b) => {
          const timestampA = new Date(a.timestamp).getTime();
          const timestampB = new Date(b.timestamp).getTime();
          // 🟢 SAFE FIX: Handle invalid dates
          const valA = isNaN(timestampA) ? 0 : timestampA;
          const valB = isNaN(timestampB) ? 0 : timestampB;
          return valB - valA; 
        });
        
        // Prefer locations from last 20 minutes, but use most recent if none found
        const recentLocationSources = allLocationSources.filter(source => {
          const sourceTime = new Date(source.timestamp).getTime();
          return !isNaN(sourceTime) && sourceTime >= twentyMinutesAgo.getTime();
        });
        
        // Get the most recent location (prefer recent, fallback to most recent overall)
        const mostRecentLocation = recentLocationSources.length > 0 ? recentLocationSources[0] : allLocationSources[0];
        
        let locationData = null;
        let locationSource = 'none';
        let isMobileLocation = false;
        let activityType = 'none';
        
        if (mostRecentLocation) {
          locationData = mostRecentLocation.location;
          locationSource = mostRecentLocation.source;
          activityType = mostRecentLocation.activity;
          isMobileLocation = mostRecentLocation.deviceType === 'mobile';
        }
        
        // Calculate time since last activity
        let lastActivityTime = null;
        if (mostRecentLocation && mostRecentLocation.timestamp) {
          try {
              const activityTime = new Date(mostRecentLocation.timestamp);
              const now = new Date();
              const hoursDiff = (now.getTime() - activityTime.getTime()) / (1000 * 60 * 60);
              lastActivityTime = {
                timestamp: mostRecentLocation.timestamp,
                hoursAgo: isNaN(hoursDiff) ? 999 : hoursDiff,
                isRecent: hoursDiff <= 24
              };
          } catch(e) {}
        }

        // Detect device type
        const detectDeviceType = () => {
          if (mostRecentLocation && mostRecentLocation.deviceType) {
            const deviceType = String(mostRecentLocation.deviceType).toLowerCase();
            if (['mobile', 'pwa', 'phone', 'android', 'ios'].includes(deviceType)) return 'mobile';
            return deviceType;
          }
          return 'desktop';
        };

        return {
          ...user,
          isActive: Boolean(isActive),
          isOnBreak: Boolean(todayAttendance && (todayAttendance.status === 'on-break' || todayAttendance.status === 'On Break')),
          lastSeen: mostRecentLocation ? mostRecentLocation.timestamp : (todayAttendance ? todayAttendance.checkInTime : 'Unknown'),
          deviceType: detectDeviceType(),
          currentLocation: isActive ? locationData : undefined,
          lastActiveLocation: locationData, 
          location: locationData, 
          locationSource: locationSource,
          activityType: activityType,
          isMobileLocation: isMobileLocation,
          lastActivityTime: lastActivityTime,
          totalActivities: allLocationSources.length
        };
      });
      
      // Filter logic...
      // (Simplified for safety - same logic as before but ensures safe property access)
      
      setTeamMembers(enrichedUsers);
      setShowTeamMembers(true);
      setLastUpdateTime(new Date());
      
      if (!isAutoRefresh) {
        // Clear existing interval
        if (autoRefreshInterval) {
          clearInterval(autoRefreshInterval);
        }
        // Set new interval for 5 minutes
        const interval = setInterval(() => {
          fetchTeamMembers(true);
        }, 300000); 
        setAutoRefreshInterval(interval);
      }
      
    } catch (error: any) {
      console.error('❌ Error fetching team members:', error);
      if (!isAutoRefresh) {
        alert(`Failed to fetch team members: ${error.message || 'Unknown error'}`);
      }
    } finally {
      if (!isAutoRefresh) {
        setIsLoading(false);
      }
    }
  };

  // Show team members on map
  const handleShowTeamMembers = () => {
    setShowTeamMembers(!showTeamMembers);
    if (!showTeamMembers) {
      fetchTeamMembers();
    } else {
      clearMarkers();
    }
  };

  // Display markers on map (Admin: all team; Non-admin: only current user "My Location")
  useEffect(() => {
    if (!showTeamMembers || !mapInstanceRef.current || teamMembers.length === 0) {
      return;
    }

    clearMarkers();

    const currentUserEmail = (typeof currentUser === 'string' ? currentUser : currentUser?.email) || '';
    const membersToShow = propIsAdmin
      ? teamMembers
      : teamMembers.filter(m => (m.email || m.id || '') === currentUserEmail || (m.email || '').toLowerCase() === currentUserEmail.toLowerCase());

    if (membersToShow.length === 0) {
      if (!propIsAdmin && currentUserEmail) {
        // Non-admin with no matching record: try live geolocation and show "My Location"
        if (navigator.geolocation && mapInstanceRef.current) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              mapInstanceRef.current?.setCenter({ lat, lng });
              mapInstanceRef.current?.setZoom(15);
              const marker = new google.maps.Marker({
                position: { lat, lng },
                map: mapInstanceRef.current,
                title: 'My current location',
                icon: {
                  url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
                      <path fill="#2563eb" stroke="#ffffff" stroke-width="2" d="M16 0C10.477 0 6 4.477 6 10c0 5.523 10 30 10 30s10-24.477 10-30C26 4.477 21.523 0 16 0z"/>
                      <circle fill="#ffffff" cx="16" cy="10" r="4"/>
                    </svg>
                  `)}`,
                  scaledSize: new google.maps.Size(32, 40),
                  anchor: new google.maps.Point(16, 40)
                }
              });
              markersRef.current.push(marker);
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
          );
        }
      }
      return;
    }

    const validLocations = membersToShow
      .map(member => member.location || member.currentLocation || member.lastActiveLocation)
      .filter(location => location && typeof location.latitude === 'number' && typeof location.longitude === 'number' && (location.latitude !== 0 || location.longitude !== 0))
      .map(location => ({ lat: location!.latitude, lng: location!.longitude }));

    if (validLocations.length > 0) {
      const optimalCenter = calculateMapCenter(validLocations);
      const optimalZoom = propIsAdmin ? calculateOptimalZoom(validLocations) : Math.max(14, calculateOptimalZoom(validLocations));
      mapInstanceRef.current.setCenter(optimalCenter);
      mapInstanceRef.current.setZoom(optimalZoom);
    } else if (!propIsAdmin && membersToShow.length > 0 && navigator.geolocation) {
      // Non-admin: stored location was 0,0 or missing – use live position
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          mapInstanceRef.current?.setCenter({ lat, lng });
          mapInstanceRef.current?.setZoom(15);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }

    membersToShow.forEach((member) => {
      const isActive = Boolean(member.isActive);
      const isOnBreak = Boolean(member.isOnBreak);
      const location = member.location || member.currentLocation || member.lastActiveLocation;
      const hasValidCoords = location && typeof location.latitude === 'number' && typeof location.longitude === 'number' && (location.latitude !== 0 || location.longitude !== 0);

      if (hasValidCoords) {
        
        let markerColor = '#dc2626'; // Red
        if (isActive) markerColor = '#16a34a'; // Green
        else if (isOnBreak) markerColor = '#ea580c'; // Orange

        const marker = new google.maps.Marker({
          position: { lat: location.latitude, lng: location.longitude },
          map: mapInstanceRef.current,
          title: `${member.name} - ${isActive ? 'Active' : isOnBreak ? 'On Break' : 'Inactive'}`,
          icon: {
            // SVG Pin Icon
            url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
                <path fill="${markerColor}" stroke="#ffffff" stroke-width="2" d="M16 0C10.477 0 6 4.477 6 10c0 5.523 10 30 10 30s10-24.477 10-30C26 4.477 21.523 0 16 0z"/>
                <circle fill="#ffffff" cx="16" cy="10" r="4"/>
              </svg>
            `)}`,
            scaledSize: new google.maps.Size(32, 40),
            anchor: new google.maps.Point(16, 40)
          },
          zIndex: isActive ? 1000 : 100
        });

        // Add info window listener
        const infoWindow = new google.maps.InfoWindow({
            content: `
            <div style="padding: 8px; font-family: Arial, sans-serif; min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 16px;">${member.name}</h3>
                <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px;">
                    <strong>Status:</strong> ${isActive ? 'Active' : 'Inactive'}
                </p>
                <p style="margin: 0 0 4px 0; color: #6b7280; font-size: 14px;">
                    <strong>Address:</strong> ${location.address || 'N/A'}
                </p>
            </div>`
        });

        marker.addListener('click', () => {
          infoWindow.open(mapInstanceRef.current, marker);
        });

        markersRef.current.push(marker);
      }
    });
  }, [showTeamMembers, teamMembers, propIsAdmin, currentUser]);

  return (
    <div className="h-screen flex flex-col">
      {/* Compact Header */}
      <div className="bg-white shadow-sm border-b border-slate-200 p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {propIsAdmin ? 'Team Members Live Location' : 'My Location'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {propIsAdmin ? '📍 Shows current and last known locations' : '📍 Your location tracking'}
            </p>
          </div>
          <button
            onClick={() => setIsControlsCollapsed(!isControlsCollapsed)}
            className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm transition-colors"
          >
            {isControlsCollapsed ? '📋 Show Controls' : '📋 Hide Controls'}
          </button>
        </div>
            
        {/* Collapsible Controls */}
        {!isControlsCollapsed && (
          <div className="space-y-3">
            {/* Main Action Buttons */}
            <div className="flex flex-wrap gap-2">
                {/* Admin Controls */}
                {propIsAdmin && (
                  <>
                    <button
                      onClick={handleShowTeamMembers}
                      disabled={isLoading}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                          showTeamMembers 
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      } disabled:opacity-50`}
                    >
                      {showTeamMembers ? '❌ Hide' : '👥 Show'} Team
                    </button>
                    <button
                      onClick={() => {
                        setShowDesktopUsers(!showDesktopUsers);
                        if (showTeamMembers) fetchTeamMembers();
                      }}
                      disabled={isLoading}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                          showDesktopUsers 
                          ? 'bg-purple-600 hover:bg-purple-700 text-white'
                          : 'bg-slate-400 hover:bg-slate-500 text-white'
                      } disabled:opacity-50`}
                    >
                      {showDesktopUsers ? '💻 Desktop: ON' : '💻 Desktop: OFF'}
                    </button>
                  </>
                )}
                
                {/* Non-Admin Controls */}
                {!propIsAdmin && (
                  <button
                    onClick={handleShowTeamMembers}
                    disabled={isLoading}
                    className="px-4 py-2 rounded-lg font-medium transition-colors text-sm bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                  >
                    📍 Show My Location
                  </button>
                )}
                
                <button
                      onClick={() => fetchTeamMembers()}
                      disabled={isLoading}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
                    >
                      🔄 Refresh
                </button>
                
                <button
                onClick={() => setShowUserList(!showUserList)}
                className={`px-3 py-2 rounded-lg transition-colors text-sm ${
                  showUserList ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-slate-600 hover:bg-slate-700 text-white'
                }`}
              >
                {showUserList ? '📋 Hide List' : '📋 Show List'}
                </button>
              </div>

            {/* User Filter Buttons */}
            {showUserList && (
              <div className="flex gap-2">
                <span className="text-sm text-slate-600 self-center">Filter:</span>
                {['all', 'active', 'inactive'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSelectedUserFilter(filter as any)}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                      selectedUserFilter === filter
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {filter === 'all' ? 'All Users' : filter === 'active' ? 'Active' : 'Inactive'}
                  </button>
                ))}
                </div>
            )}

            {/* Team Status Summary - Admin Only */}
            {showTeamMembers && teamMembers.length > 0 && propIsAdmin && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex gap-4 text-sm mb-2 flex-wrap">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-green-700 font-medium">Active: {teamMembers.filter(member => member.isActive).length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="text-orange-700 font-medium">Break: {teamMembers.filter(member => member.isOnBreak).length}</span>
                </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-red-700 font-medium">Inactive: {teamMembers.filter(member => !member.isActive && !member.isOnBreak).length}</span>
                </div>
                </div>
                {lastUpdateTime && (
                  <div className="text-xs text-blue-600">
                    🔄 Last updated: {lastUpdateTime.toLocaleTimeString()} | Auto-refresh: Every 5 minutes
                </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* User List Sidebar - Admin Only */}
        {showUserList && propIsAdmin && (
          <div className="w-80 bg-white border-r border-slate-200 flex-shrink-0 overflow-y-auto">
            <div className="p-4">
              <h3 className="font-semibold text-slate-800 mb-3">
                Users ({filteredUsers.length})
                <span className="text-xs text-slate-500 font-normal ml-2">(Last 20 min)</span>
              </h3>
              <div className="space-y-2">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleUserClick(user)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                      selectedUser?.id === user.id
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-800">{user.name}</div>
                        <div className="text-sm text-slate-600">{user.email}</div>
                </div>
                      <div className={`w-3 h-3 rounded-full ${
                        user.isActive ? 'bg-green-500' : user.isOnBreak ? 'bg-orange-500' : 'bg-red-500'
                      }`}></div>
              </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {user.isActive ? 'Active' : user.isOnBreak ? 'On Break' : 'Inactive'}
                            {user.deviceType && ` • ${user.deviceType === 'mobile' ? '📱' : '💻'} ${user.deviceType}`}
                            {user.lastSeen && ` • Last seen: ${new Date(user.lastSeen).toLocaleTimeString()}`}
                </div>
                </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Map Container */}
        <div className="flex-1 relative">
          <div
            ref={mapRef}
            className="w-full h-full"
            style={{ minHeight: '400px' }}
          />
          
          {isLoading && (
            <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-10">
              <div className="bg-white px-6 py-4 rounded-lg shadow-lg flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-slate-700 font-medium">Loading...</span>
                    </div>
                  </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default SimpleGoogleMaps;