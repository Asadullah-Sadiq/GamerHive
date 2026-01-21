import React, { useEffect, useState } from 'react';
import { 
  Bell,
  Database,
  Download,
  AlertTriangle, 
  EyeOff, 
  Trash2,
  Check,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { apiRequest, getStoredUser, clearAuthSession } from '../utils/api';

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

const SettingsPage: React.FC<Props> = ({ globalSettings, onLogout }) => {
  const [savedMessage, setSavedMessage] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Load notification preference on mount
  useEffect(() => {
    const loadNotificationPreference = async () => {
      try {
        const stored = localStorage.getItem(NOTIFICATION_PREFERENCE_KEY);
        if (stored !== null) {
          const enabled = JSON.parse(stored);
          setNotificationsEnabled(enabled);
        } else {
          // Default to enabled if not set
          setNotificationsEnabled(true);
          localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, JSON.stringify(true));
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
    if (savedMessage) {
      const t = setTimeout(() => setSavedMessage(''), 3000);
      return () => clearTimeout(t);
    }
  }, [savedMessage]);

  const toggleNotifications = async () => {
    const newValue = !notificationsEnabled;
    setNotificationsEnabled(newValue);
    
    try {
      // Save preference to localStorage
      localStorage.setItem(NOTIFICATION_PREFERENCE_KEY, JSON.stringify(newValue));
      
      if (newValue) {
        setSavedMessage('Notifications enabled');
      } else {
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

      // Get user ID from localStorage
      const user = getStoredUser();
      if (!user) {
        alert('User not found. Please log in again.');
        setIsExporting(false);
        return;
      }

      const userId = user.id;

      if (!userId) {
        alert('User ID not found.');
        setIsExporting(false);
        return;
      }

      // Call backend API to get user data
      const response = await apiRequest<{ data: any }>(`/user/export/${userId}`);

      if (!response.success || !response.data) {
        throw new Error((response as any).message || 'Failed to export data');
      }

      const exportData = response.data;

      // Convert data to JSON string with pretty formatting
      const jsonData = JSON.stringify(exportData, null, 2);

      // Create filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const filename = `GamerHive_Export_${timestamp}.json`;

      // Create blob and download
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsExporting(false);
      setSavedMessage('Data exported successfully');
    } catch (error: any) {
      console.error('Error exporting data:', error);
      setIsExporting(false);
      alert(
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
    
    if (!window.confirm(`${title}\n\n${message}`)) {
      return;
    }

    try {
      if (type === 'deactivate') {
        // Get user ID from localStorage
        const user = getStoredUser();
        if (!user) {
          alert('User not found. Please log in again.');
          return;
        }

        const userId = user.id;

        // Call API to deactivate account
        const response = await apiRequest<{ data: { isActive: boolean; userId: string } }>('/user/account-status', {
          method: 'PUT',
          body: JSON.stringify({
            userId,
            isActive: false,
          }),
        });

        if (response.success) {
          // Update user data in localStorage
          const updatedUser = { ...user, isActive: false };
          localStorage.setItem('user', JSON.stringify(updatedUser));

          // Clear token to force logout
          clearAuthSession();

          alert(
            'Account Deactivated\n\nYour account has been deactivated. You can reactivate it by logging in again.'
          );

          // Call logout handler if provided
          if (onLogout) {
            onLogout();
          }
        } else {
          alert((response as any).message || 'Failed to deactivate account');
        }
      } else {
        // Delete account
        setIsDeletingAccount(true);
        try {
          const user = getStoredUser();
          if (!user) {
            alert('User not found. Please log in again.');
            setIsDeletingAccount(false);
            return;
          }

          const userId = user.id;

          // Call API to delete account
          const response = await apiRequest('/user/account', {
            method: 'DELETE',
            body: JSON.stringify({ userId }),
          });

          if (response.success) {
            // Clear all stored data
            clearAuthSession();

            setIsDeletingAccount(false);

            alert(
              'Account Deleted\n\nYour account and all associated data have been permanently deleted.'
            );

            // Call logout handler
            if (onLogout) {
              onLogout();
            }
          } else {
            setIsDeletingAccount(false);
            alert((response as any).message || 'Failed to delete account');
          }
        } catch (error: any) {
          console.error('Error deleting account:', error);
          setIsDeletingAccount(false);
          alert(
            error.response?.data?.message || error.message || 'Failed to delete account. Please try again.'
          );
        }
      }
    } catch (error: any) {
      console.error('Error with account action:', error);
      setIsDeletingAccount(false);
      alert(
        error.response?.data?.message || error.message || 'Failed to perform account action. Please try again.'
      );
    }
  };

                return (
    <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <div className="p-4 md:p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Settings</h1>
          <p className="text-purple-200/80 text-sm md:text-base">
            Customize your GamerHive experience with personalized settings and preferences.
          </p>

          {savedMessage !== '' && (
            <div className="mt-4 bg-green-900/30 border border-green-500/30 rounded-lg p-3 flex items-center space-x-2">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm">{savedMessage}</span>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4 mb-4">
          <div className="flex items-center space-x-3 mb-4">
            <Bell className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Notification Preferences</h2>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="flex-1">
              <p className="text-white font-medium">Notifications</p>
              <p className="text-purple-300/70 text-sm">Enable or disable all notifications</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={toggleNotifications}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4 mb-4">
          <div className="flex items-center space-x-3 mb-4">
            <Database className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Data Management</h2>
          </div>

          <button
            className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
              isExporting
                ? 'opacity-60 cursor-not-allowed border-slate-600/50'
                : 'border-slate-600/30 hover:border-purple-500/50 hover:bg-slate-700/30'
            }`}
            onClick={handleExportData}
            disabled={isExporting}
          >
            <div className="flex items-center space-x-3">
              {isExporting ? (
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              ) : (
              <Download className="w-5 h-5 text-blue-400" />
              )}
              <div className="text-left">
                <p className="text-white font-medium">
                  {isExporting ? 'Exporting Data...' : 'Export Data'}
                </p>
                <p className="text-purple-300/70 text-sm">Download your profile and gaming data</p>
              </div>
            </div>
            {!isExporting && <ChevronRight className="w-5 h-5 text-purple-300" />}
          </button>
      </div>

      {/* Danger Zone */}
        <div className="bg-red-900/20 backdrop-blur-sm rounded-xl border border-red-500/30 p-4">
          <div className="flex items-center space-x-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
          </div>

          <button
            className="w-full flex items-center justify-between p-3 rounded-lg border border-red-500/30 bg-red-900/30 hover:bg-red-900/50 transition-all mb-3"
            onClick={() => confirmDangerAction('deactivate')}
          >
            <div className="flex items-center space-x-3">
              <EyeOff className="w-5 h-5 text-red-400" />
              <div className="text-left">
                <p className="text-red-300 font-medium">Deactivate Account</p>
                <p className="text-red-300/70 text-sm">Temporarily disable your account</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-red-300" />
          </button>
          
          <button
            className={`w-full flex items-center justify-between p-3 rounded-lg border border-red-500/30 bg-red-900/30 hover:bg-red-900/50 transition-all ${
              isDeletingAccount ? 'opacity-60 cursor-not-allowed' : ''
            }`}
            onClick={() => confirmDangerAction('delete')}
            disabled={isDeletingAccount}
          >
            <div className="flex items-center space-x-3">
              {isDeletingAccount ? (
                <Loader2 className="w-5 h-5 text-red-400 animate-spin" />
              ) : (
              <Trash2 className="w-5 h-5 text-red-400" />
              )}
              <div className="text-left">
                <p className="text-red-300 font-medium">
                  {isDeletingAccount ? 'Deleting Account...' : 'Delete Account'}
                </p>
                <p className="text-red-300/70 text-sm">Permanently delete your account and all data</p>
              </div>
            </div>
            {!isDeletingAccount && <ChevronRight className="w-5 h-5 text-red-300" />}
          </button>
        </div>

        {/* Bottom spacing */}
        <div className="h-12" />
      </div>
    </main>
  );
};

export default SettingsPage;
