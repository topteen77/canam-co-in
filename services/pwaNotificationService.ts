import type { Lead, FollowUp } from '../types';
import { 
  notificationPreferencesService, 
  type NotificationCategory 
} from './notificationPreferencesService';

console.log('🔧 PWA Notification Service loaded');

export interface ScheduledNotification {
  notificationId: string;
  meetingId: string;
  leadId: string;
  scheduledTime: number; // timestamp
  meetingTime: number; // timestamp
  title: string;
  body: string;
  cancelled: boolean;
  category: NotificationCategory;
}

class PWANotificationService {
  private notificationPermission: NotificationPermission = 'default';
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private scheduledNotifications: Map<string, ScheduledNotification> = new Map();
  private checkInterval: number | null = null;
  private currentUser: string | null = null;
  private readonly NOTIFICATION_CHECK_INTERVAL = 60000; // Check every minute
  private readonly NOTIFICATION_ADVANCE_TIME = 5 * 60 * 1000; // 5 minutes

  /**
   * Set current user for preference checks
   */
  setCurrentUser(userId: string | null): void {
    this.currentUser = userId;
  }

  private getCurrentUser(): string | null {
    return this.currentUser;
  }

  /**
   * Initialize the notification service
   */
  async initialize(): Promise<boolean> {
    try {
      if (!('Notification' in window)) {
        console.warn('⚠️ Notifications are not supported in this browser');
        return false;
      }

      if (!('serviceWorker' in navigator)) {
        console.warn('⚠️ Service Workers are not supported in this browser');
        return false;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        this.serviceWorkerRegistration = registration;
        console.log('✅ Using main Service Worker for notifications');
      } catch (error) {
        console.warn('⚠️ Could not get service worker, using direct API');
      }

      await this.requestPermission();
      this.startMonitoring();

      return true;
    } catch (error) {
      console.error('❌ Failed to initialize PWA notification service:', error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (this.notificationPermission === 'granted') return 'granted';

    try {
      this.notificationPermission = Notification.permission;
      if (this.notificationPermission === 'default') {
        const permission = await Notification.requestPermission();
        this.notificationPermission = permission;
      }
      return this.notificationPermission;
    } catch (error) {
      console.error('❌ Error requesting permission:', error);
      return 'denied';
    }
  }

  isPermissionGranted(): boolean {
    return Notification.permission === 'granted';
  }

  startMonitoring(): void {
    if (this.checkInterval !== null) clearInterval(this.checkInterval);

    this.checkInterval = window.setInterval(() => {
      this.checkAndShowNotifications();
    }, this.NOTIFICATION_CHECK_INTERVAL);

    console.log('✅ Started monitoring for meeting notifications');
    
    // Initial check
    setTimeout(() => this.checkAndShowNotifications(), 5000); 
  }

  stopMonitoring(): void {
    if (this.checkInterval !== null) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Update scheduled notifications based on current leads
   */
  async updateScheduledNotifications(leads: Lead[], currentUser: string, isAdmin: boolean): Promise<void> {
    if (!this.isPermissionGranted()) return;

    // Check SQL-backed preferences
    const meetingRemindersEnabled = await notificationPreferencesService.isCategoryEnabled(
      currentUser,
      'meeting_reminders'
    );
    
    if (!meetingRemindersEnabled) {
      console.log('📵 Meeting reminders disabled in preferences');
      return;
    }

    const now = Date.now();
    const newScheduledNotifications = new Map<string, ScheduledNotification>();

    leads.forEach((lead) => {
      const hasAccess = isAdmin || 
        lead.accountManager === currentUser ||
        lead.salesPerson === currentUser ||
        lead.createdBy === currentUser;

      if (!hasAccess) return;

      const safeFollowUps = Array.isArray(lead.followUps) ? lead.followUps : [];

      safeFollowUps.forEach((followUp: FollowUp) => {
        if (followUp.type !== 'Meeting' || followUp.status !== 'Planned') return;

        try {
          const meetingTime = new Date(followUp.date).getTime();
          if (isNaN(meetingTime)) return; // Safety check for invalid dates

          if (meetingTime <= now) return;

          const notificationTime = meetingTime - this.NOTIFICATION_ADVANCE_TIME;
          if (notificationTime <= now) return;

          const notificationId = `meeting_${lead.id}_${followUp.id}`;
          const existing = this.scheduledNotifications.get(notificationId);
          
          if (!existing || existing.scheduledTime !== notificationTime) {
            newScheduledNotifications.set(notificationId, {
              notificationId,
              meetingId: followUp.id,
              leadId: lead.id,
              scheduledTime: notificationTime,
              meetingTime: meetingTime,
              title: `Meeting Reminder: ${lead.agencyName}`,
              body: `Meeting in 5 minutes at ${new Date(meetingTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
              cancelled: false,
              category: 'meeting_reminders'
            });
          } else if (existing && !existing.cancelled) {
            newScheduledNotifications.set(notificationId, existing);
          }
        } catch (error) {
          console.error('❌ Error processing meeting:', error);
        }
      });
    });

    this.scheduledNotifications = newScheduledNotifications;
    console.log(`✅ Scheduled ${this.scheduledNotifications.size} notifications`);
  }

  private checkAndShowNotifications(): void {
    if (!this.isPermissionGranted()) return;

    const now = Date.now();
    const notificationsToShow: ScheduledNotification[] = [];

    this.scheduledNotifications.forEach((notification) => {
      if (notification.cancelled) return;

      const timeUntil = notification.scheduledTime - now;
      const timeSince = now - notification.scheduledTime;

      // Show if within 2 minute window
      if (timeUntil <= 120000 && timeSince <= 120000) {
        notificationsToShow.push(notification);
      }
    });

    notificationsToShow.forEach((notification) => {
      this.showNotification(notification);
      notification.cancelled = true;
    });
  }

  private async showNotification(notification: ScheduledNotification): Promise<void> {
    if (!this.isPermissionGranted()) return;

    let soundEnabled = true;
    let vibrateEnabled = true;

    try {
      const currentUser = this.getCurrentUser();
      if (currentUser) {
        const prefs = await notificationPreferencesService.getPreferences(currentUser);
        if (prefs.categories && !prefs.categories[notification.category]) return;
        soundEnabled = prefs.sound;
        vibrateEnabled = prefs.vibrate;
      }
    } catch (e) {
      console.warn('Using default notification settings');
    }

    try {
      const options: NotificationOptions = {
        body: notification.body,
        icon: '/icon-192x192.png',
        tag: `${notification.category}_${notification.notificationId}`,
        silent: !soundEnabled,
        vibrate: vibrateEnabled ? [200, 100, 200] : undefined,
        data: {
          leadId: notification.leadId,
          meetingId: notification.meetingId
        }
      };

      if (this.serviceWorkerRegistration?.active) {
        await this.serviceWorkerRegistration.showNotification(notification.title, options);
      } else {
        const n = new Notification(notification.title, options);
        n.onclick = () => {
          window.focus();
          n.close();
          // Dispatch event for UI handling
          window.dispatchEvent(new CustomEvent('notification-click', {
             detail: { leadId: notification.leadId }
          }));
        };
      }
    } catch (error) {
      console.error('❌ Error showing notification:', error);
    }
  }

  cancelNotification(notificationId: string): void {
    const notification = this.scheduledNotifications.get(notificationId);
    if (notification) notification.cancelled = true;
  }

  clearAllNotifications(): void {
    this.scheduledNotifications.forEach(n => n.cancelled = true);
    this.scheduledNotifications.clear();
  }
}

export const pwaNotificationService = new PWANotificationService();