import React, { useEffect, useState } from "react";
import { View, TouchableOpacity, Text, StyleSheet, Image, Platform } from "react-native";
import { Gamepad2, User } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PageType } from "../../types";
import { getAvatarImageSource } from "../utils/avatarUtils";
import api from "../utils/api";

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

const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";

interface HeaderProps {
  displayName?: string;
  goToPage?: (page: PageType, params?: any) => void;
  showToggle?: boolean;
  toggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  displayName = "GamerPro",
  goToPage,
  showToggle = true,
}) => {
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [isAccountActive, setIsAccountActive] = useState(true);
  const [profileRank, setProfileRank] = useState<string>("Bronze");
  const [isAdmin, setIsAdmin] = useState(false);

  // Load profile picture, account status, and profile rank
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");
        if (userData) {
          const user = JSON.parse(userData);
          if (user.picture) {
            setProfilePicture(user.picture);
          }
          if (user.isActive !== undefined) {
            setIsAccountActive(user.isActive);
          }
          const admin = !!(user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
          setIsAdmin(admin);
          
          // Fetch profile rank
          if (user.id) {
            try {
              if (admin) {
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

  const handleProfileClick = () => goToPage?.("profile");
  const handleLogoClick = () => goToPage?.("home");

  return (
    <View style={styles.headerContainer}>
      {/* Logo */}
      <TouchableOpacity onPress={handleLogoClick} style={styles.logoContainer}>
        <View style={styles.logoIcon}>
          <Gamepad2 size={24} color="white" />
        </View>
      </TouchableOpacity>

      {/* Profile */}
      <TouchableOpacity onPress={handleProfileClick} style={styles.profileButton}>
        {profilePicture ? (
          <View style={styles.profileImageContainer}>
            <Image 
              source={getAvatarImageSource(profilePicture)} 
              style={styles.profileImage}
              onError={(error) => {
                // Silently handle SVG/image format errors
                const errorMessage = error?.nativeEvent?.error || '';
                if (errorMessage !== 'unknown image format') {
                  console.error("Header profile picture failed to load:", error);
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
            <User size={16} color="white" />
          </View>
        )}
        <Text style={styles.profileLevel}>{isAdmin ? 'Admin' : profileRank}</Text>
      </TouchableOpacity>
    </View>
  );
};

export default Header;

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: "#0f172a",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingTop: 40,
  },
  logoContainer: { flexDirection: "row", alignItems: "center" },
  logoIcon: {
    backgroundColor: "rgba(168,85,247,0.9)",
    borderRadius: 10,
    padding: 6,
    marginRight: 8,
  },
  profileButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(168,85,247,0.2)",
    padding: 6,
    borderRadius: 8,
  },
  profileIcon: {
    backgroundColor: "rgba(168,85,247,1)",
    padding: 6,
    borderRadius: 6,
    marginRight: 6,
  },
  profileImageContainer: {
    position: "relative",
    marginRight: 6,
  },
  profileImage: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.5)",
  },
  onlineStatusDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#0f172a",
  },
  profileLevel: { color: "rgba(196,181,253,0.6)", fontSize: 10 },
});
