// components/SimpleMapsView.tsx
// SIMPLE Maps View - ONLY attendance data, no clutter

import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

interface SimpleAttendanceData {
  id: string;
  name: string;
  email: string;
  checkInTime: string;
  checkOutTime?: string;
  location: string;
  status: string;
  date: string;
}

const SimpleMapsView: React.FC = () => {
  const [attendanceData, setAttendanceData] = useState<SimpleAttendanceData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // 🟢 SAFE FIX: Robust date formatting helper
  const formatTime = (timeString: string | undefined): string => {
    if (!timeString || timeString === 'Unknown') return 'Unknown';
    try {
      const date = new Date(timeString);
      if (isNaN(date.getTime())) return 'Invalid Time';
      
      return date.toLocaleTimeString('en-IN', { 
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' IST';
    } catch (e) {
      return 'Error';
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/attendance/all');
        if (cancelled) return;
        const rows = Array.isArray(data) ? data : [];
        const attendance: SimpleAttendanceData[] = rows
          .filter((row: any) => selectedDate === 'all' || (row.date ?? row.Date) === selectedDate)
          .map((row: any) => ({
            id: row.id ?? row.firebase_id ?? '',
            name: row.name ?? row.username ?? row.user_name ?? 'Unknown',
            email: row.email ?? row.username ?? 'unknown@email.com',
            checkInTime: row.checkInTime ?? row.check_in_time ?? 'Unknown',
            checkOutTime: row.checkOutTime ?? row.check_out_time,
            location: (row.location?.address ?? row.location ?? row.start_location ?? 'Unknown').toString(),
            status: row.status ?? 'Unknown',
            date: row.date ?? row.Date ?? selectedDate
          }));
        attendance.sort((a, b) => {
            if (a.checkInTime === 'Unknown' && b.checkInTime === 'Unknown') return 0;
            if (a.checkInTime === 'Unknown') return 1;
            if (b.checkInTime === 'Unknown') return -1;
            return b.checkInTime.localeCompare(a.checkInTime);
          });
          
        setAttendanceData(attendance);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Error loading attendance:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedDate]);

  // Refresh function
  const refreshAttendance = () => {
    setIsLoading(true);
    console.log('🔄 Refreshing simple attendance data...');
    
    // Force a fresh fetch by re-triggering the useEffect (hacky but effective for simple views)
    // In a real app, you might want a more sophisticated refetch mechanism
    const currentDate = selectedDate;
    setSelectedDate(''); 
    setTimeout(() => {
        setSelectedDate(currentDate);
        setIsLoading(false);
    }, 100);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200 p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-800">🗺️ Attendance Maps</h2>
            <p className="text-sm text-slate-600">Attendance data only</p>
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={selectedDate === 'all' ? '' : selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <button
              onClick={refreshAttendance}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isLoading ? '🔄 Loading...' : '🔄 Refresh'}
            </button>
            <button
              onClick={() => setSelectedDate('all')}
              className={`px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium ${selectedDate === 'all' ? 'bg-green-700' : 'bg-green-600 hover:bg-green-700'}`}
            >
              📅 All Dates
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span className="text-green-700 font-medium">
              Attendance Records: {attendanceData.length} users
            </span>
          </div>
          {lastUpdate && (
            <div className="text-xs text-green-600 mt-1">
              Last updated: {lastUpdate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {attendanceData.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <div className="text-4xl mb-2">📅</div>
              <p>No attendance records found for {selectedDate === 'all' ? 'any date' : selectedDate}</p>
              <p className="text-sm mt-1">Users need to check in/out</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {attendanceData.map((record) => (
                <div key={record.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${record.checkOutTime ? 'bg-slate-400' : 'bg-green-500'}`}></div>
                      <div>
                        <div className="font-medium text-slate-800">{record.name}</div>
                        <div className="text-sm text-slate-600">{record.email}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-medium ${record.checkOutTime ? 'text-slate-600' : 'text-green-700'}`}>
                        {record.status}
                      </div>
                      <div className="text-xs text-slate-500">{record.date}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm mt-3 pt-3 border-t border-slate-100">
                    <div>
                      <div className="text-slate-500 text-xs uppercase tracking-wide">Check In</div>
                      <div className="font-medium text-slate-800">
                        {formatTime(record.checkInTime)}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs uppercase tracking-wide">Check Out</div>
                      <div className="font-medium text-slate-800">
                        {record.checkOutTime ? 
                          formatTime(record.checkOutTime) : 
                          <span className="text-green-600 italic">Active</span>
                        }
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-slate-500 text-xs uppercase tracking-wide">Location</div>
                      <div className="font-medium text-slate-800 truncate" title={record.location}>{record.location}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleMapsView;