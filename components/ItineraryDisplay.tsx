import React, { useMemo, useState } from 'react';
import type { Lead, FollowUp, MeetingCheckInRecord } from '../types';
import { PlusIcon } from './icons/SparklesIcon';

type MeetingItem = FollowUp & { leadId: string; agencyName: string; isCheckIn?: boolean };

interface MeetingPlannerProps {
  leads: Lead[];
  meetingCheckInRecords?: MeetingCheckInRecord[];
  onUpdateLead: (lead: Lead) => void;
  onPlanNewMeeting: () => void;
}

const Calendar: React.FC<{
  meetings: MeetingItem[];
  onDateSelect: (date: Date | null) => void;
  selectedDate: Date | null;
}> = ({ meetings, onDateSelect, selectedDate }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const meetingDays = useMemo(() => {
    const safe = Array.isArray(meetings) ? meetings : [];
    return new Set(
      safe
        .map((m) => {
          try {
            const d = new Date(m.date);
            return isNaN(d.getTime()) ? null : d.toDateString();
          } catch {
            return null;
          }
        })
        .filter(Boolean) as string[]
    );
  }, [meetings]);

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDay = startOfMonth.getDay();
  const daysInMonth = endOfMonth.getDate();

  const days = Array.from(
    { length: daysInMonth },
    (_, i) => new Date(currentDate.getFullYear(), currentDate.getMonth(), i + 1)
  );
  const blanks = Array.from({ length: startDay }, () => null);

  const changeMonth = (offset: number) => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-200">
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => changeMonth(-1)}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-600"
          aria-label="Previous month"
        >
          &larr;
        </button>
        <h3 className="font-bold text-lg text-slate-800">
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          onClick={() => changeMonth(1)}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-600"
          aria-label="Next month"
        >
          &rarr;
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="font-medium text-slate-500">
            {day}
          </div>
        ))}
        {blanks.map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const isToday = day.toDateString() === new Date().toDateString();
          const hasMeeting = meetingDays.has(day.toDateString());
          const isSelected = selectedDate?.toDateString() === day.toDateString();
          return (
            <button
              key={day.toISOString()}
              onClick={() => onDateSelect(isSelected ? null : day)}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors relative
                ${isSelected ? 'bg-indigo-600 text-white' : ''}
                ${!isSelected && isToday ? 'bg-indigo-100 text-indigo-700' : ''}
                ${!isSelected && !isToday ? 'hover:bg-slate-100 text-slate-700' : ''}
              `}
            >
              {day.getDate()}
              {hasMeeting && (
                <span
                  className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const ItineraryDisplay: React.FC<MeetingPlannerProps> = ({
  leads,
  meetingCheckInRecords = [],
  onUpdateLead,
  onPlanNewMeeting,
}) => {
  const allMeetings = useMemo((): MeetingItem[] => {
    const fromLeads: MeetingItem[] = Array.isArray(leads)
      ? leads.flatMap((lead) => {
          const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];
          return safeFollowUps
            .filter((f) => f.type === 'Meeting')
            .map((meeting) => ({ ...meeting, leadId: lead.id, agencyName: lead.agencyName, isCheckIn: false }));
        })
      : [];
    const fromCheckIns: MeetingItem[] = Array.isArray(meetingCheckInRecords)
      ? meetingCheckInRecords.map((r, i) => {
          const id = (r as { id?: string }).id ?? (r as { firebase_id?: string }).firebase_id ?? `checkin-${i}`;
          const dateStr = r.date || r.checkInTime || '';
          const status = r.meetingStatus === 'completed' ? ('Done' as const) : ('Planned' as const);
          return {
            id,
            type: 'Meeting',
            status,
            date: dateStr,
            notes: r.notes || '',
            leadId: r.leadId || '',
            agencyName: r.leadName || '—',
            isCheckIn: true,
          };
        })
      : [];
    return [...fromLeads, ...fromCheckIns].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return (isNaN(dateA) ? 0 : dateA) - (isNaN(dateB) ? 0 : dateB);
    });
  }, [leads, meetingCheckInRecords]);

  const [editingMeeting, setEditingMeeting] = useState<MeetingItem | null>(null);
  const [remarks, setRemarks] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const filteredMeetings = useMemo(() => {
    if (!selectedDate) {
      const today = new Date(new Date().toDateString()).getTime();
      return allMeetings.filter((m) => {
        const t = new Date(m.date).getTime();
        return !isNaN(t) && t >= today;
      });
    }
    return allMeetings.filter(
      (m) => new Date(m.date).toDateString() === selectedDate.toDateString()
    );
  }, [allMeetings, selectedDate]);

  const handleMarkAsDone = (meetingToUpdate: MeetingItem) => {
    if (meetingToUpdate.isCheckIn) return; // Check-in records are updated via meetings API, not lead followUps
    const lead = leads.find((l) => l.id === meetingToUpdate.leadId);
    if (!lead) return;
    const currentFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];
    const updatedFollowUps = currentFollowUps.map((f) =>
      f.id === meetingToUpdate.id ? { ...f, status: 'Done' as const, notes: remarks || f.notes } : f
    );
    onUpdateLead({ ...lead, followUps: updatedFollowUps });
    setEditingMeeting(null);
    setRemarks('');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <h2 className="text-3xl font-bold text-slate-800">Your Meetings</h2>
        <button
          onClick={onPlanNewMeeting}
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
        >
          <PlusIcon className="h-4 w-4" /> Plan a New Meeting
        </button>
      </div>

      <Calendar
        meetings={allMeetings}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
      />

      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-4">
          {selectedDate
            ? `Agenda for ${selectedDate.toLocaleDateString()}`
            : 'Upcoming Meetings'}
        </h3>
        {filteredMeetings.length > 0 ? (
          <ul className="space-y-4">
            {filteredMeetings.map((meeting) => (
              <li
                key={meeting.id}
                className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-900">{meeting.agencyName}</p>
                    <p className="text-sm text-slate-600">
                      {new Date(meeting.date).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                    {editingMeeting?.id !== meeting.id && (
                      <p className="text-sm text-slate-500 mt-1">
                        Notes: {meeting.notes || '—'}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        meeting.status === 'Done'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {meeting.status}
                    </span>
                  </div>
                </div>

                {meeting.status === 'Planned' && !meeting.isCheckIn && editingMeeting?.id !== meeting.id && (
                  <div className="mt-4 text-right">
                    <button
                      onClick={() => {
                        setEditingMeeting({ ...meeting, leadId: meeting.leadId });
                        setRemarks(meeting.notes || '');
                      }}
                      className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                    >
                      Complete Meeting
                    </button>
                  </div>
                )}

                {editingMeeting?.id === meeting.id && (
                  <div className="mt-4 space-y-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Outcome / Remarks
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      rows={2}
                      className="block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                      placeholder="How did the meeting go?"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingMeeting(null)}
                        className="px-3 py-1 text-sm font-medium text-slate-700 bg-slate-200 rounded-md"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleMarkAsDone(meeting)}
                        className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md"
                      >
                        Mark as Done
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-xl font-semibold text-slate-700">No Meetings Scheduled</h3>
            <p className="text-slate-500 mt-2">
              {selectedDate
                ? 'There are no meetings on this date.'
                : 'Plan your first meeting from the button above.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
