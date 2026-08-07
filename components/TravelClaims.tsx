import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../services/apiClient';
import type { MeetingCheckInRecord, AttendanceRecord } from '../types';
import { getUserDisplayName } from '../utils/dataCleaning';
import { formatTimeIST } from '../utils/dateTime';

interface TravelClaim {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  month: string;
  year: number;
  trips: TripRecord[];
  totalDistance: number;
  totalAmount: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'paid';
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface TripRecord {
  tripId: string;
  date: string;
  username?: string; // Add username for admin viewing
  meetings: MeetingRecord[];
  totalDistance: number;
  totalAmount: number;
  startLocation: string;
  endLocation: string;
}

interface MeetingRecord {
  meetingId: string;
  clientName: string;
  location: string;
  address: string;
  checkInTime: string;
  checkOutTime?: string;
  meetingType?: string;
  distanceFromPrevious: number;
  amountForThisMeeting: number;
}

interface TravelClaimsProps {
  currentUser: string | null;
  isAdmin: boolean;
}

// 🟢 SAFE FIX: Robust Distance Calculation
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (
    typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' || typeof lon2 !== 'number' ||
    isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)
  ) {
    return 0;
  }

  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

interface AppUser {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  status?: string;
}

const TravelClaims: React.FC<TravelClaimsProps> = ({ currentUser, isAdmin }) => {
  const [claims, setClaims] = useState<TravelClaim[]>([]);
  const [meetingRecords, setMeetingRecords] = useState<(MeetingCheckInRecord & { id: string })[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<(AttendanceRecord & { id: string })[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<TravelClaim | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Admin filters and pagination
  const [filters, setFilters] = useState({
    selectedUser: '',
    selectedMonth: '',
    status: '',
    startMonth: '',
    endMonth: '',
    minAmount: '',
    maxAmount: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Travel rate: ₹9 per km as requested
  const TRAVEL_RATE_PER_KM = 9;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [claimsRes, meetingsRes, attendanceRes, usersRes] = await Promise.all([
        apiClient.get('/travel-claims').catch(() => ({ data: [] })),
        apiClient.get('/meetings/all').catch(() => ({ data: [] })),
        apiClient.get('/attendance/all').catch(() => ({ data: [] })),
        apiClient.get('/users').catch(() => ({ data: [] })),
      ]);
      const claimsList = Array.isArray(claimsRes.data) ? claimsRes.data : [];
      setClaims(claimsList.map((row: any) => ({
        id: row.id || row.firebase_id,
        ...row,
        createdAt: row.created_at || row.createdAt,
        updatedAt: row.updated_at || row.updatedAt,
      })) as TravelClaim[]);
      const meetingsList = Array.isArray(meetingsRes.data) ? meetingsRes.data : [];
      setMeetingRecords(meetingsList.map((row: any) => ({
        id: row.id || row.firebase_id,
        username: row.username || row.userId,
        salesPersonName: row.salesPersonName,
        salesPersonEmail: row.salesPersonEmail || row.userId,
        meetingType: row.meetingType,
        notes: row.notes,
        leadId: row.leadId,
        leadName: row.leadName,
        date: row.date,
        checkInTime: typeof row.checkInTime === 'string' ? row.checkInTime : (row.checkInTime?.toDate ? row.checkInTime.toDate().toISOString() : new Date().toISOString()),
        checkOutTime: typeof row.checkOutTime === 'string' ? row.checkOutTime : (row.checkOutTime?.toDate ? row.checkOutTime.toDate().toISOString() : ''),
        meetingDuration: row.meetingDuration || 0,
        meetingStatus: row.meetingStatus || 'active',
        location: row.location,
        ...row,
      })) as (MeetingCheckInRecord & { id: string })[]);
      const attendanceList = Array.isArray(attendanceRes.data) ? attendanceRes.data : [];
      setAttendanceRecords(attendanceList.map((row: any) => ({ id: row.id || row.firebase_id, ...row })) as (AttendanceRecord & { id: string })[]);
      const usersList = Array.isArray(usersRes.data) ? usersRes.data : [];
      setUsers(usersList.filter((u: AppUser) => u.status === 'Active'));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate trips for the selected month and user
  const calculateTripsForMonth = useMemo(() => {
    if (!currentUser && !isAdmin) return [];

    // Filter meetings based on admin status and filters
    const userMeetings = meetingRecords.filter(meeting => {
      const matchesDate = meeting.date.startsWith(selectedMonth || filters.selectedMonth || new Date().toISOString().slice(0, 7));
      
      if (isAdmin) {
        if (filters.selectedUser) {
          return matchesDate && meeting.username === filters.selectedUser;
        } else {
          return matchesDate; 
        }
      } else {
        return matchesDate && meeting.username === currentUser;
      }
    });

    const userAttendance = attendanceRecords.filter(attendance => {
      const matchesDate = attendance.date.startsWith(selectedMonth || filters.selectedMonth || new Date().toISOString().slice(0, 7));
      
      if (isAdmin) {
        if (filters.selectedUser) {
          return matchesDate && attendance.username === filters.selectedUser;
        } else {
          return matchesDate; 
        }
      } else {
        return matchesDate && attendance.username === currentUser;
      }
    });

    // Group meetings by date and user to create trips
    const meetingsByDateAndUser = userMeetings.reduce((acc, meeting) => {
      const key = `${meeting.date}|${meeting.username}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(meeting);
      return acc;
    }, {} as Record<string, (MeetingCheckInRecord & { id: string })[]>);

    const trips: TripRecord[] = [];

    Object.entries(meetingsByDateAndUser).forEach(([key, meetings]) => {
      const [date, username] = key.split('|');
      const meetingsList = meetings as (MeetingCheckInRecord & { id: string })[];
      
      // Sort meetings by check-in time
      const sortedMeetings = meetingsList.sort((a, b) => 
        new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
      );

      // Get start and end locations from attendance record
      const dayAttendance = userAttendance.find(att => att.date === date && att.username === username);
      
      // Extract start and end coordinates from attendance
      const startCoords = dayAttendance?.startLocation;
      const endCoords = dayAttendance?.endLocation;
      
      const startLocation = startCoords?.address || 'Start Location Not Recorded';
      const endLocation = endCoords?.address || 'End Location Not Recorded';

      let totalDistance = 0;
      const tripMeetings: MeetingRecord[] = [];

      if (sortedMeetings.length === 0) {
        // No meetings - only calculate distance from start to end
        if (startCoords?.latitude && endCoords?.latitude) {
          totalDistance = calculateDistance(
            startCoords.latitude,
            startCoords.longitude,
            endCoords.latitude,
            endCoords.longitude
          );
        }
      } else {
        // Calculate complete route
        
        // STEP 1: Distance from start location to first meeting
        if (startCoords?.latitude && sortedMeetings[0]?.location?.latitude) {
          const distanceToFirstMeeting = calculateDistance(
            startCoords.latitude,
            startCoords.longitude,
            sortedMeetings[0].location.latitude,
            sortedMeetings[0].location.longitude
          );
          totalDistance += distanceToFirstMeeting;
        }

        // STEP 2: Distance between consecutive meetings
        for (let i = 0; i < sortedMeetings.length; i++) {
          const meeting = sortedMeetings[i];
          
          let distanceForThisMeeting = 0;
          
          if (i === 0) {
            distanceForThisMeeting = totalDistance; // Accumulate initial distance
          } else {
            const previousMeeting = sortedMeetings[i - 1];
            if (meeting.location?.latitude && previousMeeting.location?.latitude) {
              distanceForThisMeeting = calculateDistance(
                previousMeeting.location.latitude,
                previousMeeting.location.longitude,
                meeting.location.latitude,
                meeting.location.longitude
              );
              totalDistance += distanceForThisMeeting;
            }
          }

          // Add meeting record
          tripMeetings.push({
            meetingId: meeting.id || `${date}_${i}`,
            clientName: meeting.leadName || meeting.salesPersonName || 'Unknown Client',
            location: meeting.location?.address || 'Unknown Location',
            address: meeting.location?.address || 'Address not available',
            checkInTime: meeting.checkInTime,
            checkOutTime: meeting.checkOutTime,
            meetingType: meeting.meetingType || 'Client Meeting',
            distanceFromPrevious: Math.round(distanceForThisMeeting * 100) / 100,
            amountForThisMeeting: Math.round(distanceForThisMeeting * TRAVEL_RATE_PER_KM * 100) / 100
          });
        }

        // STEP 3: Distance from last meeting to end location
        if (sortedMeetings.length > 0 && endCoords?.latitude) {
          const lastMeeting = sortedMeetings[sortedMeetings.length - 1];
          if (lastMeeting.location?.latitude) {
            const distanceToEnd = calculateDistance(
              lastMeeting.location.latitude,
              lastMeeting.location.longitude,
              endCoords.latitude,
              endCoords.longitude
            );
            totalDistance += distanceToEnd;
          }
        }
      }

      const totalAmount = Math.round(totalDistance * TRAVEL_RATE_PER_KM * 100) / 100;

      trips.push({
        tripId: `${username}_${date}`,
        date,
        username: username,
        meetings: tripMeetings,
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalAmount: totalAmount,
        startLocation,
        endLocation
      });
    });

    const sortedTrips = trips.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sortedTrips;
  }, [meetingRecords, attendanceRecords, currentUser, selectedMonth, isAdmin, filters.selectedUser, filters.selectedMonth]);

  // Calculate totals for the month
  const monthTotals = useMemo(() => {
    const totalDistance = calculateTripsForMonth.reduce((sum, trip) => sum + trip.totalDistance, 0);
    const totalAmount = calculateTripsForMonth.reduce((sum, trip) => sum + trip.totalAmount, 0);
    const totalMeetings = calculateTripsForMonth.reduce((sum, trip) => sum + trip.meetings.length, 0);

    return {
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalMeetings,
      totalTrips: calculateTripsForMonth.length
    };
  }, [calculateTripsForMonth]);

  // Filter and paginate claims for admin view
  const filteredAndPaginatedClaims = useMemo(() => {
    let filteredClaims = claims;

    if (!isAdmin && currentUser) {
      filteredClaims = filteredClaims.filter(claim => 
        claim.userEmail === currentUser || 
        claim.userId === currentUser
      );
    }

    if (isAdmin && filters.selectedUser) {
      filteredClaims = filteredClaims.filter(claim => 
        claim.userEmail === filters.selectedUser || 
        claim.userId === filters.selectedUser
      );
    }

    if (filters.selectedMonth) {
      filteredClaims = filteredClaims.filter(claim => claim.month === filters.selectedMonth);
    }

    if (filters.status) {
      filteredClaims = filteredClaims.filter(claim => claim.status === filters.status);
    }

    if (filters.startMonth && filters.endMonth) {
      filteredClaims = filteredClaims.filter(claim => 
        claim.month >= filters.startMonth && claim.month <= filters.endMonth
      );
    }

    if (filters.minAmount) {
      filteredClaims = filteredClaims.filter(claim => claim.totalAmount >= parseFloat(filters.minAmount));
    }

    if (filters.maxAmount) {
      filteredClaims = filteredClaims.filter(claim => claim.totalAmount <= parseFloat(filters.maxAmount));
    }

    const totalItems = filteredClaims.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedClaims = filteredClaims.slice(startIndex, endIndex);

    return {
      claims: paginatedClaims,
      totalItems,
      totalPages,
      currentPage
    };
  }, [claims, filters, currentPage, itemsPerPage, isAdmin, currentUser]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const clearFilters = () => {
    setFilters({
      selectedUser: '',
      selectedMonth: '',
      status: '',
      startMonth: '',
      endMonth: '',
      minAmount: '',
      maxAmount: ''
    });
  };

  const createClaim = async () => {
    if (!currentUser || calculateTripsForMonth.length === 0) {
      alert('No trips found for the selected month');
      return;
    }

    try {
      const claim: Omit<TravelClaim, 'id'> = {
        userId: currentUser,
        userName: currentUser.split('@')[0],
        userEmail: currentUser,
        month: selectedMonth,
        year: new Date(selectedMonth).getFullYear(),
        trips: calculateTripsForMonth,
        totalDistance: monthTotals.totalDistance,
        totalAmount: monthTotals.totalAmount,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await apiClient.post('/travel-claims', claim);
      await loadData();
      alert('Travel claim created successfully!');
    } catch (error) {
      console.error('Error creating claim:', error);
      alert('Error creating claim. Please try again.');
    }
  };

  const updateClaimStatus = async (claimId: string, status: TravelClaim['status'], rejectionReason?: string) => {
    try {
      const updateData: Partial<TravelClaim> = {
        status,
        updatedAt: new Date().toISOString()
      };

      if (status === 'approved') {
        updateData.approvedAt = new Date().toISOString();
        updateData.approvedBy = currentUser || 'Admin';
      }

      if (status === 'rejected' && rejectionReason) {
        updateData.rejectionReason = rejectionReason;
      }

      await apiClient.put(`/travel-claims/${claimId}`, updateData);
      await loadData();
      alert(`Claim ${status} successfully!`);
    } catch (error) {
      console.error('Error updating claim:', error);
      alert('Error updating claim. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Loading travel claims...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">🚗 Travel Claims</h2>
            <p className="text-gray-600">Automatic distance calculation and trip tracking (₹9/km)</p>
          </div>
        </div>
      </div>

      {/* Travel Claims Filters & Management */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {isAdmin ? 'All Travel Claims Management' : 'Travel Claims Tracking'}
        </h3>
          
          {/* Filters */}
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* User Filter - Only for Admins */}
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by User</label>
                  <select
                    value={filters.selectedUser}
                    onChange={(e) => setFilters({...filters, selectedUser: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Users</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.email}>
                        {user.name || user.email} ({user.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({...filters, status: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="submitted">Submitted</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              {/* Month Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specific Month</label>
                <input
                  type="month"
                  value={filters.selectedMonth}
                  onChange={(e) => setFilters({...filters, selectedMonth: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Amount Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Range (₹)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.minAmount}
                    onChange={(e) => setFilters({...filters, minAmount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.maxAmount}
                    onChange={(e) => setFilters({...filters, maxAmount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Month Range Filter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month Range - Start</label>
                <input
                  type="month"
                  value={filters.startMonth}
                  onChange={(e) => setFilters({...filters, startMonth: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month Range - End</label>
                <input
                  type="month"
                  value={filters.endMonth}
                  onChange={(e) => setFilters({...filters, endMonth: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Results Summary */}
            <div className="text-sm text-gray-600">
              Showing {filteredAndPaginatedClaims.claims.length} of {filteredAndPaginatedClaims.totalItems} claims
              {filteredAndPaginatedClaims.totalPages > 1 && (
                <span> | Page {filteredAndPaginatedClaims.currentPage} of {filteredAndPaginatedClaims.totalPages}</span>
              )}
            </div>
          </div>
        </div>

      {/* Month Selector */}
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <label className="block text-sm font-medium text-gray-700">Select Month:</label>
              <input
                type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

      {/* Monthly Summary */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{monthTotals.totalTrips}</div>
          <div className="text-sm text-blue-800">Total Trips</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{monthTotals.totalMeetings}</div>
          <div className="text-sm text-green-800">Total Meetings</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{monthTotals.totalDistance} km</div>
          <div className="text-sm text-purple-800">Total Distance</div>
          </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">₹{monthTotals.totalAmount}</div>
          <div className="text-sm text-orange-800">Total Amount</div>
          </div>
          </div>

      {/* Create Claim Button */}
      {!isAdmin && calculateTripsForMonth.length > 0 && (
        <div className="mb-6">
                    <button
            onClick={createClaim}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
            📋 Create Travel Claim for {selectedMonth}
                    </button>
                  </div>
      )}

      {/* Trip Details Table */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Trip Details for {selectedMonth}</h3>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {calculateTripsForMonth.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No trips found for {selectedMonth}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distance (km)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {calculateTripsForMonth.map((trip) => (
                    <React.Fragment key={trip.tripId}>
                      {/* Trip Header */}
                      <tr className="bg-blue-50">
                        {isAdmin && (
                          <td className="px-4 py-3 font-medium text-blue-800">
                            {getUserDisplayName(trip.username || '', users)}
                          </td>
                        )}
                        <td className="px-4 py-3 font-medium text-blue-800" colSpan={isAdmin ? 2 : 3}>
                          🚗 Trip - {new Date(trip.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-700">
                          {trip.startLocation} → {trip.endLocation}
                        </td>
                        <td className="px-4 py-3 text-sm text-blue-700"></td>
                        <td className="px-4 py-3 font-medium text-blue-800">
                          {trip.totalDistance} km
                        </td>
                        <td className="px-4 py-3 font-medium text-blue-800">
                          ₹{trip.totalAmount}
                        </td>
                      </tr>
                      {/* Meeting Details */}
                      {trip.meetings.map((meeting, index) => (
                        <tr key={meeting.meetingId} className="hover:bg-gray-50">
                          {isAdmin && (
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {index === 0 ? getUserDisplayName(trip.username || '', users) : ''}
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {index === 0 ? new Date(meeting.checkInTime).toLocaleDateString() : ''}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900">{meeting.clientName}</div>
                            <div className="text-xs text-gray-500">{meeting.meetingType}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{meeting.location}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{meeting.address}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div>{formatTimeIST(meeting.checkInTime)}</div>
                            {meeting.checkOutTime && (
                              <div className="text-xs text-gray-500">
                                - {formatTimeIST(meeting.checkOutTime)}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {meeting.distanceFromPrevious} km
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            ₹{meeting.amountForThisMeeting}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Existing Claims Table */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {isAdmin ? 'All Travel Claims' : 'My Travel Claims'}
        </h3>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trips</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meetings</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distance</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {(() => {
                  // Show filtered and paginated claims
                  const claimsToShow = filteredAndPaginatedClaims.claims;
                  
                  return claimsToShow.map((claim) => {
                    const totalMeetings = claim.trips?.reduce((sum, trip) => sum + trip.meetings.length, 0) || 0;
                    const totalTrips = claim.trips?.length || 0;
                    
                    return (
                <tr key={claim.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{getUserDisplayName(claim.userEmail, users) || claim.userName}</div>
                      <div className="text-sm text-gray-500">{claim.userEmail}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {claim.month}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {totalTrips}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {totalMeetings}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {claim.totalDistance} km
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          ₹{claim.totalAmount}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      claim.status === 'approved' ? 'bg-green-100 text-green-800' :
                      claim.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      claim.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                      claim.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {claim.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedClaim(claim)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                              View Details
                      </button>
                      {isAdmin && claim.status === 'submitted' && (
                        <>
                          <button
                                onClick={() => updateClaimStatus(claim.id!, 'approved')}
                            className="text-green-600 hover:text-green-900"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Enter rejection reason:');
                                    if (reason) updateClaimStatus(claim.id!, 'rejected', reason);
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {isAdmin && claim.status === 'approved' && (
                        <button
                                onClick={() => updateClaimStatus(claim.id!, 'paid')}
                                className="text-purple-600 hover:text-purple-900"
                        >
                                Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                    );
                  });
                })()}
              {(() => {
                if (filteredAndPaginatedClaims.claims.length === 0) {
                  return (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                        {isAdmin ? 'No claims match the current filters' : 'No travel claims found'}
                      </td>
                    </tr>
                  );
                }
                return null;
              })()}
            </tbody>
          </table>
        </div>
        </div>

        {/* Pagination Controls */}
        {filteredAndPaginatedClaims.totalPages > 1 && (
          <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(filteredAndPaginatedClaims.totalPages, currentPage + 1))}
                  disabled={currentPage === filteredAndPaginatedClaims.totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing{' '}
                    <span className="font-medium">
                      {filteredAndPaginatedClaims.totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}
                    </span>{' '}
                    to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * itemsPerPage, filteredAndPaginatedClaims.totalItems)}
                    </span>{' '}
                    of{' '}
                    <span className="font-medium">{filteredAndPaginatedClaims.totalItems}</span>{' '}
                    results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {/* Page numbers */}
                    {Array.from({ length: filteredAndPaginatedClaims.totalPages }, (_, i) => i + 1)
                      .filter((pageNum) => {
                        const totalPages = filteredAndPaginatedClaims.totalPages;
                        return (
                          pageNum === 1 ||
                          pageNum === totalPages ||
                          (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)
                        );
                      })
                      .map((pageNum, index, array) => {
                        if (index > 0 && pageNum - array[index - 1] > 1) {
                          return (
                            <React.Fragment key={`ellipsis-${pageNum}`}>
                              <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                ...
                              </span>
                              <button
                                onClick={() => setCurrentPage(pageNum)}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                              >
                                {pageNum}
                              </button>
                            </React.Fragment>
                          );
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              currentPage === pageNum
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    
                    <button
                      onClick={() => setCurrentPage(Math.min(filteredAndPaginatedClaims.totalPages, currentPage + 1))}
                      disabled={currentPage === filteredAndPaginatedClaims.totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Claim Details Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Travel Claim Details</h3>
                <button
                  onClick={() => setSelectedClaim(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">User</label>
                  <p className="text-sm text-gray-900">{getUserDisplayName(selectedClaim.userEmail, users) || selectedClaim.userName} ({selectedClaim.userEmail})</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Month</label>
                  <p className="text-sm text-gray-900">{selectedClaim.month}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Distance</label>
                  <p className="text-sm text-gray-900">{selectedClaim.totalDistance} km</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                  <p className="text-sm text-gray-900">₹{selectedClaim.totalAmount}</p>
                </div>
              </div>

              {/* Trip Details */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-700 mb-3">Trip Details</h4>
                {selectedClaim.trips?.map((trip, tripIndex) => (
                  <div key={trip.tripId} className="mb-4 border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h5 className="font-medium text-blue-800">
                        Trip {tripIndex + 1} - {new Date(trip.date).toLocaleDateString()}
                      </h5>
                      <div className="text-sm text-gray-600">
                        {trip.totalDistance} km | ₹{trip.totalAmount}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      Route: {trip.startLocation} → {trip.endLocation}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Client</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Location</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Time</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Distance</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {trip.meetings.map((meeting) => (
                            <tr key={meeting.meetingId}>
                              <td className="px-2 py-1">{meeting.clientName}</td>
                              <td className="px-2 py-1 truncate max-w-xs" title={meeting.address}>
                                {meeting.address}
                              </td>
                              <td className="px-2 py-1">
                                {formatTimeIST(meeting.checkInTime)}
                              </td>
                              <td className="px-2 py-1">{meeting.distanceFromPrevious} km</td>
                              <td className="px-2 py-1">₹{meeting.amountForThisMeeting}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                </div>

              {selectedClaim.rejectionReason && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Rejection Reason</label>
                  <p className="text-sm text-red-600 bg-red-50 p-3 rounded">{selectedClaim.rejectionReason}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TravelClaims;