import React, { useMemo, useState } from 'react';
import type {
  CRMNotification,
  NotificationCategory,
  NotificationPreferences
} from '../utils/notifications';

interface NotificationsCenterProps {
  notifications: CRMNotification[];
  readNotificationIds: Set<string>;
  onMarkRead: (notificationId: string) => void;
  onMarkUnread: (notificationId: string) => void;
  onMarkAllRead: () => void;
  onDismissNotification?: (notificationId: string) => void;
  onNavigateToLead?: (leadId: string, followUpId?: string) => void;
  preferences: NotificationPreferences;
  onMuteCategory: (category: NotificationCategory) => void;
  onUnmuteCategory: (category: NotificationCategory) => void;
  onMuteNotification: (notificationId: string) => void;
  onUnmuteNotification: (notificationId: string) => void;
  onSnoozeNotification: (notificationId: string, minutes: number) => void;
  onClearSnooze: (notificationId: string) => void;
  onBack?: () => void;
  onOpenSettings?: () => void;
}

type StatusFilter = 'all' | 'overdue' | 'today' | 'upcoming' | 'active' | 'muted' | 'snoozed';
type CategoryFilter = 'all' | NotificationCategory;

const categoryDefinitions: Array<{ id: CategoryFilter; label: string; icon: string }> = [
  { id: 'all', label: 'All', icon: '📋' },
  { id: 'call', label: 'Calls', icon: '📞' },
  { id: 'email', label: 'Emails', icon: '📧' },
  { id: 'meeting', label: 'Meetings', icon: '📅' },
  { id: 'assessment', label: 'Assessments', icon: '📝' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { id: 'overdue', label: 'Overdue', icon: '⏰' },
  { id: 'other', label: 'Other', icon: '🔔' }
];

const statusDefinitions: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All statuses' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Due today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'active', label: 'Active meetings' },
  { id: 'muted', label: 'Muted' },
  { id: 'snoozed', label: 'Snoozed' }
];

const getCategoryBadgeColor = (category: NotificationCategory) => {
  switch (category) {
    case 'call':
      return 'bg-green-100 text-green-700';
    case 'email':
      return 'bg-sky-100 text-sky-700';
    case 'meeting':
      return 'bg-purple-100 text-purple-700';
    case 'assessment':
      return 'bg-amber-100 text-amber-700';
    case 'whatsapp':
      return 'bg-lime-100 text-lime-700';
    case 'overdue':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({
  notifications,
  readNotificationIds,
  onMarkRead,
  onMarkUnread,
  onMarkAllRead,
  onDismissNotification,
  onNavigateToLead,
  preferences,
  onMuteCategory,
  onUnmuteCategory,
  onMuteNotification,
  onUnmuteNotification,
  onSnoozeNotification,
  onClearSnooze,
  onBack,
  onOpenSettings
}) => {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 🟢 SAFE FIX: Robust preference handling
  const safePreferences = preferences || {};
  
  const mutedCategoriesSet = useMemo(
    () => new Set(safePreferences.mutedCategories || []),
    [safePreferences.mutedCategories]
  );

  const mutedNotificationSet = useMemo(
    () => new Set(safePreferences.mutedNotificationIds || []),
    [safePreferences.mutedNotificationIds]
  );

  const snoozedMap = safePreferences.snoozedNotifications || {};

  const now = Date.now();

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: notifications.length,
      call: 0,
      email: 0,
      meeting: 0,
      assessment: 0,
      whatsapp: 0,
      overdue: 0,
      other: 0
    };

    notifications.forEach((notification) => {
      const category = notification.category;
      if (counts[category] !== undefined) {
        counts[category] += 1;
      } else {
        counts.other += 1;
      }

      if (notification.status === 'overdue') {
        counts.overdue += 1;
      }
    });

    return counts;
  }, [notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readNotificationIds.has(n.id)).length,
    [notifications, readNotificationIds]
  );

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      // 🟢 SAFE FIX: Null check
      if (!notification) return false;

      const isMuted =
        mutedCategoriesSet.has(notification.category) || mutedNotificationSet.has(notification.id);
      
      let isSnoozed = false;
      if (snoozedMap[notification.id]) {
          try {
              isSnoozed = new Date(snoozedMap[notification.id]).getTime() > now;
          } catch (e) {
              isSnoozed = false;
          }
      }

      if (categoryFilter !== 'all' && notification.category !== categoryFilter) {
        if (!(categoryFilter === 'overdue' && notification.status === 'overdue')) {
          return false;
        }
      }

      switch (statusFilter) {
        case 'overdue':
          if (notification.status !== 'overdue') return false;
          break;
        case 'today':
          if (notification.status !== 'today') return false;
          break;
        case 'upcoming':
          if (notification.status !== 'upcoming') return false;
          break;
        case 'active':
          if (notification.status !== 'active') return false;
          break;
        case 'muted':
          if (!isMuted) return false;
          break;
        case 'snoozed':
          if (!isSnoozed) return false;
          break;
        default:
          break;
      }

      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        // 🟢 SAFE FIX: Null-safe haystack construction
        const haystack = [
          notification.title || '',
          notification.description || '',
          notification.leadName || '',
          notification.followUpType || ''
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [
    notifications,
    categoryFilter,
    statusFilter,
    mutedCategoriesSet,
    mutedNotificationSet,
    snoozedMap,
    now,
    searchTerm
  ]);

  const sortedNotifications = useMemo(
    () =>
      [...filteredNotifications].sort((a, b) => {
          // 🟢 SAFE FIX: Robust date sorting
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          const validA = isNaN(timeA) ? 0 : timeA;
          const validB = isNaN(timeB) ? 0 : timeB;
          return validB - validA;
      }),
    [filteredNotifications]
  );

  const handleToggleCategoryMute = (category: NotificationCategory) => {
    if (mutedCategoriesSet.has(category)) {
      onUnmuteCategory(category);
    } else {
      onMuteCategory(category);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-700 bg-indigo-50 rounded-lg flex items-center gap-1"
              >
                ← Back
              </button>
            )}
            <h1 className="text-2xl font-bold text-slate-900">Notifications Center</h1>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Stay on top of calls, emails, meetings, and assessments. Manage reminders and mute what
            you don’t need.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onMarkAllRead}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-300"
            disabled={unreadCount === 0}
          >
            Mark all read
          </button>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              title="Notification Settings"
              className="flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="text-sm text-slate-500">Total notifications</div>
          <div className="mt-1 text-3xl font-bold text-slate-900">{notifications.length}</div>
        </div>
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 shadow-sm">
          <div className="text-sm text-blue-800">Unread</div>
          <div className="mt-1 text-3xl font-bold text-blue-900">{unreadCount}</div>
        </div>
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 shadow-sm">
          <div className="text-sm text-red-800">Overdue follow-ups</div>
          <div className="mt-1 text-3xl font-bold text-red-900">{categoryCounts.overdue ?? 0}</div>
        </div>
        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50 shadow-sm">
          <div className="text-sm text-purple-800">Muted items</div>
          <div className="mt-1 text-3xl font-bold text-purple-900">
            {mutedNotificationSet.size + mutedCategoriesSet.size}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {categoryDefinitions.map((category) => (
            <button
              key={category.id}
              onClick={() => setCategoryFilter(category.id)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors flex items-center gap-1 ${
                categoryFilter === category.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600'
              }`}
            >
              <span>{category.icon}</span>
              <span>{category.label}</span>
              <span className="font-semibold">{categoryCounts[category.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {statusDefinitions.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search notifications..."
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-56"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Muted categories</h2>
        <div className="flex flex-wrap gap-2">
          {(['call', 'email', 'meeting', 'assessment', 'whatsapp', 'other'] as NotificationCategory[]).map(
            (category) => (
              <button
                key={category}
                onClick={() => handleToggleCategoryMute(category)}
                className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                  mutedCategoriesSet.has(category)
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-rose-400 hover:text-rose-600'
                }`}
              >
                {mutedCategoriesSet.has(category) ? 'Unmute' : 'Mute'} {category}
              </button>
            )
          )}
        </div>
      </div>

      <div className="space-y-4">
        {sortedNotifications.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-slate-300 rounded-2xl bg-slate-50">
            <div className="text-4xl mb-2">🎉</div>
            <p className="text-sm text-slate-600">No notifications match your filters.</p>
          </div>
        ) : (
          sortedNotifications.map((notification) => {
            const isRead = readNotificationIds.has(notification.id);
            const isMuted =
              mutedCategoriesSet.has(notification.category) || mutedNotificationSet.has(notification.id);
            
            let isSnoozed = false;
            try {
                const snoozedUntil = snoozedMap[notification.id];
                isSnoozed = snoozedUntil ? new Date(snoozedUntil).getTime() > now : false;
            } catch (e) {
                // Ignore invalid date
            }

            return (
              <div
                key={notification.id}
                className="p-5 border border-slate-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${getCategoryBadgeColor(
                          notification.category
                        )}`}
                      >
                        {notification.category}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(notification.timestamp).toLocaleString()}
                      </span>
                      {notification.status === 'overdue' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-red-100 text-red-700">
                          Overdue
                        </span>
                      )}
                      {notification.status === 'upcoming' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700">
                          Upcoming
                        </span>
                      )}
                      {notification.status === 'active' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-blue-100 text-blue-700">
                          In progress
                        </span>
                      )}
                      {isMuted && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-rose-100 text-rose-700">
                          Muted
                        </span>
                      )}
                      {isSnoozed && snoozedMap[notification.id] && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-purple-100 text-purple-700">
                          Snoozed until {new Date(snoozedMap[notification.id]).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 truncate">
                      {notification.title}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">{notification.description}</p>
                    {notification.leadName && (
                      <p className="text-xs text-slate-500 mt-1">
                        Lead: <span className="font-medium">{notification.leadName}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      onClick={() => {
                        if (isRead) {
                          onMarkUnread(notification.id);
                        } else {
                          onMarkRead(notification.id);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-800"
                    >
                      {isRead ? 'Mark unread' : 'Mark read'}
                    </button>
                    {isSnoozed ? (
                      <button
                        onClick={() => onClearSnooze(notification.id)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-purple-200 text-purple-700 hover:border-purple-400 hover:text-purple-800"
                      >
                        Resume now
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        {[10, 30, 60].map((minutes) => (
                          <button
                            key={minutes}
                            onClick={() => onSnoozeNotification(notification.id, minutes)}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-purple-200 text-purple-700 hover:border-purple-400 hover:text-purple-800"
                          >
                            Snooze {minutes}m
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (isMuted) {
                          onUnmuteNotification(notification.id);
                        } else {
                          onMuteNotification(notification.id);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-600 hover:border-rose-400 hover:text-rose-700"
                    >
                      {isMuted ? 'Unmute' : 'Mute'}
                    </button>
                    {notification.leadId && onNavigateToLead && (
                      <button
                        onClick={() => onNavigateToLead(notification.leadId!, notification.followUpId)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 text-indigo-600 hover:border-indigo-400 hover:text-indigo-700"
                      >
                        Open lead
                      </button>
                    )}
                    {onDismissNotification && (
                      <button
                        onClick={() => onDismissNotification(notification.id)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:text-red-600"
                        title="Delete notification"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationsCenter;