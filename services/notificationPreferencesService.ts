import apiClient from './apiClient';

export type NotificationCategory = 
  | 'meeting_reminders'
  | 'lead_updates'
  | 'task_alerts'
  | 'system_notifications'
  | 'followup_reminders';

export interface NotificationPreferences {
  userId: string;
  enabled: boolean; // Master toggle
  categories: {
    meeting_reminders: boolean;
    lead_updates: boolean;
    task_alerts: boolean;
    system_notifications: boolean;
    followup_reminders: boolean;
  };
  sound: boolean;
  vibrate: boolean;
  updatedAt: string;
}

const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'userId' | 'updatedAt'> = {
  enabled: true,
  categories: {
    meeting_reminders: true,
    lead_updates: true,
    task_alerts: true,
    system_notifications: true,
    followup_reminders: true,
  },
  sound: true,
  vibrate: true,
};

class NotificationPreferencesService {
  private cache: Map<string, NotificationPreferences> = new Map();

  /**
   * Get notification preferences for a user
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    // Check cache first
    if (this.cache.has(userId)) {
      return this.cache.get(userId)!;
    }

    try {
      const response = await apiClient.get(`/preferences/${userId}`);
      const data = response.data;
      
      this.cache.set(userId, data);
      return data;
    } catch (error) {
      console.error('❌ Error getting notification preferences:', error);
      // Return default preferences on error so the UI doesn't break
      return {
        userId,
        ...DEFAULT_PREFERENCES,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Save notification preferences
   */
  async savePreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      const prefsToSave = {
        ...preferences,
        updatedAt: new Date().toISOString(),
      };
      
      // Update cache immediately for optimistic UI
      this.cache.set(preferences.userId, prefsToSave);
      
      await apiClient.post('/preferences/save', prefsToSave);
      
      console.log('✅ Notification preferences saved:', preferences.userId);
    } catch (error) {
      console.error('❌ Error saving notification preferences:', error);
      throw error;
    }
  }

  /**
   * Update a specific category preference
   */
  async updateCategory(
    userId: string,
    category: NotificationCategory,
    enabled: boolean
  ): Promise<void> {
    const preferences = await this.getPreferences(userId);
    preferences.categories[category] = enabled;
    await this.savePreferences(preferences);
  }

  /**
   * Update master toggle
   */
  async updateMasterToggle(userId: string, enabled: boolean): Promise<void> {
    const preferences = await this.getPreferences(userId);
    preferences.enabled = enabled;
    await this.savePreferences(preferences);
  }

  /**
   * Check if a category is enabled
   */
  async isCategoryEnabled(
    userId: string,
    category: NotificationCategory
  ): Promise<boolean> {
    const preferences = await this.getPreferences(userId);
    
    // Master toggle must be on
    if (!preferences.enabled) {
      return false;
    }
    
    // Category must be enabled
    return preferences.categories[category] ?? true;
  }

  /**
   * Clear cache for a user
   */
  clearCache(userId: string): void {
    this.cache.delete(userId);
  }
}

export const notificationPreferencesService = new NotificationPreferencesService();