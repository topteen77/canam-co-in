// components/LiveRouteView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { RouteTrackingService, UserRoute, RoutePoint } from '../services/routeTrackingService';

// Google Maps types
declare global {
  interface Window {
    google: any;
  }
}

interface LiveRouteViewProps {
  selectedDate?: string;
  selectedUser?: string;
  isAdmin?: boolean;
}

const LiveRouteView: React.FC<LiveRouteViewProps> = ({ 
  selectedDate, 
  selectedUser, 
  isAdmin = false 
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [routes, setRoutes] = useState<UserRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<UserRoute | null>(null);
  
  // Refs for cleanup to avoid closure stale state in useEffects
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [showMeetings, setShowMeetings] = useState(true);
  const [showStops, setShowStops] = useState(true);
  const [showLongStops, setShowLongStops] = useState(true);
  const [showTravel, setShowTravel] = useState(true);
  const [minStopDuration, setMinStopDuration] = useState(30);

  // Initialize map with Safety Shield
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let timeoutId: NodeJS.Timeout;

    const initMap = () => {
      if (!mapRef.current) return;
      
      // 🟢 SAFE FIX: Robust check for Google Maps API
      if (!window.google || !window.google.maps) {
        return;
      }

      try {
        const googleMap = new window.google.maps.Map(mapRef.current, {
          center: { lat: 28.6139, lng: 77.2090 }, // Delhi, India
          zoom: 10,
          mapTypeId: window.google.maps.MapTypeId.ROADMAP,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true
        });

        setMap(googleMap);
        setMapLoaded(true);
        setError(null);
      } catch (e) {
        console.error("Map initialization error:", e);
        setError("Error initializing map. Please refresh.");
      }
    };

    if (window.google?.maps) {
      initMap();
    } else {
      // Poll for API load
      intervalId = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(intervalId);
          clearTimeout(timeoutId);
          initMap();
        }
      }, 500);

      // Safety timeout
      timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        if (!window.google?.maps) {
          setError('Google Maps API failed to load. Please check your connection.');
        }
      }, 15000);
    }

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  }, []);

  // Load route data
  useEffect(() => {
    const loadRouteData = async () => {
      if (!selectedDate) return;

      setLoading(true);
      setError(null);

      try {
        let routeData: UserRoute[] = [];

        if (selectedUser) {
          // Load route for specific user
          const route = await RouteTrackingService.getUserRoute(selectedUser, selectedDate);
          if (route) {
            routeData = [route];
          }
        } else {
          // Load routes for all users
          routeData = await RouteTrackingService.getAllUserRoutes(selectedDate);
        }

        // 🟢 SAFE FIX: Ensure we always set an array
        setRoutes(Array.isArray(routeData) ? routeData : []);
        console.log('📍 Route data loaded:', routeData);
      } catch (error) {
        console.error('Error loading route data:', error);
        setError('Failed to load route data');
        setRoutes([]);
      } finally {
        setLoading(false);
      }
    };

    loadRouteData();
  }, [selectedDate, selectedUser]);

  // Update map markers and polylines
  useEffect(() => {
    if (!map || !mapLoaded || !window.google?.maps) return;

    // 🟢 SAFE FIX: Cleanup previous map elements using Refs
    markersRef.current.forEach(marker => marker.setMap(null));
    polylinesRef.current.forEach(polyline => polyline.setMap(null));
    markersRef.current = [];
    polylinesRef.current = [];

    if (routes.length === 0) return;

    const newMarkers: any[] = [];
    const newPolylines: any[] = [];
    const bounds = new window.google.maps.LatLngBounds();

    routes.forEach((route, routeIndex) => {
      // 🟢 SAFE FIX: Guard against missing routePoints
      const safePoints = Array.isArray(route.routePoints) ? route.routePoints : [];
      
      const filteredPoints = safePoints.filter(point => {
        if (!point || !point.location) return false;
        if (point.type === 'meeting' && !showMeetings) return false;
        if (point.type === 'stop' && !showStops) return false;
        if (point.type === 'stop' && (point.duration || 0) < minStopDuration) return false;
        if (point.type === 'attendance' && !showTravel) return false;
        return true;
      });

      // Create polyline for route
      if (filteredPoints.length > 1) {
        const path = filteredPoints
          .filter(p => typeof p.location.latitude === 'number' && typeof p.location.longitude === 'number')
          .map(point => ({
            lat: point.location.latitude,
            lng: point.location.longitude
          }));

        if (path.length > 1) {
          const polyline = new window.google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: getRouteColor(routeIndex),
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map: map
          });
          newPolylines.push(polyline);
        }
      }

      // Create markers for each point
      filteredPoints.forEach((point, pointIndex) => {
        const marker = createRouteMarker(point, route, pointIndex);
        if (marker) {
          marker.setMap(map);
          newMarkers.push(marker);
          bounds.extend(marker.getPosition());
        }
      });
    });

    // Update refs
    markersRef.current = newMarkers;
    polylinesRef.current = newPolylines;

    // Fit map to show all routes if markers exist
    if (newMarkers.length > 0) {
      map.fitBounds(bounds);
    }
  }, [map, mapLoaded, routes, showMeetings, showStops, showLongStops, showTravel, minStopDuration]);

  // Get color for route based on index
  const getRouteColor = (index: number): string => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    return colors[index % colors.length];
  };

  // Create marker for route point
  const createRouteMarker = (point: RoutePoint, route: UserRoute, index: number) => {
    // 🟢 SAFE FIX: Strict coordinate validation
    if (!point.location || 
        typeof point.location.latitude !== 'number' || 
        typeof point.location.longitude !== 'number') {
      return null;
    }

    let markerColor = '#FF6B6B';
    let markerTitle = '';

    switch (point.type) {
      case 'meeting':
        markerColor = '#34A853'; // Green
        markerTitle = `Meeting: ${point.leadName || 'Unknown Lead'}`;
        break;
      case 'stop':
        if ((point.duration || 0) > 30) {
          markerColor = '#FBBC04'; // Orange
          markerTitle = `Long Stop: ${RouteTrackingService.formatDuration(point.duration || 0)}`;
        } else {
          markerColor = '#FF6B6B'; // Red
          markerTitle = `Stop: ${RouteTrackingService.formatDuration(point.duration || 0)}`;
        }
        break;
      case 'attendance':
        if (point.action === 'start-day') {
          markerColor = '#4285F4'; // Blue
          markerTitle = 'Day Start';
        } else if (point.action === 'end-day') {
          markerColor = '#9C27B0'; // Purple
          markerTitle = 'Day End';
        }
        break;
      default:
        markerColor = '#757575'; // Gray
        markerTitle = 'Location';
    }

    const marker = new window.google.maps.Marker({
      position: { lat: point.location.latitude, lng: point.location.longitude },
      map: map,
      title: markerTitle,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: markerColor,
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2
      }
    });

    // Create info window
    const infoWindow = new window.google.maps.InfoWindow({
      content: createInfoWindowContent(point, route, index)
    });

    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });

    return marker;
  };

  // Create info window content
  const createInfoWindowContent = (point: RoutePoint, route: UserRoute, index: number): string => {
    const time = new Date(point.timestamp).toLocaleString();
    const duration = point.duration ? RouteTrackingService.formatDuration(point.duration) : 'N/A';
    
    return `
      <div style="padding: 12px; min-width: 280px; font-family: Arial, sans-serif;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 20px;">${getMarkerIcon(point.type)}</span>
          <h3 style="margin: 0; color: #333; font-size: 16px;">${getMarkerTitle(point)}</h3>
        </div>
        
        <div style="margin-bottom: 8px;">
          <p style="margin: 4px 0; font-weight: bold; color: #555;">👤 ${route.userName || 'Unknown User'}</p>
          <p style="margin: 4px 0; color: #666;">📍 ${point.location.address || 'Address Unavailable'}</p>
          <p style="margin: 4px 0; color: #666;">⏰ ${time}</p>
          ${point.duration ? `<p style="margin: 4px 0; color: #666;">⏱️ Duration: ${duration}</p>` : ''}
        </div>

        ${point.type === 'meeting' ? `
          <div style="background: #E8F5E8; padding: 8px; border-radius: 4px; margin-top: 8px;">
            <p style="margin: 0; font-weight: bold; color: #2E7D32;">Meeting Details:</p>
            <p style="margin: 4px 0; color: #2E7D32;">Lead: ${point.leadName || 'N/A'}</p>
            ${point.notes ? `<p style="margin: 4px 0; color: #2E7D32;">Notes: ${point.notes}</p>` : ''}
          </div>
        ` : ''}

        ${point.type === 'stop' && (point.duration || 0) > 30 ? `
          <div style="background: #FFF3E0; padding: 8px; border-radius: 4px; margin-top: 8px;">
            <p style="margin: 0; font-weight: bold; color: #F57C00;">Long Stop Detected</p>
            <p style="margin: 4px 0; color: #F57C00;">Stopped for ${duration} at this location</p>
          </div>
        ` : ''}

        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #E0E0E0;">
          <p style="margin: 0; font-size: 12px; color: #999;">
            Route Point ${index + 1}
          </p>
        </div>
      </div>
    `;
  };

  const getMarkerIcon = (type: string): string => {
    switch (type) {
      case 'meeting': return '🤝';
      case 'stop': return '⏰';
      case 'attendance': return '🏁';
      default: return '📍';
    }
  };

  const getMarkerTitle = (point: RoutePoint): string => {
    switch (point.type) {
      case 'meeting': return `Meeting: ${point.leadName || 'Unknown Lead'}`;
      case 'stop': return `Stop: ${RouteTrackingService.formatDuration(point.duration || 0)}`;
      case 'attendance': return point.action === 'start-day' ? 'Day Start' : 'Day End';
      default: return 'Location';
    }
  };

  const getCurrentDate = (): string => {
    return new Date().toISOString().split('T')[0];
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold">Error Loading Route Data</h3>
          <p className="text-red-600">{error}</p>
          <button 
             onClick={() => window.location.reload()}
             className="mt-2 text-sm text-red-700 underline"
          >
             Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Controls Panel */}
        <div className="lg:w-1/3 space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Route Controls</h3>
            
            {/* Date Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
              <input
                type="date"
                value={selectedDate || getCurrentDate()}
                onChange={(e) => {
                   // In a real app, this should trigger a prop change or context update
                   console.log('Date changed:', e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filters */}
            <div className="space-y-3">
              <h4 className="font-medium text-gray-900">Show Points:</h4>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showMeetings}
                  onChange={(e) => setShowMeetings(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">🤝 Meetings</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showStops}
                  onChange={(e) => setShowStops(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">📍 All Stops</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showLongStops}
                  onChange={(e) => setShowLongStops(e.target.checked)}
                  className="mr-2"
                />
                  <span className="text-sm">⏰ Long Stops (&gt;30min)</span>
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showTravel}
                  onChange={(e) => setShowTravel(e.target.checked)}
                  className="mr-2"
                />
                <span className="text-sm">🏁 Day Start/End</span>
              </label>
            </div>

            {/* Minimum Stop Duration */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Stop Duration (minutes)
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={minStopDuration}
                onChange={(e) => setMinStopDuration(parseInt(e.target.value) || 30)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          

          {/* Route Summary */}
          {routes.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Route Summary</h3>
              
              <div className="space-y-3">
                {routes.map((route) => (
                  <div key={route.userId} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{route.userName || 'Unknown'}</h4>
                      <span className="text-xs text-gray-500">{route.userRole}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-600">Distance:</span>
                        <span className="ml-1 font-medium">{RouteTrackingService.formatDistance(route.totalDistance)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Time:</span>
                        <span className="ml-1 font-medium">{RouteTrackingService.formatDuration(route.totalTime)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Stops:</span>
                        <span className="ml-1 font-medium">{route.totalStops}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Meetings:</span>
                        <span className="ml-1 font-medium">{route.meetingStops}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setSelectedRoute(route)}
                      className="w-full mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      View Details
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="lg:w-2/3">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Live Route View</h3>
              {loading && <p className="text-sm text-gray-600">Loading route data...</p>}
            </div>
            
            <div className="relative">
              <div ref={mapRef} className="w-full h-96 lg:h-[600px] rounded-b-lg"></div>
              
              {!mapLoaded && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-b-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-gray-600">Loading map...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveRouteView;