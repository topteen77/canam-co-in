import React, { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { addAttendanceRecord } from '../services/attendanceService';
import { formatTimeIST } from '../utils/dateTime';
import type { AttendanceRecord, AttendanceStatus, AttendanceAction } from '../types';

interface AttendanceTrackerProps {
  currentUser: string;
  isOpen?: boolean;
  onClose?: () => void;
  onAttendanceUpdate: () => void;
  attendanceRecords?: AttendanceRecord[];
}

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
}

const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({
  currentUser,
  isOpen: propIsOpen = false,
  onClose,
  onAttendanceUpdate,
  attendanceRecords = []
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<AttendanceStatus | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord[]>([]);
  const [isOpen, setIsOpen] = useState(propIsOpen);
  const [timerTick, setTimerTick] = useState(0);

  useEffect(() => { setIsOpen(propIsOpen); }, [propIsOpen]);

  // Load location when modal opens (for display and for start/end day)
  useEffect(() => {
    if (isOpen && !location) {
      setIsLoadingLocation(true);
      getCurrentLocation()
        .then(setLocation)
        .catch(() => setLocation(null))
        .finally(() => setIsLoadingLocation(false));
    }
  }, [isOpen]);

  // --- GEOCODING ---
  const getDetailedAddressFromCoords = async (lat: number, lng: number): Promise<string> => {
    try {
      const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "YOUR_API_KEY";

      if (GOOGLE_API_KEY && GOOGLE_API_KEY !== "YOUR_API_KEY") {
        const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`);
        const data = await response.json();
        if (data.status === "OK" && data.results && data.results.length > 0) {
          return data.results[0].formatted_address;
        }
      }

      // Fallback to OpenStreetMap if Google API fails or is not configured
      const osmResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const osmData = await osmResponse.json();
      if (osmData && osmData.display_name) {
        return osmData.display_name;
      }

      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (e) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const getCurrentLocation = async (): Promise<LocationData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const address = await getDetailedAddressFromCoords(latitude, longitude);
            resolve({ latitude, longitude, address });
          } catch {
            resolve({ latitude, longitude, address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` });
          }
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  };

  // --- LOAD STATUS ---
  const loadTodayAttendance = () => {
    try {
      const now = new Date();
      // YYYY-MM-DD in user's local timezone (match what we send on check-in)
      const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
      const localDate = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const safeRecords = Array.isArray(attendanceRecords) ? attendanceRecords : [];

      const records = safeRecords
        .filter(record => {
          if (record.username !== currentUser) return false;
          const recDate = record.date || record.checkInTime || '';
          // Match records that start with today's date
          return recDate.startsWith(localDate);
        })
        .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());

      setTodayAttendance(records);

      if (records.length > 0) {
        const latest = records[0];
        const actionLower = String(latest.action || '').toLowerCase();
        const statusLower = String(latest.status || '').toLowerCase();
        // If latest record has checkOutTime or is end-day, it is ENDED
        if (latest.status === 'ended' || actionLower === 'end-day' || latest.checkOutTime) {
          setCurrentStatus('ended');
        } else if (statusLower === 'on-break' || actionLower === 'on-break') {
          setCurrentStatus('on-break');
        } else {
          setCurrentStatus('started');
        }
      } else {
        setCurrentStatus(null);
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  useEffect(() => {
    if (currentUser) loadTodayAttendance();
  }, [currentUser, attendanceRecords, isOpen]);

  // Live timer: tick every second when status is 'started' so Today's Working Hours updates
  useEffect(() => {
    if (currentStatus !== 'started' || !isOpen) return;
    const interval = setInterval(() => setTimerTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [currentStatus, isOpen]);

  // --- ACTIONS ---
  const handleAttendanceAction = async (action: AttendanceAction) => {
    setIsSubmitting(true);
    let loc: LocationData | null = null;
    try {
      loc = await getCurrentLocation();
    } catch (e) {
      console.warn('Location unavailable, recording without coordinates:', e);
      loc = { latitude: 0, longitude: 0, address: 'Location unavailable' };
    }

    try {
      const now = new Date();
      // Use local date (YYYY-MM-DD) so the record appears on the correct calendar day for the user's timezone
      const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
      const today = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

      if (action === 'start-day') {
        await addAttendanceRecord({
          username: currentUser,
          date: today,
          checkInTime: now.toISOString(),
          status: 'started',
          action: 'start-day',
          location: loc,
          startLocation: loc,
          deviceType,
          workingHours: 0
        });
      }
      else if (action === 'end-day') {
        // Find the active session (start-day row for today with no end yet)
        const activeRecord = todayAttendance.find(r =>
          String(r.action || '').toLowerCase() === 'start-day' &&
          (r.status === 'started' || r.status === 'present') &&
          !r.checkOutTime
        );

        if (!activeRecord) {
          alert("No active session found to end.");
          setIsSubmitting(false);
          return;
        }

        // Calculate hours from start to now
        const startTime = new Date(activeRecord.checkInTime);
        let hours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);
        if (hours < 0) hours = 0;

        // Insert a new "end-day" row (so Reports show both Start Time and End Time without needing checkOutTime column)
        await addAttendanceRecord({
          username: currentUser,
          date: today,
          checkInTime: now.toISOString(),
          status: 'ended',
          action: 'end-day',
          endLocation: loc ?? undefined,
          workingHours: hours,
          location: loc,
          startLocation: undefined
        });
      }
      else {
        // Breaks
        await addAttendanceRecord({
          username: currentUser,
          date: today,
          checkInTime: now.toISOString(),
          status: action === 'on-break' ? 'on-break' : 'started',
          action: action,
          location: loc ?? undefined,
          startLocation: loc ?? undefined,
          deviceType,
          workingHours: 0
        });
      }

      alert(`Success: ${action.replace('-', ' ')}`);
      if (onClose) onClose();
      onAttendanceUpdate();

      // Force immediate refresh
      setTimeout(() => loadTodayAttendance(), 1000);

    } catch (error) {
      console.error("Attendance Error:", error);
      alert("Failed to record attendance. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canEndDay = (currentStatus === 'started' || currentStatus === 'on-break');

  // --- RENDER ---
  if (!isOpen) {
    return (
      <div className="flex gap-2">
        {currentStatus !== 'ended' && (
          <button
            onClick={() => {
              const next = !currentStatus ? 'start-day' :
                currentStatus === 'started' ? 'on-break' :
                  'back-from-break';
              handleAttendanceAction(next);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-white rounded-lg bg-green-600 hover:bg-green-700`}
            disabled={isSubmitting}
          >
            {currentStatus === 'started' ? 'Take Break' : currentStatus === 'on-break' ? 'Return' : 'Start My Day'}
          </button>
        )}

        <button onClick={() => setIsOpen(true)} className="px-4 py-2 bg-slate-100 rounded-lg">View Stats</button>

        {canEndDay && (
          <button
            onClick={() => handleAttendanceAction('end-day')}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            disabled={isSubmitting}
          >
            End Day
          </button>
        )}
      </div>
    );
  }

  // Records sorted by checkInTime DESC (newest first) — use latest to decide what to show
  const latestRecord = todayAttendance[0];
  const latestAction = latestRecord ? String(latestRecord.action || '').toLowerCase() : '';
  const isEnded = latestAction === 'end-day';

  const endRecord = todayAttendance.find(r => String(r.action || '').toLowerCase() === 'end-day');
  const startRecord = todayAttendance.find(r => {
    const a = String(r.action || '').toLowerCase();
    return a === 'start-day' || a === 'back-from-break';
  });
  const breakRecord = todayAttendance.find(r => String(r.action || '').toLowerCase() === 'on-break');

  const nowMs = new Date().getTime();
  void timerTick; // use so timer re-runs when tick updates

  // Sum all work segments (start-day/back-from-break → on-break/end-day or now) so hours persist across breaks
  const chrono = [...todayAttendance].sort((a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime());
  let segmentTotalHours = 0;
  let currentSegmentStart: number | null = null;
  for (const r of chrono) {
    const t = new Date(r.checkInTime).getTime();
    const action = String(r.action || '').toLowerCase();
    if (action === 'start-day' || action === 'back-from-break') {
      currentSegmentStart = t;
    } else if (action === 'on-break' && currentSegmentStart != null) {
      segmentTotalHours += (t - currentSegmentStart) / (1000 * 60 * 60);
      currentSegmentStart = null;
    } else if (action === 'end-day' && currentSegmentStart != null) {
      segmentTotalHours += (t - currentSegmentStart) / (1000 * 60 * 60);
      currentSegmentStart = null;
    }
  }

  // Only show "day completed" hours when the latest action is end-day
  let workingHoursEnd: number | null = null;
  if (isEnded && endRecord) {
    const stored = (endRecord as any).workingHours;
    if (stored != null && !isNaN(Number(stored))) {
      workingHoursEnd = Number(stored);
    } else {
      // Use accumulated segments + final segment to end-day time if not stored
      const endMs = new Date(endRecord.checkInTime || endRecord.checkOutTime || 0).getTime();
      if (currentSegmentStart != null) {
        workingHoursEnd = segmentTotalHours + (endMs - currentSegmentStart) / (1000 * 60 * 60);
      } else {
        workingHoursEnd = segmentTotalHours;
      }
    }
  }

  let workingHoursLive: number | null = null;
  let workingHoursBreak: number | null = null;
  if (currentStatus === 'on-break' && breakRecord) {
    // Total hours worked so far (all segments up to and including the one that ended at break)
    workingHoursBreak = segmentTotalHours;
  } else if (currentStatus === 'started' && currentSegmentStart != null) {
    // Total = completed segments + current segment to now
    workingHoursLive = segmentTotalHours + (nowMs - currentSegmentStart) / (1000 * 60 * 60);
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto"
      onClick={() => { setIsOpen(false); onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="attendance-modal-title"
    >
      <div
        className="modal-content bg-white rounded-xl w-full max-w-md max-h-[90vh] sm:max-h-[95vh] overflow-y-auto flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-6 flex-shrink-0">
          <div className="flex justify-between items-start gap-2 mb-4">
            <h3 id="attendance-modal-title" className="text-lg sm:text-xl font-bold text-slate-800">Attendance Tracking</h3>
            <button type="button" onClick={() => { setIsOpen(false); onClose?.(); }} className="text-slate-400 hover:text-slate-600 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg" aria-label="Close">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Current Status - same as Firebase */}
          <div className="mb-4 p-3 bg-slate-50 rounded-lg">
            <div className="text-sm font-medium text-slate-700">Current Status</div>
            <div className="text-lg font-semibold text-blue-800">
              {currentStatus ? currentStatus.replace('-', ' ').toUpperCase() : 'NOT STARTED'}
            </div>
          </div>

          {/* Today's Working Hours: live timer when started, frozen on break, total when ended */}
          {(startRecord || workingHoursEnd != null) && (
            <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
              <div className="text-sm font-medium text-slate-700 mb-2">Today&apos;s Working Hours</div>
              {workingHoursEnd != null ? (
                <div className="text-xl sm:text-2xl font-bold text-green-800">
                  {Number(workingHoursEnd).toFixed(1)} hours
                  <div className="text-sm font-normal text-green-600 mt-1">Day completed</div>
                </div>
              ) : workingHoursBreak != null ? (
                <div className="text-xl sm:text-2xl font-bold text-amber-800">
                  {workingHoursBreak.toFixed(1)} hours
                  <div className="text-sm font-normal text-amber-600 mt-1">On break since {breakRecord ? formatTimeIST(breakRecord.checkInTime) : '—'}</div>
                </div>
              ) : workingHoursLive != null ? (
                <div className="text-xl sm:text-2xl font-bold text-blue-800">
                  {workingHoursLive.toFixed(1)} hours
                  <div className="text-sm font-normal text-blue-600 mt-1">Started at {formatTimeIST(startRecord!.checkInTime)} · timer running</div>
                </div>
              ) : null}
            </div>
          )}

          {/* Location - same as Firebase */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">Current Location</label>
            {isLoadingLocation ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <svg className="animate-spin h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Getting your location...
              </div>
            ) : location?.address ? (
              <div className="p-3 sm:p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 mb-1">
                  <span className="font-medium text-sm">Location Detected</span>
                </div>
                <div className="text-sm font-semibold text-green-900">{location.address}</div>
                <div className="text-xs text-green-600 mt-0.5">Coordinates: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">Location not available</div>
            )}
          </div>

          {/* Today's Activity - same as Firebase */}
          {todayAttendance.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Today&apos;s Activity</label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {todayAttendance.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm">
                    <span className="font-medium capitalize">{r.action.replace('-', ' ')}</span>
                    <span className="text-slate-500">{formatTimeIST(r.checkInTime)}{r.checkOutTime ? ` – Out: ${formatTimeIST(r.checkOutTime)}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons - Firebase style, touch-friendly min 48px */}
          <div className="flex flex-col sm:flex-row gap-2">
            {(!currentStatus || currentStatus === 'ended') && (
              <button
                type="button"
                onClick={() => handleAttendanceAction('start-day')}
                disabled={isSubmitting || isLoadingLocation}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] text-base font-medium text-white rounded-lg bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <><svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Recording...</>
                ) : isLoadingLocation ? (
                  <><svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Getting Location...</>
                ) : (
                  <><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Start My Day</>
                )}
              </button>
            )}
            {currentStatus === 'started' && (
              <button type="button" onClick={() => handleAttendanceAction('on-break')} disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] text-base font-medium text-white rounded-lg bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50">
                {isSubmitting ? (<><svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Recording...</>) : (<><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> On Break</>)}
              </button>
            )}
            {currentStatus === 'on-break' && (
              <button type="button" onClick={() => handleAttendanceAction('back-from-break')} disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] text-base font-medium text-white rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                {isSubmitting ? (<><svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Recording...</>) : (<><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Back from Break</>)}
              </button>
            )}
            {canEndDay && (
              <button type="button" onClick={() => handleAttendanceAction('end-day')} disabled={isSubmitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 min-h-[48px] text-base font-medium text-white rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50">
                {isSubmitting ? (<><svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Recording...</>) : (<><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> End My Day</>)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceTracker;