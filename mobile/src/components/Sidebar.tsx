import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  StyleSheet,
  Alert,
  ScrollView,
  Image,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Keyboard,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import {
  User,
  Users,
  Trophy,
  Gamepad,
  Settings,
  Bell,
  Shield,
  Mail,
  Info,
  LogOut,
  X,
  Search,
  MessageSquare,
} from "lucide-react-native";
import api, { getImageUrl } from "../utils/api";

// API Base URL Configuration (matching web behavior exactly)
// Web uses: process.env.REACT_APP_API_URL || 'http://localhost:3000'
// For mobile, we need to match this behavior
const getAPIBaseURL = () => {
  // Match web's API_BASE_URL logic
  // Web: process.env.REACT_APP_API_URL || 'http://localhost:3000'
  // For mobile, use the same base URL logic
  const IS_PHYSICAL_DEVICE = true; // Match your api.ts setting
  const COMPUTER_IP = '192.168.1.4'; // Match your api.ts setting
  const SERVER_PORT = 3000;
  
  if (IS_PHYSICAL_DEVICE) {
    return `http://${COMPUTER_IP}:${SERVER_PORT}`;
  } else {
    if (Platform.OS === 'android') {
      return `http://10.0.2.2:${SERVER_PORT}`;
    } else {
      return `http://localhost:${SERVER_PORT}`;
    }
  }
};
import {
  PanGestureHandler,
  State as GestureState,
} from "react-native-gesture-handler";
import { PageType } from "../../types";
import { getAvatarImageSource } from "../utils/avatarUtils";

const { width } = Dimensions.get("window");

// Admin email - change this to your admin email
const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  onLogout: () => void;
  onNavigate: (page: PageType, params?: any) => void;
  currentPage: PageType;
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
  currentPage,
  displayName = "GamerPro",
}) => {
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isAccountActive, setIsAccountActive] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profileRank, setProfileRank] = useState<string>("Bronze");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(isOpen ? 0 : -width * 0.75)).current;
  const overlayAnim = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  // Load profile picture, admin status, and profile rank
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");
        if (userData) {
          const user = JSON.parse(userData);
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
                // Use the same endpoint as web for consistency
                // Web uses: /api/users/profile/${user.id}/rank (plural "users")
                // Using web's exact endpoint to match behavior exactly
                const API_BASE_URL = getAPIBaseURL();
                try {
                  const response = await fetch(`${API_BASE_URL}/api/users/profile/${user.id}/rank`);
                  if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data) {
                      const rank = data.data.rank || 'Bronze';
                      setProfileRank(rank);
                      // Cache the rank in user data for offline use
                      const updatedUser = { ...user, profileRank: rank };
                      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
                    } else {
                      // If response not ok or no data, use default Bronze (matching web behavior)
                      setProfileRank('Bronze');
                    }
                  } else {
                    // If response not ok, use default Bronze (matching web behavior)
                    setProfileRank('Bronze');
                  }
                } catch (fetchError) {
                  // On error, use default Bronze (matching web behavior)
                  // Web silently fails and uses default
                  setProfileRank('Bronze');
                  console.log('Could not fetch profile rank, using default Bronze:', fetchError);
                }
              }
            } catch (error: any) {
              // Try to use cached rank from user data
              if (user.profileRank) {
                setProfileRank(user.profileRank);
                console.log('Using cached profile rank:', user.profileRank);
              } else {
                // Fallback to default rank
                setProfileRank('Bronze');
                console.log('Could not fetch profile rank, using default:', error?.message || error);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error loading profile data:", error);
      }
    };

    loadProfileData();

    // Listen for profile updates
    const interval = setInterval(() => {
      loadProfileData();
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Load account status from AsyncStorage
  const loadAccountStatus = async () => {
    try {
      const userData = await AsyncStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        if (user.isActive !== undefined) {
          setIsAccountActive(user.isActive);
        }
      }
    } catch (error) {
      console.error("Error loading account status:", error);
    }
  };

  // Animate opening/closing when `isOpen` changes
  React.useEffect(() => {
    const toValue = isOpen ? 0 : -width * 0.75;
    const overlayToValue = isOpen ? 1 : 0;

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayAnim, {
        toValue: overlayToValue,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isOpen]);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", onPress: onLogout, style: "destructive" },
    ]);
  };

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
        // Get current user ID from AsyncStorage
        let currentUserId = null;
        try {
          const userData = await AsyncStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            currentUserId = user.id;
          }
        } catch (error) {
          // Silently handle error
        }

        const response = await api.get('/search', {
          params: { 
            query: query.trim(),
            userId: currentUserId, // Pass current user ID to exclude from results
          },
        });

        if (response.data.success) {
          const data = response.data.data.results;

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

  // Handle search input change (just update text, don't search)
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    // Don't search on every change - wait for Done button
    if (text.trim().length === 0) {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Handle search when user presses Done
  const handleSearchSubmit = () => {
    if (searchQuery.trim().length > 0) {
      performSearch(searchQuery.trim());
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Handle search result click
  const handleResultClick = (result: SearchResult) => {
    // Dismiss keyboard first
    Keyboard.dismiss();
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
    
    setSearchQuery("");
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
          // Note: Tournament selection can be handled in TournamentPage if needed
          break;
        case 'game':
          // Navigate to game borrowing page
          onNavigate('gameBorrowing');
          // Note: Game selection can be handled in GameBorrowingPage if needed
          break;
      }
    }, 100);
  };

  // Render search result item
  const renderSearchResult = ({ item }: { item: SearchResult }) => {
    let IconComponent = User;
    let iconColor = "#7C3AED";
    const isUser = item.type === 'user';
    const userPicture = isUser && item.image ? getImageUrl(item.image) : null;

    switch (item.type) {
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
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => handleResultClick(item)}
      >
        {isUser && userPicture ? (
          <View style={styles.searchResultIcon}>
            <Image 
              source={getAvatarImageSource(userPicture)} 
              style={styles.searchResultProfileImage}
              onError={(error) => {
                // Silently handle image load errors
                const errorMessage = error?.nativeEvent?.error || '';
                if (errorMessage !== 'unknown image format') {
                  console.log("Profile picture failed to load");
                }
              }}
            />
          </View>
        ) : (
          <View style={[styles.searchResultIcon, { backgroundColor: `${iconColor}20` }]}>
            <IconComponent size={20} color={iconColor} />
          </View>
        )}
        <View style={styles.searchResultContent}>
          <Text style={styles.searchResultName}>{item.name}</Text>
          {item.subtitle && (
            <Text style={styles.searchResultSubtitle}>{item.subtitle}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Dynamic menu items - profile label changes based on admin status
  const mainMenuItems: { icon: any; label: string; page: PageType }[] = [
    { icon: User, label: isAdmin ? "Admin Profile" : "User Profile", page: "profile" as PageType },
    ...(isAdmin ? [] : [{ icon: MessageSquare, label: "Friend Messaging", page: "friendMessaging" as PageType }]),
    { icon: Users, label: "Communities", page: "communities" as PageType },
    { icon: Trophy, label: "Tournaments", page: "tournaments" as PageType },
    { icon: Gamepad, label: "Game Borrowing", page: "gameBorrowing" as PageType },
  ];

  const settingsMenuItems: { icon: any; label: string; page: PageType }[] = [
    { icon: Settings, label: "Settings", page: "settings" as PageType },
    { icon: Bell, label: "Notifications", page: "notifications" as PageType },
    // { icon: Shield, label: "Privacy", page: "privacy" },
  ];

  const additionalMenuItems: { icon: any; label: string; page: PageType }[] = [
    ...(isAdmin ? [] : [
      { icon: Mail, label: "Contact Us", page: "contact" as PageType },
      { icon: Info, label: "About Us", page: "about" as PageType },
    ]),
    // Admin-only: Feedback
    ...(isAdmin ? [{ icon: MessageSquare, label: "Feedback", page: "feedback" as PageType }] : []),
  ];

  const handleGesture = (event: any) => {
    const { translationX, state } = event.nativeEvent;
    if (state === GestureState.END) {
      if (translationX < -50 && isOpen) {
        toggleSidebar();
      }
    }
  };

  const renderMenuItem = (item: { icon: any; label: string; page: PageType }) => {
    const IconComp = item.icon;
    const isActive = currentPage === item.page;

    return (
      <TouchableOpacity
        key={item.label}
        onPress={() => {
          onNavigate(item.page);
          Animated.timing(slideAnim,{
            toValue: -width*0.75,
            duration:300,
            useNativeDriver:true,
          }).start(()=>{
          overlayAnim.setValue(0);
        });
        }}
        style={[styles.menuItem, isActive && styles.activeItem]}
      >
        <IconComp
          size={20}
          color={isActive ? "#a78bfa" : "#c4b5fd"}
          style={{ marginRight: 12 }}
        />
        <Text style={[styles.menuText, isActive && styles.activeText]}>{item.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      {/* Animated Overlay */}
      <Animated.View
        pointerEvents={isOpen ? "auto" : "none"}
        style={[styles.overlay, { opacity: overlayAnim }]}
      >
        <TouchableOpacity style={{ flex: 1 }} onPress={toggleSidebar} />
      </Animated.View>

      {/* Sidebar with swipe gesture */}
      <PanGestureHandler onHandlerStateChange={handleGesture}>
        <Animated.View
          style={[
            styles.sidebarContainer,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          <BlurView intensity={60} tint="dark" style={styles.sidebarBlur}>
            {/* Header */}
            <View style={styles.header}>
                   {profilePicture ? (
                      <View style={styles.profileImageContainer}>
                        <Image 
                          source={getAvatarImageSource(profilePicture)} 
                          style={styles.profileImage}
                          onError={(error) => {
                            // Silently handle SVG/image format errors
                            const errorMessage = error?.nativeEvent?.error || '';
                            if (errorMessage !== 'unknown image format') {
                              console.error("Sidebar profile picture failed to load:", error);
                            }
                          }}
                        />
                        {/* Online Status Dot */}
                        {isAccountActive && (
                          <View style={styles.onlineStatusDot} />
                        )}
                      </View>
                    ) : (
                <View style={styles.profileIcon}>
                  <User color="white" size={22} />
                </View>
              )}
              <View style={styles.userInfo}>
                <Text style={styles.displayName} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.level}>{profileRank}</Text>
              </View>
              <TouchableOpacity onPress={toggleSidebar} style={styles.closeButton}>
                <X size={22} color="#a78bfa" />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Search size={18} color="#9CA3AF" style={styles.searchIcon} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Search users, communities, tournaments, games..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={handleSearchChange}
                  onSubmitEditing={handleSearchSubmit}
                  returnKeyType="done"
                  onFocus={() => {
                    // Only show results if already searched
                    if (searchResults.length > 0) {
                      setShowSearchResults(true);
                    }
                  }}
                  blurOnSubmit={true}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                      setShowSearchResults(false);
                    }}
                    style={styles.clearSearchButton}
                  >
                    <X size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <ScrollView 
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              bounces={true}
              nestedScrollEnabled={true}
            >
              <Text style={styles.sectionTitle}>Main Menu</Text>
              {mainMenuItems.map(renderMenuItem)}

              <Text style={styles.sectionTitle}>Account</Text>
              {settingsMenuItems.map(renderMenuItem)}

              <Text style={styles.sectionTitle}>Support</Text>
              {additionalMenuItems.map(renderMenuItem)}

              {/* Logout Button - Right after About Us */}
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <LogOut size={18} color="#fca5a5" />
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </ScrollView>
          </BlurView>
        </Animated.View>
      </PanGestureHandler>

      {/* Floating toggle button (bottom-left) */}
      <TouchableOpacity style={styles.toggleButton} onPress={toggleSidebar}>
        <View style={styles.toggleIcon}>
          <Text style={{ color: "white", fontSize: 22 }}>{isOpen ? "×" : "☰"}</Text>
        </View>
      </TouchableOpacity>

      {/* Search Results Modal */}
      <Modal
        visible={showSearchResults && searchResults.length > 0}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSearchResults(false)}
      >
        <TouchableOpacity
          style={styles.searchModalOverlay}
          activeOpacity={1}
          onPress={() => setShowSearchResults(false)}
        >
          <View style={styles.searchModalContent}>
            <View style={styles.searchModalHeader}>
              <Text style={styles.searchModalTitle}>
                {isSearching ? "Searching..." : `Found ${searchResults.length} results`}
              </Text>
              <TouchableOpacity
                onPress={() => setShowSearchResults(false)}
                style={styles.searchModalClose}
              >
                <X size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            {isSearching ? (
              <View style={styles.searchLoadingContainer}>
                <ActivityIndicator size="large" color="#7C3AED" />
              </View>
            ) : (
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item) => `${item.type}-${item.id}`}
                style={styles.searchResultsList}
                contentContainerStyle={styles.searchResultsContent}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

export default Sidebar;

// Styles remain unchanged
const styles = StyleSheet.create({
  sidebarContainer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: width * 0.75,
    zIndex: 50,
  },
  sidebarBlur: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    paddingTop: 50,
    paddingHorizontal: 16,
    flexDirection: "column",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 25,
    justifyContent: "space-between",
  },
  profileIcon: {
    width: 40,
    height: 40,
    backgroundColor: "#7c3aed",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  profileImageContainer: {
    position: "relative",
    marginRight: 12,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#7c3aed",
  },
  onlineStatusDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#0f172a",
  },
  userInfo: {
    flex: 1,
    marginRight: 8,
  },
  closeButton: { padding: 4 },
  displayName: { color: "#fff", fontWeight: "600", fontSize: 16 },
  level: { color: "#a78bfa", fontSize: 12 },
  sectionTitle: { marginTop: 16, marginBottom: 8, color: "#a78bfa", fontWeight: "700", fontSize: 12 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderRadius: 12, paddingHorizontal: 8, marginBottom: 4 },
  activeItem: { backgroundColor: "rgba(167, 139, 250, 0.2)" },
  menuText: { color: "#c4b5fd", fontSize: 14 },
  activeText: { color: "#fff" },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  bottomSection: { 
    borderTopWidth: 1, 
    borderColor: "rgba(147, 51, 234, 0.3)", 
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
  },
  statsBox: { backgroundColor: "rgba(147, 51, 234, 0.15)", borderRadius: 10, padding: 10, marginBottom: 10 },
  statsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statsTitle: { color: "#a78bfa", fontSize: 12, fontWeight: "600" },
  statsText: { color: "#c4b5fd", fontSize: 12, marginVertical: 2 },
  progressBar: { height: 6, backgroundColor: "#1e1b4b", borderRadius: 3, overflow: "hidden" },
  progressFill: { width: "68%", height: "100%", backgroundColor: "#7c3aed" },
  nextLevel: { color: "#a78bfa", fontSize: 10, marginTop: 4 },
  logoutButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    backgroundColor: "rgba(239, 68, 68, 0.15)", 
    paddingVertical: 10, 
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  logoutText: { color: "#fca5a5", marginLeft: 8, fontWeight: "600" },
  toggleButton: { position: "absolute", bottom: 25, left: 25, zIndex: 100 },
  toggleIcon: { backgroundColor: "#7c3aed", width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  
  // Search Styles
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.2)",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    paddingVertical: 10,
  },
  clearSearchButton: {
    padding: 4,
  },
  
  // Search Results Modal Styles
  searchModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-start",
    paddingTop: 100,
  },
  searchModalContent: {
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    marginHorizontal: 20,
  },
  searchModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.1)",
  },
  searchModalTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  searchModalClose: {
    padding: 4,
  },
  searchResultsList: {
    maxHeight: 400,
  },
  searchResultsContent: {
    paddingBottom: 20,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148, 163, 184, 0.1)",
  },
  searchResultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  searchResultProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  searchResultSubtitle: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  searchResultImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 8,
  },
  searchLoadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
