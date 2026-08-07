import apiClient from './apiClient';
import type { AttendanceRecord, MeetingCheckInRecord } from '../types';

// --- HELPER: Fix Date Format for MySQL ---
const formatDateForMySQL = (isoString: string | undefined): string | null => {
    if (!isoString) return null;
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return null;
        return date.toISOString().slice(0, 19).replace('T', ' ');
    } catch (e) {
        return null;
    }
};

// Normalize location to { latitude, longitude, address } for reports
const normalizeLocation = (loc: unknown): AttendanceRecord['startLocation'] => {
    if (loc == null) return undefined;
    if (typeof loc === 'object' && 'latitude' in (loc as object) && 'longitude' in (loc as object)) {
        const o = loc as { latitude?: number; longitude?: number; address?: string };
        return {
            latitude: Number(o.latitude) || 0,
            longitude: Number(o.longitude) || 0,
            address: typeof o.address === 'string' ? o.address : 'Location recorded'
        };
    }
    if (typeof loc === 'string') {
        try {
            const parsed = JSON.parse(loc);
            return normalizeLocation(parsed);
        } catch {
            return undefined;
        }
    }
    return undefined;
};

// --- GET ALL ATTENDANCE RECORDS ---
export const getAllAttendanceRecords = async (): Promise<AttendanceRecord[]> => {
    try {
        const response = await apiClient.get('/attendance/all');
        const records = response.data || [];
        return records.map((record: any) => ({
            ...record,
            id: record.firebase_id ?? record.id,
            checkInTime: record.checkInTime ?? record.check_in_time,
            checkOutTime: record.checkOutTime ?? record.check_out_time,
            startLocation: normalizeLocation(record.startLocation ?? record.start_location) ?? undefined,
            endLocation: normalizeLocation(record.endLocation ?? record.end_location) ?? undefined,
            location: normalizeLocation(record.location ?? record.startLocation ?? record.start_location) ?? undefined
        }));
    } catch (error) {
        console.error('Error getting attendance records:', error);
        return [];
    }
};

// --- GET ALL MEETING RECORDS ---
export const getAllMeetingCheckInRecords = async (): Promise<MeetingCheckInRecord[]> => {
    try {
        const response = await apiClient.get('/meetings/all');
        return response.data || [];
    } catch (error) {
        console.error('Error getting meeting check-in records:', error);
        return [];
    }
};

// --- ADD ATTENDANCE RECORD (Start Day) ---
export const addAttendanceRecord = async (record: Omit<AttendanceRecord, 'id'>): Promise<void> => {
    try {
        // Send checkInTime as ISO UTC (e.g. ...Z) so backend stores and returns IST correctly
        const payload = {
            ...record,
            checkInTime: record.checkInTime ?? undefined,
            date: record.date || new Date().toISOString().slice(0, 10),
            location: record.location || null,
            workingHours: record.workingHours || 0
        };

        await apiClient.post('/attendance/add', payload);
    } catch (error) {
        console.error('Error adding attendance record:', error);
        throw error;
    }
};

// --- UPDATE ATTENDANCE RECORD (End Day / Check Out) ---
export const updateAttendanceRecord = async (id: string, updates: Partial<AttendanceRecord>): Promise<void> => {
    try {
        // Send checkOutTime as ISO UTC (e.g. ...Z) so backend stores and returns IST correctly
        const payload = {
            ...updates,
            checkOutTime: updates.checkOutTime ?? undefined,
            endLocation: updates.endLocation ?? undefined,
            end_location: updates.endLocation ?? undefined,
        };
        
        await apiClient.put(`/attendance/update/${id}`, payload);
    } catch (error) {
        console.error('Error updating attendance record:', error);
        throw error;
    }
};

// --- ADD MEETING CHECK-IN ---
export const addMeetingCheckInRecord = async (record: Omit<MeetingCheckInRecord, 'id'>): Promise<void> => {
    try {
        const payload = {
            ...record,
            checkInTime: formatDateForMySQL(record.checkInTime),
            location: record.location || null,
            checkInPhotos: record.checkInPhotos || [], 
            checkInPhotoMetadata: record.checkInPhotoMetadata || {}
        };

        await apiClient.post('/meetings/check-in', payload);
    } catch (error) {
        console.error('Error adding meeting check-in record:', error);
        throw error;
    }
};

// --- SUBSCRIBE TO ATTENDANCE (No Polling) ---
export const subscribeToAttendanceRecords = (callback: (records: AttendanceRecord[]) => void) => {
    getAllAttendanceRecords().then(callback);
    return () => {};
};

// --- SUBSCRIBE TO MEETINGS (No Polling) ---
export const subscribeToMeetingCheckInRecords = (callback: (records: MeetingCheckInRecord[]) => void) => {
    getAllMeetingCheckInRecords().then(callback);
    return () => {};
};

// --- CLIENT-SIDE FILTERS ---
export const getAttendanceRecordsByDateRange = async (startDate: string, endDate: string): Promise<AttendanceRecord[]> => {
    try {
        const allRecords = await getAllAttendanceRecords();
        return allRecords.filter(record => {
            const recordDate = record.date || (record.checkInTime ? record.checkInTime.slice(0, 10) : '');
            return recordDate >= startDate && recordDate <= endDate;
        });
    } catch (error) {
        console.error('Error getting attendance records by date range:', error);
        return [];
    }
};

export const getAttendanceRecordsByUser = async (username: string): Promise<AttendanceRecord[]> => {
    try {
        const allRecords = await getAllAttendanceRecords();
        return allRecords.filter(record => record.username === username);
    } catch (error) {
        console.error('Error getting attendance records by user:', error);
        return [];
    }
};

export const calculateWorkingHours = (records: AttendanceRecord[]): number => {
    return records.reduce((total, record) => {
        return total + (record.workingHours || 0);
    }, 0);
};

export const getAttendanceSummary = (records: AttendanceRecord[]) => {
    const totalDays = records.length;
    const startedDays = records.filter(r => r.status === 'started' || r.action === 'start-day').length;
    
    return {
        totalDays,
        presentDays: startedDays,
        absentDays: totalDays - startedDays,
        totalWorkingHours: calculateWorkingHours(records),
        attendanceRate: totalDays > 0 ? (startedDays / totalDays) * 100 : 0
    };
};