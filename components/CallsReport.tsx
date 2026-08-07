import React, { useState, useEffect } from 'react';
import type { CallLog, Lead } from '../types';
import apiClient from '../services/apiClient';

interface CallsReportProps {
  currentUser: string;
  isAdmin: boolean;
  availableUsers?: Array<{id: string, name: string, email: string, role: string}>;
}

export const CallsReport: React.FC<CallsReportProps> = ({
  currentUser,
  isAdmin,
  availableUsers = []
}) => {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]); // Kept for potential future use
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [filterCallType, setFilterCallType] = useState<'all' | 'lead' | 'non-lead'>('all');
  const [filterLeadName, setFilterLeadName] = useState<string>('');
  const [filterUser, setFilterUser] = useState<string>(isAdmin ? 'all' : currentUser);
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterOutcome, setFilterOutcome] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [currentUser, filterUser]);

  const mapCallRow = (row: any): CallLog => ({
    id: row.id ?? '',
    phoneNumber: row.phone_number ?? row.phoneNumber ?? '',
    leadId: row.lead_id ?? row.leadId ?? null,
    leadName: row.lead_name ?? row.leadName ?? '',
    contactName: row.contact_name ?? row.contactName ?? '',
    callType: row.call_type ?? row.callType ?? 'non-lead',
    timestamp: row.timestamp ?? row.created_at ?? new Date().toISOString(),
    duration: typeof row.duration === 'number' ? row.duration : Number(row.duration) || 0,
    notes: row.notes ?? '',
    outcome: row.outcome ?? 'other',
    userId: row.user_id ?? row.userId ?? '',
    userEmail: row.user_email ?? row.userEmail ?? '',
    userName: row.user_name ?? row.userName ?? '',
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: callsRows } = await apiClient.get('/call-logs');
      let callsData: CallLog[] = (Array.isArray(callsRows) ? callsRows : []).map(mapCallRow);
      if (isAdmin && filterUser !== 'all') {
        callsData = callsData.filter(c => c.userEmail === filterUser);
      } else if (!isAdmin) {
        callsData = callsData.filter(c => c.userEmail === currentUser);
      }
      callsData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setCallLogs(callsData);

      try {
        const { data: leadsRows } = await apiClient.get('/leads/all');
        setLeads(Array.isArray(leadsRows) ? leadsRows : []);
      } catch (leadError) {
        console.warn('Could not load leads for reference (non-critical):', leadError);
      }
    } catch (error) {
      console.error('Error loading call logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCalls = callLogs.filter(call => {
    // Filter by call type
    if (filterCallType !== 'all' && call.callType !== filterCallType) return false;
    
    // 🟢 SAFE FIX: Handle undefined/null leadName
    if (filterLeadName) {
      const safeName = (call.leadName || '').toLowerCase();
      if (!safeName.includes(filterLeadName.toLowerCase())) return false;
    }
    
    // 🟢 SAFE FIX: Validate date before comparison
    const callDate = new Date(call.timestamp);
    if (isNaN(callDate.getTime())) return false; // Skip invalid dates

    // Filter by date from
    if (filterDateFrom) {
       const fromDate = new Date(filterDateFrom);
       if (callDate < fromDate) return false;
    }
    
    // Filter by date to
    if (filterDateTo) {
       const toDate = new Date(filterDateTo + 'T23:59:59');
       if (callDate > toDate) return false;
    }
    
    // Filter by outcome
    if (filterOutcome !== 'all' && call.outcome !== filterOutcome) return false;
    
    return true;
  });

  // Calculate statistics
  const stats = {
    totalCalls: filteredCalls.length,
    leadCalls: filteredCalls.filter(c => c.callType === 'lead').length,
    nonLeadCalls: filteredCalls.filter(c => c.callType === 'non-lead').length,
    // 🟢 SAFE FIX: Duration is guaranteed number from loadData
    totalDuration: filteredCalls.reduce((sum, c) => sum + c.duration, 0),
    answeredCalls: filteredCalls.filter(c => c.outcome === 'answered').length,
    avgDuration: filteredCalls.length > 0 
      ? filteredCalls.reduce((sum, c) => sum + c.duration, 0) / filteredCalls.length 
      : 0
  };

  const formatDuration = (seconds: number) => {
    // 🟢 SAFE FIX: Handle NaN or infinite
    if (!Number.isFinite(seconds)) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'answered': return '✅';
      case 'no-answer': return '📵';
      case 'busy': return '🔴';
      case 'voicemail': return '📧';
      default: return '❓';
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'answered': return 'bg-green-100 text-green-800 border-green-300';
      case 'no-answer': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'busy': return 'bg-red-100 text-red-800 border-red-300';
      case 'voicemail': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading call logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">📞 Calls Report</h1>
          <p className="text-slate-600 mt-1">Track and analyze all calls made through the system</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-lg shadow-lg">
          <div className="text-sm font-semibold opacity-90">Total Calls</div>
          <div className="text-3xl font-bold mt-1">{stats.totalCalls}</div>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-4 rounded-lg shadow-lg">
          <div className="text-sm font-semibold opacity-90">Lead Calls</div>
          <div className="text-3xl font-bold mt-1">{stats.leadCalls}</div>
        </div>
        
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-lg shadow-lg">
          <div className="text-sm font-semibold opacity-90">Non-Lead Calls</div>
          <div className="text-3xl font-bold mt-1">{stats.nonLeadCalls}</div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-4 rounded-lg shadow-lg">
          <div className="text-sm font-semibold opacity-90">Total Duration</div>
          <div className="text-3xl font-bold mt-1">{formatDuration(stats.totalDuration)}</div>
        </div>
        
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-4 rounded-lg shadow-lg">
          <div className="text-sm font-semibold opacity-90">Answered</div>
          <div className="text-3xl font-bold mt-1">{stats.answeredCalls}</div>
        </div>
        
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 text-white p-4 rounded-lg shadow-lg">
          <div className="text-sm font-semibold opacity-90">Avg Duration</div>
          <div className="text-3xl font-bold mt-1">{formatDuration(Math.round(stats.avgDuration))}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-300">
        <h2 className="text-lg font-bold text-slate-800 mb-4">🔍 Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Call Type Filter */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Call Type</label>
            <select
              value={filterCallType}
              onChange={(e) => setFilterCallType(e.target.value as any)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-indigo-500"
            >
              <option value="all">All Calls</option>
              <option value="lead">Lead Calls Only</option>
              <option value="non-lead">Non-Lead Calls Only</option>
            </select>
          </div>

          {/* Lead Name Filter */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Lead Name</label>
            <input
              type="text"
              value={filterLeadName}
              onChange={(e) => setFilterLeadName(e.target.value)}
              placeholder="Search by lead name..."
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-indigo-500"
            />
          </div>

          {/* User Filter (Admin only) */}
          {isAdmin && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">User</label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-indigo-500"
              >
                <option value="all">All Users</option>
                {availableUsers.map(user => (
                  <option key={user.id} value={user.email}>{user.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date From */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">From Date</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-indigo-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">To Date</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-indigo-500"
            />
          </div>

          {/* Outcome Filter */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Outcome</label>
            <select
              value={filterOutcome}
              onChange={(e) => setFilterOutcome(e.target.value)}
              className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:border-indigo-500"
            >
              <option value="all">All Outcomes</option>
              <option value="answered">Answered</option>
              <option value="no-answer">No Answer</option>
              <option value="busy">Busy</option>
              <option value="voicemail">Voicemail</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        <div className="mt-4">
          <button
            onClick={() => {
              setFilterCallType('all');
              setFilterLeadName('');
              setFilterUser(isAdmin ? 'all' : currentUser);
              setFilterDateFrom('');
              setFilterDateTo('');
              setFilterOutcome('all');
            }}
            className="px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            ✖️ Clear All Filters
          </button>
        </div>
      </div>

      {/* Call Logs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-bold">Date & Time</th>
                <th className="px-4 py-3 text-left text-sm font-bold">Phone Number</th>
                <th className="px-4 py-3 text-left text-sm font-bold">Type</th>
                <th className="px-4 py-3 text-left text-sm font-bold">Lead/Contact</th>
                <th className="px-4 py-3 text-left text-sm font-bold">Duration</th>
                <th className="px-4 py-3 text-left text-sm font-bold">Outcome</th>
                <th className="px-4 py-3 text-left text-sm font-bold">User</th>
                <th className="px-4 py-3 text-left text-sm font-bold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCalls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No call logs found. Calls will appear here after you make them through the app.
                  </td>
                </tr>
              ) : (
                filteredCalls.map(call => (
                  <tr key={call.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {formatDateTime(call.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono font-semibold text-indigo-600">
                      {call.phoneNumber}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        call.callType === 'lead' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {call.callType === 'lead' ? '📋 Lead' : '📞 Non-Lead'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {call.leadName && <div className="font-semibold">{call.leadName}</div>}
                      {call.contactName && <div className="text-slate-600">{call.contactName}</div>}
                      {!call.leadName && !call.contactName && <span className="text-slate-400 italic">N/A</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {formatDuration(call.duration)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getOutcomeColor(call.outcome || 'other')}`}>
                        {getOutcomeIcon(call.outcome || 'other')} {call.outcome || 'other'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {call.userName}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                      {call.notes || <span className="text-slate-400 italic">No notes</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};