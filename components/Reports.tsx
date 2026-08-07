import React, { useState, useMemo, useEffect } from 'react';
import type { AttendanceRecord, MeetingCheckInRecord, Lead } from '../types';
import { cleanCorruptedData, getUserDisplayName as utilGetUserDisplayName } from '../utils/dataCleaning';
import { parseToDate } from '../utils/dateTime';
import { MultiSelect } from './MultiSelect';
import { exportMeetingCheckInsToCSV, exportMeetingCheckInsToExcel, exportMeetingCheckInSummary } from '../services/exportService';
import { calculateLocationDistance, formatDistance, getLocationName, getLocationNameFromCoordinates, validateLocationCoordinates } from '../utils/distanceCalculator';
import AgentDashboard from './AgentDashboard';

interface ReportsProps {
  attendanceRecords: AttendanceRecord[];
  meetingCheckInRecords: MeetingCheckInRecord[];
  currentUser: string;
  isAdmin: boolean;
  availableUsers?: Array<{id: string, name: string, email: string, role: string}>;
  leads?: Lead[];
  onViewChange?: (view: string, filters?: any) => void;
  canViewAllDashboardData?: boolean;
}

// Use shared parser; times are displayed in IST via formatTimeIST / formatDateIST
const parseDate = (dateStr: string | undefined): Date => {
  const d = parseToDate(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
};

const formatDateForInput = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

interface ReportCalendarProps {
  activityDays: Set<string>;
  onDateSelect: (date: string) => void;
  calendarDate: Date;
  setCalendarDate: (date: Date) => void;
  attendanceStatusMap: Map<string, 'present' | 'absent' | null>;
  isAdmin: boolean;
}

const ReportCalendar: React.FC<ReportCalendarProps> = ({ activityDays, onDateSelect, calendarDate, setCalendarDate, attendanceStatusMap, isAdmin }) => {
  const startOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
  const endOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
  const startDay = startOfMonth.getDay();
  const daysInMonth = endOfMonth.getDate();

  const days = Array.from({ length: daysInMonth }, (_, i) => new Date(calendarDate.getFullYear(), calendarDate.getMonth(), i + 1));
  const blanks = Array.from({ length: startDay }, () => null);

  const changeMonth = (offset: number) => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + offset, 1));
  };

  return (
    <div className="p-2">
      <div className="flex justify-between items-center mb-4">
        <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-slate-100 text-slate-600" aria-label="Previous month">←</button>
        <h3 className="font-bold text-lg text-slate-800">{calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
        <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-slate-100 text-slate-600" aria-label="Next month">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => <div key={i} className="font-medium text-slate-500 w-9 h-9 flex items-center justify-center">{day}</div>)}
        {blanks.map((_, i) => <div key={`blank-${i}`} />)}
        {days.map(day => {
          const dayString = formatDateForInput(day);
          
          if (!isAdmin) {
            const status = attendanceStatusMap.get(dayString);
            let statusClass = 'hover:bg-indigo-100 text-slate-700'; // default
            if (status === 'present') {
              statusClass = 'bg-green-500 text-white font-bold';
            } else if (status === 'absent') {
              statusClass = 'bg-red-500 text-white font-bold';
            }
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateSelect(dayString)}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors relative ${statusClass}`}
                aria-label={`Select date ${day.getDate()}`}
              >
                <span>{day.getDate()}</span>
              </button>
            );

          } else { // Admin view
            const hasActivity = activityDays.has(dayString);
            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateSelect(dayString)}
                className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors relative hover:bg-indigo-100 text-slate-700`}
                aria-label={`Select date ${day.getDate()}`}
              >
                <span>{day.getDate()}</span>
                {hasActivity && <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-indigo-500"></span>}
              </button>
            )
          }
        })}
      </div>
    </div>
  );
};


export const Reports: React.FC<ReportsProps> = ({
  attendanceRecords = [],
  meetingCheckInRecords = [],
  currentUser,
  isAdmin,
  availableUsers = [],
  leads = [],
  onViewChange,
  canViewAllDashboardData = false
}) => {
  const today = new Date();
  const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [filterStartDate, setFilterStartDate] = useState(formatDateForInput(startOfCurrentMonth));
  const [filterEndDate, setFilterEndDate] = useState(formatDateForInput(endOfCurrentMonth));
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showWorkingHours, setShowWorkingHours] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'attendance' | 'meetings' | 'travel' | 'live-tracking' | 'dashboard'>('attendance');
  
  // Enhanced filter states
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedMeetingTypes, setSelectedMeetingTypes] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState('');
  const [datePreset, setDatePreset] = useState('custom');
  
  // Pagination state for all users
  const [recordsPerPage, setRecordsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Date preset handlers (use separate Date instances so end date is never the same reference as start)
  const applyDatePreset = (preset: string) => {
    const today = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (preset) {
      case 'today':
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        startDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        endDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
        break;
      }
      case 'thisWeek': {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay());
        endDate = new Date(today);
        endDate.setDate(today.getDate() + (6 - today.getDay()));
        break;
      }
      case 'lastWeek': {
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay() - 7);
        endDate = new Date(today);
        endDate.setDate(today.getDate() - today.getDay() - 1);
        break;
      }
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'last30Days':
        startDate = new Date(today);
        startDate.setDate(today.getDate() - 30);
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      default:
        return; // Keep current dates for 'custom'
    }

    setFilterStartDate(formatDateForInput(startDate));
    setFilterEndDate(formatDateForInput(endDate));
    setDatePreset(preset);
  };

  // Force re-render when data changes for real-time updates
  useEffect(() => {
    setRefreshKey(prev => prev + 1);
  }, [attendanceRecords, meetingCheckInRecords]);

  
  const activityDays = useMemo(() => {
    const dates = new Set<string>();
    (attendanceRecords || []).forEach(rec => rec?.date && dates.add(rec.date));
    (meetingCheckInRecords || []).forEach(rec => rec?.date && dates.add(rec.date));
    return dates;
  }, [attendanceRecords, meetingCheckInRecords]);
  
  const attendanceStatusMap = useMemo(() => {
    const map = new Map<string, 'present' | 'absent' | null>();
    if (isAdmin) return map;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const daysInMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate();
    
    const userAttendanceDays = new Set(
      (attendanceRecords || [])
        .filter(rec => rec?.username === currentUser && rec?.date)
        .map(rec => rec.date)
    );

    for (let i = 1; i <= daysInMonth; i++) {
      const day = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), i);
      const dayOfWeek = day.getDay();
      const dayString = formatDateForInput(day);

      if (day > today || dayOfWeek === 0 || dayOfWeek === 6) {
        map.set(dayString, null);
        continue;
      }

      if (userAttendanceDays.has(dayString)) {
        map.set(dayString, 'present');
      } else {
        map.set(dayString, 'absent');
      }
    }

    return map;
  }, [calendarDate, attendanceRecords, currentUser, isAdmin]);

  const normalizedCurrentUser = useMemo(
    () => cleanCorruptedData(currentUser || '').toLowerCase().trim(),
    [currentUser]
  );

  const userIdentifierSet = useMemo(() => {
    const identifiers = new Set<string>();

    if (normalizedCurrentUser) {
      identifiers.add(normalizedCurrentUser);

      if (normalizedCurrentUser.includes('@')) {
        identifiers.add(
          normalizedCurrentUser
            .split('@')[0]
            .replace(/[._]/g, ' ')
            .trim()
        );
      }
    }

    const currentUserRecord = availableUsers.find(user => {
      const normalizedEmail = cleanCorruptedData(user.email || '').toLowerCase().trim();
      const normalizedName = cleanCorruptedData(user.name || '').toLowerCase().trim();
      return (
        (normalizedCurrentUser && normalizedEmail === normalizedCurrentUser) ||
        (normalizedCurrentUser && normalizedName === normalizedCurrentUser)
      );
    });

    if (currentUserRecord) {
      const normalizedEmail = cleanCorruptedData(currentUserRecord.email || '').toLowerCase().trim();
      const normalizedName = cleanCorruptedData(currentUserRecord.name || '').toLowerCase().trim();

      if (normalizedEmail) identifiers.add(normalizedEmail);
      if (normalizedName) identifiers.add(normalizedName);

      if (normalizedName) {
        identifiers.add(
          normalizedName
            .replace(/[._]/g, ' ')
            .trim()
        );
      }
    }

    return identifiers;
  }, [normalizedCurrentUser, availableUsers]);

  const dashboardLeads = useMemo(() => {
    if (!leads || leads.length === 0) {
      return [];
    }

    if (canViewAllDashboardData) {
      return leads;
    }

    const matchesCurrentUser = (value?: string | null) => {
      if (!value) return false;
      const normalizedValue = cleanCorruptedData(value).toLowerCase().trim();
      if (!normalizedValue) return false;
      if (userIdentifierSet.has(normalizedValue)) return true;
      const spacedValue = normalizedValue.replace(/[._]/g, ' ').trim();
      return spacedValue !== '' && userIdentifierSet.has(spacedValue);
    };

    return leads.filter(lead => {
      if (matchesCurrentUser(lead.accountManager)) return true;
      if (matchesCurrentUser(lead.salesPerson)) return true;
      if (matchesCurrentUser(lead.createdBy)) return true;
      if (matchesCurrentUser(lead.onboardedBy)) return true;
      if (matchesCurrentUser((lead as any).assignedTo)) return true;
      return false;
    });
  }, [leads, canViewAllDashboardData, userIdentifierSet]);
  
  const handleDateSelectFromCalendar = (date: string) => {
    setFilterStartDate(date);
    setFilterEndDate(date);
  };

  const filteredAttendance = useMemo(() => {
    const safeRecords = Array.isArray(attendanceRecords) ? attendanceRecords : [];

    let records = safeRecords.filter(rec => {
      const recDate = rec.date;
      const isInRange = recDate >= filterStartDate && recDate <= filterEndDate;
      return isInRange;
    });
    
    if (!isAdmin) {
      records = records.filter(rec => rec.username === currentUser);
    } else if (selectedUsers.length > 0) {
      records = records.filter(rec => selectedUsers.includes(rec.username));
    }
    
    if (selectedRoles.length > 0 && isAdmin) {
      records = records.filter(rec => {
        const user = availableUsers.find(u => u.email === rec.username);
        return user && selectedRoles.includes(user.role);
      });
    }
    
    if (locationFilter) {
      records = records.filter(rec => {
        const location = rec.location?.address || '';
        return location.toLowerCase().includes(locationFilter.toLowerCase());
      });
    }
    
    const sortedRecords = records.sort((a,b) => {
        const timeA = parseDate(a.checkInTime).getTime();
        const timeB = parseDate(b.checkInTime).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
    
    return sortedRecords;
  }, [attendanceRecords, filterStartDate, filterEndDate, isAdmin, currentUser, selectedUsers, selectedRoles, locationFilter, availableUsers]);

  const totalAttendancePages = Math.ceil(filteredAttendance.length / recordsPerPage);
  const attendanceStartIndex = (currentPage - 1) * recordsPerPage;
  const attendanceEndIndex = attendanceStartIndex + recordsPerPage;
  const paginatedAttendance = filteredAttendance.slice(attendanceStartIndex, attendanceEndIndex);

  const filteredMeetingCheckIns = useMemo(() => {
    const safeMeetings = Array.isArray(meetingCheckInRecords) ? meetingCheckInRecords : [];

    let records = safeMeetings.filter(rec => rec.date >= filterStartDate && rec.date <= filterEndDate);
    
    if (!isAdmin) {
      records = records.filter(rec => rec.username === currentUser);
    } else if (selectedUsers.length > 0) {
      records = records.filter(rec => selectedUsers.includes(rec.username));
    }
    
    if (selectedRoles.length > 0 && isAdmin) {
      records = records.filter(rec => {
        const user = availableUsers.find(u => u.email === rec.username);
        return user && selectedRoles.includes(user.role);
      });
    }
    
    if (selectedMeetingTypes.length > 0) {
      records = records.filter(rec => selectedMeetingTypes.includes(rec.meetingType || ''));
    }
    
    if (locationFilter) {
      records = records.filter(rec => {
        const location = rec.location?.address || '';
        return location.toLowerCase().includes(locationFilter.toLowerCase());
      });
    }
    
    const sortedRecords = records.sort((a,b) => {
        const timeA = parseDate(a.checkInTime).getTime();
        const timeB = parseDate(b.checkInTime).getTime();
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });
    
    return sortedRecords;
  }, [meetingCheckInRecords, filterStartDate, filterEndDate, isAdmin, currentUser, selectedUsers, selectedRoles, selectedMeetingTypes, locationFilter, availableUsers]);

  const totalMeetingPages = Math.ceil(filteredMeetingCheckIns.length / recordsPerPage);
  const meetingStartIndex = (currentPage - 1) * recordsPerPage;
  const meetingEndIndex = meetingStartIndex + recordsPerPage;
  
  const pageTitle = isAdmin ? 'Activity Reports' : 'My Activity Report';
  
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStartDate, filterEndDate, selectedUsers, selectedStatuses, selectedRoles, selectedMeetingTypes, locationFilter]);
  
  const availableMeetingTypes = useMemo(() => {
    const types = new Set<string>();
    meetingCheckInRecords.forEach(rec => {
      if (rec.meetingType) types.add(rec.meetingType);
    });
    return Array.from(types).sort();
  }, [meetingCheckInRecords]);
  
  const availableRoles = useMemo(() => {
    const roles = new Set<string>();
    availableUsers.forEach(user => {
      const r = user?.role;
      if (r != null && r !== '') roles.add(String(r));
    });
    return Array.from(roles).sort();
  }, [availableUsers]);
  
  const getUserDisplayName = (emailOrUsername: string): string => {
    return utilGetUserDisplayName(emailOrUsername, availableUsers);
  };
  
  // ✅ FIX 1: SAFETY CLAMP IN SUMMARY
  const attendanceSummary = useMemo(() => {
    const totalDays = filteredAttendance.length;
    const presentDays = filteredAttendance.filter(r => r.status === 'started' || r.action === 'start-day' || r.status === 'present').length;
    
    const totalWorkingHours = filteredAttendance.reduce((total, record) => {
      // Prevents negative numbers from destroying the sum
      return total + Math.max(0, record.workingHours || 0);
    }, 0);

    const averageWorkingHours = totalDays > 0 ? totalWorkingHours / totalDays : 0;
    const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
    
    return {
      totalDays,
      presentDays,
      totalWorkingHours,
      averageWorkingHours,
      attendanceRate
    };
  }, [filteredAttendance]);
  
  // ✅ FIX 2: SAFETY CLAMP IN TRAVEL REPORT
  const travelReportData = useMemo(() => {
    const travelData: Array<{
      username: string;
      date: string;
      startLocation?: { latitude: number; longitude: number; address: string };
      endLocation?: { latitude: number; longitude: number; address: string };
      meetingLocations: Array<{
        time: string;
        location: { latitude: number; longitude: number; address: string };
        meetingType?: string;
        leadName?: string;
      }>;
      totalDistance: number;
      workingHours: number;
      meetingTime: number;
      travelTime: number;
      startTime?: string;
      endTime?: string;
    }> = [];

    const groupedRecords = filteredAttendance.reduce((acc, record) => {
      const key = `${record.username}-${record.date}`;
      if (!acc[key]) {
        acc[key] = {
          username: record.username,
          date: record.date,
          records: []
        };
      }
      acc[key].records.push(record);
      return acc;
    }, {} as Record<string, { username: string; date: string; records: AttendanceRecord[] }>);

    Object.values(groupedRecords).forEach((dayData: { username: string; date: string; records: AttendanceRecord[] }) => {
      const records = dayData.records.sort((a, b) => 
        parseDate(a.checkInTime).getTime() - parseDate(b.checkInTime).getTime()
      );

      const startRecord = records.find(r => String(r.action || '').toLowerCase() === 'start-day');
      const endRecord = records.find(r => String(r.action || '').toLowerCase() === 'end-day');
      
      if (!startRecord) return; 

      const dayMeetings = filteredMeetingCheckIns.filter(meeting => 
        meeting.username === dayData.username && 
        meeting.date === dayData.date
      ).sort((a, b) => parseDate(a.checkInTime).getTime() - parseDate(b.checkInTime).getTime());

      const startLocation = startRecord.startLocation || startRecord.location;
      const endLocation = endRecord?.endLocation || endRecord?.location;

      let totalDistance = 0;
      const allLocations = [];

      if (startLocation) {
        allLocations.push({
          time: startRecord.checkInTime,
          location: startLocation,
          type: 'start'
        });
      }

      dayMeetings.forEach(meeting => {
        if (meeting.location) {
          allLocations.push({
            time: meeting.checkInTime,
            location: meeting.location,
            type: 'meeting',
            meetingType: meeting.meetingType,
            leadName: meeting.leadName
          });
        }
      });

      if (endLocation) {
        allLocations.push({
          time: endRecord!.checkOutTime || endRecord!.checkInTime,
          location: endLocation,
          type: 'end'
        });
      }

      for (let i = 0; i < allLocations.length - 1; i++) {
        const current = allLocations[i];
        const next = allLocations[i + 1];
        if (current.location && next.location) {
            const distance = calculateLocationDistance(current.location, next.location);
            if (!isNaN(distance)) {
                totalDistance += distance;
            }
        }
      }

      let workingHours = 0;
      if (endRecord && endRecord.workingHours) {
        workingHours = Math.max(0, endRecord.workingHours);
      } else if (startRecord) {
        const startTime = parseDate(startRecord.checkInTime);
        const endTime = endRecord ? parseDate(endRecord.checkOutTime || endRecord.checkInTime) : new Date();
        const diff = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        workingHours = isNaN(diff) ? 0 : Math.max(0, diff); // Clamp negative hours
      }

      const meetingTime = dayMeetings.length * 1.0; 
      const travelTime = totalDistance > 0 ? totalDistance / 30 : 0; 

      travelData.push({
        username: dayData.username,
        date: dayData.date,
        startLocation,
        endLocation,
        meetingLocations: dayMeetings.map(meeting => ({
          time: meeting.checkInTime,
          location: meeting.location!,
          meetingType: meeting.meetingType,
          leadName: meeting.leadName
        })),
        totalDistance,
        workingHours,
        meetingTime,
        travelTime,
        startTime: startRecord.checkInTime,
        endTime: endRecord?.checkOutTime ?? endRecord?.checkInTime
      });
    });

    return travelData.sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return a.username.localeCompare(b.username);
    });
  }, [filteredAttendance, filteredMeetingCheckIns]);
  
  const formatDateRangeTitle = () => {
    try {
        const start = new Date(filterStartDate);
        const end = new Date(filterEndDate);
        
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return '';
        }

        start.setMinutes(start.getMinutes() + start.getTimezoneOffset());
        end.setMinutes(end.getMinutes() + end.getTimezoneOffset());
        
        if (filterStartDate === filterEndDate) {
          return `for ${start.toLocaleDateString()}`;
        }
        return `from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`;
    } catch (e) {
        return '';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h2 className="text-3xl font-bold text-slate-800">{pageTitle}</h2>
        <button
          onClick={() => setRefreshKey(prev => prev + 1)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
          title="Refresh reports"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            📊 Attendance Report
          </button>
          <button
            onClick={() => setActiveTab('meetings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'meetings'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            🤝 Meeting Check-ins
          </button>
          <button
            onClick={() => setActiveTab('travel')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'travel'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            🚗 Travel Report
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('live-tracking')}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'live-tracking'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              📱 Live Location Tracker
            </button>
          )}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              activeTab === 'dashboard'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            📊 Agent Dashboard
          </button>
        </nav>
      </div>

      {/* Enhanced Filter Section - Only show for non-dashboard tabs */}
      {activeTab !== 'dashboard' && (
      <div className="bg-white shadow-lg rounded-xl overflow-hidden">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">Filters</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Date Range Presets */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Quick Date Range</label>
              <select
                value={datePreset}
                onChange={(e) => applyDatePreset(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="custom">Custom Range</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="thisWeek">This Week</option>
                <option value="lastWeek">Last Week</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="last30Days">Last 30 Days</option>
              </select>
            </div>

            {/* Custom Date Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">From Date</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={e => {
                  setFilterStartDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">To Date</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={e => {
                  setFilterEndDate(e.target.value);
                  setDatePreset('custom');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Team Members */}
            {isAdmin && availableUsers.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Team Members</label>
                <div className="w-full">
                  <MultiSelect
                    options={availableUsers
                      .filter(user => user?.email != null && user.email !== '')
                      .map(user => ({ 
                        value: String(user.email), 
                        label: `${user?.name ?? 'Unknown'} (${user?.role ?? ''})` 
                      }))}
                    selectedValues={selectedUsers}
                    onChange={setSelectedUsers}
                    placeholder="All Users"
                  />
                </div>
              </div>
            )}

            {/* Roles Filter */}
            {isAdmin && availableRoles.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Roles</label>
                <div className="w-full">
                  <MultiSelect
                    options={availableRoles
                      .filter((role): role is string => role != null && role !== '')
                      .map(role => ({ value: role, label: role }))}
                    selectedValues={selectedRoles}
                    onChange={setSelectedRoles}
                    placeholder="All Roles"
                  />
                </div>
              </div>
            )}

            {/* Meeting Types */}
            {availableMeetingTypes.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Meeting Types</label>
                <div className="w-full">
                  <MultiSelect
                    options={availableMeetingTypes
                      .filter((type): type is string => type != null && type !== '')
                      .map(type => ({ value: type, label: type }))}
                    selectedValues={selectedMeetingTypes}
                    onChange={setSelectedMeetingTypes}
                    placeholder="All Types"
                  />
                </div>
              </div>
            )}

            {/* Location Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Location</label>
              <input
                type="text"
                value={locationFilter}
                onChange={e => setLocationFilter(e.target.value)}
                placeholder="Search by location..."
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* Clear Filters */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700"> </label>
              <button
                onClick={() => {
                  setSelectedUsers([]);
                  setSelectedRoles([]);
                  setSelectedMeetingTypes([]);
                  setLocationFilter('');
                  setDatePreset('thisMonth');
                  applyDatePreset('thisMonth');
                }}
                className="w-full px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Tab Content */}
      {activeTab === 'attendance' && (
        <>
          {/* Working Hours Summary */}
          {showWorkingHours && (
            <div className="bg-white shadow-lg rounded-xl overflow-hidden">
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-800 mb-4">Working Hours Summary {formatDateRangeTitle()}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{attendanceSummary.totalDays}</div>
                    <div className="text-sm text-blue-800">Total Days</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{attendanceSummary.presentDays}</div>
                    <div className="text-sm text-green-800">Present Days</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{attendanceSummary.totalWorkingHours.toFixed(1)}h</div>
                    <div className="text-sm text-purple-800">Total Hours</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{attendanceSummary.averageWorkingHours.toFixed(1)}h</div>
                    <div className="text-sm text-orange-800">Avg Hours/Day</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Attendance Rate:</span>
                    <span className="font-semibold text-slate-800">{attendanceSummary.attendanceRate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${attendanceSummary.attendanceRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <ReportCalendar 
              activityDays={activityDays} 
              onDateSelect={handleDateSelectFromCalendar}
              calendarDate={calendarDate}
              setCalendarDate={setCalendarDate}
              attendanceStatusMap={attendanceStatusMap}
              isAdmin={isAdmin}
            />
          </div>

          {/* Daily Attendance Report - Compact View */}
          <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-xl font-bold text-slate-800">Daily Attendance Summary <span className="text-base font-normal text-slate-600">{formatDateRangeTitle()}</span></h3>
                {filteredAttendance.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const csvContent = [
                          ['Username', 'Email', 'Date', 'Start Time', 'End Time', 'Total Hours', 'Location', 'Status'],
                          ...filteredAttendance.map(rec => {
                            const startRecord = String(rec.action || '').toLowerCase() === 'start-day' ? rec : null;
                            const endRecord = String(rec.action || '').toLowerCase() === 'end-day' ? rec : null;
                            const startTime = startRecord ? parseDate(startRecord.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '-';
                            const endTime = endRecord ? parseDate(endRecord.checkOutTime || endRecord.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '-';
                            const location = rec.location?.address || rec.startLocation?.address || '-';
                            return [getUserDisplayName(rec.username), cleanCorruptedData(rec.username), rec.date, startTime, endTime, '-', location, rec.status];
                          })
                        ].map(row => row.join(',')).join('\n');
                        
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `attendance-report-${filterStartDate}-to-${filterEndDate}.csv`;
                        a.click();
                        window.URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export CSV
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="overflow-x-auto">
              {filteredAttendance.length > 0 ? (
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Username</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Start Time</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">End Time</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Total Hours</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Start Location</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">End Location</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Google Maps</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {(() => {
                      const groupedRecords = paginatedAttendance.reduce((acc, rec) => {
                        const key = `${rec.username}-${rec.date}`;
                        if (!acc[key]) {
                          acc[key] = {
                            username: rec.username,
                            date: rec.date,
                            records: []
                          };
                        }
                        acc[key].records.push(rec);
                        return acc;
                      }, {} as Record<string, { username: string; date: string; records: AttendanceRecord[] }>);

                      const timeFmt = (dateStr: string | undefined) => dateStr ? parseDate(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '-';
                      const locDisplay = (loc: { address?: string; latitude?: number; longitude?: number } | undefined, fallback: string) => {
                        if (!loc) return { address: fallback, coords: '' };
                        const address = loc.address && loc.address.length > 5 ? loc.address : (loc.latitude != null && loc.longitude != null && validateLocationCoordinates(loc.latitude, loc.longitude).isValid ? getLocationNameFromCoordinates(loc.latitude, loc.longitude) : fallback);
                        const coords = loc.latitude != null && loc.longitude != null ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}` : '';
                        return { address, coords };
                      };

                      return Object.values(groupedRecords).map((dayData: { username: string; date: string; records: AttendanceRecord[] }, index) => {
                        const records = dayData.records.sort((a, b) => 
                          parseDate(a.checkInTime).getTime() - parseDate(b.checkInTime).getTime()
                        );

                        const startRecords = records.filter(r => String(r.action || '').toLowerCase() === 'start-day');
                        const endRecords = records.filter(r => String(r.action || '').toLowerCase() === 'end-day');
                        const startRecord = startRecords.length > 0 ? startRecords.sort((a, b) => parseDate(b.checkInTime).getTime() - parseDate(a.checkInTime).getTime())[0] : null;
                        const endRecord = endRecords.length > 0 ? endRecords.sort((a, b) => parseDate(b.checkOutTime || b.checkInTime).getTime() - parseDate(a.checkOutTime || a.checkInTime).getTime())[0] : null;

                        // Single record per day (one row with both check-in and check-out): use its fields for both start and end columns
                        const singleRecord = records.length === 1 ? records[0] : null;
                        let startTime: string;
                        let endTime: string;
                        let totalHours: string;
                        let startLocation: string;
                        let startCoordinates: string;
                        let endLocation: string;
                        let endCoordinates: string;

                        if (singleRecord) {
                          startTime = timeFmt(singleRecord.checkInTime);
                          const endTimeVal = singleRecord.checkOutTime ?? (String(singleRecord.action || '').toLowerCase() === 'end-day' ? singleRecord.checkInTime : undefined);
                          endTime = endTimeVal ? timeFmt(endTimeVal) : '-';
                          const start = singleRecord.checkInTime ? parseDate(singleRecord.checkInTime) : null;
                          const end = endTimeVal ? parseDate(endTimeVal) : null;
                          if (singleRecord.workingHours != null && singleRecord.workingHours > 0) {
                            totalHours = `${Math.max(0, singleRecord.workingHours).toFixed(1)}h`;
                          } else if (start && end) {
                            const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                            totalHours = isNaN(diffHours) ? '-' : `${Math.max(0, diffHours).toFixed(1)}h`;
                          } else {
                            totalHours = '-';
                          }
                          const startLoc = singleRecord.startLocation || singleRecord.location;
                          const endLoc = singleRecord.endLocation;
                          const s = locDisplay(startLoc?.address ? { ...startLoc, address: startLoc.address } : startLoc, '-');
                          const e = locDisplay(endLoc?.address ? { ...endLoc, address: endLoc.address } : endLoc, '-');
                          startLocation = s.address;
                          startCoordinates = s.coords;
                          endLocation = e.address;
                          endCoordinates = e.coords;
                        } else {
                          startTime = startRecord ? timeFmt(startRecord.checkInTime) : '-';
                          endTime = endRecord ? timeFmt(endRecord.checkOutTime || endRecord.checkInTime) : '-';
                          totalHours = '-';
                          if (startRecord && endRecord) {
                            const start = parseDate(startRecord.checkInTime);
                            const end = parseDate(endRecord.checkOutTime || endRecord.checkInTime);
                            const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                            totalHours = isNaN(diffHours) ? '-' : `${Math.max(0, diffHours).toFixed(1)}h`;
                          }
                          const s = locDisplay(startRecord?.startLocation || startRecord?.location, '-');
                          // End-day row may have end location in endLocation, location, or startLocation (when stored there)
                          const endRecordLoc = endRecord?.endLocation || endRecord?.location || (String(endRecord?.action || '').toLowerCase() === 'end-day' ? endRecord?.startLocation : null);
                          const e = locDisplay(endRecordLoc, '-');
                          startLocation = s.address;
                          startCoordinates = s.coords;
                          endLocation = e.address;
                          endCoordinates = e.coords;
                        }

                        const hasStart = !!startRecord || !!(singleRecord && singleRecord.checkInTime);
                        const hasEnd = !!endRecord || !!(singleRecord && singleRecord.checkOutTime);
                        const recordForStartMap = singleRecord ? singleRecord : startRecord;
                        const recordForEndMap = singleRecord ? singleRecord : endRecord;
                        const startMapLoc = recordForStartMap?.startLocation || recordForStartMap?.location;
                        const endMapLoc = recordForEndMap?.endLocation || (String(recordForEndMap?.action || '').toLowerCase() === 'end-day' ? recordForEndMap?.startLocation : null);
                        let status = 'Incomplete';
                        let statusColor = 'bg-gray-100 text-gray-800';
                        
                        if (hasStart && hasEnd) {
                          status = 'Complete';
                          statusColor = 'bg-green-100 text-green-800';
                        } else if (hasStart && !hasEnd) {
                          status = 'Active';
                          statusColor = 'bg-yellow-100 text-yellow-800';
                        }

                        return (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">
                              <div>
                                <div className="font-medium">{getUserDisplayName(dayData.username)}</div>
                                <div className="text-xs text-slate-500">{cleanCorruptedData(dayData.username).split('@')[0]}</div>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                              {new Date(dayData.date + 'T00:00:00').toLocaleDateString('en-IN', { 
                                timeZone: 'Asia/Kolkata',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 font-medium">
                              {startTime}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 font-medium">
                              {endTime}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500 font-medium">
                              {totalHours}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-500 max-w-xs">
                              <div className="truncate" title={`${startLocation} - ${startCoordinates}`}>
                                <div className="font-medium text-slate-900 flex items-center gap-1">
                                  <svg className="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                  </svg>
                                  {startLocation}
                                </div>
                                {startCoordinates && (
                                  <div className="text-xs text-slate-500 mt-1 font-mono">
                                    📍 {startCoordinates}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-500 max-w-xs">
                              <div className="truncate" title={`${endLocation} - ${endCoordinates}`}>
                                <div className="font-medium text-slate-900 flex items-center gap-1">
                                  <svg className="h-3 w-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                                  </svg>
                                  {endLocation}
                                </div>
                                {endCoordinates && (
                                  <div className="text-xs text-slate-500 mt-1 font-mono">
                                    📍 {endCoordinates}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor}`}>
                                {status}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">
                              <div className="flex flex-col gap-1">
                                {startMapLoc?.latitude != null && startMapLoc?.longitude != null ? (
                                  <a
                                    href={`https://www.google.com/maps?q=${startMapLoc.latitude},${startMapLoc.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
                                  >
                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                    </svg>
                                    Start
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-400">No start location</span>
                                )}
                                {endMapLoc?.latitude != null && endMapLoc?.longitude != null ? (
                                  <a
                                    href={`https://www.google.com/maps?q=${endMapLoc.latitude},${endMapLoc.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                                  >
                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                    </svg>
                                    End
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-400">No end location</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-slate-500 p-12">No attendance records for this date range.</p>
              )}
            </div>
            
            {/* Pagination Controls for Attendance - Always show for all users */}
            {filteredAttendance.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 shadow-sm mt-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  {/* Left side - Info and items per page */}
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-600">
                      Showing {attendanceStartIndex + 1}-{Math.min(attendanceEndIndex, filteredAttendance.length)} of {filteredAttendance.length} attendance records
                    </div>
                    
                    {/* Items per page selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">Show</span>
                      <select
                        value={recordsPerPage}
                        onChange={(e) => setRecordsPerPage(parseInt(e.target.value))}
                        className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                      <span className="text-sm text-slate-600">per page</span>
                    </div>
                  </div>

                  {/* Right side - Navigation */}
                  <div className="flex items-center gap-2">
                    {totalAttendancePages > 1 ? (
                      <>
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                        >
                          Previous
                        </button>
                        
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalAttendancePages) }, (_, i) => {
                            let pageNum;
                            if (totalAttendancePages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalAttendancePages - 2) {
                              pageNum = totalAttendancePages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setCurrentPage(pageNum)}
                                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                                  currentPage === pageNum
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}
                        </div>
                        
                        <button
                          onClick={() => setCurrentPage(Math.min(totalAttendancePages, currentPage + 1))}
                          disabled={currentPage === totalAttendancePages}
                          className="px-3 py-1 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <span>Page 1 of 1</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'meetings' && (
        <>
          {/* Meeting Check-in Summary */}
          <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Meeting Check-in Summary {formatDateRangeTitle()}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{filteredMeetingCheckIns.length}</div>
                  <div className="text-sm text-blue-800">Total Meetings</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {new Set(filteredMeetingCheckIns.map(rec => rec.salesPersonName || getUserDisplayName(rec.username))).size}
                  </div>
                  <div className="text-sm text-green-800">Active Sales People</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {new Set(filteredMeetingCheckIns.map(rec => rec.meetingType)).size}
                  </div>
                  <div className="text-sm text-purple-800">Meeting Types</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {new Set(filteredMeetingCheckIns.map(rec => rec.leadName).filter(Boolean)).size}
                  </div>
                  <div className="text-sm text-orange-800">Unique Leads</div>
                </div>
              </div>
            </div>
          </div>

          {/* Meeting Check-in Report */}
          <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Detailed Meeting Check-in Report <span className="text-base font-normal text-slate-600">{formatDateRangeTitle()}</span></h3>
                  {filteredMeetingCheckIns.length > 0 && (
                    <div className="mt-2 text-sm text-slate-600">
                      Total Meetings: {filteredMeetingCheckIns.length} | 
                      Total Duration: {filteredMeetingCheckIns.reduce((total, rec) => total + (rec.meetingDuration || 0), 0)} minutes | 
                      Active Meetings: {filteredMeetingCheckIns.filter(rec => rec.meetingStatus === 'active').length}
                    </div>
                  )}
                </div>
                {filteredMeetingCheckIns.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => exportMeetingCheckInsToCSV(filteredMeetingCheckIns)}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export CSV
                    </button>
                    <button
                      onClick={() => exportMeetingCheckInsToExcel(filteredMeetingCheckIns)}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export Excel
                    </button>
                    <button
                      onClick={() => exportMeetingCheckInSummary(filteredMeetingCheckIns)}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Summary
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
               {filteredMeetingCheckIns.length > 0 ? (
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      {isAdmin && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>}
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Sales Person</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Meeting Type</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Lead/Agency</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Start Time</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">End Time</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Duration</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {filteredMeetingCheckIns.map((rec, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        {isAdmin && <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{getUserDisplayName(rec.username)}</td>}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{rec.salesPersonName || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {new Date(rec.date + 'T00:00:00').toLocaleDateString('en-IN', { 
                            timeZone: 'Asia/Kolkata',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {rec.meetingType || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{rec.leadName || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {rec.location?.address ? (
                            <div>
                              <div className="font-medium text-slate-900">{rec.location.address}</div>
                              {rec.location.latitude && rec.location.longitude && (
                                <div className="text-xs text-slate-500 mt-1 font-mono">
                                  📍 {rec.location.latitude.toFixed(4)}, {rec.location.longitude.toFixed(4)}
                                </div>
                              )}
                            </div>
                          ) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {parseDate(rec.checkInTime).toLocaleTimeString('en-IN', { 
                            timeZone: 'Asia/Kolkata',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {rec.checkOutTime ? parseDate(rec.checkOutTime).toLocaleTimeString('en-IN', { 
                            timeZone: 'Asia/Kolkata',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {rec.meetingDuration ? (
                            <span className="font-medium text-slate-900">
                              {rec.meetingDuration} min
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {rec.meetingStatus === 'completed' ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Completed
                            </span>
                          ) : rec.meetingStatus === 'active' ? (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                              Unknown
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 max-w-xs">
                          {rec.notes ? (
                            <div className="truncate" title={rec.notes}>
                              {rec.notes}
                            </div>
                          ) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
               ) : (
                   <p className="text-center text-slate-500 p-12">No meeting check-in records for this date range.</p>
               )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'travel' && (
        <>
          {/* Travel Report Summary */}
          <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-800 mb-4">Travel Report Summary {formatDateRangeTitle()}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{travelReportData.length}</div>
                  <div className="text-sm text-blue-800">Travel Days</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {formatDistance(travelReportData.reduce((total, day) => total + day.totalDistance, 0))}
                  </div>
                  <div className="text-sm text-green-800">Total Distance</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {travelReportData.reduce((total, day) => total + day.meetingLocations.length, 0)}
                  </div>
                  <div className="text-sm text-purple-800">Total Meetings</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {travelReportData.length > 0 ? formatDistance(travelReportData.reduce((total, day) => total + day.totalDistance, 0) / travelReportData.length) : '0km'}
                  </div>
                  <div className="text-sm text-orange-800">Avg Distance/Day</div>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Travel Report */}
          <div className="bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-xl font-bold text-slate-800">Detailed Travel Report <span className="text-base font-normal text-slate-600">{formatDateRangeTitle()}</span></h3>
                {travelReportData.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const csvContent = [
                          ['Username', 'Date', 'Start Time', 'End Time', 'Start Location', 'End Location', 'Total Distance', 'Working Hours', 'Meeting Time', 'Travel Time', 'Meetings Count'],
                          ...travelReportData.map(day => [
                            getUserDisplayName(day.username),
                            new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
                            day.startTime ? parseDate(day.startTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '-',
                            day.endTime ? parseDate(day.endTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : '-',
                            getLocationName(day.startLocation),
                            getLocationName(day.endLocation),
                            formatDistance(day.totalDistance),
                            `${day.workingHours.toFixed(1)}h`,
                            `${day.meetingTime.toFixed(1)}h`,
                            `${day.travelTime.toFixed(1)}h`,
                            day.meetingLocations.length.toString()
                          ])
                        ];
                        const csv = csvContent.map(row => row.join(',')).join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `travel-report-${filterStartDate}-to-${filterEndDate}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export CSV
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              {travelReportData.length > 0 ? (
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Start Time</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">End Time</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Start Location</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">End Location</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Distance</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Working Hours</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Meeting Time</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Travel Time</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Meetings</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Route</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {travelReportData.map((day, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                          <div>
                            <div className="font-medium">{getUserDisplayName(day.username)}</div>
                            <div className="text-xs text-slate-500">{cleanCorruptedData(day.username)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {new Date(day.date + 'T00:00:00').toLocaleDateString('en-IN', { 
                            timeZone: 'Asia/Kolkata',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                          {day.startTime ? parseDate(day.startTime).toLocaleTimeString('en-IN', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            timeZone: 'Asia/Kolkata'
                          }) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                          {day.endTime ? parseDate(day.endTime).toLocaleTimeString('en-IN', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            timeZone: 'Asia/Kolkata'
                          }) : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 max-w-xs">
                          <div className="truncate" title={getLocationName(day.startLocation)}>
                            <div className="font-medium text-slate-900 flex items-center gap-1">
                              <svg className="h-3 w-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                              {getLocationName(day.startLocation)}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500 max-w-xs">
                          <div className="truncate" title={getLocationName(day.endLocation)}>
                            <div className="font-medium text-slate-900 flex items-center gap-1">
                              <svg className="h-3 w-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                              {getLocationName(day.endLocation)}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {formatDistance(day.totalDistance)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                          {day.workingHours.toFixed(1)}h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {day.meetingTime.toFixed(1)}h
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {day.travelTime.toFixed(1)}h
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {day.meetingLocations.length} meetings
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          <div className="flex flex-col gap-1">
                            {day.startLocation && (
                              <a
                                href={`https://www.google.com/maps?q=${day.startLocation.latitude},${day.startLocation.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-600 bg-green-50 rounded-md hover:bg-green-100 transition-colors"
                              >
                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                </svg>
                                Start
                              </a>
                            )}
                            {day.endLocation && (
                              <a
                                href={`https://www.google.com/maps?q=${day.endLocation.latitude},${day.endLocation.longitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                              >
                                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                </svg>
                                End
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center text-slate-500 p-12">No travel data available for this date range.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Agent Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <AgentDashboard 
            leads={dashboardLeads}
            availableUsers={availableUsers}
            onViewChange={onViewChange}
            showAccountManagerFilter={canViewAllDashboardData}
          />
        </div>
      )}

      {/* Live Location Tracker Tab - Disabled */}
      {activeTab === 'live-tracking' && isAdmin && (
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="text-yellow-600 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">Live GPS Tracking Disabled</h2>
            <p className="text-yellow-600">Live GPS tracking has been disabled to resolve location fetching errors. The attendance and meeting systems with location capture are still functional.</p>
          </div>
        </div>
      )}
    </div>
  );
};