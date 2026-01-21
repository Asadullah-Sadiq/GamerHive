import React, { useState, useEffect } from 'react';
import { Gamepad2, Menu, User, Bell, Search, ChevronDown } from 'lucide-react';
import { getImageUrl, getStoredUser } from '../utils/api';

interface HeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  displayName?: string;
  onNavigate?: (page: string, params?: any) => void;
}

// Admin email - same as in App.tsx
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

const Header: React.FC<HeaderProps> = ({ isSidebarOpen, toggleSidebar, displayName = 'GamerPro', onNavigate }) => {
  const [showFeaturesDropdown, setShowFeaturesDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isAccountActive, setIsAccountActive] = useState(true);
  const [profileRank, setProfileRank] = useState<string>('Bronze');

  // Load profile picture, account status, and profile rank
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const user = getStoredUser();
        if (user && user.id) {
          if (user.picture) {
            setProfilePicture(user.picture);
          }
          // Check account status
          if (user.isActive !== undefined) {
            setIsAccountActive(user.isActive);
          }
          
          // Fetch profile rank
          try {
            if (isAdminUser()) {
              setProfileRank('Admin');
            } else {
              const API_BASE_URL = (import.meta as any)?.env?.VITE_API_URL || 'http://localhost:3000';
              const response = await fetch(`${API_BASE_URL}/api/users/profile/${user.id}/rank`);
              if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                  setProfileRank(data.data.rank || 'Bronze');
                }
              }
            }
          } catch (error) {
            // Silently fail - use default rank
            console.log('Could not fetch profile rank:', error);
          }
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
      }
    };

    loadProfileData();

    // Listen for profile picture updates
    const interval = setInterval(() => {
      loadProfileData();
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const features = [
    { label: 'User Profile', page: 'profile' },
    { label: 'Communities', page: 'communities' },
    { label: 'Tournaments', page: 'tournaments' },
    { label: 'Game Borrowing', page: 'borrowing' }
  ];

  const handleNavigation = (page: string) => {
    if (onNavigate) {
      onNavigate(page);
    }
    setShowFeaturesDropdown(false);
  };

  const handleNotificationClick = () => {
    if (onNavigate) {
      onNavigate('notifications');
    }
    setShowNotifications(false);
  };

  const handleProfileClick = () => {
    if (onNavigate) {
      // Navigate to admin profile if user is admin, otherwise user profile
      const page = isAdminUser() ? 'adminProfile' : 'profile';
      onNavigate(page);
    }
  };

  const handleHomeClick = () => {
    if (onNavigate) {
      onNavigate('home');
    }
  };

  const handleContactClick = () => {
    if (onNavigate) {
      onNavigate('contact');
    }
  };

  const handleAboutClick = () => {
    if (onNavigate) {
      onNavigate('about');
    }
  };

  const handleLogoClick = () => {
    if (onNavigate) {
      onNavigate('home');
    }
  };

  return (
    <header className="bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 border-b border-purple-500/20 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-3">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 transition-colors"
            title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
          >
            <Menu className={`w-5 h-5 text-purple-300 transition-transform ${isSidebarOpen ? 'rotate-90' : ''}`} />
          </button>
          
          {/* Clickable Logo */}
          <button
            onClick={handleLogoClick}
            className="flex items-center space-x-3 group hover:scale-105 transition-transform duration-200"
          >
            <div className="relative">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg shadow-lg group-hover:shadow-purple-500/25 transition-shadow">
                <Gamepad2 className="w-8 h-8 text-white" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-blue-400 rounded-lg blur opacity-50 animate-pulse group-hover:opacity-70 transition-opacity"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent group-hover:from-purple-300 group-hover:to-blue-300 transition-all duration-200">
                GamerHive
              </h1>
              <p className="text-xs text-purple-300/70 group-hover:text-purple-300/90 transition-colors">Gaming Community</p>
            </div>
          </button>
        </div>

        {/* Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" />
            <input
              type="text"
              placeholder="Search games, players, tournaments..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-purple-500/30 rounded-lg text-white placeholder-purple-300/50 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 focus:outline-none transition-all duration-300"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden lg:block">
          <ul className="flex items-center space-x-8">
            <li>
              <button
                onClick={handleHomeClick}
                className="text-purple-200 hover:text-white transition-colors duration-200 font-medium relative group"
              >
                Home
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-blue-400 group-hover:w-full transition-all duration-300"></span>
              </button>
            </li>
            <li className="relative">
              <button
                onClick={() => setShowFeaturesDropdown(!showFeaturesDropdown)}
                className="flex items-center space-x-1 text-purple-200 hover:text-white transition-colors duration-200 font-medium relative group"
              >
                <span>Features</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showFeaturesDropdown ? 'rotate-180' : ''}`} />
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-blue-400 group-hover:w-full transition-all duration-300"></span>
              </button>
              
              {/* Features Dropdown */}
              {showFeaturesDropdown && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-slate-900/95 backdrop-blur-sm border border-purple-500/30 rounded-lg shadow-xl z-50">
                  <div className="py-2">
                    {features.map((feature) => (
                      <button
                        key={feature.page}
                        onClick={() => handleNavigation(feature.page)}
                        className="w-full text-left px-4 py-2 text-purple-200 hover:text-white hover:bg-purple-600/20 transition-colors"
                      >
                        {feature.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </li>
            <li>
              <button
                onClick={handleContactClick}
                className="text-purple-200 hover:text-white transition-colors duration-200 font-medium relative group"
              >
                Contact Us
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-blue-400 group-hover:w-full transition-all duration-300"></span>
              </button>
            </li>
            <li>
              <button
                onClick={handleAboutClick}
                className="text-purple-200 hover:text-white transition-colors duration-200 font-medium relative group"
              >
                About Us
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-purple-400 to-blue-400 group-hover:w-full transition-all duration-300"></span>
              </button>
            </li>
          </ul>
        </nav>

        {/* User Actions */}
        <div className="flex items-center space-x-3">
          {/* Notifications */}
          <button 
            onClick={handleNotificationClick}
            className="relative p-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 transition-colors group"
          >
            <Bell className="w-5 h-5 text-purple-300 group-hover:text-purple-200" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
            </span>
          </button>

          {/* User Profile */}
          <button 
            onClick={handleProfileClick}
            className="flex items-center space-x-2 p-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 transition-colors group"
          >
            {profilePicture ? (
              <div className="relative flex-shrink-0">
                <img
                  src={getImageUrl(profilePicture) || profilePicture}
                  alt="Profile"
                  className="w-8 h-8 rounded-lg object-cover border-2 border-purple-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const placeholder = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                    if (placeholder) {
                      placeholder.style.display = 'flex';
                    }
                  }}
                />
                <div className="hidden w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                {/* Online Status Dot */}
                {isAccountActive && (
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900" />
                )}
              </div>
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="hidden sm:block text-left">
              <div className="text-sm font-medium text-white">{displayName}</div>
              <div className="text-xs text-purple-300/70 font-semibold">{isAdminUser() ? 'Admin' : profileRank}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Overlay for dropdowns */}
      {(showFeaturesDropdown || showNotifications) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowFeaturesDropdown(false);
            setShowNotifications(false);
          }}
        />
      )}
    </header>
  );
};

export default Header;