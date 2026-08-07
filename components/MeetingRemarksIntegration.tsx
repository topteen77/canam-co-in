import React, { useState } from 'react';
import { Lead, FollowUp, MeetingCheckInRecord } from '../types';
import { getUserDisplayName } from '../utils/dataCleaning';

interface MeetingRemarksIntegrationProps {
  lead: Lead;
  meetingCheckIns: MeetingCheckInRecord[];
  onAddFollowUp?: (leadId: string, followUp: Omit<FollowUp, 'id'>) => void;
  availableUsers: Array<{id: string, name: string, email: string, role: string}>;
}

const MeetingRemarksIntegration: React.FC<MeetingRemarksIntegrationProps> = ({
  lead,
  meetingCheckIns,
  onAddFollowUp,
  availableUsers
}) => {
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);

  // 🟢 SAFE FIX: Robust date comparison helper
  const isSameDay = (date1: string | Date, date2: string | Date) => {
    try {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
      );
    } catch (e) {
      return false;
    }
  };

  // 🟢 SAFE FIX: Ensure arrays exist
  const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];
  const safeCheckIns = Array.isArray(meetingCheckIns) ? meetingCheckIns : [];

  // Filter check-ins relevant to this lead
  const relevantCheckIns = safeCheckIns.filter(checkIn => {
    // Match by lead ID directly if available
    if (checkIn.leadId === lead.id) return true;
    
    // Fallback: fuzzy match by agency name if lead ID missing
    if (!checkIn.leadId && checkIn.leadName && lead.agencyName) {
      return checkIn.leadName.toLowerCase() === lead.agencyName.toLowerCase();
    }
    return false;
  });

  // Link check-ins to follow-ups
  const linkedData = relevantCheckIns.map(checkIn => {
    // Find corresponding follow-up on the same day
    const matchingFollowUp = safeFollowUps.find(followUp => 
      followUp.type === 'Meeting' && 
      isSameDay(followUp.date, checkIn.date)
    );

    return {
      checkIn,
      followUp: matchingFollowUp,
      isLinked: !!matchingFollowUp
    };
  });

  // Identify unlogged meetings (Follow-ups marked as "Meeting" but no check-in record)
  const unloggedMeetings = safeFollowUps.filter(followUp => 
    followUp.type === 'Meeting' && 
    followUp.status === 'Done' &&
    !relevantCheckIns.some(checkIn => isSameDay(checkIn.date, followUp.date))
  );

  if (linkedData.length === 0 && unloggedMeetings.length === 0) {
    return null; // Nothing to show
  }

  const handleCreateFollowUpFromCheckIn = (checkIn: MeetingCheckInRecord) => {
    if (!onAddFollowUp) return;

    onAddFollowUp(lead.id, {
      type: 'Meeting',
      status: 'Done',
      date: new Date(checkIn.checkInTime).toISOString(),
      notes: checkIn.notes || 'Meeting check-in recorded automatically.',
      assignedTo: checkIn.username,
      createdAt: new Date().toISOString(),
      createdBy: 'system',
      updatedAt: new Date().toISOString(),
      updatedBy: 'system'
    });
    
    alert('Follow-up record created from meeting check-in!');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-indigo-100 rounded-lg overflow-hidden">
        <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex justify-between items-center">
          <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
            🤝 Meeting & Remarks Integration
          </h3>
          <span className="text-xs font-medium bg-indigo-200 text-indigo-800 px-2 py-1 rounded-full">
            {linkedData.length} Records
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {linkedData.map(({ checkIn, followUp, isLinked }) => (
            <div key={checkIn.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {new Date(checkIn.checkInTime).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(checkIn.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                    {isLinked ? (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                        Linked
                      </span>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                        Unlinked Check-in
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Check-in by: <span className="font-medium">{getUserDisplayName(checkIn.username, availableUsers)}</span>
                  </p>
                </div>
                
                {!isLinked && onAddFollowUp && (
                  <button
                    onClick={() => handleCreateFollowUpFromCheckIn(checkIn)}
                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    + Create Follow-up Record
                  </button>
                )}
              </div>

              {/* Remarks Comparison */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Check-in Remarks */}
                <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Check-in Notes</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {checkIn.notes || <span className="text-gray-400 italic">No notes recorded at check-in.</span>}
                  </p>
                  {checkIn.location && checkIn.location.address && (
                    <div className="mt-2 text-xs text-gray-500 flex items-start gap-1">
                      <span>📍</span>
                      <span className="line-clamp-1" title={checkIn.location.address}>
                        {checkIn.location.address}
                      </span>
                    </div>
                  )}
                </div>

                {/* Follow-up Remarks */}
                {followUp ? (
                  <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                    <p className="text-xs font-semibold text-blue-500 uppercase mb-1">CRM Follow-up Notes</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">
                      {followUp.notes || <span className="text-gray-400 italic">No notes in follow-up record.</span>}
                    </p>
                  </div>
                ) : (
                  <div className="bg-amber-50 p-3 rounded-md border border-amber-100 flex flex-col justify-center items-center text-center">
                    <p className="text-sm text-amber-800 font-medium">Missing CRM Record</p>
                    <p className="text-xs text-amber-600 mt-1">
                      User checked in but didn't log a formal follow-up.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Unlogged Meetings Warning */}
      {unloggedMeetings.length > 0 && (
        <div className="bg-white border border-orange-200 rounded-lg overflow-hidden">
          <div className="bg-orange-50 px-4 py-3 border-b border-orange-100">
            <h3 className="font-semibold text-orange-900 flex items-center gap-2">
              ⚠️ Meetings Without Check-ins
            </h3>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-600 mb-3">
              The following meetings were marked as "Done" in the CRM, but no GPS check-in was recorded.
            </p>
            <div className="space-y-2">
              {unloggedMeetings.map((meeting, idx) => (
                <div key={meeting.id || idx} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{new Date(meeting.date).toLocaleDateString()}</span>
                    <span className="text-xs text-gray-500">{meeting.type}</span>
                  </div>
                  <span className="text-xs text-orange-600 font-medium">No Location Data</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingRemarksIntegration;