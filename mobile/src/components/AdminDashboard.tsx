import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ImageBackground,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { 
  TrendingUp, 
  Users, 
  ChartBar,
  ArrowUpRight,
  Calendar,
  UserPlus,
  Gamepad2,
  Trophy,
  Mail
} from "lucide-react-native";
import api from "../utils/api";

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 320;
const MAX_BAR_HEIGHT = 220;

interface MonthlyData {
  currentMonth: string;
  currentMonthSignups: number;
  labels: string[];
  values: number[];
  totalUsers: number;
  growthPercentage: number;
}

interface MonthlyGameData {
  currentMonth: string;
  currentMonthGames: number;
  labels: string[];
  values: number[];
  totalGames: number;
}

interface MonthlyTournamentData {
  currentMonth: string;
  currentMonthTournaments: number;
  labels: string[];
  values: number[];
  totalTournaments: number;
}

interface AdminDashboardProps {
  goToPage?: (page: string, params?: any) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ goToPage }) => {
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [monthlyGameData, setMonthlyGameData] = useState<MonthlyGameData | null>(null);
  const [monthlyTournamentData, setMonthlyTournamentData] = useState<MonthlyTournamentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingGames, setLoadingGames] = useState(true);
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMonthlySignups();
    fetchMonthlyGames();
    fetchMonthlyTournaments();
  }, []);

  const fetchMonthlySignups = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stats/monthly-signups');
      if (response.data.success) {
        setMonthlyData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching monthly signups:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMonthlyGames = async () => {
    try {
      setLoadingGames(true);
      const response = await api.get('/stats/monthly-games');
      if (response.data.success) {
        setMonthlyGameData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching monthly games:', error);
    } finally {
      setLoadingGames(false);
    }
  };

  const fetchMonthlyTournaments = async () => {
    try {
      setLoadingTournaments(true);
      const response = await api.get('/stats/monthly-tournaments');
      if (response.data.success) {
        setMonthlyTournamentData(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching monthly tournaments:', error);
    } finally {
      setLoadingTournaments(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMonthlySignups();
    fetchMonthlyGames();
    fetchMonthlyTournaments();
  };

  const getMaxValue = () => {
    if (!monthlyData || monthlyData.values.length === 0) return 1;
    const max = Math.max(...monthlyData.values);
    return max === 0 ? 1 : max;
  };

  const getGrowthPercentage = () => {
    // Use growth percentage from backend if available
    if (monthlyData && monthlyData.growthPercentage !== undefined) {
      return monthlyData.growthPercentage;
    }
    // Fallback to local calculation if backend doesn't provide it
    if (!monthlyData || monthlyData.values.length < 2) return 0;
    const recent = monthlyData.values[monthlyData.values.length - 1];
    const previous = monthlyData.values[monthlyData.values.length - 2];
    if (previous === 0) return recent > 0 ? 100 : 0;
    return Math.round(((recent - previous) / previous) * 100);
  };

  const getTotalThisMonth = () => {
    if (!monthlyData) return 0;
    return monthlyData.currentMonthSignups || 0;
  };

  const renderCurrentMonthChart = () => {
    if (!monthlyData) {
      return (
        <View style={styles.noDataContainer}>
          <ChartBar size={48} color="#64748b" />
          <Text style={styles.noDataText}>No signup data available</Text>
          <Text style={styles.noDataSubtext}>User signups will appear here</Text>
        </View>
      );
    }

    const currentMonthCount = monthlyData.currentMonthSignups || 0;
    const maxValue = Math.max(...monthlyData.values, currentMonthCount, 1);
    const barHeight = (currentMonthCount / maxValue) * MAX_BAR_HEIGHT;

    // Get last 5 months for comparison (excluding current month)
    const comparisonData = monthlyData.values.slice(0, -1);
    const comparisonLabels = monthlyData.labels.slice(0, -1);
    const comparisonMax = Math.max(...comparisonData, 1);
    const comparisonBarHeight = 100; // Fixed height for comparison bars

    return (
      <View style={styles.chartContainer}>
        {/* Current Month Display */}
        <View style={styles.currentMonthSection}>
          <View style={styles.currentMonthHeader}>
            <View style={styles.currentMonthIcon}>
              <Calendar size={20} color="#a78bfa" />
            </View>
            <View style={styles.currentMonthInfo}>
              <Text style={styles.currentMonthLabel}>Current Month</Text>
              <Text style={styles.currentMonthName}>{monthlyData.currentMonth}</Text>
            </View>
          </View>
          
          <View style={styles.currentMonthBarContainer}>
            <View style={styles.currentMonthBarWrapper}>
              {/* Value Display */}
              <View style={styles.currentMonthValueBox}>
                <Text style={styles.currentMonthValue}>{currentMonthCount}</Text>
                <Text style={styles.currentMonthValueLabel}>Users Registered</Text>
              </View>

              {/* Main Bar */}
              <View style={styles.currentMonthBarArea}>
                <LinearGradient
                  colors={['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 0, y: 0 }}
                  style={[
                    styles.currentMonthBar,
                    { 
                      height: Math.max(barHeight, 20),
                    }
                  ]}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </LinearGradient>
                
                {/* Grid lines */}
                <View style={styles.currentMonthGrid}>
                  {[4, 3, 2, 1, 0].map((line) => (
                    <View 
                      key={line} 
                      style={[
                        styles.currentMonthGridLine,
                        { bottom: (line * MAX_BAR_HEIGHT / 4) }
                      ]} 
                    />
                  ))}
                </View>
              </View>

              {/* Y-axis */}
              <View style={styles.currentMonthYAxis}>
                {[maxValue, Math.floor(maxValue * 0.75), Math.floor(maxValue * 0.5), Math.floor(maxValue * 0.25), 0].map((val, idx) => (
                  <Text key={idx} style={styles.currentMonthYAxisLabel}>
                    {val}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Comparison Section - Last 5 Months */}
        <View style={styles.comparisonSection}>
          <Text style={styles.comparisonTitle}>Previous Months Comparison</Text>
          <View style={styles.comparisonBars}>
            {comparisonData.map((value, index) => {
              const barHeight = (value / comparisonMax) * comparisonBarHeight;
              const monthName = comparisonLabels[index]?.substring(0, 3) || '';
              
              return (
                <View key={index} style={styles.comparisonBarWrapper}>
                  <View style={styles.comparisonBarContainer}>
                    {value > 0 && (
                      <>
                        <Text style={styles.comparisonBarValue}>{value}</Text>
                        <LinearGradient
                          colors={['#6366f1', '#7c3aed']}
                          start={{ x: 0, y: 1 }}
                          end={{ x: 0, y: 0 }}
                          style={[
                            styles.comparisonBar,
                            { height: Math.max(barHeight, 4) }
                          ]}
                        />
                      </>
                    )}
                    {value === 0 && (
                      <View style={[styles.comparisonBar, styles.emptyComparisonBar]} />
                    )}
                  </View>
                  <Text style={styles.comparisonBarLabel}>{monthName}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderCurrentMonthGamesChart = () => {
    if (!monthlyGameData) {
      return (
        <View style={styles.noDataContainer}>
          <Gamepad2 size={48} color="#64748b" />
          <Text style={styles.noDataText}>No game data available</Text>
          <Text style={styles.noDataSubtext}>Games added will appear here</Text>
        </View>
      );
    }

    const currentMonthCount = monthlyGameData.currentMonthGames || 0;
    const maxValue = Math.max(...monthlyGameData.values, currentMonthCount, 1);
    const barHeight = (currentMonthCount / maxValue) * MAX_BAR_HEIGHT;

    // Get last 5 months for comparison (excluding current month)
    const comparisonData = monthlyGameData.values.slice(0, -1);
    const comparisonLabels = monthlyGameData.labels.slice(0, -1);
    const comparisonMax = Math.max(...comparisonData, 1);
    const comparisonBarHeight = 100; // Fixed height for comparison bars

    return (
      <View style={styles.chartContainer}>
        {/* Current Month Display */}
        <View style={styles.currentMonthSection}>
          <View style={styles.currentMonthHeader}>
            <View style={[styles.currentMonthIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
              <Calendar size={20} color="#10b981" />
            </View>
            <View style={styles.currentMonthInfo}>
              <Text style={styles.currentMonthLabel}>Current Month</Text>
              <Text style={styles.currentMonthName}>{monthlyGameData.currentMonth}</Text>
            </View>
          </View>
          
          <View style={[styles.currentMonthBarContainer, { borderColor: 'rgba(16, 185, 129, 0.2)' }]}>
            <View style={styles.currentMonthBarWrapper}>
              {/* Value Display */}
              <View style={[styles.currentMonthValueBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                <Text style={[styles.currentMonthValue, { color: '#10b981' }]}>{currentMonthCount}</Text>
                <Text style={styles.currentMonthValueLabel}>Games Added</Text>
              </View>

              {/* Main Bar */}
              <View style={styles.currentMonthBarArea}>
                <LinearGradient
                  colors={['#10b981', '#34d399', '#6ee7b7', '#a7f3d0']}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 0, y: 0 }}
                  style={[
                    styles.currentMonthBar,
                    { 
                      height: Math.max(barHeight, 20),
                      shadowColor: '#10b981',
                    }
                  ]}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </LinearGradient>
                
                {/* Grid lines */}
                <View style={styles.currentMonthGrid}>
                  {[4, 3, 2, 1, 0].map((line) => (
                    <View 
                      key={line} 
                      style={[
                        styles.currentMonthGridLine,
                        { bottom: (line * MAX_BAR_HEIGHT / 4) }
                      ]} 
                    />
                  ))}
                </View>
              </View>

              {/* Y-axis */}
              <View style={styles.currentMonthYAxis}>
                {[maxValue, Math.floor(maxValue * 0.75), Math.floor(maxValue * 0.5), Math.floor(maxValue * 0.25), 0].map((val, idx) => (
                  <Text key={idx} style={styles.currentMonthYAxisLabel}>
                    {val}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Comparison Section - Last 5 Months */}
        <View style={styles.comparisonSection}>
          <Text style={styles.comparisonTitle}>Previous Months Comparison</Text>
          <View style={styles.comparisonBars}>
            {comparisonData.map((value, index) => {
              const barHeight = (value / comparisonMax) * comparisonBarHeight;
              const monthName = comparisonLabels[index]?.substring(0, 3) || '';
              
              return (
                <View key={index} style={styles.comparisonBarWrapper}>
                  <View style={styles.comparisonBarContainer}>
                    {value > 0 && (
                      <>
                        <Text style={styles.comparisonBarValue}>{value}</Text>
                        <LinearGradient
                          colors={['#059669', '#10b981']}
                          start={{ x: 0, y: 1 }}
                          end={{ x: 0, y: 0 }}
                          style={[
                            styles.comparisonBar,
                            { 
                              height: Math.max(barHeight, 4),
                              shadowColor: '#10b981',
                            }
                          ]}
                        />
                      </>
                    )}
                    {value === 0 && (
                      <View style={[styles.comparisonBar, styles.emptyComparisonBar]} />
                    )}
                  </View>
                  <Text style={styles.comparisonBarLabel}>{monthName}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderCurrentMonthTournamentsChart = () => {
    if (!monthlyTournamentData) {
      return (
        <View style={styles.noDataContainer}>
          <Trophy size={48} color="#64748b" />
          <Text style={styles.noDataText}>No tournament data available</Text>
          <Text style={styles.noDataSubtext}>Tournaments added will appear here</Text>
        </View>
      );
    }

    const currentMonthCount = monthlyTournamentData.currentMonthTournaments || 0;
    const maxValue = Math.max(...monthlyTournamentData.values, currentMonthCount, 1);
    const barHeight = (currentMonthCount / maxValue) * MAX_BAR_HEIGHT;

    // Get last 5 months for comparison (excluding current month)
    const comparisonData = monthlyTournamentData.values.slice(0, -1);
    const comparisonLabels = monthlyTournamentData.labels.slice(0, -1);
    const comparisonMax = Math.max(...comparisonData, 1);
    const comparisonBarHeight = 100; // Fixed height for comparison bars

    return (
      <View style={styles.chartContainer}>
        {/* Current Month Display */}
        <View style={styles.currentMonthSection}>
          <View style={styles.currentMonthHeader}>
            <View style={[styles.currentMonthIcon, { backgroundColor: 'rgba(251, 146, 60, 0.2)' }]}>
              <Calendar size={20} color="#f59e0b" />
            </View>
            <View style={styles.currentMonthInfo}>
              <Text style={styles.currentMonthLabel}>Current Month</Text>
              <Text style={styles.currentMonthName}>{monthlyTournamentData.currentMonth}</Text>
            </View>
          </View>
          
          <View style={[styles.currentMonthBarContainer, { borderColor: 'rgba(251, 146, 60, 0.2)' }]}>
            <View style={styles.currentMonthBarWrapper}>
              {/* Value Display */}
              <View style={[styles.currentMonthValueBox, { backgroundColor: 'rgba(251, 146, 60, 0.15)', borderColor: 'rgba(251, 146, 60, 0.3)' }]}>
                <Text style={[styles.currentMonthValue, { color: '#f59e0b' }]}>{currentMonthCount}</Text>
                <Text style={styles.currentMonthValueLabel}>Tournaments Added</Text>
              </View>

              {/* Main Bar */}
              <View style={styles.currentMonthBarArea}>
                <LinearGradient
                  colors={['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a']}
                  start={{ x: 0, y: 1 }}
                  end={{ x: 0, y: 0 }}
                  style={[
                    styles.currentMonthBar,
                    { 
                      height: Math.max(barHeight, 20),
                      shadowColor: '#f59e0b',
                    }
                  ]}
                >
                  <LinearGradient
                    colors={['rgba(255,255,255,0.4)', 'rgba(255,255,255,0)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                </LinearGradient>
                
                {/* Grid lines */}
                <View style={styles.currentMonthGrid}>
                  {[4, 3, 2, 1, 0].map((line) => (
                    <View 
                      key={line} 
                      style={[
                        styles.currentMonthGridLine,
                        { bottom: (line * MAX_BAR_HEIGHT / 4) }
                      ]} 
                    />
                  ))}
                </View>
              </View>

              {/* Y-axis */}
              <View style={styles.currentMonthYAxis}>
                {[maxValue, Math.floor(maxValue * 0.75), Math.floor(maxValue * 0.5), Math.floor(maxValue * 0.25), 0].map((val, idx) => (
                  <Text key={idx} style={styles.currentMonthYAxisLabel}>
                    {val}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Comparison Section - Last 5 Months */}
        <View style={styles.comparisonSection}>
          <Text style={styles.comparisonTitle}>Previous Months Comparison</Text>
          <View style={styles.comparisonBars}>
            {comparisonData.map((value, index) => {
              const barHeight = (value / comparisonMax) * comparisonBarHeight;
              const monthName = comparisonLabels[index]?.substring(0, 3) || '';
              
              return (
                <View key={index} style={styles.comparisonBarWrapper}>
                  <View style={styles.comparisonBarContainer}>
                    {value > 0 && (
                      <>
                        <Text style={styles.comparisonBarValue}>{value}</Text>
                        <LinearGradient
                          colors={['#d97706', '#f59e0b']}
                          start={{ x: 0, y: 1 }}
                          end={{ x: 0, y: 0 }}
                          style={[
                            styles.comparisonBar,
                            { 
                              height: Math.max(barHeight, 4),
                              shadowColor: '#f59e0b',
                            }
                          ]}
                        />
                      </>
                    )}
                    {value === 0 && (
                      <View style={[styles.comparisonBar, styles.emptyComparisonBar]} />
                    )}
                  </View>
                  <Text style={styles.comparisonBarLabel}>{monthName}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const growthPercentage = getGrowthPercentage();
  const totalThisMonth = getTotalThisMonth();

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />
      }
    >
      {/* Hero Header */}
      <LinearGradient
        colors={['#1e1b4b', '#312e81', '#1e293b']}
        style={styles.heroContainer}
      >
        <ImageBackground
          source={{
            uri: "https://images.pexels.com/photos/442576/pexels-photo-442576.jpeg?auto=compress&cs=tinysrgb&w=1080",
          }}
          style={styles.heroBackground}
          imageStyle={{ opacity: 0.1 }}
        >
          <View style={styles.heroContent}>
            <View style={styles.heroIconWrapper}>
              <ChartBar size={32} color="#a78bfa" />
            </View>
            <Text style={styles.heroTitle}>Admin Dashboard</Text>
            <Text style={styles.heroSubtitle}>
              Analytics & Insights Overview
            </Text>
          </View>
        </ImageBackground>
      </LinearGradient>

      {/* Stats Cards */}
      <View style={styles.statsSection}>
        <View style={styles.statsGrid}>
          <LinearGradient
            colors={['rgba(139, 92, 246, 0.15)', 'rgba(139, 92, 246, 0.05)']}
            style={styles.statCard}
          >
            <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
              <Users size={24} color="#a78bfa" />
            </View>
            <Text style={styles.statValue}>
              {monthlyData ? monthlyData.totalUsers.toLocaleString() : '0'}
            </Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </LinearGradient>

          <LinearGradient
            colors={['rgba(124, 58, 237, 0.15)', 'rgba(124, 58, 237, 0.05)']}
            style={styles.statCard}
          >
            <View style={[styles.statIconWrapper, { backgroundColor: 'rgba(124, 58, 237, 0.2)' }]}>
              <UserPlus size={24} color="#a78bfa" />
            </View>
            <Text style={styles.statValue}>
              {monthlyData ? monthlyData.currentMonthSignups : 0}
            </Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>
              {monthlyData ? monthlyData.currentMonth.split(' ')[0] : 'This Month'}
            </Text>
          </LinearGradient>

          <LinearGradient
            colors={growthPercentage >= 0 
              ? ['rgba(34, 197, 94, 0.15)', 'rgba(34, 197, 94, 0.05)']
              : ['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.05)']
            }
            style={styles.statCard}
          >
            <View style={[
              styles.statIconWrapper, 
              { backgroundColor: growthPercentage >= 0 
                ? 'rgba(34, 197, 94, 0.2)' 
                : 'rgba(239, 68, 68, 0.2)'
              }
            ]}>
              <TrendingUp 
                size={24} 
                color={growthPercentage >= 0 ? '#4ade80' : '#f87171'} 
              />
            </View>
            <Text 
              style={[
                styles.statValue,
                { color: growthPercentage >= 0 ? '#4ade80' : '#f87171' }
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {growthPercentage > 0 ? '+' : ''}{growthPercentage}%
            </Text>
            <Text style={styles.statLabel}>Growth Rate</Text>
          </LinearGradient>

        </View>
      </View>

      {/* Quick Actions */}
      {goToPage && (
        <View style={styles.quickActionsSection}>
          <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => goToPage('feedback')}
          >
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.2)', 'rgba(139, 92, 246, 0.1)']}
              style={styles.quickActionGradient}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
                <Mail size={24} color="#a78bfa" />
              </View>
              <View style={styles.quickActionContent}>
                <Text style={styles.quickActionTitle}>User Feedback</Text>
                <Text style={styles.quickActionSubtitle}>View and manage user feedback</Text>
              </View>
              <ArrowUpRight size={20} color="#a78bfa" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Chart Section */}
      <View style={styles.chartSection}>
        <View style={styles.chartHeader}>
          <View style={styles.chartHeaderLeft}>
            <View style={styles.chartHeaderIcon}>
              <TrendingUp size={20} color="#7c3aed" />
            </View>
            <View>
              <Text style={styles.chartTitle}>Monthly User Signups</Text>
              <Text style={styles.chartSubtitle}>
                Last 12 months analytics
              </Text>
            </View>
          </View>
          <View style={styles.chartHeaderBadge}>
            <Calendar size={14} color="#a78bfa" />
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : (
          <View style={styles.chartCard}>
            {renderCurrentMonthChart()}
          </View>
        )}
      </View>

      {/* Games Chart Section */}
      <View style={styles.chartSection}>
        <View style={styles.chartHeader}>
          <View style={styles.chartHeaderLeft}>
            <View style={[styles.chartHeaderIcon, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
              <Gamepad2 size={20} color="#10b981" />
            </View>
            <View>
              <Text style={styles.chartTitle}>Monthly Game Additions</Text>
              <Text style={styles.chartSubtitle}>
                Games added to borrow section
              </Text>
            </View>
          </View>
          <View style={[styles.chartHeaderBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Calendar size={14} color="#10b981" />
          </View>
        </View>

        {loadingGames ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : (
          <View style={styles.chartCard}>
            {renderCurrentMonthGamesChart()}
          </View>
        )}
      </View>

      {/* Tournaments Chart Section */}
      <View style={styles.chartSection}>
        <View style={styles.chartHeader}>
          <View style={styles.chartHeaderLeft}>
            <View style={[styles.chartHeaderIcon, { backgroundColor: 'rgba(251, 146, 60, 0.2)' }]}>
              <Trophy size={20} color="#f59e0b" />
            </View>
            <View>
              <Text style={styles.chartTitle}>Monthly Tournament Additions</Text>
              <Text style={styles.chartSubtitle}>
                Tournaments added to tournament page
              </Text>
            </View>
          </View>
          <View style={[styles.chartHeaderBadge, { backgroundColor: 'rgba(251, 146, 60, 0.15)' }]}>
            <Calendar size={14} color="#f59e0b" />
          </View>
        </View>

        {loadingTournaments ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#f59e0b" />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : (
          <View style={styles.chartCard}>
            {renderCurrentMonthTournamentsChart()}
          </View>
        )}
      </View>

      {/* Bottom Spacing */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AdminDashboard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },
  heroContainer: {
    height: 280,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  heroBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  heroIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(167, 139, 250, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#c4b5fd',
    textAlign: 'center',
    opacity: 0.9,
  },
  quickActionsSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  quickActionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  quickActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
  },
  statsSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
  },
  statIconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
    flexShrink: 1,
  },
  chartSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  chartHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  chartHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
    letterSpacing: -0.3,
  },
  chartSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  chartHeaderBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(124, 58, 237, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    height: CHART_HEIGHT + 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 14,
    fontWeight: '500',
  },
  chartCard: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  chartContainer: {
    paddingVertical: 8,
  },
  currentMonthSection: {
    marginBottom: 32,
  },
  currentMonthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  currentMonthIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentMonthInfo: {
    flex: 1,
  },
  currentMonthLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
    marginBottom: 2,
  },
  currentMonthName: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  currentMonthBarContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  currentMonthBarWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
  },
  currentMonthValueBox: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    minWidth: 100,
    alignItems: 'center',
  },
  currentMonthValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#a78bfa',
    letterSpacing: -1,
    marginBottom: 4,
  },
  currentMonthValueLabel: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '500',
    textAlign: 'center',
  },
  currentMonthBarArea: {
    flex: 1,
    height: MAX_BAR_HEIGHT,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  currentMonthBar: {
    width: '100%',
    borderRadius: 12,
    minHeight: 20,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  currentMonthGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  currentMonthGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  currentMonthYAxis: {
    width: 35,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 8,
    height: MAX_BAR_HEIGHT,
  },
  currentMonthYAxisLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  comparisonSection: {
    marginTop: 8,
  },
  comparisonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comparisonBars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  comparisonBarWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonBarContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 120,
    justifyContent: 'flex-end',
  },
  comparisonBar: {
    width: '100%',
    borderRadius: 6,
    minHeight: 4,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyComparisonBar: {
    backgroundColor: 'rgba(148, 163, 184, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    borderStyle: 'dashed',
    shadowOpacity: 0,
    elevation: 0,
  },
  comparisonBarValue: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  comparisonBarLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  noDataContainer: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noDataText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  noDataSubtext: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 8,
  },
  bottomSpacing: {
    height: 40,
  },
});
