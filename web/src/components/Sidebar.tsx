import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  User, 
  Users, 
  Trophy, 
  Gamepad, 
  Settings, 
  Bell, 
  Mail, 
  Info, 
  LogOut, 
  X, 
  Search, 
  MessageSquare
} from 'lucide-react';
import { apiRequest, getImageUrl, getStoredUser } from '../utils/api';

// Admin email - change this to your admin email
const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  onLogout: () => void;
  onNavigate: (page: string, params?: any) => void;
  currentPage: string;
  displayName?: string;
}

interface SearchResult {
  id: string;
  type: 'user' | 'community' | 'tournament' | 'game';
  name: string;
  subtitle?: string;
  image?: string;
  data?: any;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  toggleSidebar,
  onLogout,
  onNavigate,
  currentPage: currentPageProp,
  displayName = 'GamerPro',
}) => {
  const location = useLocation();
  // Use route pathname if available, otherwise fall back to currentPage prop
  const currentPage = location.pathname || currentPageProp;
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isAccountActive, setIsAccountActive] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileRank, setProfileRank] = useState<string>('Bronze');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load profile picture, admin status, and profile rank
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const user = getStoredUser();
        if (user) {
          if (user.picture) {
            setProfilePicture(user.picture);
          }
          // Check if user is admin
          if (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
          // Check account status
          if (user.isActive !== undefined) {
            setIsAccountActive(user.isActive);
          }
          
          // Fetch profile rank
          if (user.id) {
            try {
              if (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
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
        }
      } catch (error) {
        console.error('Error loading profile data:', error);
      }
    };

    loadProfileData();

    // Listen for profile updates
    const interval = setInterval(() => {
      loadProfileData();
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Tournament data (hardcoded for now)
  const tournaments = [
    { id: '1', name: 'PUBG Mobile Championship 2025', game: 'PUBG Mobile' },
    { id: '2', name: 'Free Fire World Series', game: 'Free Fire' },
    { id: '3', name: 'FIFA 24 Pro League', game: 'FIFA 24' },
    { id: '4', name: 'Valorant Champions', game: 'Valorant' },
    { id: '5', name: 'Tekken 8 World Tour', game: 'Tekken 8' },
  ];

  // Game data (hardcoded for now)
  const games = [
    { id: '1', title: 'PUBG Mobile', genre: 'Battle Royale' },
    { id: '2', title: 'Free Fire', genre: 'Battle Royale' },
    { id: '3', title: 'FIFA 24', genre: 'Sports' },
    { id: '4', title: 'Valorant', genre: 'FPS' },
    { id: '5', title: 'Tekken 8', genre: 'Fighting' },
    { id: '6', title: 'COD Mobile', genre: 'FPS' },
    { id: '7', title: 'League of Legends', genre: 'MOBA' },
    { id: '8', title: 'Minecraft', genre: 'Sandbox' },
  ];

  // Perform search
  const performSearch = async (query: string) => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setShowSearchResults(true);

    try {
      const results: SearchResult[] = [];

      // Search from backend (users and communities)
      try {
        // Get current user ID from localStorage
        let currentUserId = null;
        try {
          const user = getStoredUser();
          if (user) {
            currentUserId = user.id;
          }
        } catch (error) {
          // Silently handle error
        }

        const params = new URLSearchParams();
        params.append('query', query.trim());
        if (currentUserId) {
          params.append('userId', currentUserId);
        }

        const response = await apiRequest<{ results: { users: any[]; communities: any[] } }>(`/search?${params.toString()}`);

        if (response.success && response.data) {
          const data = response.data.results;

          // Add users (exclude admin email and current user)
          data.users.forEach((user: any) => {
            // Filter out admin email users
            if (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
              return; // Skip admin users
            }
            // Filter out current logged in user
            if (currentUserId && user.id === currentUserId) {
              return; // Skip current user's own profile
            }
            results.push({
              id: user.id,
              type: 'user',
              name: user.name || user.username,
              subtitle: user.email,
              image: user.picture,
              data: user,
            });
          });

          // Add communities
          data.communities.forEach((community: any) => {
            results.push({
              id: community.id,
              type: 'community',
              name: community.name,
              subtitle: `${community.game} • ${community.members} members`,
              image: community.image,
              data: community,
            });
          });
        }
      } catch (error) {
        console.error('Search API error:', error);
      }

      // Search tournaments locally
      const matchingTournaments = tournaments.filter(
        (t) =>
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.game.toLowerCase().includes(query.toLowerCase())
      );
      matchingTournaments.forEach((tournament) => {
        results.push({
          id: tournament.id,
          type: 'tournament',
          name: tournament.name,
          subtitle: tournament.game,
          data: tournament,
        });
      });

      // Search games locally
      const matchingGames = games.filter(
        (g) =>
          g.title.toLowerCase().includes(query.toLowerCase()) ||
          g.genre.toLowerCase().includes(query.toLowerCase())
      );
      matchingGames.forEach((game) => {
        results.push({
          id: game.id,
          type: 'game',
          name: game.title,
          subtitle: game.genre,
          data: game,
        });
      });

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search input change
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    // Don't search on every change - wait for Enter or search button
    if (text.trim().length === 0) {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Handle search when user presses Enter
  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (searchQuery.trim().length > 0) {
      performSearch(searchQuery.trim());
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Handle search result click
  const handleResultClick = (result: SearchResult) => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    toggleSidebar();

    // Small delay to ensure sidebar closes before navigation
    setTimeout(() => {
      switch (result.type) {
        case 'user':
          // Navigate to user profile with targetUserId
          onNavigate('profile', { targetUserId: result.id });
          break;
        case 'community':
          // Navigate to communities page
          onNavigate('communities', { selectedCommunityId: result.id });
          break;
        case 'tournament':
          // Navigate to tournaments page
          onNavigate('tournaments');
          break;
        case 'game':
          // Navigate to game borrowing page
          onNavigate('borrowing');
          break;
      }
    }, 100);
  };

  // Render search result item
  const renderSearchResult = (result: SearchResult) => {
    let IconComponent = User;
    let iconColor = "#7C3AED";
    const isUser = result.type === 'user';

    switch (result.type) {
      case 'user':
        IconComponent = User;
        iconColor = "#7C3AED";
        break;
      case 'community':
        IconComponent = Users;
        iconColor = "#6FB3FF";
        break;
      case 'tournament':
        IconComponent = Trophy;
        iconColor = "#F6C85F";
        break;
      case 'game':
        IconComponent = Gamepad;
        iconColor = "#7ED957";
        break;
    }

    return (
      <button
        key={`${result.type}-${result.id}`}
        className="w-full flex items-center gap-3 p-3 hover:bg-slate-700/50 transition-colors border-b border-slate-700/50"
        onClick={() => handleResultClick(result)}
      >
        {isUser && result.image ? (
          <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
            <img
              src={getImageUrl(result.image) || result.image}
              alt={result.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${iconColor}20` }}>
            <IconComponent size={20} color={iconColor} />
          </div>
        )}
        <div className="flex-1 text-left min-w-0">
          <div className="text-white font-semibold text-sm truncate">{result.name}</div>
          {result.subtitle && (
            <div className="text-gray-400 text-xs truncate">{result.subtitle}</div>
          )}
        </div>
      </button>
    );
  };

  // Dynamic menu items - profile label changes based on admin status (using route paths)
  const mainMenuItems: { icon: any; label: string; page: string; route: string }[] = [
    { icon: User, label: isAdmin ? "Admin Profile" : "User Profile", page: isAdmin ? "adminProfile" : "profile", route: isAdmin ? "/admin/profile" : "/profile" },
    ...(isAdmin ? [] : [{ icon: MessageSquare, label: "Friend Messaging", page: "friendMessaging", route: "/messages" }]),
    { icon: Users, label: "Communities", page: "communities", route: "/communities" },
    { icon: Trophy, label: "Tournaments", page: "tournaments", route: "/tournaments" },
    { icon: Gamepad, label: "Game Borrowing", page: "borrowing", route: "/borrowing" },
  ];

  const settingsMenuItems: { icon: any; label: string; page: string; route: string }[] = [
    { icon: Settings, label: "Settings", page: "settings", route: "/settings" },
    { icon: Bell, label: "Notifications", page: "notifications", route: "/notifications" },
  ];

  const additionalMenuItems: { icon: any; label: string; page: string; route: string }[] = [
    ...(isAdmin ? [] : [
      { icon: Mail, label: "Contact Us", page: "contact", route: "/contact" },
      { icon: Info, label: "About Us", page: "about", route: "/about" },
    ]),
    // Admin-only: Feedback
    ...(isAdmin ? [{ icon: MessageSquare, label: "Feedback", page: "feedback", route: "/feedback" }] : []),
  ];

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      onLogout();
    }
  };

  const handleNavigation = (page: string, params?: any) => {
    onNavigate(page, params);
    toggleSidebar();
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-80 bg-gradient-to-b from-slate-900 via-purple-900/50 to-slate-900 border-r border-purple-500/20 backdrop-blur-sm z-50 transform transition-transform duration-300 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-purple-500/20 flex-shrink-0">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {profilePicture ? (
              <div className="relative flex-shrink-0">
                <img
                  src={getImageUrl(profilePicture) || profilePicture}
                  alt="Profile"
                  className="w-10 h-10 rounded-lg object-cover border-2 border-purple-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const placeholder = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                    if (placeholder) {
                      placeholder.style.display = 'flex';
                    }
                  }}
                />
                <div className="hidden w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                {/* Online Status Dot */}
                {isAccountActive && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900" />
                )}
              </div>
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-semibold truncate">{displayName}</h3>
              <p className="text-purple-300/70 text-sm font-semibold">{profileRank}</p>
            </div>
          </div>
          
          {/* Close button */}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 transition-colors flex-shrink-0 ml-2"
            title="Close Sidebar"
          >
            <X className="w-5 h-5 text-purple-300" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-purple-500/20 flex-shrink-0">
          <form onSubmit={handleSearchSubmit} className="relative">
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-4 h-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search users, communities, tournaments, games..."
                className="w-full pl-10 pr-10 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => {
                  // Only show results if already searched
                  if (searchResults.length > 0) {
                    setShowSearchResults(true);
                  }
                }}
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}
                  className="absolute right-3 p-1 hover:bg-slate-700 rounded"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Main Menu */}
        <nav className="px-6 py-6 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3 px-3">
              Main Menu
            </h4>
            {mainMenuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = currentPage === item.route || currentPage.startsWith(item.route + '/');
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavigation(item.page)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600/30 to-blue-600/30 text-white border border-purple-500/30'
                      : 'text-purple-200 hover:text-white hover:bg-gradient-to-r hover:from-purple-600/20 hover:to-blue-600/20'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                  <IconComponent className={`w-5 h-5 transition-colors relative z-10 ${
                    isActive ? 'text-purple-400' : 'group-hover:text-purple-400'
                  }`} />
                  <span className="font-medium relative z-10">{item.label}</span>
                  <div className={`absolute right-4 w-2 h-2 bg-purple-400 rounded-full transition-opacity duration-200 ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}></div>
                </button>
              );
            })}
          </div>

          {/* Settings Section */}
          <div className="mt-8 space-y-1">
            <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3 px-3">
              Account
            </h4>
            {settingsMenuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = currentPage === item.route || currentPage.startsWith(item.route + '/');
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavigation(item.page)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600/30 to-blue-600/30 text-white border border-purple-500/30'
                      : 'text-purple-200 hover:text-white hover:bg-gradient-to-r hover:from-purple-600/20 hover:to-blue-600/20'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                  <IconComponent className={`w-5 h-5 transition-colors relative z-10 ${
                    isActive ? 'text-purple-400' : 'group-hover:text-purple-400'
                  }`} />
                  <span className="font-medium relative z-10">{item.label}</span>
                  <div className={`absolute right-4 w-2 h-2 bg-purple-400 rounded-full transition-opacity duration-200 ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}></div>
                </button>
              );
            })}
          </div>

          {/* Additional Menu Items */}
          <div className="mt-8 space-y-1">
            <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3 px-3">
              Support
            </h4>
            {additionalMenuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = currentPage === item.route || currentPage.startsWith(item.route + '/');
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavigation(item.page)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600/30 to-blue-600/30 text-white border border-purple-500/30'
                      : 'text-purple-200 hover:text-white hover:bg-gradient-to-r hover:from-purple-600/20 hover:to-blue-600/20'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                  <IconComponent className={`w-5 h-5 transition-colors relative z-10 ${
                    isActive ? 'text-purple-400' : 'group-hover:text-purple-400'
                  }`} />
                  <span className="font-medium relative z-10">{item.label}</span>
                  <div className={`absolute right-4 w-2 h-2 bg-purple-400 rounded-full transition-opacity duration-200 ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}></div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Bottom Section */}
        <div className="p-6 border-t border-purple-500/20 flex-shrink-0">
          {/* Gaming Stats */}
        
          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-red-600/20 to-red-500/20 hover:from-red-600/30 hover:to-red-500/30 border border-red-500/20 hover:border-red-500/40 rounded-xl text-red-300 hover:text-red-200 transition-all duration-200 group"
          >
            <LogOut className="w-5 h-5 group-hover:rotate-12 transition-transform duration-200" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Search Results Modal */}
      {showSearchResults && searchResults.length > 0 && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-24"
          onClick={() => setShowSearchResults(false)}
        >
          <div
            className="bg-slate-800 rounded-2xl w-full max-w-md max-h-[70vh] overflow-hidden border border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-white font-semibold text-lg">
                {isSearching ? 'Searching...' : `Found ${searchResults.length} results`}
              </h3>
              <button
                onClick={() => setShowSearchResults(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {isSearching ? (
              <div className="p-10 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[60vh]">
                {searchResults.map((result) => renderSearchResult(result))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
