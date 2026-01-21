import { useEffect, useState, useCallback } from 'react';
import { Routes, Route, useNavigate, useLocation, useParams, Navigate } from 'react-router-dom';
import AuthPage from './components/AuthPage';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import CommunitiesPage from './components/CommunitiesPage';
import UserProfilePage from './components/UserProfilePage';
import TournamentPage from './components/TournamentPage';
import GameBorrowingPage from './components/GameBorrowingPage';
import SettingsPage from './components/SettingsPage';
import NotificationPage from './components/NotificationPage';
import ContactUsPage from './components/ContactUsPage';
import AboutUsPage from './components/AboutUsPage';
import FriendMessagingPage from './components/FriendMessagingPage';
import PTPMessagingPage from './components/PTPMessagingPage';
import JoinCommunityPage from './components/JoinCommunityPage';
import AdminDashboard from './components/AdminDashboard';
import AdminProfilePage from './components/AdminProfilePage';
import AdminAnalyticsPage from './components/AdminAnalyticsPage';
import AdminUsersPage from './components/AdminUsersPage';
import FeedbackPage from './components/FeedbackPage';
import FriendRequestsPage from './components/FriendRequestsPage';
import FriendsListPage from './components/FriendsListPage';
import CustomToast from './components/CustomToast';
import { clearAuthSession, getStoredUser, getAuthToken } from './utils/api';
import { toastManager } from './utils/toastManager';
import { socketService, NotificationData } from './utils/socketService';

// Admin email - same as in Sidebar
const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";

// Helper function to check if user is admin
const isAdminUser = (): boolean => {
  try {
    const user = getStoredUser();
    return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  } catch {
    return false;
  }
};

// Check authentication status from localStorage (single source of truth)
// This function is called synchronously on every render, so it's always up-to-date
const isAuthenticated = (): boolean => {
  try {
    const token = getAuthToken();
    if (!token) {
      return false;
    }
    
    const user = getStoredUser();
    if (!user) {
      return false;
    }
    
    // User must have an id field to be considered authenticated
    if (!user.id) {
      console.warn('[isAuthenticated] User object missing id field:', user);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('[isAuthenticated] Error checking authentication:', error);
    return false;
  }
};

// ProtectedRoute component - redirects to /login if not authenticated
interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const auth = isAuthenticated();
  
  if (!auth) {
    // Log for debugging OAuth redirect issues
    const token = getAuthToken();
    const user = getStoredUser();
    console.log('[ProtectedRoute] Not authenticated:', { hasToken: !!token, hasUser: !!user, user });
    return <Navigate to="/login" replace />;
  }
  
  if (adminOnly && !isAdminUser()) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// PublicRoute component - redirects to dashboard if authenticated
function PublicRoute({ children }: { children: React.ReactNode }) {
  const auth = isAuthenticated();
  
  if (auth) {
    // Redirect to appropriate dashboard
    if (isAdminUser()) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toast, setToast] = useState<{ id: string; type: 'info' | 'success' | 'error'; title: string; message: string; onPress?: () => void } | null>(null);

  // Global settings state
  const [globalSettings, setGlobalSettings] = useState({
    displayName: 'GamerPro',
    language: 'English',
    timezone: 'UTC-8 (Pacific Standard Time)',
    region: 'United States',
    country: 'United States',
    location: 'Los Angeles, CA',
    theme: 'Dark Mode',
    fontSize: 'Medium',
    contentLayout: 'Spacious'
  });

  // Hydrate global settings from stored user on mount and when location changes
  useEffect(() => {
    const user = getStoredUser();
    if (user?.username) {
      setGlobalSettings((prev) => ({
        ...prev,
        displayName: user.username || prev.displayName,
      }));
    }
  }, [location.pathname]); // Re-check on route changes to catch OAuth redirects

  // Set up toast manager listener
  useEffect(() => {
    const unsubscribe = toastManager.subscribe((toastData) => {
      setToast(toastData);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Set up socket notification listener
  useEffect(() => {
    const user = getStoredUser();
    if (!user?.id) return;

    // Connect socket if not connected
    if (!socketService.isConnected()) {
      socketService.connect(user.id, user.username || 'User');
    }

    socketService.setEventHandlers({
      onNotification: (notification: NotificationData) => {
        const getToastType = (): 'info' | 'success' | 'error' => {
          if (notification.type === 'friend_request_accepted') return 'success';
          if (notification.type === 'admin_community' || notification.type === 'admin_tournament' || notification.type === 'admin_game') return 'info';
          if (notification.type === 'error') return 'error';
          return 'info';
        };

        toastManager.show(
          getToastType(),
          notification.title,
          notification.message,
          () => {
            navigate('/notifications');
          }
        );
      },
    });

    return () => {
      socketService.removeEventHandler('onNotification');
    };
  }, [navigate]);

  // Handle auth success callback
  const handleAuthSuccess = useCallback(() => {
    // Refresh display name from localStorage user
    const user = getStoredUser();
    if (user?.username) {
      setGlobalSettings((prev) => ({ ...prev, displayName: user.username || prev.displayName }));
    }
    // Navigation will be handled by PublicRoute redirect
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    setIsSidebarOpen(false);
    navigate('/login', { replace: true });
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Route mapping for navigation
  const navigateToPage = (page: string, params?: any) => {
    setIsSidebarOpen(false); // Close sidebar on mobile after navigation
    
    // Map page names to routes
    const routeMap: { [key: string]: string } = {
      'home': '/dashboard',
      'communities': '/communities',
      'joinCommunity': `/communities/${params?.community?.id || params?.communityId || ''}`,
      'profile': params?.targetUserId ? `/profile/${params.targetUserId}` : '/profile',
      'friendRequests': params?.targetUserId ? `/profile/${params.targetUserId}/friend-requests` : '/profile/friend-requests',
      'friendsList': params?.targetUserId ? `/profile/${params.targetUserId}/friends` : '/profile/friends',
      'friendMessaging': '/messages',
      'ptpMessaging': `/messages/${params?.targetUserId || ''}`,
      'tournaments': '/tournaments',
      'borrowing': '/borrowing',
      'settings': '/settings',
      'notifications': '/notifications',
      'contact': '/contact',
      'about': '/about',
      'feedback': '/feedback',
      'adminDashboard': '/admin/dashboard',
      'adminProfile': '/admin/profile',
      'adminAnalytics': '/admin/analytics',
      'adminUsers': '/admin/users',
    };
    
    const route = routeMap[page] || '/dashboard';
    navigate(route);
  };

  const updateGlobalSettings = (newSettings: Partial<typeof globalSettings>) => {
    setGlobalSettings(prev => ({ ...prev, ...newSettings }));
  };

  // Shared layout component for authenticated pages
  const AuthenticatedLayout = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      <Header 
        isSidebarOpen={isSidebarOpen} 
        toggleSidebar={toggleSidebar}
        displayName={globalSettings.displayName}
        onNavigate={navigateToPage}
      />
      
      <div className="flex relative">
        <Sidebar 
          isOpen={isSidebarOpen} 
          toggleSidebar={toggleSidebar}
          onLogout={handleLogout}
          onNavigate={navigateToPage}
          currentPage={location.pathname}
          displayName={globalSettings.displayName}
        />
        <div className="flex-1 w-full min-w-0 transition-all duration-300">
          {children}
        </div>
      </div>
    </div>
  );

  // User Dashboard Component - handles admin redirect
  const UserDashboard = () => {
    // Check if admin and redirect if needed
    if (isAdminUser()) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    
    return (
      <AuthenticatedLayout>
        <MainContent onNavigate={navigateToPage} />
      </AuthenticatedLayout>
    );
  };

  // Always render a single Routes tree
  return (
    <>
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={
        <PublicRoute>
          <AuthPage onAuthSuccess={handleAuthSuccess} />
        </PublicRoute>
      } />
      
      {/* Protected Routes - Dashboard */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <UserDashboard />
        </ProtectedRoute>
      } />
      
      {/* Communities */}
      <Route path="/communities" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <CommunitiesPage 
              onSelectCommunity={(community) => {
                navigate(`/communities/${community.id}`);
              }}
            />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      <Route path="/communities/:communityId" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <JoinCommunityPageWrapper />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      
      {/* Profile */}
      <Route path="/profile" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <UserProfilePage 
              globalSettings={globalSettings}
              updateGlobalSettings={updateGlobalSettings}
              goToPage={navigateToPage}
            />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      <Route path="/profile/:userId" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <UserProfilePageWrapper 
              globalSettings={globalSettings}
              updateGlobalSettings={updateGlobalSettings}
              goToPage={navigateToPage}
            />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      <Route path="/profile/:userId/friend-requests" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <FriendRequestsPageWrapper goToPage={navigateToPage} />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      <Route path="/profile/:userId/friends" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <FriendsListPageWrapper goToPage={navigateToPage} />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      
      {/* Messaging */}
      <Route path="/messages" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <FriendMessagingPage onNavigate={navigateToPage} />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      <Route path="/messages/:userId" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <PTPMessagingPageWrapper />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      
      {/* Tournaments */}
      <Route path="/tournaments" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <TournamentPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      
      {/* Game Borrowing */}
      <Route path="/borrowing" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <GameBorrowingPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      
      {/* Settings */}
      <Route path="/settings" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <SettingsPage 
              globalSettings={globalSettings}
              updateGlobalSettings={updateGlobalSettings}
            />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      
      {/* Notifications */}
      <Route path="/notifications" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <NotificationPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      
      {/* Contact */}
      <Route path="/contact" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <ContactUsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      
      {/* About */}
      <Route path="/about" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <AboutUsPage />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      
      {/* Feedback */}
      <Route path="/feedback" element={
        <ProtectedRoute>
          <AuthenticatedLayout>
            <FeedbackPage
              onBack={() => navigate('/dashboard')}
            />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      
      {/* Admin Routes */}
      <Route path="/admin/dashboard" element={
        <ProtectedRoute adminOnly>
          <AuthenticatedLayout>
            <AdminDashboard goToPage={navigateToPage} />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/profile" element={
        <ProtectedRoute adminOnly>
          <AuthenticatedLayout>
            <AdminProfilePage goToPage={navigateToPage} />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/analytics" element={
        <ProtectedRoute adminOnly>
          <AuthenticatedLayout>
            <AdminAnalyticsPage onBack={() => navigate('/admin/profile')} />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute adminOnly>
          <AuthenticatedLayout>
            <AdminUsersPage onBack={() => navigate('/admin/profile')} goToPage={navigateToPage} />
          </AuthenticatedLayout>
        </ProtectedRoute>
      } />
      
      {/* Root redirect */}
      <Route path="/" element={
        isAuthenticated() ? (
          isAdminUser() ? (
            <Navigate to="/admin/dashboard" replace />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        ) : (
          <Navigate to="/login" replace />
        )
      } />
      
      {/* Catch all - redirect to login if not authenticated, otherwise to dashboard */}
      <Route path="*" element={
        isAuthenticated() ? (
          isAdminUser() ? (
            <Navigate to="/admin/dashboard" replace />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        ) : (
          <Navigate to="/login" replace />
        )
      } />
    </Routes>
    
    {/* Toast Notifications */}
    <CustomToast 
      toast={toast}
      onHide={() => toastManager.hide()}
    />
    </>
  );
}

// Wrapper components to extract route params
function JoinCommunityPageWrapper() {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const [community, setCommunity] = useState<any>(null);
  
  useEffect(() => {
    // Fetch community data by ID
    const fetchCommunity = async () => {
      try {
        const API_BASE_URL = (import.meta as any)?.env?.VITE_API_URL || 'http://localhost:3000';
        console.log('[JoinCommunityPageWrapper] Fetching community:', communityId);
        const response = await fetch(`${API_BASE_URL}/api/community/${communityId}`);
        if (response.ok) {
          const data = await response.json();
          console.log('[JoinCommunityPageWrapper] Community response:', data);
          if (data.success && data.data) {
            // Backend returns { success: true, data: { community: {...} } }
            let communityData = data.data.community || data.data;
            // Ensure id field exists (backend uses _id internally but returns id)
            if (communityData && !communityData.id && communityData._id) {
              communityData = { ...communityData, id: communityData._id };
            }
            console.log('[JoinCommunityPageWrapper] Setting community:', communityData);
            if (communityData && communityData.id) {
              setCommunity(communityData);
            } else {
              console.error('[JoinCommunityPageWrapper] Community data missing id:', communityData);
              navigate('/communities');
            }
          } else {
            console.error('[JoinCommunityPageWrapper] Invalid response:', data);
            navigate('/communities');
          }
        } else {
          console.error('[JoinCommunityPageWrapper] Failed to fetch community:', response.status);
          navigate('/communities');
        }
      } catch (error) {
        console.error('Error fetching community:', error);
        navigate('/communities');
      }
    };
    
    if (communityId) {
      fetchCommunity();
    } else {
      navigate('/communities');
    }
  }, [communityId, navigate]);
  
  if (!community) return <div>Loading...</div>;
  
  return (
    <JoinCommunityPage
      community={community}
      onBack={() => navigate('/communities')}
      onViewProfile={(userId: string) => {
        navigate(`/profile/${userId}`);
      }}
    />
  );
}

function UserProfilePageWrapper({ globalSettings, updateGlobalSettings, goToPage }: any) {
  const { userId } = useParams();
  return (
    <UserProfilePage 
      globalSettings={globalSettings}
      updateGlobalSettings={updateGlobalSettings}
      targetUserId={userId}
      goToPage={goToPage}
    />
  );
}

function FriendRequestsPageWrapper({ goToPage }: any) {
  const { userId } = useParams();
  const navigate = useNavigate();
  return (
    <FriendRequestsPage
      onBack={() => navigate(userId ? `/profile/${userId}` : '/profile')}
      goToPage={goToPage}
    />
  );
}

function FriendsListPageWrapper({ goToPage }: any) {
  const { userId } = useParams();
  const navigate = useNavigate();
  return (
    <FriendsListPage
      onBack={() => navigate(userId ? `/profile/${userId}` : '/profile')}
      goToPage={goToPage}
    />
  );
}

function PTPMessagingPageWrapper() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [targetUser, setTargetUser] = useState<any>(null);
  
  useEffect(() => {
    if (userId) {
      // Fetch user data
      const fetchUser = async () => {
        try {
          const API_BASE_URL = (import.meta as any)?.env?.VITE_API_URL || 'http://localhost:3000';
          const response = await fetch(`${API_BASE_URL}/api/user/profile/${userId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setTargetUser(data.data);
            }
          }
        } catch (error) {
          console.error('Error fetching user:', error);
        }
      };
      fetchUser();
    }
  }, [userId]);
  
  if (!userId) {
    navigate('/messages');
    return null;
  }
  
  return (
    <PTPMessagingPage
      targetUserId={userId}
      targetUsername={targetUser?.username || targetUser?.name}
      targetUserAvatar={targetUser?.picture}
      onBack={() => navigate('/messages')}
    />
  );
}

export default App;
