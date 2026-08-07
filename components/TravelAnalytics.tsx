// components/TravelAnalytics.tsx
// Travel analytics dashboard for team management

import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

interface TravelSession {
  sessionId: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime?: string;
  startLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  endLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  totalDistance: number;
  totalTime: number;
  status: 'active' | 'completed' | 'paused';
  locations: Array<{
    latitude: number;
    longitude: number;
    timestamp: string;
    speed?: number;
  }>;
}

interface TeamMemberStats {
  userId: string;
  userName: string;
  userEmail: string;
  totalDistance: number;
  totalTime: number;
  sessionsCount: number;
  averageSpeed: number;
  longestSession: number;
  todayDistance: number;
  todayTime: number;
  todaySessions: number;
}

const TravelAnalytics: React.FC = () => {
  const [travelSessions, setTravelSessions] = useState<TravelSession[]>([]);
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);
  // const [isLoading, setIsLoading] = useState(false); // Unused variable
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMember, setSelectedMember] = useState<string>('all');
  // const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('daily'); // Unused variable

  useEffect(() => {
    let startDate: Date, endDate: Date;
    try {
        startDate = new Date(selectedDate);
        endDate = new Date(selectedDate);
        endDate.setDate(endDate.getDate() + 1);
    } catch (e) {
        console.error("Invalid date selected", e);
        return; // Exit if date is invalid
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/travel-sessions');
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : [];
        const sessions: TravelSession[] = [];
        for (const row of rows) {
          let sessionDate: Date;
          try {
            sessionDate = new Date(row.startTime ?? row.start_time);
            if (isNaN(sessionDate.getTime())) continue;
          } catch (e) {
            continue;
          }
          if (sessionDate >= startDate && sessionDate < endDate) {
            sessions.push({
              sessionId: row.sessionId ?? row.session_id ?? row.id ?? '',
              userId: row.userId ?? row.user_id ?? 'unknown',
              userName: row.userName ?? row.user_name ?? 'Unknown User',
              startTime: row.startTime ?? row.start_time ?? '',
              endTime: row.endTime ?? row.end_time,
              startLocation: row.startLocation ?? row.start_location ?? { latitude: 0, longitude: 0, address: 'Unknown' },
              endLocation: row.endLocation ?? row.end_location,
              totalDistance: Number(row.totalDistance ?? row.total_distance) || 0,
              totalTime: Number(row.totalTime ?? row.total_time) || 0,
              status: (row.status || 'completed') as 'active' | 'completed' | 'paused',
              locations: Array.isArray(row.locations) ? row.locations : []
            });
          }
        }
        setTravelSessions(sessions);
        calculateTeamStats(sessions);
      } catch (error) {
        console.error('Error fetching travel sessions:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedDate]);

  const calculateTeamStats = (sessions: TravelSession[]) => {
    const statsMap = new Map<string, TeamMemberStats>();

    sessions.forEach(session => {
      if (!statsMap.has(session.userId)) {
        statsMap.set(session.userId, {
          userId: session.userId,
          userName: session.userName,
          userEmail: '', // Could be populated if available
          totalDistance: 0,
          totalTime: 0,
          sessionsCount: 0,
          averageSpeed: 0,
          longestSession: 0,
          todayDistance: 0,
          todayTime: 0,
          todaySessions: 0
        });
      }

      const stats = statsMap.get(session.userId)!;
      stats.totalDistance += session.totalDistance;
      stats.totalTime += session.totalTime;
      stats.sessionsCount += 1;
      stats.longestSession = Math.max(stats.longestSession, session.totalTime);
      
      // Calculate average speed
      if (session.totalTime > 0) {
        const speed = (session.totalDistance / session.totalTime) * 3600; // km/h
        // 🟢 SAFE FIX: Prevent infinite/NaN average speed
        if (isFinite(speed)) {
             // Simple running average (approximation)
            stats.averageSpeed = stats.sessionsCount === 1 ? speed : (stats.averageSpeed + speed) / 2;
        }
      }
    });

    setTeamStats(Array.from(statsMap.values()));
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatDistance = (km: number): string => {
    if (!km || isNaN(km)) return '0m';
    if (km < 1) {
      return `${(km * 1000).toFixed(0)}m`;
    } else {
      return `${km.toFixed(2)}km`;
    }
  };

  const formatSpeed = (kmh: number): string => {
    if (!kmh || isNaN(kmh)) return '0 km/h';
    return `${kmh.toFixed(1)} km/h`;
  };

  const getTotalStats = () => {
    const totalDistance = teamStats.reduce((sum, member) => sum + member.totalDistance, 0);
    const totalTime = teamStats.reduce((sum, member) => sum + member.totalTime, 0);
    const totalSessions = teamStats.reduce((sum, member) => sum + member.sessionsCount, 0);
    const averageSpeed = totalTime > 0 ? (totalDistance / totalTime) * 3600 : 0;

    return {
      totalDistance,
      totalTime,
      totalSessions,
      averageSpeed: isFinite(averageSpeed) ? averageSpeed : 0
    };
  };

  const totalStats = getTotalStats();

  // Filter displayed sessions based on selected member
  const displayedSessions = selectedMember === 'all' 
    ? travelSessions 
    : travelSessions.filter(s => s.userId === selectedMember);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200 p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">📊 Travel Analytics</h2>
            <p className="text-sm text-slate-600">Team travel reports and performance metrics</p>
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Members</option>
              {teamStats.map(member => (
                <option key={member.userId} value={member.userId}>
                  {member.userName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {formatDistance(totalStats.totalDistance)}
            </div>
            <div className="text-sm text-blue-700">Total Distance</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {formatDuration(totalStats.totalTime)}
            </div>
            <div className="text-sm text-green-700">Total Time</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {totalStats.totalSessions}
            </div>
            <div className="text-sm text-purple-700">Total Sessions</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {formatSpeed(totalStats.averageSpeed)}
            </div>
            <div className="text-sm text-orange-700">Avg Speed</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Team Member Stats */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-slate-800">👥 Team Member Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Distance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sessions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Speed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Longest Session
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamStats.map((member) => (
                  <tr key={member.userId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{member.userName}</div>
                      <div className="text-sm text-gray-500">{member.userEmail}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDistance(member.totalDistance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDuration(member.totalTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {member.sessionsCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatSpeed(member.averageSpeed)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDuration(member.longestSession)}
                    </td>
                  </tr>
                ))}
                {teamStats.length === 0 && (
                    <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                            No data available for this date.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Travel Sessions */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-slate-800">🚗 Travel Sessions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team Member
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    End Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Distance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedSessions.map((session) => (
                  <tr key={session.sessionId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{session.userName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(session.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {session.endTime ? new Date(session.endTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' : 'Active'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDistance(session.totalDistance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDuration(session.totalTime)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        session.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : session.status === 'completed'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {session.status}
                      </span>
                    </td>
                  </tr>
                ))}
                 {displayedSessions.length === 0 && (
                    <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                            No travel sessions found.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TravelAnalytics;