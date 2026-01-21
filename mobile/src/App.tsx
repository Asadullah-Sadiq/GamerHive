import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, StatusBar, ActivityIndicator, Alert, BackHandler, Text, AppState, AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigationHistory } from "./hooks/useNavigationHistory";
import { notificationService, NotificationData } from "./utils/notificationService";
import CustomToast from "./components/CustomToast";
import { toastManager } from "./utils/toastManager";
import SplashScreen from "./components/SplashScreen";

// Components
import AuthPage from "./components/AuthPage";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import MainContent from "./components/MainContent";
import AdminDashboard from "./components/AdminDashboard";
import UserProfilePage from "./components/UserProfilePage";
import AdminProfilePage from "./components/AdminProfilePage";
import AdminAnalyticsPage from "./components/AdminAnalyticsPage";
import AdminUsersPage from "./components/AdminUsersPage";
import CommunitiesPage from "./components/CommunitiesPage";
import JoinCommunityPage from "./components/JoinCommunityPage";
import TournamentPage from "./components/TournamentPage";
import GameBorrowingPage from "./components/GameBorrowingPage";
import SettingsPage from "./components/SettingsPage";
import AboutUsPage from "./components/AboutUsPage";
import ContactUsPage from "./components/ContactUsPage";
import NotificationPage from "./components/NotificationPage"; // ✅ NEW IMPORT
import FriendsListPage from "./components/FriendsListPage"; // ✅ NEW IMPORT
import FriendRequestsPage from "./components/FriendRequestsPage"; // ✅ NEW IMPORT
import WelcomeSplash from "./components/WelcomeSplash"; // ✅ NEW IMPORT
import PTPMessagingPage from "./components/PTPMessagingPage"; // ✅ NEW IMPORT
import FeedbackPage from "./components/FeedbackPage"; // ✅ NEW IMPORT
import FriendMessagingPage from "./components/FriendMessagingPage";

import { PageType } from "../types";

// Admin email - change this to your admin email
const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";

// Types
interface GlobalSettings {
  displayName: string;
  language: string;
  timezone: string;
  region: string;
  country: string;
  location: string;
  theme: string;
  fontSize: string;
  contentLayout: string;
}

const defaultCommunity = {
  id: "1",
  name: "PUBG Warriors",
  game: "PUBG Mobile",
  description:
    "Elite battle royale community for competitive PUBG players. Join us for daily scrims and tournaments.",
  members: 15420,
  activeMembers: 3240,
  createdDate: "2022-03-15",
  category: "Battle Royale",
  level: "Pro" as const,
  image:
    "https://images.pexels.com/photos/3165335/pexels-photo-3165335.jpeg?auto=compress&cs=tinysrgb&w=400",
  color: "#ff4d4d",
  icon: () => null,
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentPage, setCurrentPage] = useState<PageType>("home");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ id: string; type: 'info' | 'success' | 'error'; title: string; message: string; onPress?: () => void } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showWelcomeSplash, setShowWelcomeSplash] = useState(false);
  const [splashUsername, setSplashUsername] = useState<string | undefined>(undefined);

  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    displayName: "GamerPro",
    language: "English",
    timezone: "UTC+5 (Pakistan Standard Time)",
    region: "Asia",
    country: "Pakistan",
    location: "Lahore",
    theme: "Dark Mode",
    fontSize: "Medium",
    contentLayout: "Spacious",
  });

  // Navigation history hook
  const navigationHistory = useNavigationHistory();

  // ✅ Unified navigation function
  const [navigationParams, setNavigationParams] = useState<any>({});

  const goToPage = (page: PageType, params?: any) => {
    // Add to navigation history
    navigationHistory.navigate(page, params);
    
    setCurrentPage(page);
    setIsSidebarOpen(false);
    if (params) {
      setNavigationParams(params);
    } else {
      setNavigationParams({});
    }
  };

  // Handle back navigation
  const handleBack = useCallback(() => {
    const previousState = navigationHistory.goBack();
    if (previousState) {
      setCurrentPage(previousState.page);
      setNavigationParams(previousState.params || {});
      setIsSidebarOpen(false);
      return true; // Prevent default back behavior
    }
    return false; // Allow default back behavior (exit app)
  }, [navigationHistory]);

  // Handle forward navigation
  const handleForward = useCallback(() => {
    const nextState = navigationHistory.goForward();
    if (nextState) {
      setCurrentPage(nextState.page);
      setNavigationParams(nextState.params || {});
      setIsSidebarOpen(false);
    }
  }, [navigationHistory]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isSidebarOpen) {
        setIsSidebarOpen(false);
        return true;
      }
      return handleBack();
    });

    return () => backHandler.remove();
  }, [isSidebarOpen, handleBack]);

  const handleAuthSuccess = async () => {
    // Load user data first
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        // Update global settings with user data
        setGlobalSettings(prev => ({
          ...prev,
          displayName: user.username || user.name || prev.displayName,
          location: user.location || prev.location,
          country: user.country || prev.country,
          region: user.region || prev.region,
        }));
        
        // Check if user is admin
        setCurrentUserId(user.id || user._id);
        if (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }

        // Set username for splash screen
        setSplashUsername(user.username || user.name);
      }
    } catch (error) {
      console.error('Error loading user data after login:', error);
    }

    // Show welcome splash screen
    setIsAuthenticated(true);
    setShowWelcomeSplash(true);
  };

  const handleSplashComplete = () => {
    setShowWelcomeSplash(false);
    // Navigate to appropriate dashboard
    // The renderCurrentPage will handle showing admin or user dashboard
    setCurrentPage("home");
  };
  const handleLogout = async () => {
    try {
      // Stop notification polling
      notificationService.stopPolling();
      
      // Clear stored authentication data
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
    setIsAuthenticated(false);
    setCurrentPage("home");
    setIsSidebarOpen(false);
    setIsAdmin(false);
    setCurrentUserId(null);
  };

  const updateGlobalSettings = (newSettings: Partial<GlobalSettings>) => {
    setGlobalSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  // Check if user is already logged in on app start
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const user = await AsyncStorage.getItem('user');
        
        if (token && user) {
          const userData = JSON.parse(user);
          
          // Check if account is deactivated
          if (userData.isActive === false) {
            // Account is deactivated - clear auth and force login
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            setIsAuthenticated(false);
            setIsCheckingAuth(false);
            Alert.alert(
              'Account Deactivated',
              'Your account has been deactivated. Please log in again to reactivate it.',
              [{ text: 'OK' }]
            );
            return;
          }

          // User is already logged in and account is active
          setIsAuthenticated(true);
          // Don't show splash screen for already authenticated users
          setShowWelcomeSplash(false);
          
          // Update global settings with user data
          if (userData.username) {
            setGlobalSettings(prev => ({
              ...prev,
              displayName: userData.username,
            }));
          }
          
          // Check if user is admin
          setCurrentUserId(userData.id || userData._id);
          if (userData.email && userData.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Set up toast manager listener
  useEffect(() => {
    const unsubscribe = toastManager.subscribe((toastData) => {
      setToast(toastData);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Set up notification polling when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      // Stop polling if user logs out
      notificationService.stopPolling();
      return;
    }

    let unsubscribe: (() => void) | null = null;

    const setupNotifications = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          if (user.id) {
            // Always subscribe to notifications (for handling when they arrive)
            unsubscribe = notificationService.subscribe((notification: NotificationData) => {
              // Show toast notification
              const getToastType = (): 'info' | 'success' | 'error' => {
                if (notification.type === 'friend_request') return 'info';
                if (notification.type === 'friend_request_accepted') return 'success';
                if (notification.priority === 'high') return 'error';
                return 'info';
              };

              toastManager.show(
                getToastType(),
                notification.title,
                notification.message,
                () => {
                  // Navigate to notifications page or profile if friend request
                  if (notification.type === 'friend_request' && notification.relatedUserId) {
                    const targetUserId = notification.relatedUserId._id || notification.relatedUserId;
                    goToPage('profile', { targetUserId });
                  } else {
                    goToPage('notifications');
                  }
                }
              );
            });

            // Check notification preference before starting polling
            const notificationPreference = await AsyncStorage.getItem('notificationsEnabled');
            const notificationsEnabled = notificationPreference === null ? true : JSON.parse(notificationPreference);
            
            // Start polling only if notifications are enabled
            if (notificationsEnabled) {
              await notificationService.startPolling(user.id);
            } else {
              // Ensure polling is stopped if disabled
              notificationService.stopPolling();
            }
          }
        }
      } catch (error) {
        // Silently handle notification setup errors - server may be unavailable
      }
    };

    setupNotifications();

    // Cleanup on unmount or when isAuthenticated changes
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      notificationService.stopPolling();
    };
  }, [isAuthenticated, goToPage]);

  // Check notifications when app comes to foreground (refresh)
  // Use debouncing and throttling to prevent too frequent checks
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let debounceTimer: NodeJS.Timeout | null = null;
    let lastAppState: AppStateStatus = AppState.currentState;
    let lastForegroundCheck = 0;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // Only check when app comes from background/inactive to active
      if (lastAppState !== 'active' && nextAppState === 'active') {
        // Check notification preference before checking notifications
        try {
          const notificationPreference = await AsyncStorage.getItem('notificationsEnabled');
          const notificationsEnabled = notificationPreference === null ? true : JSON.parse(notificationPreference);
          
          // If notifications are disabled, don't check
          if (!notificationsEnabled) {
            lastAppState = nextAppState;
            return;
          }
        } catch (error) {
          // If error reading preference, default to enabled
        }

        const now = Date.now();
        // Throttle - only check if at least 30 seconds have passed since last foreground check
        if (now - lastForegroundCheck < 30000) {
          lastAppState = nextAppState;
          return;
        }

        // Debounce - wait 3 seconds before checking
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          // App came to foreground - check for notifications
          lastForegroundCheck = Date.now();
          notificationService.checkNow();
        }, 3000); // 3 second debounce
      }
      lastAppState = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      subscription.remove();
    };
  }, [isAuthenticated]);

  // Show splash screen first
  if (showSplash) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SplashScreen
            onComplete={() => {
              setShowSplash(false);
            }}
          />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  // Show loading screen while checking auth
  if (isCheckingAuth) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // Show welcome splash screen
  if (showWelcomeSplash) {
    return <WelcomeSplash onComplete={handleSplashComplete} username={splashUsername} />;
  }

  const showSidebarToggle = currentPage !== "joinCommunity" && currentPage !== "ptpMessaging";

  // ✅ Added NotificationPage in navigation
  const renderCurrentPage = () => {
    switch (currentPage) {
      case "adminAnalytics":
        return <AdminAnalyticsPage onBack={() => goToPage("profile")} />;
      case "adminUsers":
        return <AdminUsersPage onBack={() => goToPage("profile")} goToPage={goToPage} />;
      case "profile":
        // Check if admin and viewing own profile (no targetUserId)
        const isViewingOwnProfile = !navigationParams?.targetUserId || navigationParams?.targetUserId === currentUserId;
        if (isAdmin && isViewingOwnProfile) {
          return (
            <AdminProfilePage
              goToPage={goToPage}
            />
          );
        }
        return (
          <UserProfilePage
            globalSettings={globalSettings}
            updateGlobalSettings={updateGlobalSettings}
            targetUserId={navigationParams?.targetUserId}
            goToPage={goToPage}
          />
        );
      case "communities":
        return (
          <CommunitiesPage 
            onSelectCommunity={(community) => {
              goToPage("joinCommunity", { community });
            }}
            selectedCommunityId={navigationParams?.selectedCommunityId}
          />
        );
      case "joinCommunity":
        return (
          <JoinCommunityPage
            community={navigationParams?.community || defaultCommunity}
            onBack={() => goToPage("communities")}
            onViewProfile={(userId: string) => {
              goToPage("profile", { targetUserId: userId });
            }}
          />
        );
      case "tournaments":
        return <TournamentPage />;
      case "gameBorrowing":
        return <GameBorrowingPage goToPage={goToPage} />;
      case "settings":
        return (
          <SettingsPage
            globalSettings={globalSettings}
            updateGlobalSettings={updateGlobalSettings}
            onLogout={handleLogout}
          />
        );
      case "about":
        return <AboutUsPage />;
      case "contact":
        return <ContactUsPage />;
      case "notifications": // ✅ NEW PAGE
        return <NotificationPage />;
      case "friendsList": // ✅ NEW PAGE
        return <FriendsListPage goToPage={goToPage} onBack={() => goToPage('profile')} />;
      case "friendRequests": // ✅ NEW PAGE
        return <FriendRequestsPage goToPage={goToPage} onBack={() => goToPage('profile')} />;
      case "ptpMessaging": // ✅ NEW PAGE
        return (
          <PTPMessagingPage
            targetUserId={navigationParams?.targetUserId}
            targetUsername={navigationParams?.targetUsername}
            targetUserAvatar={navigationParams?.targetUserAvatar}
            onBack={() => { handleBack(); }}
          />
        );
      case "friendMessaging":
        return <FriendMessagingPage goToPage={goToPage} />;
      case "feedback": // ✅ NEW PAGE
        return <FeedbackPage onBack={() => goToPage('home')} />;
      default:
        // Show Admin Dashboard for admin users, MainContent for regular users
        if (isAdmin) {
          return <AdminDashboard />;
        }
        return <MainContent goToPage={goToPage} />;
    }
  };

  return (
    <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

        {/* Header */}
        <Header
          displayName={globalSettings.displayName}
          goToPage={goToPage}
          showToggle={showSidebarToggle}
        />

        {/* Page Content */}
        <View style={styles.pageContainer}>{renderCurrentPage()}</View>

        {/* Sidebar */}
        {showSidebarToggle && (
          <Sidebar
            isOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
            onNavigate={goToPage}
            currentPage={currentPage}
            displayName={globalSettings.displayName}
            onLogout={handleLogout}
          />
        )}

        {/* Toast Notifications */}
        <CustomToast 
          toast={toast}
          onHide={() => toastManager.hide()}
        />
      </View>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  pageContainer: {
    flex: 1,
    padding: 10,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
    justifyContent: "center",
    alignItems: "center",
  },
});
