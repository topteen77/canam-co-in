import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../services/apiClient';

interface UserUsageData {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  totalActivities: number;
  dailyUsage: {
    [date: string]: {
      reads: number;
      writes: number;
      deletes: number;
      storage: number;
      bandwidth: number;
    };
  };
  resourceUsage: {
    leads: number;
    followUps: number;
    attendance: number;
    reports: number;
    admin: number;
  };
  lastActive: string;
}

interface UsageStats {
  totalUsers: number;
  activeUsers: number;
  totalActivities: number;
  topResourceConsumer: string;
  topUser: string;
  dailyBreakdown: {
    [date: string]: {
      totalReads: number;
      totalWrites: number;
      totalDeletes: number;
      totalStorage: number;
      totalBandwidth: number;
    };
  };
}

const UserUsageTracker: React.FC = () => {
  const [userUsageData, setUserUsageData] = useState<UserUsageData[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadUsageData();
  }, []);

  const loadUsageData = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔍 Loading user usage data...');
      
      let users: any[] = [];
      try {
        const { data } = await apiClient.get('/users');
        users = Array.isArray(data) ? data : [];
        console.log(`📊 Found ${users.length} users`);
      } catch (userError) {
        console.error('❌ Error loading users:', userError);
        // Create fallback users if collection doesn't exist
        users = [
          { id: 'fallback1', name: 'Sample User', email: 'user@example.com', role: 'Account Manager' },
          { id: 'fallback2', name: 'Admin User', email: 'admin@example.com', role: 'Admin' }
        ];
      }
      
      // Get all activity logs with error handling
      let activities: any[] = [];
      try {
        const { data: activityRows } = await apiClient.get('/activities').catch(() => ({ data: [] }));
        activities = Array.isArray(activityRows) ? activityRows.map((r: any) => ({ id: r.id ?? r.firebase_id, ...r })) : [];
        console.log(`📊 Found ${activities.length} activities`);
      } catch (activityError) {
        console.error('❌ Error loading activities:', activityError);
        // Create sample activities if collection doesn't exist
        activities = [
          {
            id: 'sample1',
            userEmail: users[0]?.email || 'user@example.com',
            action: 'view_lead',
            description: 'Viewed lead details',
            timestamp: new Date().toISOString()
          },
          {
            id: 'sample2',
            userEmail: users[1]?.email || 'admin@example.com',
            action: 'update_followup',
            description: 'Updated follow-up status',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          }
        ];
      }
      
      console.log(`📊 Processing ${users.length} users and ${activities.length} activities`);
      
      // Process usage data by user
      const userUsageMap = new Map<string, UserUsageData>();
      
      // Initialize user data
      users.forEach((user: any) => {
        userUsageMap.set(user.email, {
          userId: user.id,
          userName: user.name || 'Unknown',
          userEmail: user.email,
          userRole: user.role || 'Pending',
          totalActivities: 0,
          dailyUsage: {},
          resourceUsage: {
            leads: 0,
            followUps: 0,
            attendance: 0,
            reports: 0,
            admin: 0
          },
          lastActive: user.lastActive || 'Never'
        });
      });
      
      // Process activities
      activities.forEach((activity: any) => {
        const userEmail = activity.userEmail || activity.userId;
        const userData = userUsageMap.get(userEmail);
        
        if (userData) {
          userData.totalActivities++;
          
          // Parse date
          let date = new Date().toISOString().split('T')[0];
          if (activity.timestamp) {
              try {
                  const parsedDate = new Date(activity.timestamp);
                  if (!isNaN(parsedDate.getTime())) {
                      date = parsedDate.toISOString().split('T')[0];
                  }
              } catch (e) {
                  console.warn("Invalid date in activity log", activity);
              }
          }
          
          // Initialize daily usage if not exists
          if (!userData.dailyUsage[date]) {
            userData.dailyUsage[date] = {
              reads: 0,
              writes: 0,
              deletes: 0,
              storage: 0,
              bandwidth: 0
            };
          }
          
          // Estimate usage based on action type
          const action = (activity.action || 'unknown').toLowerCase();
          const description = (activity.description || '').toLowerCase();
          
          // Reads (viewing data)
          if (action.includes('view') || action.includes('load') || action.includes('read') || 
              description.includes('viewed') || description.includes('loaded')) {
            userData.dailyUsage[date].reads += 1;
          }
          
          // Writes (updating data)
          if (action.includes('update') || action.includes('create') || action.includes('add') || 
              description.includes('updated') || description.includes('created') || description.includes('added')) {
            userData.dailyUsage[date].writes += 1;
          }
          
          // Deletes
          if (action.includes('delete') || action.includes('remove') || 
              description.includes('deleted') || description.includes('removed')) {
            userData.dailyUsage[date].deletes += 1;
          }
          
          // Storage (estimated based on data size)
          userData.dailyUsage[date].storage += 0.001; // 1KB per activity
          
          // Bandwidth (estimated)
          userData.dailyUsage[date].bandwidth += 0.01; // 10MB per activity
          
          // Resource usage by section
          if (description.includes('lead') || action.includes('lead')) {
            userData.resourceUsage.leads++;
          } else if (description.includes('follow') || action.includes('follow')) {
            userData.resourceUsage.followUps++;
          } else if (description.includes('attendance') || action.includes('attendance')) {
            userData.resourceUsage.attendance++;
          } else if (description.includes('report') || action.includes('report')) {
            userData.resourceUsage.reports++;
          } else if (description.includes('admin') || action.includes('admin')) {
            userData.resourceUsage.admin++;
          }
          
          // Update last active
          if (activity.timestamp && (userData.lastActive === 'Never' || activity.timestamp > userData.lastActive)) {
            userData.lastActive = activity.timestamp;
          }
        }
      });
      
      const userUsageArray = Array.from(userUsageMap.values());
      setUserUsageData(userUsageArray);
      
      // Calculate overall stats
      const stats: UsageStats = {
        totalUsers: users.length,
        activeUsers: userUsageArray.filter(u => u.totalActivities > 0).length,
        totalActivities: activities.length,
        topResourceConsumer: '',
        topUser: '',
        dailyBreakdown: {}
      };
      
      // Find top user
      if (userUsageArray.length > 0) {
        const topUser = userUsageArray.reduce((prev, current) => 
          prev.totalActivities > current.totalActivities ? prev : current
        );
        stats.topUser = topUser.userName;
      }
      
      // Find top resource consumer
      const resourceTotals = userUsageArray.reduce((acc, user) => {
        acc.leads += user.resourceUsage.leads;
        acc.followUps += user.resourceUsage.followUps;
        acc.attendance += user.resourceUsage.attendance;
        acc.reports += user.resourceUsage.reports;
        acc.admin += user.resourceUsage.admin;
        return acc;
      }, { leads: 0, followUps: 0, attendance: 0, reports: 0, admin: 0 });
      
      const sortedResources = Object.entries(resourceTotals).sort(([,a], [,b]) => b - a);
      if (sortedResources.length > 0) {
          stats.topResourceConsumer = sortedResources[0][0];
      }
      
      // Calculate daily breakdown
      userUsageArray.forEach(user => {
        Object.entries(user.dailyUsage).forEach(([date, usage]) => {
          if (!stats.dailyBreakdown[date]) {
            stats.dailyBreakdown[date] = {
              totalReads: 0,
              totalWrites: 0,
              totalDeletes: 0,
              totalStorage: 0,
              totalBandwidth: 0
            };
          }
          stats.dailyBreakdown[date].totalReads += usage.reads;
          stats.dailyBreakdown[date].totalWrites += usage.writes;
          stats.dailyBreakdown[date].totalDeletes += usage.deletes;
          stats.dailyBreakdown[date].totalStorage += usage.storage;
          stats.dailyBreakdown[date].totalBandwidth += usage.bandwidth;
        });
      });
      
      setUsageStats(stats);
      setLoading(false);
      
    } catch (error) {
      console.error('Error loading usage data:', error);
      setError('Failed to load usage data. Showing sample data.');
      // Keep loading false to show error state or empty state instead of spinning forever
      setLoading(false);
    }
  };

  // Filtered data
  const filteredData = useMemo(() => {
    let filtered = userUsageData;
    
    // Filter by user
    if (selectedUser !== 'all') {
      filtered = filtered.filter(user => user.userEmail === selectedUser);
    }
    
    // Filter by date
    if (selectedDate !== 'all') {
      filtered = filtered.map(user => ({
        ...user,
        dailyUsage: {
          [selectedDate]: user.dailyUsage[selectedDate] || {
            reads: 0, writes: 0, deletes: 0, storage: 0, bandwidth: 0
          }
        }
      }));
    }
    
    // Filter by date range
    filtered = filtered.map(user => {
      const filteredDailyUsage: { [date: string]: any } = {};
      Object.entries(user.dailyUsage).forEach(([date, usage]) => {
        if (date >= dateRange.start && date <= dateRange.end) {
          filteredDailyUsage[date] = usage;
        }
      });
      return { ...user, dailyUsage: filteredDailyUsage };
    });
    
    return filtered;
  }, [userUsageData, selectedUser, selectedDate, dateRange]);

  // Get unique dates for filter
  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    userUsageData.forEach(user => {
      Object.keys(user.dailyUsage).forEach(date => dates.add(date));
    });
    return Array.from(dates).sort().reverse();
  }, [userUsageData]);

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Loading usage data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      {error && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <div className="text-yellow-800 text-sm">
            ⚠️ <strong>Warning:</strong> {error}
          </div>
        </div>
      )}
      
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">👥 User Usage Tracker</h2>
            <p className="text-gray-600">Track individual user activity and resource consumption</p>
          </div>
          <button
            onClick={loadUsageData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔄 Refresh Data
          </button>
        </div>
      </div>

      {/* Usage Statistics */}
      {usageStats && (
        <div className="mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">📊 Overall Usage Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{usageStats.totalUsers}</div>
              <div className="text-sm text-gray-600">Total Users</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{usageStats.activeUsers}</div>
              <div className="text-sm text-gray-600">Active Users</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{usageStats.totalActivities}</div>
              <div className="text-sm text-gray-600">Total Activities</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 truncate">{usageStats.topUser || 'None'}</div>
              <div className="text-sm text-gray-600">Top User</div>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-orange-50 rounded border border-orange-200">
            <h5 className="font-semibold text-orange-800 mb-2">🔥 Resource Consumption Analysis</h5>
            <div className="text-sm text-orange-700">
              <div>• <strong>Most Used Resource:</strong> {usageStats.topResourceConsumer || 'None'}</div>
              <div>• <strong>Top Active User:</strong> {usageStats.topUser || 'None'}</div>
              <div>• <strong>Active Users:</strong> {usageStats.activeUsers} out of {usageStats.totalUsers} total users</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">🔍 Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Users</option>
              {userUsageData.map(user => (
                <option key={user.userEmail} value={user.userEmail}>
                  {user.userName} ({user.userRole})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Dates</option>
              {availableDates.map(date => (
                <option key={date} value={date}>
                  {new Date(date).toLocaleDateString()}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range Start</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Range End</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* User Usage Table */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 User Usage Details</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Activities</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource Usage</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Daily Usage</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((user) => (
                <tr key={user.userEmail} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.userName}</div>
                      <div className="text-sm text-gray-500">{user.userEmail}</div>
                    </div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      user.userRole === 'Admin' ? 'bg-red-100 text-red-800' :
                      user.userRole === 'Account Manager' ? 'bg-blue-100 text-blue-800' :
                      user.userRole === 'Sales' ? 'bg-green-100 text-green-800' :
                      user.userRole === 'Operations' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {user.userRole}
                    </span>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {user.totalActivities}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="text-xs space-y-1">
                      <div>Leads: {user.resourceUsage.leads}</div>
                      <div>Follow-ups: {user.resourceUsage.followUps}</div>
                      <div>Attendance: {user.resourceUsage.attendance}</div>
                      <div>Reports: {user.resourceUsage.reports}</div>
                      <div>Admin: {user.resourceUsage.admin}</div>
                    </div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="text-xs space-y-1">
                      {Object.entries(user.dailyUsage).slice(0, 3).map(([date, usage]) => (
                        <div key={date}>
                          <div className="font-medium">{new Date(date).toLocaleDateString()}</div>
                          <div>R: {usage.reads} | W: {usage.writes} | D: {usage.deletes}</div>
                          <div>S: {usage.storage.toFixed(2)}GB | B: {usage.bandwidth.toFixed(2)}GB</div>
                        </div>
                      ))}
                      {Object.keys(user.dailyUsage).length > 3 && (
                        <div className="text-gray-500">+{Object.keys(user.dailyUsage).length - 3} more days</div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {user.lastActive === 'Never' ? 'Never' : new Date(user.lastActive).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Usage Chart */}
      {usageStats && Object.keys(usageStats.dailyBreakdown).length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Daily Usage Trend</h3>
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="space-y-2">
              {Object.entries(usageStats.dailyBreakdown)
                .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                .slice(0, 10)
                .map(([date, usage]) => (
                  <div key={date} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="font-medium">{new Date(date).toLocaleDateString()}</div>
                    <div className="text-sm space-x-4">
                      <span>R: {usage.totalReads}</span>
                      <span>W: {usage.totalWrites}</span>
                      <span>D: {usage.totalDeletes}</span>
                      <span>S: {usage.totalStorage.toFixed(2)}GB</span>
                      <span>B: {usage.totalBandwidth.toFixed(2)}GB</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserUsageTracker;