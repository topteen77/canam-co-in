import type { Lead, FollowUp, MeetingCheckInRecord } from '../types';

export type NotificationCategory =
  | 'call'
  | 'email'
  | 'meeting'
  | 'assessment'
  | 'whatsapp'
  | 'overdue'
  | 'other';

export type NotificationStatus = 'overdue' | 'today' | 'upcoming' | 'active';

export interface NotificationPreferences {
  mutedCategories: string[];
  mutedNotificationIds: string[];
  snoozedNotifications: Record<string, string>;
}

export interface CRMNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  timestamp: string;
  scheduledAt?: string;
  leadId?: string;
  leadName?: string;
  followUpId?: string;
  followUpType?: string;
  status: NotificationStatus;
  isMuted: boolean;
  snoozedUntil?: string;
}

interface BuildNotificationParams {
  currentUser: string | null;
  isAdmin: boolean;
  leads: Lead[];
  meetingCheckInRecords: MeetingCheckInRecord[];
  preferences: NotificationPreferences;
}

const normalizeCategory = (followUpType?: FollowUp['type']): NotificationCategory => {
  if (!followUpType) return 'other';
  const type = followUpType.toLowerCase();
  if (type.includes('call')) return 'call';
  if (type.includes('meeting') || type.includes('visit')) return 'meeting';
  if (type.includes('email')) return 'email';
  if (type.includes('assessment')) return 'assessment';
  if (type.includes('whatsapp') || type.includes('whats')) return 'whatsapp';
  return 'other';
};

export const isLeadOwnedByUser = (lead: Lead, userEmail: string, isAdmin: boolean) => {
  if (isAdmin) return true;

  // 🟢 SAFE FIX: If followUps is null, undefined, or not a list, use empty list []
  const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];

  return (
    lead.accountManager === userEmail ||
    lead.salesPerson === userEmail ||
    lead.createdBy === userEmail ||
    // Now runs safely on the empty list instead of crashing
    safeFollowUps.some(fu => fu.assignedTo === userEmail) 
  );
};

export const buildNotifications = ({
  currentUser,
  isAdmin,
  leads,
  meetingCheckInRecords,
  preferences
}: BuildNotificationParams): CRMNotification[] => {
  if (!currentUser) return [];

  const now = new Date();
  const todayISO = now.toISOString().split('T')[0];
  const notificationList: CRMNotification[] = [];

  const snoozedMap = preferences.snoozedNotifications || {};
  const mutedCategories = new Set(preferences.mutedCategories || []);
  const mutedNotifications = new Set(preferences.mutedNotificationIds || []);

  const recentCutoffMs = now.getTime() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
  const newLeadCutoffMs = now.getTime() - 14 * 24 * 60 * 60 * 1000; // 14 days ago for "new lead"
  let completedCount = 0;
  const maxCompletedNotifications = 100;
  const maxNewLeadNotifications = 50;

  let newLeadCount = 0;
  leads
    .filter((lead) => isLeadOwnedByUser(lead, currentUser, isAdmin))
    .forEach((lead) => {
      const createdAt = lead.createdAt || (lead as any).created_at;
      if (newLeadCount < maxNewLeadNotifications && createdAt) {
        const createdMs = new Date(createdAt).getTime();
        if (!Number.isNaN(createdMs) && createdMs >= newLeadCutoffMs) {
          newLeadCount++;
          const notificationId = `lead_created_${lead.id}`;
          const snoozedUntil = snoozedMap[notificationId];
          const isMuted = mutedNotifications.has(notificationId);
          const createdToday = new Date(createdMs).toISOString().split('T')[0] === todayISO;
          notificationList.push({
            id: notificationId,
            category: 'other',
            title: 'New lead',
            description: lead.createdBy === currentUser
              ? `You added ${lead.agencyName}`
              : `${lead.agencyName}${lead.accountManager === currentUser || lead.salesPerson === currentUser ? ' (assigned to you)' : ''}`,
            timestamp: createdAt,
            scheduledAt: createdAt,
            leadId: lead.id,
            leadName: lead.agencyName,
            status: createdToday ? 'today' : 'upcoming',
            isMuted,
            snoozedUntil
          });
        }
      }

      const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];

      const leadOwnedByUser = lead.accountManager === currentUser || lead.salesPerson === currentUser || lead.createdBy === currentUser;

      safeFollowUps.forEach((followUp: any) => {
        const assignedTo = followUp.assignedTo || lead.accountManager;
        const createdBy = followUp.createdBy;
        const isAssignedToUser = assignedTo === currentUser || createdBy === currentUser || leadOwnedByUser;

        // Planned: upcoming/overdue follow-ups (show if assigned to user, or if user owns the lead)
        if (followUp.status === 'Planned') {
          if (!isAssignedToUser) return;

          const followUpDate = new Date(followUp.date);
          if (Number.isNaN(followUpDate.getTime())) return;

          const category = normalizeCategory(followUp.type);
          const isOverdue = followUpDate.getTime() < now.getTime();
          const isToday = followUp.date.startsWith(todayISO);

          const notificationId = `${isOverdue ? 'overdue' : 'followup'}_${lead.id}_${followUp.id}`;
          const snoozedUntil = snoozedMap[notificationId];
          const isMuted =
            mutedCategories.has(category) || mutedNotifications.has(notificationId);

          notificationList.push({
            id: notificationId,
            category,
            title: isOverdue ? 'Overdue Follow-up' : `Follow-up: ${followUp.type}`,
            description: isOverdue
              ? `${followUp.type} for ${lead.agencyName} (${Math.ceil(
                  (now.getTime() - followUpDate.getTime()) / (1000 * 60 * 60 * 24)
                )} days overdue)`
              : `${followUp.type} for ${lead.agencyName}${
                  isToday ? ' scheduled today' : ''
                }`,
            timestamp: followUp.date,
            scheduledAt: followUp.date,
            leadId: lead.id,
            leadName: lead.agencyName,
            followUpId: followUp.id,
            followUpType: followUp.type,
            status: isOverdue ? 'overdue' : isToday ? 'today' : 'upcoming',
            isMuted,
            snoozedUntil
          });
          return;
        }

        // Done: recent completed follow-ups (so notifications show "updates" / activity)
        if (followUp.status === 'Done' && completedCount < maxCompletedNotifications && isAssignedToUser) {
          const followUpDate = new Date(followUp.date);
          if (Number.isNaN(followUpDate.getTime())) return;
          if (followUpDate.getTime() < recentCutoffMs) return;

          completedCount++;
          const category = normalizeCategory(followUp.type);
          const notificationId = `completed_${lead.id}_${followUp.id}`;
          const snoozedUntil = snoozedMap[notificationId];
          const isMuted =
            mutedCategories.has(category) || mutedNotifications.has(notificationId);
          const completedToday = followUp.date.startsWith(todayISO);

          notificationList.push({
            id: notificationId,
            category,
            title: `Completed: ${followUp.type}`,
            description: `${followUp.type} for ${lead.agencyName}${completedToday ? ' (today)' : ''}`,
            timestamp: followUp.updatedAt || followUp.date,
            scheduledAt: followUp.date,
            leadId: lead.id,
            leadName: lead.agencyName,
            followUpId: followUp.id,
            followUpType: followUp.type,
            status: completedToday ? 'today' : 'upcoming',
            isMuted,
            snoozedUntil
          });
        }
      });
    });

  meetingCheckInRecords
    .filter((meeting) => meeting.username === currentUser)
    .forEach((meeting) => {
      const checkInDate = new Date(meeting.checkInTime);
      if (Number.isNaN(checkInDate.getTime())) return;

      const snoozedUntil = snoozedMap[`active_meeting_${meeting.id}`];
      const isMuted =
        mutedCategories.has('meeting') || mutedNotifications.has(`active_meeting_${meeting.id}`);

      notificationList.push({
        id: `active_meeting_${meeting.id}`,
        category: 'meeting',
        title: meeting.checkOutTime ? 'Meeting Summary' : 'Active Meeting',
        description: meeting.checkOutTime
          ? `Meeting with ${meeting.leadName || 'Client'} completed`
          : `Meeting with ${meeting.leadName || 'Client'} in progress`,
        timestamp: meeting.checkInTime,
        scheduledAt: meeting.checkInTime,
        leadId: meeting.leadId,
        leadName: meeting.leadName,
        status: meeting.checkOutTime ? 'today' : 'active',
        followUpType: 'Meeting',
        isMuted,
        snoozedUntil
      });
    });

  return notificationList.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};

export const defaultNotificationPreferences: NotificationPreferences = {
  mutedCategories: [],
  mutedNotificationIds: [],
  snoozedNotifications: {}
};