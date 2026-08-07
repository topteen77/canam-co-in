// Utility functions for calculating distances between locations

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

/**
 * Calculate the distance between two points using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

/**
 * Calculate distance between two location objects
 * @param location1 First location
 * @param location2 Second location
 * @returns Distance in kilometers, or 0 if either location is invalid
 */
export function calculateLocationDistance(location1: Location | undefined, location2: Location | undefined): number {
  if (!location1 || !location2 || 
      !location1.latitude || !location1.longitude || 
      !location2.latitude || !location2.longitude) {
    return 0;
  }
  
  return calculateDistance(
    location1.latitude, 
    location1.longitude, 
    location2.latitude, 
    location2.longitude
  );
}

/**
 * Format distance for display
 * @param distance Distance in kilometers
 * @returns Formatted distance string
 */
export function formatDistance(distance: number): string {
  if (distance < 1) {
    return `${(distance * 1000).toFixed(0)}m`;
  } else if (distance < 10) {
    return `${distance.toFixed(1)}km`;
  } else {
    return `${distance.toFixed(0)}km`;
  }
}

/**
 * Get a human-readable location name
 * @param location Location object
 * @returns Formatted location string
 */
export function getLocationName(location: Location | undefined): string {
  if (!location) return 'Unknown Location';
  
  if (location.address && location.address !== 'Unknown Location') {
    // If address contains coordinates, try to get a better location name
    if (location.address.includes(',') && !isNaN(parseFloat(location.address.split(',')[0]))) {
      const lat = parseFloat(location.address.split(',')[0]);
      const lng = parseFloat(location.address.split(',')[1]);
      return getLocationNameFromCoordinates(lat, lng);
    }
    return location.address;
  }
  
  return getLocationNameFromCoordinates(location.latitude, location.longitude);
}

/**
 * Get location name from coordinates
 * @param lat Latitude
 * @param lng Longitude
 * @returns Formatted location string
 */
/**
 * Validate and clean location coordinates
 * @param lat Latitude
 * @param lng Longitude
 * @returns Object with isValid boolean and cleaned coordinates
 */
export function validateLocationCoordinates(lat: number, lng: number): { isValid: boolean; lat: number; lng: number } {
  // Check for NaN values
  if (isNaN(lat) || isNaN(lng)) {
    return { isValid: false, lat: 0, lng: 0 };
  }
  
  // Check for obviously invalid coordinates (like 80.0000 which is way outside India)
  if (lat > 40 || lat < 6 || lng > 100 || lng < 68) {
    return { isValid: false, lat: 0, lng: 0 };
  }
  
  // Check for zero coordinates
  if (lat === 0 && lng === 0) {
    return { isValid: false, lat: 0, lng: 0 };
  }
  
  return { isValid: true, lat, lng };
}

/**
 * Get location name from coordinates
 * @param lat Latitude
 * @param lng Longitude
 * @returns Formatted location string
 */
export function getLocationNameFromCoordinates(lat: number, lng: number): string {
  const validation = validateLocationCoordinates(lat, lng);
  
  if (!validation.isValid) {
    return 'Location not available';
  }
  
  // Punjab region coordinates with specific Chandigarh sector detection
  if (lat >= 30.7 && lat <= 30.8 && lng >= 76.6 && lng <= 76.7) {
    // Sector 17 area (coordinates around 30.740893, 76.781823)
    if (lat >= 30.74 && lat <= 30.75 && lng >= 76.78 && lng <= 76.79) {
      return 'Sector 17, Chandigarh, Punjab, India';
    }
    // Other Chandigarh sectors
    else if (lat >= 30.73 && lat <= 30.76 && lng >= 76.77 && lng <= 76.80) {
      return 'Chandigarh, Punjab, India';
    } else {
      return 'Chandigarh, Punjab, India';
    }
  } else if (lat >= 30.7 && lat <= 30.8 && lng >= 76.5 && lng <= 76.6) {
    return 'Kharar, Punjab, India';
  } else if (lat >= 30.7 && lat <= 30.8 && lng >= 76.6 && lng <= 76.8) {
    return 'Mohali, Punjab, India';
  } else if (lat >= 30.6 && lat <= 30.9 && lng >= 76.5 && lng <= 76.9) {
    return 'Punjab, India';
  } else {
    return `Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}





























