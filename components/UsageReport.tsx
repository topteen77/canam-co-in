import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../services/apiClient';
import { trackCallAction, testCTATracking } from '../services/ctaTrackingService';

interface UserActivity {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: 'call' | 'email' | 'whatsapp' | 'followup_created' | 'followup_completed' | 'meeting_scheduled' | 'meeting_completed' | 'status_changed' | 'lead_created' | 'lead_updated' | 'attendance_checkin' | 'attendance_checkout' | 'user_login' | 'user_logout' | 'admin_action' | 'data_export' | 'data_import';
  description: string;
  leadId?: string;
  leadName?: string;
  timestamp: string;
  device: 'mobile' | 'desktop';
  details?: {
    phone?: string;
    email?: string;
    oldStatus?: string;
    newStatus?: string;
    followUpType?: string;
    meetingDate?: string;
  };
}

interface UsageReportProps {
  currentUser: string | null;
  isAdmin: boolean;
}

const getActionIcon = (action: string) => {
  const icons: Record<string, string> = {
    call: '📞',
    email: '📧',
    whatsapp: '💬',
    followup_created: '📝',
    followup_completed: '✅',
    meeting_scheduled: '📅',
    meeting_completed: '🎯',
    status_changed: '🔄',
    lead_created: '➕',
    lead_updated: '✏️',
    attendance_checkin: '🕐',
    attendance_checkout: '🕕',
    user_login: '🔑',
    user_logout: '🚪',
    admin_action: '⚙️',
    data_export: '📤',
    data_import: '📥'
  };
  return icons[action] || '📋';
};

const getActionColor = (action: string) => {
  const colors: Record<string, string> = {
    call: 'bg-green-100 text-green-800',
    email: 'bg-blue-100 text-blue-800',
    whatsapp: 'bg-green-100 text-green-800',
    followup_created: 'bg-yellow-100 text-yellow-800',
    followup_completed: 'bg-green-100 text-green-800',
    meeting_scheduled: 'bg-purple-100 text-purple-800',
    meeting_completed: 'bg-indigo-100 text-indigo-800',
    status_changed: 'bg-orange-100 text-orange-800',
    lead_created: 'bg-emerald-100 text-emerald-800',
    lead_updated: 'bg-amber-100 text-amber-800',
    attendance_checkin: 'bg-teal-100 text-teal-800',
    attendance_checkout: 'bg-cyan-100 text-cyan-800',
    user_login: 'bg-lime-100 text-lime-800',
    user_logout: 'bg-red-100 text-red-800',
    admin_action: 'bg-violet-100 text-violet-800',
    data_export: 'bg-pink-100 text-pink-800',
    data_import: 'bg-rose-100 text-rose-800'
  };
  return colors[action] || 'bg-gray-100 text-gray-800';
};

const getDeviceIcon = (device: string) => {
  return device === 'mobile' ? '📱' : '💻';
};

// Helper function to get user display name
const getUserDisplayName = (email: string, users: Array<{id: string, name: string, email: string}>): string => {
  if (!email) return 'Unknown';
  if (!users || users.length === 0) {
    return email.split('@')[0]; // Fallback to email prefix
  }
  
  const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
  if (user && user.name && user.name.trim()) {
    return user.name;
  }
  
  return email.split('@')[0]; // Fallback to email prefix
};

export const UsageReport: React.FC<UsageReportProps> = ({ currentUser, isAdmin }) => {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [ctaActivities, setCtaActivities] = useState<UserActivity[]>([]);
  const [users, setUsers] = useState<Array<{id: string, name: string, email: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'general' | 'cta'>('general');
  
  // Set default filters to show last 30 days of data
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Helper function to create valid timestamps
  const createValidTimestamp = (offsetMs: number = 0) => {
    const date = new Date(Date.now() + offsetMs);
    if (isNaN(date.getTime())) {
      console.error('Invalid date created, using current time');
      return new Date().toISOString();
    }
    return date.toISOString();
  };

  // Create initial sample data
  const createSampleData = () => {
    const sampleActivities: UserActivity[] = [
      {
        id: 'sample-1',
        userId: 'sample-user-1',
        userName: 'Sample User 1',
        userEmail: 'sample1@example.com',
        action: 'call',
        description: 'Called lead about project inquiry',
        leadId: 'sample-lead-1',
        leadName: 'Sample Lead 1',
        timestamp: createValidTimestamp(),
        device: 'mobile',
        details: { phone: '+91-9876543210' }
      },
      // ... more sample data can be added here if needed
    ];
    
    const sampleUsers = [
      { id: 'sample-user-1', email: 'sample1@example.com', name: 'Sample User 1' },
      { id: 'sample-user-2', email: 'sample2@example.com', name: 'Sample User 2' }
    ];
    
    return { sampleActivities, sampleUsers };
  };

  const [filters, setFilters] = useState({
    user: '',
    action: '',
    device: '',
    dateFrom: thirtyDaysAgo, // Default to last 30 days
    dateTo: today,    // Default to today
    searchTerm: ''
  });

  // Load users and activities
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLoading(true);
        console.log('🔄 Attempting to load real data...');
        
        const { data: usersRows } = await apiClient.get('/users');
        const usersData = (Array.isArray(usersRows) ? usersRows : []).map((row: any) => ({
          id: row.id,
          name: row.name || '',
          email: row.email || '',
          ...row
        })).filter((user: any) => user.status === 'Active');
        if (isMounted) setUsers(usersData);

        const activitiesData: UserActivity[] = [];
        const { data: leadsRows } = await apiClient.get('/leads/all');
        const leadsData = Array.isArray(leadsRows) ? leadsRows.map((row: any) => ({ id: row.id ?? row.firebase_id, ...row })) : [];
        
        // Process leads to extract activities
        leadsData.forEach((lead: any) => {
          // Add lead creation activity
          if (lead.createdAt) {
            activitiesData.push({
              id: `lead_created_${lead.id}`,
              userId: lead.createdBy || 'Unknown',
              userName: getUserDisplayName(lead.createdBy || 'Unknown', usersData),
              userEmail: lead.createdBy || 'Unknown',
              action: 'lead_created',
              description: `Created lead: ${lead.agencyName || 'Unknown Agency'}`,
              leadId: lead.id,
              leadName: lead.agencyName || 'Unknown Agency',
              timestamp: lead.createdAt,
              device: 'desktop', // Default assumption
              details: {}
            });
          }
          
          // Add follow-up activities
          if (lead.followUps && Array.isArray(lead.followUps)) {
            lead.followUps.forEach((followUp: any, index: number) => {
              activitiesData.push({
                id: `followup_${lead.id}_${index}`,
                userId: lead.createdBy || 'Unknown',
                userName: getUserDisplayName(lead.createdBy || 'Unknown', usersData),
                userEmail: lead.createdBy || 'Unknown',
                action: followUp.status === 'Done' ? 'followup_completed' : 'followup_created',
                description: `${followUp.status === 'Done' ? 'Completed' : 'Created'} follow-up: ${followUp.type} with ${lead.agencyName}`,
                leadId: lead.id,
                leadName: lead.agencyName,
                timestamp: followUp.date || new Date().toISOString(),
                device: 'desktop', // Default assumption
                details: { followUpType: followUp.type }
              });
            });
          }
        });
        
        const { data: attRows } = await apiClient.get('/attendance/all').catch(() => ({ data: [] }));
        (Array.isArray(attRows) ? attRows : []).forEach((att: any) => {
          const username = att.username ?? att.user_name;
          if (username) {
            activitiesData.push({
              id: `attendance_${att.id ?? att.firebase_id}`,
              userId: username,
              userName: getUserDisplayName(username, usersData),
              userEmail: username,
              action: 'attendance_checkin',
              description: 'Checked in for work',
              timestamp: att.checkInTime ?? att.check_in_time ?? new Date().toISOString(),
              device: 'desktop',
              details: {}
            });
          }
        });

        const { data: meetingRows } = await apiClient.get('/meetings/all').catch(() => ({ data: [] }));
        (Array.isArray(meetingRows) ? meetingRows : []).forEach((meeting: any) => {
          const username = meeting.username ?? meeting.user_name;
          if (username) {
            activitiesData.push({
              id: `meeting_${meeting.id ?? meeting.firebase_id}`,
              userId: username,
              userName: getUserDisplayName(username, usersData),
              userEmail: username,
              action: 'meeting_completed',
              description: `Completed meeting with ${(meeting.leadName ?? meeting.lead_name) || 'Unknown Lead'}`,
              leadId: meeting.leadId ?? meeting.lead_id,
              leadName: meeting.leadName ?? meeting.lead_name,
              timestamp: meeting.checkInTime ?? meeting.check_in_time ?? new Date().toISOString(),
              device: 'desktop',
              details: {}
            });
          }
        });

        try {
          const { data: ctaRows } = await apiClient.get('/cta/recent').catch(() => ({ data: [] }));
          (Array.isArray(ctaRows) ? ctaRows : []).forEach((ctaData: any) => {
            activitiesData.push({
              id: ctaData.id ?? ctaData.firebase_id,
              userId: (ctaData.userId ?? ctaData.user_id) || 'Unknown',
              userName: (ctaData.userName ?? ctaData.user_name) || getUserDisplayName((ctaData.userId ?? ctaData.user_id) || 'Unknown', usersData),
              userEmail: (ctaData.userEmail ?? ctaData.user_email) || ctaData.userId || 'Unknown',
              action: ctaData.action,
              description: `Clicked to ${ctaData.action}: ${(ctaData.contactInfo ?? ctaData.contact_info) || 'N/A'}`,
              leadId: ctaData.leadId ?? ctaData.lead_id,
              leadName: ctaData.leadName ?? ctaData.lead_name,
              timestamp: ctaData.timestamp ?? new Date().toISOString(),
              device: (ctaData.device || 'desktop') as 'mobile' | 'desktop',
              details: ctaData.details || {}
            });
          });
          
        } catch (error) {
          console.error('Error fetching CTA activities:', error);
        }

        // Separate CTA activities (call, email, whatsapp)
        const ctaActivitiesData = activitiesData.filter(activity => 
          ['call', 'email', 'whatsapp'].includes(activity.action)
        );
        
        // General activities (everything else)
        const generalActivitiesData = activitiesData.filter(activity => 
          !['call', 'email', 'whatsapp'].includes(activity.action)
        );

        // Sort activities by timestamp (newest first)
        // 🟢 SAFE FIX: Robust sort function
        const sortFn = (a: UserActivity, b: UserActivity) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
        };

        generalActivitiesData.sort(sortFn);
        ctaActivitiesData.sort(sortFn);
        
        if (isMounted) {
            setActivities(generalActivitiesData);
            setCtaActivities(ctaActivitiesData);
        }

      } catch (error) {
        console.error('Error loading usage report data:', error);
        
        // Don't replace sample data if it's already there
        if (activities.length === 0 && isMounted) {
          const { sampleActivities } = createSampleData();
          setActivities(sampleActivities);
          setCtaActivities([]);
        } 
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Always try to load real data if admin
    if (isAdmin) {
      loadData();
    } else {
        // For non-admin, just set loading false (access denied screen handles UI)
        setLoading(false);
    }

    return () => { isMounted = false; };
  }, [isAdmin]);

  // Get current activities based on active tab
  const currentActivities = useMemo(() => {
    return activeTab === 'cta' ? ctaActivities : activities;
  }, [activeTab, ctaActivities, activities]);

  // Filter activities
  const filteredActivities = useMemo(() => {
    
    const filtered = currentActivities.filter(activity => {
      // User filter - handle both email and ID matching
      if (filters.user) {
        const selectedUser = users.find(user => user.id === filters.user);
        if (selectedUser) {
          // Check both email and ID matching
          if (activity.userEmail !== selectedUser.email && activity.userId !== selectedUser.id) {
            return false;
          }
        } else {
          // If user not found by ID, try direct email match
          if (activity.userEmail !== filters.user) {
            return false;
          }
        }
      }
      
      // Action filter
      if (filters.action && activity.action !== filters.action) return false;
      
      // Device filter
      if (filters.device && activity.device !== filters.device) return false;
      
      // Date filters - handle date range properly with validation
      if (filters.dateFrom && activity.timestamp) {
        try {
          const activityDate = new Date(activity.timestamp);
          if (isNaN(activityDate.getTime())) {
            return false; // Skip invalid dates
          }
          const activityDateString = activityDate.toISOString().split('T')[0];
          if (activityDateString < filters.dateFrom) return false;
        } catch (error) {
          return false; // Skip activities with date errors
        }
      }
      
      if (filters.dateTo && activity.timestamp) {
        try {
          const activityDate = new Date(activity.timestamp);
          if (isNaN(activityDate.getTime())) {
            return false; // Skip invalid dates
          }
          const activityDateString = activityDate.toISOString().split('T')[0];
          if (activityDateString > filters.dateTo) return false;
        } catch (error) {
          return false; // Skip activities with date errors
        }
      }
      
      // Search filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const descriptionMatch = (activity.description || '').toLowerCase().includes(searchLower);
        const leadNameMatch = (activity.leadName || '').toLowerCase().includes(searchLower);
        const userNameMatch = (activity.userName || '').toLowerCase().includes(searchLower);
        if (!descriptionMatch && !leadNameMatch && !userNameMatch) return false;
      }
      
      return true;
    });
    
    return filtered;
  }, [currentActivities, filters, users]);

  // Get unique actions for filter dropdown
  const uniqueActions = [...new Set(currentActivities.map(a => a.action))];

  // Clear filters and reset to today
  const clearFilters = () => {
    setFilters({
      user: '',
      action: '',
      device: '',
      dateFrom: today,
      dateTo: today,
      searchTerm: ''
    });
  };

  // Show all data (remove date filters)
  const showAllData = () => {
    setFilters({
      user: '',
      action: '',
      device: '',
      dateFrom: '',
      dateTo: '',
      searchTerm: ''
    });
  };

  const formatTimestamp = (timestamp: string) => {
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return <span className="text-xs text-red-400">Invalid Date</span>;

        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Format absolute time
        const absoluteTime = date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
        });

        // Format relative time
        let relativeTime = '';
        if (diffMins < 1) relativeTime = 'Just now';
        else if (diffMins < 60) relativeTime = `${diffMins}m ago`;
        else if (diffHours < 24) relativeTime = `${diffHours}h ago`;
        else if (diffDays < 7) relativeTime = `${diffDays}d ago`;
        else relativeTime = `${Math.floor(diffDays / 7)}w ago`;

        return (
        <div className="flex flex-col">
            <span className="text-sm font-medium">{relativeTime}</span>
            <span className="text-xs text-slate-400">{absoluteTime}</span>
        </div>
        );
    } catch (e) {
        return <span className="text-xs text-slate-400">Time unavailable</span>;
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold text-slate-600">Access Denied</h2>
        <p className="text-slate-500 mt-2">Only administrators can view usage reports.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <p className="text-slate-500 mt-2">Loading usage report...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full min-w-0 overflow-x-hidden">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">User Activity Report</h2>
        <p className="text-slate-600">Track all user activities across mobile and desktop versions</p>
        
        {/* Tab Navigation */}
        <div className="mt-4 border-b border-slate-200">
          <div className="flex justify-between items-center">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('general')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'general'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                📊 General Activities ({activities.length})
              </button>
              <button
                onClick={() => setActiveTab('cta')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'cta'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                📞 Call-to-Action Activities ({ctaActivities.length})
              </button>
            </nav>
            <div className="flex items-center gap-2">
                {/* Removed Test Buttons for cleaner production UI, can be re-added if debugging needed */}
                <button
                    onClick={() => {
                        setLoading(true);
                        // Force component re-mount/reload effect by toggling a key or similar
                        window.location.reload(); 
                    }}
                    className="px-3 py-1 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 flex items-center gap-1"
                >
                    <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Data
                </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-2xl">📊</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-600">Total Activities</p>
              <p className="text-2xl font-bold text-slate-900">{currentActivities.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <span className="text-2xl">👥</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-600">Active Users</p>
              <p className="text-2xl font-bold text-slate-900">{users.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <span className="text-2xl">📱</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-600">Mobile Activities</p>
              <p className="text-2xl font-bold text-slate-900">{currentActivities.filter(a => a.device === 'mobile').length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <span className="text-2xl">💻</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-slate-600">Desktop Activities</p>
              <p className="text-2xl font-bold text-slate-900">{currentActivities.filter(a => a.device === 'desktop').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 mb-6">
        <h3 className="text-lg font-semibold text-blue-800 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">User</label>
            <select
              value={filters.user}
              onChange={(e) => setFilters(prev => ({ ...prev, user: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Users</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Actions</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>
                  {getActionIcon(action)} {action.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Device</label>
            <select
              value={filters.device}
              onChange={(e) => setFilters(prev => ({ ...prev, device: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Devices</option>
              <option value="mobile">📱 Mobile</option>
              <option value="desktop">💻 Desktop</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">From Date</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">To Date</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Search</label>
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
              placeholder="Search activities..."
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
        
        <div className="mt-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200"
            >
              Clear Filters
            </button>
            <button
              onClick={showAllData}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200"
            >
              Show All Data
            </button>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              Showing {filteredActivities.length} of {currentActivities.length} activities
            </span>
            {(filters.user || filters.action || filters.device || filters.dateFrom || filters.dateTo || filters.searchTerm) && (
              <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                Filters active: {[
                  filters.user && 'User',
                  filters.action && 'Action', 
                  filters.device && 'Device',
                  (filters.dateFrom || filters.dateTo) && 'Date',
                  filters.searchTerm && 'Search'
                ].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activities Table - contain overflow so no full-width strips */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden max-w-full">
        {activeTab === 'cta' ? (
          /* Enhanced CTA Activities Table */
          <div className="overflow-x-auto max-w-full">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Contact Details</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Lead/Agency</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredActivities.map((activity) => (
                  <tr key={activity.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-indigo-600">
                              {(activity.userName || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-slate-900">{activity.userName}</div>
                          <div className="text-sm text-slate-500">{(activity.userEmail || '').split('@')[0]}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${getActionColor(activity.action)}`}>
                          {getActionIcon(activity.action)} {activity.action.toUpperCase()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">
                        {activity.details?.phone && (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-green-600">📞</span>
                            <span className="font-mono text-sm">{activity.details.phone}</span>
                          </div>
                        )}
                        {activity.details?.email && (
                          <div className="flex items-center gap-2">
                            <span className="text-orange-500">📧</span>
                            <span className="text-sm">{activity.details.email}</span>
                          </div>
                        )}
                        {!activity.details?.phone && !activity.details?.email && (
                          <span className="text-slate-500 text-sm">Contact details not available</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-900">{activity.leadName || 'N/A'}</div>
                      {activity.leadId && (
                        <div className="text-xs text-slate-500">ID: {activity.leadId}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getDeviceIcon(activity.device)}</span>
                        <span className="text-sm text-slate-600 capitalize">{activity.device}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatTimestamp(activity.timestamp)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        ✅ Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* General Activities Table */
          <div className="overflow-x-auto max-w-full">
            <table className="min-w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Lead</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Device</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                </tr>
              </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredActivities.map((activity) => (
                <tr key={activity.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-indigo-600">
                            {(activity.userName || '?').charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-slate-900">{activity.userName}</div>
                        <div className="text-sm text-slate-500">{(activity.userEmail || '').split('@')[0]}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActionColor(activity.action)}`}>
                      {getActionIcon(activity.action)} {activity.action.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-900">{activity.description}</div>
                    {activity.details && (
                      <div className="text-xs text-slate-500 mt-1">
                        {activity.details.phone && <span>📞 {activity.details.phone}</span>}
                        {activity.details.email && <span>📧 {activity.details.email}</span>}
                        {activity.details.oldStatus && activity.details.newStatus && (
                          <span>🔄 {activity.details.oldStatus} → {activity.details.newStatus}</span>
                        )}
                        {activity.details.followUpType && <span>📝 {activity.details.followUpType}</span>}
                        {activity.details.meetingDate && (
                          <span>📅 {new Date(activity.details.meetingDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-slate-900">{activity.leadName || 'N/A'}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-lg">{getDeviceIcon(activity.device)}</span>
                    <span className="ml-1 text-sm text-slate-600 capitalize">{activity.device}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                    {formatTimestamp(activity.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
        
        {filteredActivities.length === 0 && (
          <div className="text-center py-8">
            <p className="text-slate-500">No activities found matching your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};