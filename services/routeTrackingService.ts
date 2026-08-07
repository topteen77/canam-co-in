import apiClient from './apiClient';

export interface RoutePoint {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  timestamp: string;
  type: 'meeting' | 'attendance' | 'stop' | 'travel';
  duration?: number; // minutes
  meetingId?: string;
  leadName?: string;
  notes?: string;
  action?: string;
}

export interface UserRoute {
  userId: string;
  userName: string;
  userRole: string;
  date: string;
  routePoints: RoutePoint[];
  totalDistance: number; // km
  totalTime: number; // minutes
  totalStops: number;
  meetingStops: number;
  longStops: number;
}

export class RouteTrackingService {
  // --- HELPER: Parse JSON Safely ---
  // SQL stores JSON as strings, this ensures we get Objects back
  private static parseLoc(loc: any): any {
    if (!loc) return null;
    if (typeof loc === 'object') return loc;
    try {
      return JSON.parse(loc);
    } catch (e) {
      return null;
    }
  }

  // --- CALCULATION: Haversine Formula ---
  static calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius (km)
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // --- MAIN: Get Route for Single User ---
  static async getUserRoute(userId: string, date: string): Promise<UserRoute | null> {
    try {
      // 1. Fetch ALL data (Using existing endpoints)
      // Note: In production, you would add backend filters (?date=...) to optimize this
      const [attendanceRes, meetingsRes] = await Promise.all([
        apiClient.get('/attendance/all'),
        apiClient.get('/meetings/all') // Using 'all' to avoid 404 on missing user endpoint
      ]);

      const allAttendance = attendanceRes.data || [];
      const allMeetings = meetingsRes.data || [];

      // 2. Filter Client-Side
      const userAttendance = allAttendance.filter((r: any) => 
        (r.username === userId || r.userId === userId) && 
        (r.date === date || (r.checkInTime && r.checkInTime.startsWith(date)))
      );

      const userMeetings = allMeetings.filter((m: any) => {
        const mDate = m.date || (m.checkInTime ? m.checkInTime.split('T')[0] : '');
        return (m.username === userId || m.userId === userId) && mDate === date;
      });

      return this.buildRouteObject(userId, date, userAttendance, userMeetings);

    } catch (error) {
      console.error('❌ Error calculating user route:', error);
      return null;
    }
  }

  // --- MAIN: Get Routes for ALL Users (Optimized) ---
  static async getAllUserRoutes(date: string): Promise<UserRoute[]> {
    try {
      // 1. Fetch EVERYTHING in 3 parallel calls (Much faster than N+1 calls)
      const [usersRes, attendanceRes, meetingsRes] = await Promise.all([
        apiClient.get('/users'),
        apiClient.get('/attendance/all'),
        apiClient.get('/meetings/all')
      ]);

      const users = usersRes.data || [];
      const allAttendance = attendanceRes.data || [];
      const allMeetings = meetingsRes.data || [];

      const routes: UserRoute[] = [];

      // 2. Process each user in memory
      for (const user of users) {
        const userId = user.email || user.id;

        // Filter data for this user/date
        const userAtt = allAttendance.filter((r: any) => 
            (r.username === userId || r.userId === userId) && 
            (r.date === date || (r.checkInTime && r.checkInTime.startsWith(date)))
        );

        const userMeet = allMeetings.filter((m: any) => {
            const mDate = m.date || (m.checkInTime ? m.checkInTime.split('T')[0] : '');
            return (m.username === userId || m.userId === userId) && mDate === date;
        });

        // Only build route if data exists
        if (userAtt.length > 0 || userMeet.length > 0) {
            const route = this.buildRouteObject(userId, date, userAtt, userMeet);
            // Enrich with name/role from User table
            route.userName = user.name || route.userName;
            route.userRole = user.role || route.userRole;
            routes.push(route);
        }
      }

      return routes;

    } catch (error) {
      console.error('❌ Error getting all routes:', error);
      return [];
    }
  }

  // --- LOGIC: Build the Route Object ---
  private static buildRouteObject(userId: string, date: string, attendance: any[], meetings: any[]): UserRoute {
    const routePoints: RoutePoint[] = [];

    // Process Attendance (Start/End)
    attendance.forEach(record => {
        const startLoc = this.parseLoc(record.startLocation || record.location); // Fallback for legacy
        const endLoc = this.parseLoc(record.endLocation);

        if (startLoc?.latitude) {
            routePoints.push({
                id: `att_start_${record.id}`,
                userId,
                userName: record.username,
                userRole: 'User',
                location: startLoc,
                timestamp: record.checkInTime || record.createdAt,
                type: 'attendance',
                action: 'Start Day',
                duration: 0
            });
        }

        if (endLoc?.latitude) {
            routePoints.push({
                id: `att_end_${record.id}`,
                userId,
                userName: record.username,
                userRole: 'User',
                location: endLoc,
                timestamp: record.checkOutTime || record.updatedAt,
                type: 'attendance',
                action: 'End Day',
                duration: 0
            });
        }
    });

    // Process Meetings
    meetings.forEach(meeting => {
        const loc = this.parseLoc(meeting.location);
        if (loc?.latitude) {
            routePoints.push({
                id: `meet_${meeting.id}`,
                userId,
                userName: meeting.username,
                userRole: 'User',
                location: loc,
                timestamp: meeting.checkInTime || meeting.createdAt,
                type: 'meeting',
                meetingId: meeting.id,
                leadName: meeting.leadName,
                notes: meeting.notes,
                duration: meeting.duration || 0
            });
        }
    });

    // Sort by Time
    routePoints.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Process Points (Stops & Durations)
    const processedPoints = this.processRoutePoints(routePoints);

    // Calculate Totals
    let totalDistance = 0;
    for (let i = 1; i < processedPoints.length; i++) {
        const p1 = processedPoints[i-1].location;
        const p2 = processedPoints[i].location;
        totalDistance += this.calculateDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    }

    return {
        userId,
        userName: processedPoints[0]?.userName || userId,
        userRole: processedPoints[0]?.userRole || 'User',
        date,
        routePoints: processedPoints,
        totalDistance,
        totalTime: processedPoints.reduce((acc, p) => acc + (p.duration || 0), 0),
        totalStops: processedPoints.length,
        meetingStops: processedPoints.filter(p => p.type === 'meeting').length,
        longStops: processedPoints.filter(p => (p.duration || 0) > 30).length
    };
  }

  // --- LOGIC: Calculate Stop Durations ---
  private static processRoutePoints(points: RoutePoint[]): RoutePoint[] {
    return points.map((point, i) => {
        if (i < points.length - 1) {
            const t1 = new Date(point.timestamp).getTime();
            const t2 = new Date(points[i+1].timestamp).getTime();
            const mins = (t2 - t1) / (1000 * 60);
            
            // If stopped for >30 mins and NOT a meeting, mark as idle stop
            if (mins > 30 && point.type !== 'meeting') {
                return { ...point, duration: mins, type: 'stop' }; // Override type to 'stop'
            }
            return { ...point, duration: mins };
        }
        return { ...point, duration: 0 };
    });
  }

  // --- FORMATTERS ---
  static formatDuration(minutes: number): string {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  }

  static formatDistance(km: number): string {
    return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
  }
}