import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather } from "@expo/vector-icons";
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from '../utils/notificationService';
import api from '../utils/api';

type GlobalSettings = {
  displayName: string;
  language: string;
  timezone: string;
  region: string;
  country: string;
  location: string;
  theme: string;
  fontSize: string;
  contentLayout: string;
};

type Props = {
  globalSettings: GlobalSettings;
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void;
  onLogout?: () => void;
};

const NOTIFICATION_PREFERENCE_KEY = 'notificationsEnabled';

const SettingsScreen: React.FC<Props> = ({ globalSettings, updateGlobalSettings, onLogout }) => {
  const [localSettings, setLocalSettings] = useState<GlobalSettings>({ ...globalSettings });
  const [savedMessage, setSavedMessage] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Helper function to start notification polling
  const startNotificationPolling = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        if (user.id) {
          await notificationService.startPolling(user.id);
        }
      }
    } catch (error) {
      console.error('Error starting notification polling:', error);
    }
  };

  // Load notification preference on mount
  useEffect(() => {
    const loadNotificationPreference = async () => {
      try {
        const stored = await AsyncStorage.getItem(NOTIFICATION_PREFERENCE_KEY);
        if (stored !== null) {
          const enabled = JSON.parse(stored);
          setNotificationsEnabled(enabled);
          
          // Apply the preference immediately
          if (enabled) {
            await startNotificationPolling();
          } else {
            notificationService.stopPolling();
          }
        } else {
          // Default to enabled if not set
          setNotificationsEnabled(true);
          await AsyncStorage.setItem(NOTIFICATION_PREFERENCE_KEY, JSON.stringify(true));
          await startNotificationPolling();
        }
      } catch (error) {
        console.error('Error loading notification preference:', error);
        // Default to enabled on error
        setNotificationsEnabled(true);
      }
    };

    loadNotificationPreference();
  }, []);

  useEffect(() => {
    setLocalSettings({ ...globalSettings });
  }, [globalSettings]);

  useEffect(() => {
    if (savedMessage) {
      const t = setTimeout(() => setSavedMessage(''), 3000);
      return () => clearTimeout(t);
    }
  }, [savedMessage]);

  const handleSettingChange = (key: keyof GlobalSettings, value: string) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
  };

  const toggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    
    try {
      // Save preference to AsyncStorage
      await AsyncStorage.setItem(NOTIFICATION_PREFERENCE_KEY, JSON.stringify(newValue));
      
      // Start or stop polling based on preference
      if (newValue) {
        await startNotificationPolling();
        setSavedMessage('Notifications enabled');
      } else {
        notificationService.stopPolling();
        setSavedMessage('Notifications disabled');
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      // Revert on error
      setNotificationsEnabled(!newValue);
    }
  };

  const handleExportData = async () => {
    try {
      setIsExporting(true);

      // Get user ID from AsyncStorage
      const userData = await AsyncStorage.getItem('user');
      if (!userData) {
        Alert.alert('Error', 'User not found. Please log in again.');
        setIsExporting(false);
        return;
      }

      const user = JSON.parse(userData);
      const userId = user.id || user._id;

      if (!userId) {
        Alert.alert('Error', 'User ID not found.');
        setIsExporting(false);
        return;
      }

      // Call backend API to get user data
      const response = await api.get(`/user/export/${userId}`);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to export data');
      }

      const exportData = response.data.data;

      // Convert data to JSON string with pretty formatting
      const jsonData = JSON.stringify(exportData, null, 2);

      // Create filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `GamerHive_Export_${timestamp}.json`;
      const fileUri = `${FileSystem.documentDirectory}${filename}`;

      // Write JSON file (UTF-8 is the default encoding)
      await FileSystem.writeAsStringAsync(fileUri, jsonData);

      setIsExporting(false);
      setSavedMessage('Data exported successfully');

      // Share the file using expo-sharing
      try {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: 'Export Your GamerHive Data',
          });
        } else {
          // If sharing is not available, just show success message
          Alert.alert(
            'Export Successful',
            `Your data has been exported successfully!\n\nFile: ${filename}\n\nYou can find it in your app's document directory.`,
            [{ text: 'OK' }]
          );
        }
      } catch (shareError: any) {
        console.error('Error sharing file:', shareError);
        // Show success message even if sharing fails
        Alert.alert(
          'Export Successful',
          `Your data has been exported successfully!\n\nFile: ${filename}\n\nYou can find it in your app's document directory.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('Error exporting data:', error);
      setIsExporting(false);
      Alert.alert(
        'Export Failed',
        error.response?.data?.message || error.message || 'Failed to export data. Please try again.'
      );
    }
  };

  const confirmDangerAction = async (type: 'deactivate' | 'delete') => {
    const title = type === 'delete' ? 'Delete Account' : 'Deactivate Account';
    const message =
      type === 'delete'
        ? 'Are you sure you want to permanently delete your account and all data? This cannot be undone.'
        : 'Are you sure you want to temporarily deactivate your account? You can reactivate later by logging back in.';
    
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: type === 'delete' ? 'Delete' : 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          try {
            if (type === 'deactivate') {
              // Get user ID from AsyncStorage
              const userData = await AsyncStorage.getItem('user');
              if (!userData) {
                Alert.alert('Error', 'User not found. Please log in again.');
                return;
              }

              const user = JSON.parse(userData);
              const userId = user.id || user._id;

              // Call API to deactivate account
              const response = await api.put('/user/account-status', {
                userId,
                isActive: false,
              });

              if (response.data.success) {
                // Update user data in AsyncStorage
                const updatedUser = { ...user, isActive: false };
                await AsyncStorage.setItem('user', JSON.stringify(updatedUser));

                // Stop notification polling
                notificationService.stopPolling();

                // Clear token to force logout
                await AsyncStorage.removeItem('token');

                Alert.alert(
                  'Account Deactivated',
                  'Your account has been deactivated. You can reactivate it by logging in again.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Call logout handler if provided, otherwise the app will handle it
                        if (onLogout) {
                          onLogout();
                        }
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('Error', response.data.message || 'Failed to deactivate account');
              }
            } else {
              // Delete account
              setIsDeletingAccount(true);
              try {
                const userData = await AsyncStorage.getItem('user');
                if (!userData) {
                  Alert.alert('Error', 'User not found. Please log in again.');
                  setIsDeletingAccount(false);
                  return;
                }

                const user = JSON.parse(userData);
                const userId = user.id || user._id;

                // Call API to delete account
                const response = await api.delete('/user/account', {
                  data: { userId },
                });

                if (response.data.success) {
                  // Stop notification polling
                  notificationService.stopPolling();

                  // Clear all stored data
                  await AsyncStorage.removeItem('token');
                  await AsyncStorage.removeItem('user');

                  setIsDeletingAccount(false);

                  Alert.alert(
                    'Account Deleted',
                    'Your account and all associated data have been permanently deleted.',
                    [
                      {
                        text: 'OK',
                        onPress: () => {
                          // Call logout handler
                          if (onLogout) {
                            onLogout();
                          }
                        },
                      },
                    ]
                  );
                } else {
                  setIsDeletingAccount(false);
                  Alert.alert('Error', response.data.message || 'Failed to delete account');
                }
              } catch (error: any) {
                console.error('Error deleting account:', error);
                setIsDeletingAccount(false);
                Alert.alert(
                  'Error',
                  error.response?.data?.message || error.message || 'Failed to delete account. Please try again.'
                );
              }
            }
          } catch (error: any) {
            console.error('Error with account action:', error);
            setIsDeletingAccount(false);
            Alert.alert(
              'Error',
              error.response?.data?.message || error.message || 'Failed to perform account action. Please try again.'
            );
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>
          Customize your GamerHive experience with personalized settings and preferences.
        </Text>

        {savedMessage !== '' && (
          <View style={styles.savedBanner}>
            <Feather name="check" size={16} color="#a3e635" />
            <Text style={styles.savedText}> {savedMessage}</Text>
          </View>
        )}
      </View>

      {/* All sections combined in one scrollable page */}

      {/* Notifications */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Feather name="bell" size={20} color="#a78bfa" />
          <Text style={styles.cardTitle}>Notification Preferences</Text>
        </View>

        <View style={styles.notificationRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.notificationTitle}>Notifications</Text>
            <Text style={styles.notificationDesc}>Enable or disable all notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: '#374151', true: '#7c3aed' }}
            thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
          />
        </View>
      </View>

      {/* Data Management */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Feather name="database" size={20} color="#a78bfa" />
          <Text style={styles.cardTitle}>Data Management</Text>
        </View>

        <TouchableOpacity
          style={[styles.actionRow, isExporting && { opacity: 0.6 }]}
          onPress={handleExportData}
          disabled={isExporting}
        >
          <View style={styles.actionLeft}>
            {isExporting ? (
              <ActivityIndicator size="small" color="#60a5fa" style={{ marginRight: 10 }} />
            ) : (
            <Feather name="download" size={18} color="#60a5fa" />
            )}
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.actionTitle}>
                {isExporting ? 'Exporting Data...' : 'Export Data'}
              </Text>
              <Text style={styles.actionDesc}>Download your profile and gaming data</Text>
            </View>
          </View>
          {!isExporting && <Feather name="chevron-right" size={16} color="#c4b5fd" />}
        </TouchableOpacity>
      </View>

      {/* Danger Zone */}
      <View style={[styles.card, styles.dangerCard]}>
        <View style={styles.cardHeader}>
          <Feather name="alert-triangle" size={20} color="#fb7185" />
          <Text style={[styles.cardTitle, { color: '#fb7185' }]}>Danger Zone</Text>
        </View>

        <TouchableOpacity
          style={[styles.actionRow, styles.dangerActionRow]}
          onPress={() => confirmDangerAction('deactivate')}
        >
          <View style={styles.actionLeft}>
            <Feather name="eye-off" size={18} color="#fb7185" />
            <View style={styles.actionTextContainer}>
              <Text style={[styles.actionTitle, { color: '#fecaca' }]}>Deactivate Account</Text>
              <Text style={[styles.actionDesc, { color: '#fecaca' }]}>Temporarily disable your account</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={16} color="#fecaca" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionRow, styles.dangerActionRow, isDeletingAccount && { opacity: 0.6 }]}
          onPress={() => confirmDangerAction('delete')}
          disabled={isDeletingAccount}
        >
          <View style={styles.actionLeft}>
            {isDeletingAccount ? (
              <ActivityIndicator size="small" color="#fb7185" style={{ marginRight: 10 }} />
            ) : (
            <Feather name="trash-2" size={18} color="#fb7185" />
            )}
            <View style={styles.actionTextContainer}>
              <Text style={[styles.actionTitle, { color: '#fecaca' }]}>
                {isDeletingAccount ? 'Deleting Account...' : 'Delete Account'}
              </Text>
              <Text style={[styles.actionDesc, { color: '#fecaca' }]} numberOfLines={2}>
                Permanently delete your account and all data
              </Text>
            </View>
          </View>
          {!isDeletingAccount && <Feather name="chevron-right" size={16} color="#fecaca" />}
        </TouchableOpacity>
      </View>

      {/* Bottom spacing */}
      <View style={{ height: 48 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220' },
  contentContainer: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 12 },
  title: { fontSize: 32, fontWeight: '700', color: '#EDE9FE', marginBottom: 6 },
  subtitle: { color: '#C7B7F5', fontSize: 14, marginBottom: 12 },
  savedBanner: {
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderRadius: 10,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  savedText: { color: '#86efac', marginLeft: 6 },

  card: {
    backgroundColor: 'rgba(17,24,39,0.6)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.12)',
  },
  dangerCard: { borderColor: 'rgba(239,68,68,0.18)', backgroundColor: 'rgba(17,24,39,0.55)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardTitle: { color: '#fff', fontSize: 18, marginLeft: 10, fontWeight: '600' },

  notificationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderRadius: 8 },
  notificationTitle: { color: '#fff', fontWeight: '600' },
  notificationDesc: { color: '#c7b7f5', fontSize: 12 },

  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(148,163,184,0.04)' },
  dangerActionRow: { backgroundColor: 'rgba(220,38,38,0.06)', borderColor: 'rgba(220,38,38,0.2)' },
  actionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  actionTextContainer: { marginLeft: 10, flex: 1, minWidth: 0 },
  actionTitle: { color: '#fff', fontWeight: '600', fontSize: 15 },
  actionDesc: { color: '#c7b7f5', fontSize: 12, marginTop: 2 },

});

export default SettingsScreen;
