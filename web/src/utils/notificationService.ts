import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';
import { playNotificationSound } from './sound';

// Configure how notifications are handled when app is in foreground
// Handle Expo Go limitations - local notifications still work, but push notifications don't
try {
  // Check if running in Expo Go (SDK 53+ removed push notifications from Expo Go)
  const isExpoGo = Constants.executionEnvironment === 'storeClient' || 
                   Constants.appOwnership === 'expo';
  
  // In Expo Go, we skip setting the handler to avoid warnings
  // Local notifications via scheduleNotificationAsync will still work
  if (!isExpoGo) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (error) {
  // Silently handle Expo Go limitations - local notifications will still work
}

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  priority: string;
  relatedUserId?: any;
  avatar?: string;
}

type NotificationCallback = (notification: NotificationData) => void;

class NotificationService {
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastCheckedTime: Date | null = null;
  private callbacks: NotificationCallback[] = [];
  private isPolling: boolean = false;
  private userId: string | null = null;
  private isChecking: boolean = false; // Prevent multiple simultaneous checks
  private lastCheckTime: number = 0; // Track last check timestamp
  private minCheckInterval: number = 60000; // Minimum 1 minute between checks
  private shownNotificationIds: Set<string> = new Set(); // Track which notifications have been shown
  private shownNotificationIdsKey = 'shownNotificationIds'; // AsyncStorage key

  // Subscribe to new notifications
  subscribe(callback: NotificationCallback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  // Register for push notifications
  async registerForPushNotifications() {
    try {
      // Check if running in Expo Go - push notifications are not supported in Expo Go (SDK 53+)
      // Use Constants.executionEnvironment to detect Expo Go
      const isExpoGo = Constants.executionEnvironment === 'storeClient' || 
                       Constants.appOwnership === 'expo' ||
                       !Constants.expoConfig;
      
      if (isExpoGo) {
        // In Expo Go, skip push notifications - local notifications will still work
        return null;
      }
      
      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
            allowAnnouncements: true,
          },
        });
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        return null;
      }
      
      // Get push token - handle projectId gracefully
      // Note: Local notifications will work even without push token
      try {
        // Try to get projectId from various sources
        const projectId = Constants.expoConfig?.extra?.eas?.projectId || 
                         Constants.expoConfig?.extra?.projectId ||
                         Constants.easConfig?.projectId;
        
        // If no projectId, skip push token (local notifications will still work)
        if (!projectId) {
          return null;
        }
        
        const token = await Notifications.getExpoPushTokenAsync({ 
          projectId,
          applicationId: Platform.OS === 'ios' ? 'com.gamerhive.app' : 'com.gamerhive.app'
        });
        
        // Save push token to backend if we have userId
        if (this.userId && token.data) {
          try {
            await api.post('/notification/register-token', {
              userId: this.userId,
              pushToken: token.data,
              platform: Platform.OS,
            });
          } catch (error) {
            // Silently handle backend errors - token is still valid
            // Token will be saved locally and can be synced later
          }
        }
        
        return token.data;
      } catch (tokenError: any) {
        // Silently handle errors - local notifications will still work
        return null;
      }
    } catch (error) {
      // Silently handle errors - local notifications will still work
      return null;
    }
  }

  // Show push notification on mobile
  private async showPushNotification(notification: NotificationData) {
    try {
      // Check if running in Expo Go - local notifications still work in Expo Go
      const isExpoGo = Constants.executionEnvironment === 'storeClient' || 
                       Constants.appOwnership === 'expo' ||
                       !Constants.expoConfig;
      
      // Show local notification (works in both Expo Go and development builds)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.message,
          data: { 
            notificationId: notification.id, 
            type: notification.type,
            relatedUserId: notification.relatedUserId?._id || notification.relatedUserId
          },
          sound: true,
          priority: notification.priority === 'high' ? 'max' : 'default',
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      // Silently handle errors - in-app toast will still show
    }
  }

  // Load shown notification IDs from storage
  private async loadShownNotificationIds() {
    try {
      const stored = await AsyncStorage.getItem(this.shownNotificationIdsKey);
      if (stored) {
        const ids = JSON.parse(stored);
        this.shownNotificationIds = new Set(ids);
      }
    } catch (error) {
      // Silently handle errors
    }
  }

  // Save shown notification IDs to storage
  private async saveShownNotificationIds() {
    try {
      const idsArray = Array.from(this.shownNotificationIds);
      // Keep only last 100 to prevent storage bloat
      const idsToSave = idsArray.slice(-100);
      await AsyncStorage.setItem(this.shownNotificationIdsKey, JSON.stringify(idsToSave));
    } catch (error) {
      // Silently handle errors
    }
  }

  // Start polling for notifications
  async startPolling(userId: string) {
    // Stop existing polling if any
    if (this.isPolling) {
      this.stopPolling();
    }

    this.userId = userId;
    this.isPolling = true;
    
    // Load previously shown notification IDs
    await this.loadShownNotificationIds();
    
    // Register for push notifications
    await this.registerForPushNotifications();
    
    // Initial check
    await this.checkForNotifications();

    // Poll every 1 minute for new notifications
    this.pollingInterval = setInterval(() => {
      this.checkForNotifications();
    }, 60000); // 1 minute = 60000ms
  }

  // Stop polling
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    this.userId = null;
    this.lastCheckTime = 0; // Reset check time
    this.lastCheckedTime = null; // Reset notification tracking
    this.shownNotificationIds.clear(); // Clear shown notifications
  }

  // Check for new notifications
  private async checkForNotifications() {
    // Prevent multiple simultaneous requests
    if (this.isChecking) {
      return;
    }

    // Prevent too frequent checks - minimum 5 minutes between checks
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastCheckTime;
    if (timeSinceLastCheck < this.minCheckInterval) {
      return;
    }

    try {
      this.isChecking = true;
      this.lastCheckTime = now;

      if (!this.userId) {
        const userData = await AsyncStorage.getItem('user');
        if (!userData) {
          this.isChecking = false;
          return;
        }
        const user = JSON.parse(userData);
        this.userId = user.id;
      }

      const response = await api.get(`/notification?userId=${this.userId}`);

      if (response.data.success) {
        const notifications: NotificationData[] = response.data.data.notifications.map((notif: any) => ({
          id: notif._id || notif.id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          timestamp: notif.createdAt || notif.timestamp,
          isRead: notif.isRead,
          priority: notif.priority || 'medium',
          relatedUserId: notif.relatedUserId,
          avatar: notif.relatedUserId?.picture || notif.avatar,
        }));

        // Filter for unread notifications that are new (created after last check)
        // AND haven't been shown before
        const newNotifications = notifications.filter(notif => {
          // ⭐ CRITICAL: Check if already shown FIRST (before any other checks)
          if (this.shownNotificationIds.has(notif.id)) {
            return false; // Already shown - skip completely
          }
          
          // Skip if already read (backend should only send unread, but double check)
          if (notif.isRead) {
            return false;
          }
          
          if (!this.lastCheckedTime) {
            // First check or app refresh - only show notifications from last 30 seconds
            // This prevents showing old notifications when app starts
            const notifTime = new Date(notif.timestamp);
            const thirtySecondsAgo = new Date(Date.now() - 30000); // 30 seconds
            return notifTime > thirtySecondsAgo;
          }

          // Only show notifications created after last check
          const notifTime = new Date(notif.timestamp);
          return notifTime > this.lastCheckedTime;
        });

        // Notify callbacks about new notifications (only once per notification)
        // for (const notification of newNotifications) {
        //   // Mark as shown to prevent duplicate notifications
        //   this.shownNotificationIds.add(notification.id);
          
        //   // Play sound for new notifications
        //   await playNotificationSound();
          
        //   // Notify all subscribers
        //   this.callbacks.forEach(callback => {
        //     callback(notification);
        //   });
        // }

        // Process notifications one by one to ensure proper sequencing
        for (const notification of newNotifications) {
          // ⭐ STEP 1: Mark as shown IMMEDIATELY (BEFORE anything else) to prevent duplicate
          this.shownNotificationIds.add(notification.id);
          // Save to storage immediately so it persists across app restarts
          await this.saveShownNotificationIds();
          
          // ⭐ STEP 2: Mark as read IMMEDIATELY in backend so it won't be returned again
          try {
            await api.patch(`/notification/mark-read`, {
              notificationId: notification.id
            });
            // Update local state
            notification.isRead = true;
          } catch (err) {
            // Silently handle errors - continue even if mark-read fails
            // shownNotificationIds will prevent duplicate notifications
          }
        
          // ⭐ STEP 3: Show push notification on mobile (like other apps)
          await this.showPushNotification(notification);
        
          // ⭐ STEP 4: Play sound only once
          await playNotificationSound();
        
          // ⭐ STEP 5: Notify listeners (for in-app toast) - only after everything is set
          this.callbacks.forEach(callback => {
            callback(notification);
          });
        }
        
        // Clean up old shown notification IDs (keep only last 100 to prevent memory issues)
        if (this.shownNotificationIds.size > 100) {
          const idsArray = Array.from(this.shownNotificationIds);
          this.shownNotificationIds = new Set(idsArray.slice(-100)); // Keep last 100
          await this.saveShownNotificationIds();
        }
        // Update last checked time
        this.lastCheckedTime = new Date();
      }
    } catch (error) {
      // Silently handle network errors - server may be unavailable
      // Don't log errors to avoid cluttering console
    } finally {
      this.isChecking = false;
    }
  }

  // Manually check for notifications (useful for immediate checks)
  // This bypasses the minimum interval check for app refresh scenarios
  // But still respects a minimum of 30 seconds between manual checks
  async checkNow() {
    const now = Date.now();
    const timeSinceLastCheck = now - this.lastCheckTime;
    const minManualCheckInterval = 30000; // 30 seconds minimum for manual checks
    
    if (timeSinceLastCheck < minManualCheckInterval) {
      return;
    }

    // Temporarily reduce min interval for this check
    const originalMinInterval = this.minCheckInterval;
    this.minCheckInterval = minManualCheckInterval;
    await this.checkForNotifications();
    this.minCheckInterval = originalMinInterval;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

