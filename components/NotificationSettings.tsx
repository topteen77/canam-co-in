import React, { useState, useEffect } from 'react';
import { 
  notificationPreferencesService, 
  NotificationCategory,
  type NotificationPreferences 
} from '../services/notificationPreferencesService';
import { pwaNotificationService } from '../services/pwaNotificationService';

interface NotificationSettingsProps {
  currentUser: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<NotificationCategory, { title: string; description: string }> = {
  meeting_reminders: {
    title: 'Meeting Reminders',
    description: 'Get notified 5 minutes before scheduled meetings'
  },
  lead_updates: {
    title: 'Lead Updates',
    description: 'Notifications when leads are assigned or updated'
  },
  task_alerts: {
    title: 'Task Alerts',
    description: 'Reminders for pending tasks and follow-ups'
  },
  system_notifications: {
    title: 'System Notifications',
    description: 'Important system updates and announcements'
  },
  followup_reminders: {
    title: 'Follow-up Reminders',
    description: 'Reminders for scheduled follow-up activities'
  },
};

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  currentUser,
  isOpen,
  onClose
}) => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      loadPreferences();
      checkPermission();
    }
  }, [isOpen, currentUser]);

  const loadPreferences = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    setError(null);
    try {
      const prefs = await notificationPreferencesService.getPreferences(currentUser);
      if (prefs) {
        setPreferences(prefs);
      } else {
        // Fallback or create default preferences
        const defaultPrefs = await notificationPreferencesService.initializePreferences(currentUser);
        setPreferences(defaultPrefs);
      }
    } catch (err: any) {
      console.error('Error loading preferences:', err);
      setError('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const checkPermission = async () => {
    try {
        if ('Notification' in window) {
            const status = Notification.permission;
            setPermissionStatus(status);
        } else {
            // Browser doesn't support notifications
            setPermissionStatus('denied');
        }
    } catch (e) {
        console.warn('Error checking notification permission:', e);
    }
  };

  const handleMasterToggle = async (enabled: boolean) => {
    if (!currentUser || !preferences) return;
    
    setSaving(true);
    try {
      await notificationPreferencesService.updateMasterToggle(currentUser, enabled);
      setPreferences({ ...preferences, enabled });
    } catch (err: any) {
      console.error('Error updating master toggle:', err);
      setError('Failed to update notification settings');
      // Revert optimistic update if needed, though simple state set above handles UI sync
    } finally {
      setSaving(false);
    }
  };

  const handleCategoryToggle = async (category: NotificationCategory, enabled: boolean) => {
    if (!currentUser || !preferences) return;
    
    setSaving(true);
    try {
      await notificationPreferencesService.updateCategory(currentUser, category, enabled);
      setPreferences({
        ...preferences,
        categories: {
          ...preferences.categories,
          [category]: enabled
        }
      });
    } catch (err: any) {
      console.error('Error updating category:', err);
      setError('Failed to update notification settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPermission = async () => {
    try {
      const permission = await pwaNotificationService.requestPermission();
      setPermissionStatus(permission);
      
      if (permission === 'granted') {
        // Reinitialize notification service
        await pwaNotificationService.initialize();
      }
    } catch (err: any) {
      console.error('Error requesting permission:', err);
      setError('Failed to request notification permission');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Notification Settings</h2>
              <p className="text-sm text-slate-600 mt-1">
                Manage your notification preferences
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-slate-100"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : preferences ? (
            <div className="space-y-6">
              {/* Permission Status */}
              <div className={`border rounded-lg p-4 ${
                  permissionStatus === 'granted' ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`font-semibold ${permissionStatus === 'granted' ? 'text-green-800' : 'text-slate-900'}`}>
                        Browser Permission
                    </h3>
                    <p className={`text-sm mt-1 ${permissionStatus === 'granted' ? 'text-green-700' : 'text-slate-600'}`}>
                      {permissionStatus === 'granted' && '✅ Notifications are enabled'}
                      {permissionStatus === 'denied' && '❌ Notifications are blocked'}
                      {permissionStatus === 'default' && '⚠️ Permission not requested yet'}
                    </p>
                  </div>
                  {permissionStatus !== 'granted' && (
                    <button
                      onClick={handleRequestPermission}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium shadow-sm"
                    >
                      {permissionStatus === 'denied' ? 'Open Settings' : 'Enable Notifications'}
                    </button>
                  )}
                </div>
                {permissionStatus === 'denied' && (
                  <p className="text-xs text-red-600 mt-2 font-medium">
                    Notifications are blocked by your browser. Please enable them in your browser settings (lock icon in address bar).
                  </p>
                )}
              </div>

              {/* Master Toggle */}
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">Enable Notifications</h3>
                    <p className="text-sm text-slate-600 mt-1">
                      Master switch for all notification categories
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={preferences.enabled}
                      onChange={(e) => handleMasterToggle(e.target.checked)}
                      disabled={saving || permissionStatus !== 'granted'}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                  </label>
                </div>
              </div>

              {/* Category Toggles */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 border-b border-slate-100 pb-2">Notification Categories</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Choose which types of notifications you want to receive
                </p>
                
                {(Object.keys(CATEGORY_LABELS) as NotificationCategory[]).map((category) => (
                  <div
                    key={category}
                    className="bg-white border border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">
                          {CATEGORY_LABELS[category].title}
                        </h4>
                        <p className="text-sm text-slate-600 mt-1">
                          {CATEGORY_LABELS[category].description}
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preferences.categories[category]}
                          onChange={(e) => handleCategoryToggle(category, e.target.checked)}
                          disabled={saving || !preferences.enabled || permissionStatus !== 'granted'}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Additional Settings */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-3">Additional Settings</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-900">Sound</span>
                      <p className="text-sm text-slate-600">Play sound with notifications</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.sound}
                        onChange={(e) => {
                          const newPrefs = { ...preferences, sound: e.target.checked };
                          setPreferences(newPrefs);
                          notificationPreferencesService.savePreferences(newPrefs).catch(console.error);
                        }}
                        disabled={saving}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-900">Vibrate</span>
                      <p className="text-sm text-slate-600">Vibrate device with notifications</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.vibrate}
                        onChange={(e) => {
                          const newPrefs = { ...preferences, vibrate: e.target.checked };
                          setPreferences(newPrefs);
                          notificationPreferencesService.savePreferences(newPrefs).catch(console.error);
                        }}
                        disabled={saving}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
                <p>Unable to load preferences. Please try again.</p>
                <button 
                    onClick={loadPreferences}
                    className="mt-2 text-indigo-600 hover:underline"
                >
                    Retry
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;