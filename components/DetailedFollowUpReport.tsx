import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../services/apiClient';
import type { CTAActivity } from '../services/ctaTrackingService';
import { getUserDisplayName } from '../utils/dataCleaning';
import { createWhatsAppUrl } from '../utils/whatsappUtils';

interface DetailedFollowUpReportProps {
  currentUser: string | null;
  isAdmin: boolean;
  availableUsers: Array<{id: string, name: string, email: string, role: string}>;
}

interface CallActivity extends CTAActivity {
  callDuration?: number;
  endTimestamp?: string;
}

interface WhatsAppActivity extends CTAActivity {
  messageText?: string;
}

export const DetailedFollowUpReport: React.FC<DetailedFollowUpReportProps> = ({
  currentUser,
  isAdmin,
  availableUsers
}) => {
  const [ctaActivities, setCtaActivities] = useState<CTAActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [userFilter, setUserFilter] = useState<string>('');
  const [activityType, setActivityType] = useState<'all' | 'call' | 'whatsapp'>('all');

  // Load CTA activities
  useEffect(() => {
    if (!currentUser && !isAdmin) return;

    const loadCTAActivities = async () => {
      try {
        setLoading(true);
        const { data } = await apiClient.get('/cta/recent');
        const rows = Array.isArray(data) ? data : [];
        let activities = rows.map((row: any) => ({ id: row.id ?? row.firebase_id, ...row })) as CTAActivity[];
        if (!isAdmin && currentUser) activities = activities.filter(a => (a.userId ?? (a as any).user_id) === currentUser);
        activities.sort((a, b) => new Date((b.timestamp ?? (b as any).created_at)).getTime() - new Date((a.timestamp ?? (a as any).created_at)).getTime());
        setCtaActivities(activities);
      } catch (error) {
        console.error('Error loading CTA activities:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCTAActivities();
  }, [currentUser, isAdmin]);

  // Filter and process activities
  const filteredActivities = useMemo(() => {
    // 🟢 SAFE FIX: Ensure array
    let filtered = Array.isArray(ctaActivities) ? ctaActivities : [];

    // Filter by date range
    filtered = filtered.filter(activity => {
      if (!activity.timestamp) return false;
      const date = new Date(activity.timestamp);
      if (isNaN(date.getTime())) return false; // Invalid date check
      
      const activityDate = date.toISOString().split('T')[0];
      return activityDate >= dateFilter.startDate && activityDate <= dateFilter.endDate;
    });

    // Filter by user
    if (userFilter && userFilter !== 'all') {
      filtered = filtered.filter(activity => activity.userId === userFilter);
    }

    // Filter by activity type
    if (activityType !== 'all') {
      filtered = filtered.filter(activity => activity.action === activityType);
    }

    return filtered;
  }, [ctaActivities, dateFilter, userFilter, activityType]);

  // Get call activities with duration
  const callActivities = useMemo(() => {
    return filteredActivities.filter(activity => activity.action === 'call') as CallActivity[];
  }, [filteredActivities]);

  // Get WhatsApp activities with message content
  const whatsappActivities = useMemo(() => {
    return filteredActivities.filter(activity => activity.action === 'whatsapp') as WhatsAppActivity[];
  }, [filteredActivities]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalCalls = callActivities.length;
    const totalWhatsApp = whatsappActivities.length;
    const totalCallDuration = callActivities.reduce((sum, call) => sum + (Number(call.duration) || 0), 0);
    const avgCallDuration = totalCalls > 0 ? totalCallDuration / totalCalls : 0;

    return {
      totalCalls,
      totalWhatsApp,
      totalCallDuration,
      avgCallDuration: Math.round(avgCallDuration)
    };
  }, [callActivities, whatsappActivities]);

  // Format duration in minutes:seconds
  const formatDuration = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle mobile call initiation
  const handleCall = (phoneNumber: string) => {
    if (!phoneNumber) return;
    
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      // Mobile device - use tel: protocol
      window.open(`tel:${phoneNumber}`, '_self');
    } else {
      // Desktop - copy number or use other method
      navigator.clipboard.writeText(phoneNumber).then(() => {
        alert(`Phone number copied to clipboard: ${phoneNumber}`);
      }).catch(() => {
        alert(`Please call: ${phoneNumber}`);
      });
    }
  };

  // Handle WhatsApp initiation
  const handleWhatsApp = (phoneNumber: string) => {
    if (!phoneNumber) return;
    
    try {
      const whatsappUrl = createWhatsAppUrl(phoneNumber);
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        // Mobile device - open WhatsApp
        window.open(whatsappUrl, '_blank');
      } else {
        // Desktop - open WhatsApp Web (use web.whatsapp.com format)
        const formattedPhone = whatsappUrl.replace('https://wa.me/', '');
        window.open(`https://web.whatsapp.com/send?phone=${formattedPhone}`, '_blank');
      }
    } catch (error) {
      console.error('Error creating WhatsApp URL:', error);
      alert('Invalid phone number. Please ensure the phone number has a valid format.');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading detailed report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Detailed Follow-up Report</h2>
        <div className="text-sm text-gray-600">
          {filteredActivities.length} activities found
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={dateFilter.startDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={dateFilter.endDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">User</label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Users</option>
              {availableUsers.map(user => (
                <option key={user.id} value={user.email}>
                  {getUserDisplayName(user.email, availableUsers)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Activity Type</label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value as 'all' | 'call' | 'whatsapp')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Activities</option>
              <option value="call">Calls Only</option>
              <option value="whatsapp">WhatsApp Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="text-2xl font-bold text-blue-600">{stats.totalCalls}</div>
          <div className="text-sm text-blue-800">Total Calls</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="text-2xl font-bold text-green-600">{stats.totalWhatsApp}</div>
          <div className="text-sm text-green-800">WhatsApp Messages</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="text-2xl font-bold text-purple-600">{formatDuration(stats.totalCallDuration)}</div>
          <div className="text-sm text-purple-800">Total Call Duration</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="text-2xl font-bold text-orange-600">{formatDuration(stats.avgCallDuration)}</div>
          <div className="text-sm text-orange-800">Avg Call Duration</div>
        </div>
      </div>

      {/* Activities Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration/Content
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredActivities.map((activity) => (
                <tr key={activity.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {getUserDisplayName(activity.userEmail, availableUsers)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {activity.action === 'call' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        📞 Call
                      </span>
                    ) : activity.action === 'whatsapp' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        💬 WhatsApp
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        📧 Email
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {activity.contactInfo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="max-w-xs truncate">
                      {activity.leadName || activity.details?.agencyName || 'Unknown'}
                    </div>
                    {activity.details?.contactName && (
                      <div className="text-xs text-gray-500 truncate">
                        {activity.details.contactName}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      {(() => {
                        try {
                          return new Date(activity.timestamp).toLocaleDateString();
                        } catch {
                          return 'Invalid Date';
                        }
                      })()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {(() => {
                        try {
                          return new Date(activity.timestamp).toLocaleTimeString();
                        } catch {
                          return '';
                        }
                      })()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    {activity.action === 'call' ? (
                      <div>
                        {activity.duration !== undefined ? (
                          <div className="font-medium text-blue-600">
                            {formatDuration(Number(activity.duration))}
                          </div>
                        ) : (
                          <div className="text-gray-500">Duration not recorded</div>
                        )}
                      </div>
                    ) : activity.action === 'whatsapp' && activity.messageText ? (
                      <div className="bg-green-50 p-2 rounded border border-green-200">
                        <div className="text-sm text-gray-800 max-w-xs break-words">
                          {activity.messageText}
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-500">No content</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    {activity.action === 'call' ? (
                      <button
                        onClick={() => handleCall(activity.contactInfo)}
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                      >
                        📞 Call
                      </button>
                    ) : activity.action === 'whatsapp' ? (
                      <button
                        onClick={() => handleWhatsApp(activity.contactInfo)}
                        className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                      >
                        💬 WhatsApp
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredActivities.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No activities found for the selected filters.
          </div>
        )}
      </div>
    </div>
  );
};