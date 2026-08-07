import React, { useMemo, useState } from 'react';
import type { CRMNotification, NotificationCategory } from '../utils/notifications';

type CategoryFilter = 'all' | NotificationCategory;

interface NotificationBellProps {
  notifications: CRMNotification[];
  readNotificationIds: Set<string>;
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onNavigateToLead?: (leadId: string, followUpId?: string) => void;
  onOpenNotificationsCenter: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  readNotificationIds,
  onMarkAsRead,
  onMarkAllAsRead,
  onOpenNotificationsCenter,
  onNavigateToLead
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');

  // 🟢 SAFE FIX: Ensure notifications is an array
  const safeNotifications = Array.isArray(notifications) ? notifications : [];

  const unreadCount = useMemo(
    () => safeNotifications.filter((n) => !readNotificationIds.has(n.id)).length,
    [safeNotifications, readNotificationIds]
  );

  const categories: Array<{
    id: CategoryFilter;
    label: string;
    icon: string;
  }> = [
    { id: 'all', label: 'All', icon: '📋' },
    { id: 'call', label: 'Calls', icon: '📞' },
    { id: 'email', label: 'Emails', icon: '📧' },
    { id: 'meeting', label: 'Meetings', icon: '📅' },
    { id: 'assessment', label: 'Assessments', icon: '📝' },
    { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
    { id: 'other', label: 'Other', icon: '🔔' }
  ];

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: safeNotifications.length,
      call: 0,
      email: 0,
      meeting: 0,
      assessment: 0,
      whatsapp: 0,
      other: 0
    };

    safeNotifications.forEach((notification) => {
      const category = notification.category as NotificationCategory;
      if (counts[category] !== undefined) {
        counts[category] += 1;
      } else {
        counts.other += 1;
      }
    });

    return counts;
  }, [safeNotifications]);

  const filteredNotifications = useMemo(() => {
    if (activeCategory === 'all') return safeNotifications;
    return safeNotifications.filter((notification) => notification.category === activeCategory);
  }, [safeNotifications, activeCategory]);

  const getNotificationIcon = (category: NotificationCategory, status: string) => {
    if (status === 'overdue') return '🔴';
    switch (category) {
      case 'meeting':
        return '📅';
      case 'email':
        return '📧';
      case 'assessment':
        return '📝';
      case 'whatsapp':
        return '💬';
      case 'call':
        return '📞';
      default: return '🔔';
    }
  };

  // 🟢 SAFE FIX: Date formatting helper
  const formatNotificationDate = (timestamp: string | number) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString();
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <div className="relative">
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
        title="Notifications"
      >
        <svg className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        
        {/* Notification Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium shadow-sm animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown Panel */}
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 max-h-[85vh] flex flex-col animate-scaleIn origin-top-right overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/80 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  Notifications 
                  {unreadCount > 0 && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">{unreadCount} new</span>}
                </h3>
                {unreadCount > 0 && (
                  <button
                    onClick={() => {
                      onMarkAllAsRead();
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-all whitespace-nowrap ${
                      activeCategory === category.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    <span>{category.icon}</span>
                    <span>{category.label}</span>
                    <span className={`ml-1 font-bold ${activeCategory === category.id ? 'text-indigo-100' : 'text-slate-400'}`}>
                      {categoryCounts[category.id] ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto flex-1 overscroll-contain">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                  <div className="text-4xl mb-3 opacity-50">🔕</div>
                  <p className="text-sm font-medium">No notifications</p>
                  <p className="text-xs mt-1 opacity-70">You're all caught up!</p>
                </div>
              ) : (
                filteredNotifications.map((notification) => {
                  const isRead = readNotificationIds.has(notification.id);
                  const isSnoozed =
                    notification.snoozedUntil &&
                    new Date(notification.snoozedUntil).getTime() > Date.now();

                  return (
                  <div
                    key={notification.id}
                    className={`p-4 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors relative group ${
                      !isRead ? 'bg-blue-50/50' : ''
                    }`}
                    onClick={() => {
                        onMarkAsRead(notification.id);
                        setIsOpen(false);

                        if (notification.leadId && onNavigateToLead) {
                          onNavigateToLead(notification.leadId, notification.followUpId);
                        }
                      }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 text-xl bg-white p-2 rounded-lg shadow-sm border border-gray-100">
                          {getNotificationIcon(notification.category, notification.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <h4 className={`text-sm font-semibold truncate pr-2 ${!isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                            {notification.title}
                          </h4>
                          {!isRead && (
                            <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5 ring-2 ring-blue-100" />
                          )}
                        </div>
                        <p className={`text-sm mt-0.5 line-clamp-2 ${!isRead ? 'text-gray-800' : 'text-gray-500'}`}>
                          {notification.description}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-2">
                            <p className="text-xs text-gray-400 font-medium">
                              {formatNotificationDate(notification.timestamp)}
                            </p>
                            
                            {/* Badges */}
                            <div className="flex flex-wrap gap-1 text-[10px] uppercase tracking-wider font-bold">
                                {notification.status === 'overdue' && (
                                    <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700">Overdue</span>
                                )}
                                {notification.status === 'upcoming' && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Upcoming</span>
                                )}
                                {isSnoozed && (
                                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">Snoozed</span>
                                )}
                            </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 bg-gray-50/80 backdrop-blur-sm">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenNotificationsCenter();
                }}
                className="w-full py-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                View Notification Center
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};