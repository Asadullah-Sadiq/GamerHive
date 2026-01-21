import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
  Linking,
  RefreshControl
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { getImageUrl } from '../utils/api';
import {
  Trophy,
  Calendar,
  Users,
  DollarSign,
  Clock,
  Search,
  Star,
  MapPin,
  Gamepad2,
  Crown,
  Target,
  Zap,
  Shield,
  Swords,
  Medal,
  Timer,
  UserCheck,
  Gift,
  TrendingUp,
  Play,
  Eye,
  Share2,
  Bookmark,
  AlertCircle,
  CheckCircle,
  XCircle,
  Plus,
  X,
  Camera,
  Image as ImageIcon,
  Trash2,
  CheckSquare,
  Square
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Admin email - change this to your admin email
const ADMIN_EMAIL = "asadullahsadiq3@gmail.com"; // Change this to your admin email

interface Tournament {
  prize: string;
  id: string;
  name: string;
  game: string;
  description: string;
  participants: {
    current: number;
    max: number;
  };
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  prizePool: number;
  entryFee: number;
  status: 'upcoming' | 'live' | 'registration' | 'completed';
  format: 'Single Elimination' | 'Double Elimination' | 'Round Robin' | 'Swiss';
  platform: string;
  region: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro';
  image: string;
  organizer: string;
  rules: string[];
  prizes: {
    position: string;
    amount: number;
    percentage: number;
  }[];
  icon: React.ComponentType<any>;
  color: string;
  link?: string;
}

const TournamentPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [tournamentImage, setTournamentImage] = useState<string | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedTournaments, setSelectedTournaments] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    prize: '',
    entryFee: '',
    platform: 'Multi-Platform',
      format: 'Single Elimination',
    maxParticipants: '',
    registerLink: '',
    watchLiveLink: '',
    status: 'registration', // 'registration' or 'live'
  });

  // Check if user is admin and get userId
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");
        if (userData) {
          const user = JSON.parse(userData);
          setUserId(user.id || user._id);
          if (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
            setIsAdmin(true);
          }
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
      }
    };
    
    checkAdmin();
  }, []);

  // Fetch tournaments from backend
  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tournament');
      
      if (response.data.success) {
        // Transform backend data to match Tournament interface
        const transformedTournaments = response.data.data.tournaments.map((t: any) => ({
          id: t.id,
          name: t.name,
          game: 'Tournament', // Default game name
          description: `${t.name} - Prize: ${t.prize}`,
          participants: { current: 0, max: t.maxParticipants || 1000 },
          startDate: t.startDate,
          endDate: t.endDate,
          registrationDeadline: t.startDate,
          prizePool: parseFloat(t.prize.replace(/[^0-9.]/g, '')) || 0,
          entryFee: t.entryFee || 0,
          status: t.status,
          format: t.format || 'Single Elimination',
          platform: t.platform || 'Multi-Platform',
      region: 'Global',
          difficulty: 'Intermediate',
          image: t.image,
          organizer: 'GamerHive',
          rules: [],
          prizes: [],
      icon: Target,
          color: 'from-purple-500 to-pink-600',
          link: t.link,
        }));
        setTournaments(transformedTournaments);
      }
    } catch (error) {
      console.error("Error fetching tournaments:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch tournaments on component mount
  useEffect(() => {
    fetchTournaments();
  }, []);


  const filteredTournaments = tournaments.filter(tournament => {
    const matchesSearch = tournament.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tournament.game.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'registration': return styles.statusRegistration;
      case 'upcoming': return styles.statusUpcoming;
      case 'live': return styles.statusLive;
      case 'completed': return styles.statusCompleted;
      default: return styles.statusDefault;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'registration': return UserCheck;
      case 'upcoming': return Clock;
      case 'live': return Play;
      case 'completed': return CheckCircle;
      default: return AlertCircle;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return styles.difficultyBeginner;
      case 'Intermediate': return styles.difficultyIntermediate;
      case 'Advanced': return styles.difficultyAdvanced;
      case 'Pro': return styles.difficultyPro;
      default: return styles.difficultyDefault;
    }
  };

  const getParticipationPercentage = (current: number, max: number) => {
    return Math.round((current / max) * 100);
  };

  const getGradientStyle = (color: string) => {
    const gradientKey = color.replace('from-', 'gradient').replace(' to-', '') as keyof typeof styles;
    const gradientStyle = styles[gradientKey];
    return gradientStyle && typeof gradientStyle === 'object' && 'backgroundColor' in gradientStyle 
      ? gradientStyle 
      : styles.imageOverlay;
  };

  // Request image picker permissions
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Denied',
        'We need camera roll permissions to upload tournament images.'
      );
      return false;
    }
    return true;
  };

  // Handle image picker from gallery
  const handlePickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setTournamentImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  // Handle create tournament
  const handleCreateTournament = async () => {
    if (!formData.name || !formData.startDate || !formData.endDate || !formData.prize) {
      Alert.alert("Error", "Please fill all required fields (Name, Start Date, End Date, Prize).");
      return;
    }

    if (formData.status === 'registration' && !formData.registerLink) {
      Alert.alert("Error", "Please provide a registration link.");
      return;
    }

    if (formData.status === 'live' && !formData.watchLiveLink) {
      Alert.alert("Error", "Please provide a watch live link.");
      return;
    }

    if (!tournamentImage) {
      Alert.alert("Error", "Please select a tournament image.");
      return;
    }

    if (!userId) {
      Alert.alert("Error", "User ID not found. Please login again.");
      return;
    }

    setIsCreating(true);

    try {
      const formDataToSend = new FormData();
      
      // Add image - either as file or URL
      if (tournamentImage) {
        if (!tournamentImage.startsWith('http')) {
          // Local file - upload as file
          const filename = tournamentImage.split('/').pop() || 'tournament.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;

          formDataToSend.append('image', {
            uri: tournamentImage,
            name: filename,
            type: type,
          } as any);
        } else {
          // URL - send as string
          formDataToSend.append('image', tournamentImage);
        }
      }

      // Combine date and time for start and end dates
      const startDateTime = formData.startTime 
        ? `${formData.startDate}T${formData.startTime}:00`
        : `${formData.startDate}T00:00:00`;
      
      const endDateTime = formData.endTime 
        ? `${formData.endDate}T${formData.endTime}:00`
        : `${formData.endDate}T23:59:59`;

      // Add all required fields
      formDataToSend.append('userId', userId);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('startDate', startDateTime);
      formDataToSend.append('endDate', endDateTime);
      formDataToSend.append('prize', formData.prize);
      formDataToSend.append('entryFee', formData.entryFee || '0');
      formDataToSend.append('platform', formData.platform);
      formDataToSend.append('format', formData.format);
      formDataToSend.append('maxParticipants', formData.maxParticipants || '1000');
      formDataToSend.append('status', formData.status);
      
      if (formData.status === 'registration') {
        formDataToSend.append('registerLink', formData.registerLink);
      } else {
        formDataToSend.append('watchLiveLink', formData.watchLiveLink);
      }

      const response = await api.post('/tournament', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        Alert.alert("Success", "Tournament created successfully!");
        
        // Reset form
        setFormData({
          name: '',
          startDate: '',
          startTime: '',
          endDate: '',
          endTime: '',
          prize: '',
          entryFee: '',
          platform: 'Multi-Platform',
          format: 'Single Elimination',
          maxParticipants: '',
          registerLink: '',
          watchLiveLink: '',
          status: 'registration',
        });
        setTournamentImage(null);
        setShowAddModal(false);
        
        // Refresh tournaments list
        await fetchTournaments();
      } else {
        Alert.alert("Error", response.data.message || "Failed to create tournament.");
      }
    } catch (error: any) {
      console.error("Error creating tournament:", error);
      Alert.alert("Error", error.response?.data?.message || error.message || "Failed to create tournament. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle edit tournament
  const handleEditTournament = (tournament: Tournament) => {
    setEditingTournamentId(tournament.id);
    
    // Parse dates to extract date and time
    const startDateObj = new Date(tournament.startDate);
    const endDateObj = new Date(tournament.endDate);
    
    const startDate = startDateObj.toISOString().split('T')[0];
    const startTime = startDateObj.toTimeString().split(' ')[0].slice(0, 5);
    const endDate = endDateObj.toISOString().split('T')[0];
    const endTime = endDateObj.toTimeString().split(' ')[0].slice(0, 5);
    
    // Set form data with tournament values
    setFormData({
      name: tournament.name,
      startDate: startDate,
      startTime: startTime,
      endDate: endDate,
      endTime: endTime,
      prize: tournament.prize,
      entryFee: tournament.entryFee ? String(tournament.entryFee) : '',
      platform: tournament.platform || 'Multi-Platform',
      format: tournament.format || 'Single Elimination',
      maxParticipants: tournament.participants.max ? String(tournament.participants.max) : '',
      registerLink: tournament.status === 'registration' ? (tournament.link || '') : '',
      watchLiveLink: tournament.status === 'live' ? (tournament.link || '') : '',
      status: tournament.status,
    });
    
    setTournamentImage(tournament.image);
    setShowEditModal(true);
  };

  // Handle update tournament
  const handleUpdateTournament = async () => {
    if (!formData.name || !formData.startDate || !formData.endDate || !formData.prize) {
      Alert.alert("Error", "Please fill all required fields (Name, Start Date, End Date, Prize).");
      return;
    }

    if (formData.status === 'registration' && !formData.registerLink) {
      Alert.alert("Error", "Please provide a registration link.");
      return;
    }

    if (formData.status === 'live' && !formData.watchLiveLink) {
      Alert.alert("Error", "Please provide a watch live link.");
      return;
    }

    if (!tournamentImage) {
      Alert.alert("Error", "Please select a tournament image.");
      return;
    }

    if (!userId || !editingTournamentId) {
      Alert.alert("Error", "User ID or Tournament ID not found. Please try again.");
      return;
    }

    setIsUpdating(true);

    try {
      const formDataToSend = new FormData();
      
      // Add image - either as file or URL
      if (tournamentImage) {
        if (!tournamentImage.startsWith('http')) {
          // Local file - upload as file
          const filename = tournamentImage.split('/').pop() || 'tournament.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;

          formDataToSend.append('image', {
            uri: tournamentImage,
            name: filename,
            type: type,
          } as any);
        } else {
          // URL - send as string
          formDataToSend.append('image', tournamentImage);
        }
      }

      // Combine date and time for start and end dates
      const startDateTime = formData.startTime 
        ? `${formData.startDate}T${formData.startTime}:00`
        : `${formData.startDate}T00:00:00`;
      
      const endDateTime = formData.endTime 
        ? `${formData.endDate}T${formData.endTime}:00`
        : `${formData.endDate}T23:59:59`;

      // Add all required fields
      formDataToSend.append('userId', userId);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('startDate', startDateTime);
      formDataToSend.append('endDate', endDateTime);
      formDataToSend.append('prize', formData.prize);
      formDataToSend.append('entryFee', formData.entryFee || '0');
      formDataToSend.append('platform', formData.platform);
      formDataToSend.append('format', formData.format);
      formDataToSend.append('maxParticipants', formData.maxParticipants || '1000');
      formDataToSend.append('status', formData.status);
      
      if (formData.status === 'registration') {
        formDataToSend.append('registerLink', formData.registerLink);
      } else {
        formDataToSend.append('watchLiveLink', formData.watchLiveLink);
      }

      const response = await api.put(`/tournament/${editingTournamentId}`, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        Alert.alert("Success", "Tournament updated successfully!");
        
        // Reset form
        setFormData({
          name: '',
          startDate: '',
          startTime: '',
          endDate: '',
          endTime: '',
          prize: '',
          entryFee: '',
          platform: 'Multi-Platform',
          format: 'Single Elimination',
          maxParticipants: '',
          registerLink: '',
          watchLiveLink: '',
          status: 'registration',
        });
        setTournamentImage(null);
        setEditingTournamentId(null);
        setShowEditModal(false);
        
        // Refresh tournaments list
        await fetchTournaments();
      } else {
        Alert.alert("Error", response.data.message || "Failed to update tournament.");
      }
    } catch (error: any) {
      console.error("Error updating tournament:", error);
      Alert.alert("Error", error.response?.data?.message || error.message || "Failed to update tournament. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Toggle tournament selection
  const toggleTournamentSelection = (tournamentId: string) => {
    setSelectedTournaments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tournamentId)) {
        newSet.delete(tournamentId);
      } else {
        newSet.add(tournamentId);
      }
      return newSet;
    });
  };

  // Delete selected tournaments
  const handleDeleteSelected = async () => {
    if (selectedTournaments.size === 0) {
      Alert.alert("Error", "Please select tournaments to delete.");
      return;
    }

    Alert.alert(
      "Delete Tournaments",
      `Are you sure you want to delete ${selectedTournaments.size} tournament${selectedTournaments.size > 1 ? 's' : ''}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              const tournamentIds = Array.from(selectedTournaments);
              const response = await api.delete('/tournament', {
                data: {
                  userId,
                  tournamentIds,
                },
              });

              if (response.data.success) {
                Alert.alert("Success", response.data.message);
                setIsSelectionMode(false);
                setSelectedTournaments(new Set());
                await fetchTournaments();
              } else {
                Alert.alert("Error", response.data.message || "Failed to delete tournaments.");
              }
            } catch (error: any) {
              console.error("Delete error:", error);
              Alert.alert(
                "Error",
                error.response?.data?.message || error.message || "Failed to delete tournaments. Please try again.",
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const renderTournamentCard = ({ item: tournament }: { item: Tournament }) => {
    const IconComponent = tournament.icon;
    const StatusIcon = getStatusIcon(tournament.status);
    const participationPercentage = getParticipationPercentage(tournament.participants.current, tournament.participants.max);
    
    const isSelected = selectedTournaments.has(tournament.id);
    
    return (
      <TouchableOpacity 
        style={[styles.tournamentCard, isSelectionMode && styles.tournamentCardSelectable, isSelected && styles.tournamentCardSelected]}
        onPress={() => {
          if (isSelectionMode) {
            toggleTournamentSelection(tournament.id);
          }
        }}
        activeOpacity={isSelectionMode ? 0.7 : 1}
      >
        {isSelectionMode && (
          <View style={styles.selectionIndicator}>
            {isSelected ? (
              <CheckSquare size={24} color="#7c3aed" />
            ) : (
              <Square size={24} color="#a78bfa" />
            )}
          </View>
        )}
        {/* Tournament Image Header */}
        <View style={styles.tournamentImageContainer}>
          <Image
            source={{ uri: getImageUrl(tournament.image) || tournament.image }}
            style={styles.tournamentImage}
            resizeMode="cover"
          />
          <View style={[styles.imageOverlay, getGradientStyle(tournament.color)]} />
          
          {/* Status Badge */}
          <View style={[styles.statusBadge, getStatusColor(tournament.status)]}>
            <StatusIcon size={12} color="currentColor" />
            <Text style={styles.statusBadgeText}>
              {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
            </Text>
          </View>

          {/* Difficulty Badge */}
          <View style={[styles.difficultyBadge, getDifficultyColor(tournament.difficulty)]}>
            <Text style={styles.difficultyBadgeText}>{tournament.difficulty}</Text>
          </View>

          {/* Game Icon */}
          <View style={styles.gameIconContainer}>
            <IconComponent size={20} color="#ffffff" />
          </View>

          {/* Prize Pool */}
          <View style={styles.prizePoolContainer}>
            <DollarSign size={16} color="#fbbf24" />
            <Text style={styles.prizePoolText}>{formatCurrency(tournament.prizePool)}</Text>
          </View>
        </View>

        {/* Tournament Content */}
        <View style={styles.tournamentContent}>
          <View style={styles.tournamentHeader}>
            <Text style={styles.tournamentName}>{tournament.name}</Text>
            <Text style={styles.tournamentGame}>{tournament.game}</Text>
          </View>

          <Text style={styles.tournamentDescription} numberOfLines={2}>
            {tournament.description}
          </Text>

          {/* Tournament Details */}
          <View style={styles.detailsContainer}>
            {/* Participants */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabel}>
                <Users size={16} color="#a78bfa" />
                <Text style={styles.detailLabelText}>Participants</Text>
              </View>
              <View style={styles.participantsContainer}>
                <Text style={styles.participantsText}>
                  {tournament.participants.current.toLocaleString()}/{tournament.participants.max.toLocaleString()}
                </Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill,
                      { width: `${participationPercentage}%` }
                    ]} 
                  />
                </View>
              </View>
            </View>

            {/* Start Date */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabel}>
                <Calendar size={16} color="#34d399" />
                <Text style={styles.detailLabelText}>Start Date</Text>
              </View>
              <Text style={styles.detailValue}>{formatDate(tournament.startDate)}</Text>
            </View>

            {/* End Date */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabel}>
                <Timer size={16} color="#f87171" />
                <Text style={styles.detailLabelText}>End Date</Text>
              </View>
              <Text style={styles.detailValue}>{formatDate(tournament.endDate)}</Text>
            </View>

            {/* Entry Fee */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabel}>
                <Gift size={16} color="#fbbf24" />
                <Text style={styles.detailLabelText}>Entry Fee</Text>
              </View>
              <Text style={styles.detailValue}>{tournament.entryFee || 'Free'}</Text>
            </View>

            {/* Platform */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabel}>
                <MapPin size={16} color="#60a5fa" />
                <Text style={styles.detailLabelText}>Platform</Text>
              </View>
              <Text style={styles.detailValue}>{tournament.platform}</Text>
            </View>

            {/* Format */}
            <View style={styles.detailRow}>
              <View style={styles.detailLabel}>
                <Swords size={16} color="#22d3ee" />
                <Text style={styles.detailLabelText}>Format</Text>
              </View>
              <Text style={styles.detailValue}>{tournament.format}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          {!isSelectionMode && (
          <View style={styles.actionButtons}>
              {isAdmin ? (
                <TouchableOpacity 
                  style={styles.editButton}
                  onPress={() => handleEditTournament(tournament)}
                >
                  <Text style={styles.editButtonText}>Edit Tournament</Text>
                </TouchableOpacity>
              ) : (
                <>
                  {tournament.status === 'registration' && tournament.link && (
                    <TouchableOpacity 
                      style={styles.primaryButton}
                      onPress={() => {
                        if (tournament.link) {
                          Linking.openURL(tournament.link).catch(err => {
                            console.error('Failed to open URL:', err);
                            Alert.alert('Error', 'Failed to open link. Please check the URL.');
                          });
                        }
                      }}
                    >
                <Text style={styles.primaryButtonText}>Register Now</Text>
              </TouchableOpacity>
            )}
                  {tournament.status === 'live' && tournament.link && (
                    <TouchableOpacity 
                      style={styles.liveButton}
                      onPress={() => {
                        if (tournament.link) {
                          Linking.openURL(tournament.link).catch(err => {
                            console.error('Failed to open URL:', err);
                            Alert.alert('Error', 'Failed to open link. Please check the URL.');
                          });
                        }
                      }}
                    >
                <Play size={16} color="#ffffff" />
                <Text style={styles.liveButtonText}>Watch Live</Text>
              </TouchableOpacity>
            )}
                </>
              )}
            </View>
          )}
          </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              setRefreshing(true);
              await fetchTournaments();
              setRefreshing(false);
            }} 
            tintColor="#7c3aed" 
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Gaming Tournaments</Text>
          {isAdmin && (
            <View style={styles.adminButtons}>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => setShowAddModal(true)}
              >
                <Plus size={20} color="#ffffff" />
                <Text style={styles.addButtonText}>Add Tournament</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.deleteButton, isSelectionMode && styles.deleteButtonActive]}
                onPress={() => {
                  if (isSelectionMode) {
                    handleDeleteSelected();
                  } else {
                    setIsSelectionMode(true);
                  }
                }}
                disabled={isDeleting}
              >
                <Trash2 size={20} color="#ffffff" />
                <Text style={styles.deleteButtonText}>
                  {isSelectionMode ? 'Delete Selected' : 'Delete'}
          </Text>
              </TouchableOpacity>
              {isSelectionMode && (
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => {
                    setIsSelectionMode(false);
                    setSelectedTournaments(new Set());
                  }}
                >
                  <X size={20} color="#ffffff" />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Search */}
        <View style={styles.filtersContainer}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Search size={20} color="#a78bfa" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search tournaments or games..."
              placeholderTextColor="#a78bfa80"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>
        </View>


        {/* Tournaments List */}
        <View style={styles.tournamentsSection}>
          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color="#a78bfa" />
              <Text style={styles.emptyTitle}>Loading tournaments...</Text>
            </View>
          ) : filteredTournaments.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Trophy size={48} color="#a78bfa" />
              </View>
              <Text style={styles.emptyTitle}>No Tournaments Found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search to find tournaments.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredTournaments}
              renderItem={renderTournamentCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.tournamentsList}
            />
          )}
        </View>
      </ScrollView>

      {/* Add Tournament Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Tournament</Text>
              <TouchableOpacity
                onPress={() => setShowAddModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {/* Tournament Image */}
              <View style={styles.imagePickerContainer}>
                <Text style={styles.label}>Tournament Picture *</Text>
                <TouchableOpacity
                  style={styles.imagePickerButton}
                  onPress={handlePickImage}
                >
                  {tournamentImage ? (
                    <Image
                      source={{ uri: tournamentImage.startsWith('file://') ? tournamentImage : (getImageUrl(tournamentImage) || tournamentImage) }}
                      style={styles.previewImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <ImageIcon size={32} color="#a78bfa" />
                      <Text style={styles.imagePlaceholderText}>Select Image</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Tournament Name */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Tournament Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter tournament name"
                  placeholderTextColor="#a78bfa80"
                  value={formData.name}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                />
              </View>

              {/* Start Date */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Start Date *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#a78bfa80"
                  value={formData.startDate}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, startDate: text }))}
                />
              </View>

              {/* Start Time */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Start Time</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM (e.g., 10:00)"
                  placeholderTextColor="#a78bfa80"
                  value={formData.startTime}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, startTime: text }))}
                />
              </View>

              {/* End Date */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>End Date *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#a78bfa80"
                  value={formData.endDate}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, endDate: text }))}
                />
              </View>

              {/* End Time */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>End Time</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM (e.g., 18:00)"
                  placeholderTextColor="#a78bfa80"
                  value={formData.endTime}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, endTime: text }))}
                />
              </View>

              {/* Prize */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Prize *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter prize amount (e.g., $50,000)"
                  placeholderTextColor="#a78bfa80"
                  value={formData.prize}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, prize: text }))}
                />
              </View>

              {/* Entry Fee */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Entry Fee</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter entry fee (e.g., $25 or 25)"
                  placeholderTextColor="#a78bfa80"
                  value={formData.entryFee}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, entryFee: text }))}
                />
              </View>

              {/* Platform */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Platform</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter platform (e.g., Mobile, PC, Multi-Platform)"
                  placeholderTextColor="#a78bfa80"
                  value={formData.platform}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, platform: text }))}
                />
              </View>

              {/* Format */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Format</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter format (e.g., Single Elimination, Double Elimination)"
                  placeholderTextColor="#a78bfa80"
                  value={formData.format}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, format: text }))}
                />
              </View>

              {/* Max Participants */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Max Participants</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter max participants (e.g., 1000)"
                  placeholderTextColor="#a78bfa80"
                  value={formData.maxParticipants}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, maxParticipants: text }))}
                  keyboardType="numeric"
                />
              </View>

              {/* Status */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Status *</Text>
                <View style={styles.statusSelector}>
                  <TouchableOpacity
                    style={[
                      styles.statusOption,
                      formData.status === 'registration' && styles.statusOptionSelected
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, status: 'registration' }))}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      formData.status === 'registration' && styles.statusOptionTextSelected
                    ]}>
                      Registration
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.statusOption,
                      formData.status === 'live' && styles.statusOptionSelected
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, status: 'live' }))}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      formData.status === 'live' && styles.statusOptionTextSelected
                    ]}>
                      Live
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Register Link - shown when status is registration */}
              {formData.status === 'registration' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Register Link *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter registration link"
                    placeholderTextColor="#a78bfa80"
                    value={formData.registerLink}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, registerLink: text }))}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>
              )}

              {/* Watch Live Link - shown when status is live */}
              {formData.status === 'live' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Watch Live Link *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter watch live link"
                    placeholderTextColor="#a78bfa80"
                    value={formData.watchLiveLink}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, watchLiveLink: text }))}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitButton, isCreating && styles.submitButtonDisabled]}
                onPress={handleCreateTournament}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Create Tournament</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Tournament Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowEditModal(false);
          setEditingTournamentId(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Tournament</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowEditModal(false);
                  setEditingTournamentId(null);
                }}
                style={styles.closeButton}
              >
                <X size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {/* Tournament Image */}
              <View style={styles.imagePickerContainer}>
                <Text style={styles.label}>Tournament Picture *</Text>
                <TouchableOpacity
                  style={styles.imagePickerButton}
                  onPress={handlePickImage}
                >
                  {tournamentImage ? (
                    <Image
                      source={{ uri: tournamentImage.startsWith('file://') ? tournamentImage : (getImageUrl(tournamentImage) || tournamentImage) }}
                      style={styles.previewImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <ImageIcon size={32} color="#a78bfa" />
                      <Text style={styles.imagePlaceholderText}>Select Image</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Tournament Name */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Tournament Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter tournament name"
                  placeholderTextColor="#a78bfa80"
                  value={formData.name}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                />
              </View>

              {/* Start Date */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Start Date *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#a78bfa80"
                  value={formData.startDate}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, startDate: text }))}
                />
              </View>

              {/* Start Time */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Start Time</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM (e.g., 10:00)"
                  placeholderTextColor="#a78bfa80"
                  value={formData.startTime}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, startTime: text }))}
                />
              </View>

              {/* End Date */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>End Date *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#a78bfa80"
                  value={formData.endDate}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, endDate: text }))}
                />
              </View>

              {/* End Time */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>End Time</Text>
                <TextInput
                  style={styles.input}
                  placeholder="HH:MM (e.g., 18:00)"
                  placeholderTextColor="#a78bfa80"
                  value={formData.endTime}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, endTime: text }))}
                />
              </View>

              {/* Prize */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Prize *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter prize amount (e.g., $50,000)"
                  placeholderTextColor="#a78bfa80"
                  value={formData.prize}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, prize: text }))}
                />
              </View>

              {/* Entry Fee */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Entry Fee</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter entry fee (e.g., $25 or 25)"
                  placeholderTextColor="#a78bfa80"
                  value={formData.entryFee}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, entryFee: text }))}
                />
              </View>

              {/* Platform */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Platform</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter platform (e.g., Mobile, PC, Multi-Platform)"
                  placeholderTextColor="#a78bfa80"
                  value={formData.platform}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, platform: text }))}
                />
              </View>

              {/* Format */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Format</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter format (e.g., Single Elimination, Double Elimination)"
                  placeholderTextColor="#a78bfa80"
                  value={formData.format}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, format: text }))}
                />
              </View>

              {/* Max Participants */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Max Participants</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter max participants (e.g., 1000)"
                  placeholderTextColor="#a78bfa80"
                  value={formData.maxParticipants}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, maxParticipants: text }))}
                  keyboardType="numeric"
                />
              </View>

              {/* Status */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Status *</Text>
                <View style={styles.statusSelector}>
                  <TouchableOpacity
                    style={[
                      styles.statusOption,
                      formData.status === 'registration' && styles.statusOptionSelected
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, status: 'registration' }))}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      formData.status === 'registration' && styles.statusOptionTextSelected
                    ]}>
                      Registration
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.statusOption,
                      formData.status === 'live' && styles.statusOptionSelected
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, status: 'live' }))}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      formData.status === 'live' && styles.statusOptionTextSelected
                    ]}>
                      Live
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Register Link - shown when status is registration */}
              {formData.status === 'registration' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Register Link *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter registration link"
                    placeholderTextColor="#a78bfa80"
                    value={formData.registerLink}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, registerLink: text }))}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>
              )}

              {/* Watch Live Link - shown when status is live */}
              {formData.status === 'live' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Watch Live Link *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter watch live link"
                    placeholderTextColor="#a78bfa80"
                    value={formData.watchLiveLink}
                    onChangeText={(text) => setFormData(prev => ({ ...prev, watchLiveLink: text }))}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>
              )}

              {/* Update Button */}
              <TouchableOpacity
                style={[styles.submitButton, isUpdating && styles.submitButtonDisabled]}
                onPress={handleUpdateTournament}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>Update Tournament</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#a78bfa',
    marginBottom: 8,
  },
  adminButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  deleteButtonActive: {
    backgroundColor: '#dc2626',
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#475569',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tournamentCardSelectable: {
    opacity: 0.9,
  },
  tournamentCardSelected: {
    borderColor: '#7c3aed',
    borderWidth: 2,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    backgroundColor: '#00000080',
    borderRadius: 20,
    padding: 4,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b80',
    borderWidth: 1,
    borderColor: '#a78bfa30',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  filterRow: {
    flexDirection: 'row',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b80',
    borderWidth: 1,
    borderColor: '#a78bfa30',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    minWidth: 120,
  },
  filterButtonText: {
    flex: 1,
    marginHorizontal: 8,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    backgroundColor: '#1e293b80',
    borderWidth: 1,
    borderColor: '#47556950',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#c4b5fd',
    opacity: 0.7,
    textAlign: 'center',
  },
  tournamentsSection: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  tournamentsList: {
    paddingBottom: 20,
  },
  tournamentCard: {
    backgroundColor: '#1e293b80',
    borderWidth: 1,
    borderColor: '#47556950',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tournamentImageContainer: {
    height: 160,
    position: 'relative',
  },
  tournamentImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.6,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  difficultyBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  difficultyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  gameIconContainer: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    padding: 8,
    backgroundColor: '#00000050',
    borderRadius: 8,
  },
  prizePoolContainer: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#00000050',
    borderRadius: 8,
  },
  prizePoolText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  tournamentContent: {
    padding: 16,
  },
  tournamentHeader: {
    marginBottom: 8,
  },
  tournamentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  tournamentGame: {
    fontSize: 14,
    color: '#a78bfa',
    fontWeight: '500',
  },
  tournamentDescription: {
    fontSize: 14,
    color: '#c4b5fd',
    opacity: 0.7,
    lineHeight: 20,
    marginBottom: 16,
  },
  detailsContainer: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailLabelText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#c4b5fd',
  },
  participantsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 8,
  },
  progressBar: {
    width: 64,
    height: 8,
    backgroundColor: '#475569',
    borderRadius: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#a78bfa',
    borderRadius: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  liveButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  liveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  upcomingButton: {
    flex: 1,
    backgroundColor: '#d97706',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  upcomingButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  completedButton: {
    flex: 1,
    backgroundColor: '#475569',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  completedButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusSelector: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#a78bfa30',
  },
  statusOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusOptionSelected: {
    backgroundColor: '#7c3aed',
  },
  statusOptionText: {
    color: '#c4b5fd',
    fontSize: 14,
    fontWeight: '500',
  },
  statusOptionTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  secondaryActions: {
    flexDirection: 'row',
  },
  secondaryButton: {
    width: 44,
    height: 44,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    backgroundColor: '#1e293b80',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#c4b5fd',
    opacity: 0.7,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  modalScrollView: {
    maxHeight: '80%',
  },
  imagePickerContainer: {
    marginBottom: 20,
  },
  imagePickerButton: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1e293b80',
    borderWidth: 2,
    borderColor: '#a78bfa30',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: '#a78bfa',
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c4b5fd',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#a78bfa30',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  submitButton: {
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalOptionSelected: {
    backgroundColor: '#a78bfa20',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#c4b5fd',
  },
  modalOptionTextSelected: {
    color: '#a78bfa',
    fontWeight: '600',
  },
  modalCloseButton: {
    backgroundColor: '#475569',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Status Colors
  statusRegistration: {
    backgroundColor: '#3b82f620',
    color: '#60a5fa',
  },
  statusUpcoming: {
    backgroundColor: '#f59e0b20',
    color: '#fbbf24',
  },
  statusLive: {
    backgroundColor: '#10b98120',
    color: '#34d399',
  },
  statusCompleted: {
    backgroundColor: '#6b728020',
    color: '#9ca3af',
  },
  statusDefault: {
    backgroundColor: '#6b728020',
    color: '#9ca3af',
  },
  // Difficulty Colors
  difficultyBeginner: {
    backgroundColor: '#10b98120',
    color: '#34d399',
  },
  difficultyIntermediate: {
    backgroundColor: '#f59e0b20',
    color: '#fbbf24',
  },
  difficultyAdvanced: {
    backgroundColor: '#f9731620',
    color: '#fb923c',
  },
  difficultyPro: {
    backgroundColor: '#ef444420',
    color: '#f87171',
  },
  difficultyDefault: {
    backgroundColor: '#6b728020',
    color: '#9ca3af',
  },
  // Gradient Colors (simplified for React Native)
  'gradientorange-500tored-600': {
    backgroundColor: '#f97316',
  },
  'gradientblue-500topurple-600': {
    backgroundColor: '#3b82f6',
  },
  'gradientgreen-500toemerald-600': {
    backgroundColor: '#10b981',
  },
  'gradientpurple-500topink-600': {
    backgroundColor: '#a855f7',
  },
  'gradientred-500toorange-600': {
    backgroundColor: '#ef4444',
  },
  'gradientgray-600toslate-800': {
    backgroundColor: '#4b5563',
  },
  'gradientblue-600toindigo-700': {
    backgroundColor: '#2563eb',
  },
  'gradientgreen-400toblue-500': {
    backgroundColor: '#22c55e',
  },
});

export default TournamentPage;