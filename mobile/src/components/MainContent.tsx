import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
  RefreshControl,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Users, Trophy, Gamepad2, Star } from "lucide-react-native";
import { PageType } from "../../types";
import api from "../utils/api";

const { width, height } = Dimensions.get("window");
const isSmallScreen = width < 375;
const isMediumScreen = width >= 375 && width < 768;
const isLargeScreen = width >= 768;

interface MainContentProps {
  goToPage: (page: "home" | "profile" | "communities" | "joinCommunity") => void;
}

const MainContent: React.FC<MainContentProps> = ({ goToPage }) => {
  const [activeGamersCount, setActiveGamersCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [availableGamesCount, setAvailableGamesCount] = useState<number>(0);
  const [loadingGamesCount, setLoadingGamesCount] = useState<boolean>(true);
  const [tournamentsCount, setTournamentsCount] = useState<number>(0);
  const [loadingTournamentsCount, setLoadingTournamentsCount] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch active gamers count from API
  const fetchActiveGamersCount = async () => {
    try {
      setIsLoading(true);
      const response = await api.get("/stats/active-gamers");
      if (response.data.success) {
        setActiveGamersCount(response.data.data.activeGamers);
      }
    } catch (error) {
      console.error("Error fetching active gamers count:", error);
      // Keep default value of 0 on error
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch available games count from API
  const fetchAvailableGamesCount = async () => {
    try {
      setLoadingGamesCount(true);
      const response = await api.get("/game/all");
      if (response.data.success) {
        // Filter only available games (status === 'available' and availableCopies > 0)
        const available = response.data.data.games.filter(
          (game: any) => game.status === 'available' && game.availableCopies > 0
        );
        setAvailableGamesCount(available.length);
      }
    } catch (error) {
      console.error("Error fetching available games count:", error);
    } finally {
      setLoadingGamesCount(false);
    }
  };

  // Fetch tournaments count from API
  const fetchTournamentsCount = async () => {
    try {
      setLoadingTournamentsCount(true);
      const response = await api.get("/tournament");
      if (response.data.success) {
        const tournaments = response.data.data.tournaments || [];
        setTournamentsCount(tournaments.length);
      }
    } catch (error) {
      console.error("Error fetching tournaments count:", error);
      // Keep default value of 0 on error
    } finally {
      setLoadingTournamentsCount(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchActiveGamersCount();
    fetchAvailableGamesCount();
    fetchTournamentsCount();
  }, []);

  // Handle refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchActiveGamersCount(),
      fetchAvailableGamesCount(),
      fetchTournamentsCount()
    ]);
    setRefreshing(false);
  };

  // Format count for display
  const formatCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K+`;
    }
    return count.toString();
  };

  const stats = [
    { 
      icon: Users, 
      label: "Active Gamers", 
      value: isLoading ? "..." : formatCount(activeGamersCount) 
    },
    { 
      icon: Trophy, 
      label: "Tournaments", 
      value: loadingTournamentsCount ? "..." : formatCount(tournamentsCount) 
    },
    { 
      icon: Gamepad2, 
      label: "Games Available ", 
      value: loadingGamesCount ? "..." : formatCount(availableGamesCount) 
    },
  ];

  const features = [
    {
      title: "Global Community",
      description: "Connect with gamers from around the world",
      colors: ["#8B5CF6", "#EC4899"] as const,
    },
    {
      title: "Epic Tournaments",
      description: "Compete in exciting gaming competitions",
      colors: ["#3B82F6", "#06B6D4"] as const,
    },
    {
      title: "Game Library",
      description: "Access thousands of games to borrow",
      colors: ["#10B981", "#059669"] as const,
    },
    {
      title: "Skill Development",
      description: "Level up your gaming skills with pros",
      colors: ["#F59E0B", "#EF4444"] as const,
    },
  ];

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: "#0F172A" }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />
      }
    >
      {/* Hero Section */}
      <View style={styles.heroContainer}>
        <ImageBackground
          source={{
            uri: "https://images.pexels.com/photos/442576/pexels-photo-442576.jpeg?auto=compress&cs=tinysrgb&w=1080",
          }}
          style={styles.heroBackground}
          imageStyle={{ opacity: 0.15 }}
        >
          <LinearGradient
            colors={["rgba(15,23,42,0.9)", "rgba(30,41,59,0.6)"]}
            style={styles.overlay}
          >
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>
                <Text style={styles.gradientText}>Join GamerHive</Text>{"\n"}
                <Text style={{ color: "#fff" }}>Community</Text>
              </Text>

              <Text style={styles.heroSubtitle}>
                Connect with gamers worldwide, participate in epic tournaments,
                and level up your gaming experience with our vibrant community.
              </Text>

              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => goToPage("communities")}
              >
                <Text style={styles.ctaText}>Join Community</Text>
                <ArrowRight color="#fff" size={18} style={{ marginLeft: 6 }} />
              </TouchableOpacity>

              {/* Stats */}
              <View style={styles.statsContainer}>
                {stats.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <View key={i} style={styles.statCard}>
                      <Icon color="#A78BFA" size={32} />
                      <Text style={styles.statValue}>{s.value}</Text>
                      <Text style={styles.statLabel} numberOfLines={1} ellipsizeMode="tail">{s.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>

      {/* Features Section */}
      <View style={styles.featuresSection}>
        <Text style={styles.sectionTitle}>
          Why Choose <Text style={{ color: "#A78BFA" }}>GamerHive</Text>?
        </Text>

        <View style={styles.featuresGrid}>
          {features.map((f, index) => (
            <LinearGradient
              key={index}
              colors={f.colors}
              style={styles.featureCard}
            >
              <View style={styles.iconWrapper}>
                <Star color="#fff" size={22} />
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.description}</Text>
            </LinearGradient>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

export default MainContent;

const styles = StyleSheet.create({
  heroContainer: {
    height: isSmallScreen ? height * 0.7 : isMediumScreen ? height * 0.65 : 600,
    minHeight: 500,
  },
  heroBackground: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: isSmallScreen ? 16 : isMediumScreen ? 18 : 20,
    paddingVertical: isSmallScreen ? 20 : isMediumScreen ? 24 : 32,
  },
  heroContent: {
    alignItems: "center",
    maxWidth: isSmallScreen ? width * 0.9 : isMediumScreen ? width * 0.85 : 350,
    width: "100%",
  },
  heroTitle: {
    textAlign: "center",
    fontSize: 40,
    fontWeight: "bold",
    lineHeight: 48,
    marginBottom: 16,
  },
  gradientText: {
    color: "#C084FC",
  },
  heroSubtitle: {
    textAlign: "center",
    fontSize: 16,
    color: "#E9D5FF",
    opacity: 0.8,
    marginBottom: 24,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7C3AED",
    paddingHorizontal: isSmallScreen ? 20 : isMediumScreen ? 22 : 24,
    paddingVertical: isSmallScreen ? 10 : 12,
    borderRadius: 50,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  statsContainer: {
    marginTop: isSmallScreen ? 32 : isMediumScreen ? 36 : 40,
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: isSmallScreen ? 4 : 0,
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: isSmallScreen ? 4 : 8,
  },
  statValue: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 6,
  },
  statLabel: {
    color: "#A78BFA",
    fontSize: 13,
    textAlign: "center",
    width: "100%",
  },
  featuresSection: {
    paddingVertical: isSmallScreen ? 24 : isMediumScreen ? 28 : 32,
    paddingHorizontal: isSmallScreen ? 12 : isMediumScreen ? 14 : 16,
    backgroundColor: "#1E293B",
  },
  sectionTitle: {
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 24,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  featureCard: {
    width: isSmallScreen ? "100%" : isMediumScreen ? "48%" : "48%",
    borderRadius: 16,
    padding: isSmallScreen ? 14 : isMediumScreen ? 15 : 16,
    marginBottom: isSmallScreen ? 12 : isMediumScreen ? 14 : 16,
  },
  iconWrapper: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  featureTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  featureDesc: {
    color: "#E9D5FF",
    fontSize: 13,
    opacity: 0.8,
  },
});
