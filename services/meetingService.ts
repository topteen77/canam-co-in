import apiClient from './apiClient';

// Ensure the interface matches your backend schema and frontend expectations
export interface MeetingCheckIn {
  id?: string; // Using string for UUIDs from SQL
  userId: string;
  username?: string; // Optional: often joined from User table
  leadId?: string;
  leadName?: string;
  checkInTime: string; // ISO String
  checkOutTime?: string; // ISO String
  duration?: number;
  location?: {
    latitude: number; // Changed from lat/lng to match common SQL naming if needed, or map it
    longitude: number;
    address: string;
  };
  notes?: string;
  outcome?: string;
  status: 'active' | 'completed';
  meetingType?: string; // e.g., 'In-person', 'Online'
}

// --- GET MEETINGS ---
export const getMeetingCheckIns = async (userId: string): Promise<MeetingCheckIn[]> => {
  try {
    const response = await apiClient.get(`/meetings/user/${userId}`);
    
    // Transform data if necessary (e.g., parsing JSON location)
    return response.data.map((meeting: any) => ({
      ...meeting,
      location: typeof meeting.location === 'string' ? JSON.parse(meeting.location) : meeting.location
    }));
  } catch (error) {
    console.error('Error fetching meetings:', error);
    return [];
  }
};

// --- ADD MEETING ---
export const addMeetingCheckIn = async (meeting: MeetingCheckIn): Promise<void> => {
  try {
    // Transform location to JSON string if backend expects text
    const payload = {
        ...meeting,
        location: meeting.location ? JSON.stringify(meeting.location) : null
    };
    await apiClient.post('/meetings/add', payload);
  } catch (error) {
    console.error('Error adding meeting:', error);
    throw error;
  }
};

// --- UPDATE MEETING ---
export const updateMeetingCheckIn = async (id: string, updates: Partial<MeetingCheckIn>): Promise<void> => {
  try {
    // Transform location to JSON string if it's being updated
    const payload = {
        ...updates,
        location: updates.location ? JSON.stringify(updates.location) : undefined
    };
    await apiClient.put(`/meetings/update/${id}`, payload);
  } catch (error) {
    console.error('Error updating meeting:', error);
    throw error;
  }
};