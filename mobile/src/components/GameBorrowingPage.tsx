// GameBorrowingPage.native.tsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  ScrollView,
  Modal,
  Alert,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { getImageUrl } from '../utils/api';
import {
  Gamepad2,
  Search,
  Plus,
  Edit3,
  Trash2,
  Calendar,
  HardDrive,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Download,
  Timer,
  Monitor,
  Smartphone,
  Gamepad,
  Gamepad as GamepadIcon,
  TrendingUp,
  Image as ImageIcon,
  Upload,
} from 'lucide-react-native';
import { PageType } from '../../types';

interface Game {
  id: string;
  title: string;
  genre: string;
  platform: string[];
  fileSize: string;
  version: string;
  addedDate: string;
  description: string;
  image: string;
  status: 'available' | 'borrowed' | 'maintenance';
  totalCopies: number;
  availableCopies: number;
  borrowedCount: number;
  addedBy?: {
    _id: string;
    id: string;
    username?: string;
    name?: string;
    picture?: string;
  };
}


interface GameBorrowingPageProps {
  goToPage?: (page: PageType, params?: any) => void;
}

const GameBorrowingPage: React.FC<GameBorrowingPageProps> = ({ goToPage }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingGame, setIsAddingGame] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [viewingGame, setViewingGame] = useState<Game | null>(null);
  const [gameImageUri, setGameImageUri] = useState<string | null>(null);
  const [uploadingGame, setUploadingGame] = useState(false);
  const [updatingGame, setUpdatingGame] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [newGame, setNewGame] = useState<Partial<Game>>({
    title: '',
    genre: '',
    platform: [],
    fileSize: '',
    version: '',
    description: '',
  });

  // Load user ID and games on mount
  useEffect(() => {
    const loadUserIdAndGames = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          setUserId(user.id);
        }
        // Load all games (visible to all users)
        await loadAllGames();
      } catch (error) {
        console.error('Error loading user ID:', error);
      }
    };
    loadUserIdAndGames();
  }, []);

  // Load all games from database (visible to all users)
  const loadAllGames = async () => {
    try {
      const response = await api.get('/game/all');
      if (response.data.success) {
        const gamesList = response.data.data.games.map((game: any) => ({
          id: game._id || game.id,
          title: game.title,
          genre: game.genre,
          platform: game.platform || [],
          fileSize: game.fileSize,
          version: game.version || '1.0.0',
          addedDate: game.addedDate || new Date().toISOString().split('T')[0],
          description: game.description || '',
          image: game.image,
          status: game.status || 'available',
          totalCopies: game.totalCopies || 1,
          availableCopies: game.availableCopies || 1,
          borrowedCount: game.borrowedCount || 0,
          addedBy: game.addedBy ? {
            _id: game.addedBy._id || game.addedBy.id,
            id: game.addedBy._id || game.addedBy.id,
            username: game.addedBy.username,
            name: game.addedBy.name,
            picture: game.addedBy.picture,
          } : undefined,
        }));
        setGames(gamesList);
      }
    } catch (error) {
      console.error('Error loading games:', error);
    }
  };

  const [games, setGames] = useState<Game[]>([]);

  const genres = ['Battle Royale', 'FPS', 'Sports', 'Fighting', 'MOBA', 'Sandbox', 'RPG', 'Strategy'];
  const platforms = ['PC', 'PlayStation', 'Xbox'];

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const matchesSearch =
        game.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        game.genre.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [games, searchTerm]);


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysRemaining = (dueDateString: string) => {
    const dueDate = new Date(dueDateString);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'available':
        return styles.statusAvailable;
      case 'borrowed':
        return styles.statusBorrowed;
      case 'maintenance':
        return styles.statusMaintenance;
      default:
        return styles.statusDefault;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return CheckCircle;
      case 'borrowed':
        return Clock;
      case 'maintenance':
        return AlertCircle;
      default:
        return XCircle;
    }
  };


  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'PC':
        return Monitor;
      case 'Mobile':
        return Smartphone;
      case 'PlayStation':
      case 'Xbox':
        return GamepadIcon;
      default:
        return Gamepad2;
    }
  };

  // Handle image picker
  const handlePickGameImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permissions to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setGameImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Handle add game
  const handleAddGame = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please login again.');
      return;
    }

    if (!newGame.title || !newGame.genre || !newGame.platform || newGame.platform.length === 0 || !newGame.fileSize) {
      Alert.alert('Validation', 'Please fill required fields: Title, Genre, File Size, Platforms.');
      return;
    }

    if (!gameImageUri) {
      Alert.alert('Validation', 'Please upload a game image.');
      return;
    }

    try {
      setUploadingGame(true);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('image', {
        uri: gameImageUri,
        type: 'image/jpeg',
        name: 'game-image.jpg',
      } as any);
      formData.append('title', newGame.title);
      formData.append('genre', newGame.genre);
      formData.append('platform', JSON.stringify(newGame.platform));
      formData.append('fileSize', newGame.fileSize);
      formData.append('version', newGame.version || '1.0.0');
      formData.append('description', newGame.description || '');
      formData.append('userId', userId);

      const response = await api.post('/game/add', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const gameData = response.data.data.game;
        const newGameItem: Game = {
          id: gameData._id || gameData.id,
          title: gameData.title,
          genre: gameData.genre,
          platform: gameData.platform,
          fileSize: gameData.fileSize,
          version: gameData.version || '1.0.0',
          addedDate: gameData.addedDate || new Date().toISOString().split('T')[0],
          description: gameData.description || '',
          image: gameData.image,
          status: gameData.status || 'available',
          totalCopies: gameData.totalCopies || 1,
          availableCopies: gameData.availableCopies || 1,
          borrowedCount: gameData.borrowedCount || 0,
        };

        setGames((prev) => [...prev, newGameItem]);
      setNewGame({
        title: '',
        genre: '',
        platform: [],
        fileSize: '',
        version: '',
        description: '',
        });
        setGameImageUri(null);
      setIsAddingGame(false);
        Alert.alert('Success', 'Game added successfully!');
    } else {
        Alert.alert('Error', response.data.message || 'Failed to add game.');
      }
    } catch (error: any) {
      console.error('Add game error:', error);
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to add game. Please try again.');
    } finally {
      setUploadingGame(false);
    }
  };

  const handleEditGame = (game: Game) => {
    setEditingGame({ ...game });
    setGameImageUri(null);
  };

  const handleSaveEdit = async () => {
    if (!editingGame) return;
    
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please login again.');
      return;
    }

    if (!editingGame.title || !editingGame.genre || !editingGame.platform || editingGame.platform.length === 0 || !editingGame.fileSize) {
      Alert.alert('Validation', 'Please fill required fields: Title, Genre, File Size, Platforms.');
      return;
    }

    try {
      setUpdatingGame(true);

      const updateData: any = {
        title: editingGame.title,
        genre: editingGame.genre,
        platform: JSON.stringify(editingGame.platform),
        fileSize: editingGame.fileSize,
        version: editingGame.version || '1.0.0',
        description: editingGame.description || '',
        status: editingGame.status || 'available',
        totalCopies: editingGame.totalCopies || 1,
        availableCopies: editingGame.availableCopies || editingGame.totalCopies || 1,
        userId: userId,
      };

      // If new image is selected, add it to FormData
      let formData;
      if (gameImageUri) {
        formData = new FormData();
        formData.append('image', {
          uri: gameImageUri,
          type: 'image/jpeg',
          name: 'game-image.jpg',
        } as any);
        formData.append('title', updateData.title);
        formData.append('genre', updateData.genre);
        formData.append('platform', updateData.platform);
        formData.append('fileSize', updateData.fileSize);
        formData.append('version', updateData.version);
        formData.append('description', updateData.description);
        formData.append('status', updateData.status);
        formData.append('totalCopies', String(updateData.totalCopies));
        formData.append('availableCopies', String(updateData.availableCopies));
        formData.append('userId', updateData.userId);
      }

      const response = gameImageUri
        ? await api.put(`/game/${editingGame.id}`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          })
        : await api.put(`/game/${editingGame.id}`, updateData);

      if (response.data.success) {
        const updatedGameData = response.data.data.game;
        const updatedGame: Game = {
          id: updatedGameData._id || updatedGameData.id || editingGame.id,
          title: updatedGameData.title,
          genre: updatedGameData.genre,
          platform: updatedGameData.platform,
          fileSize: updatedGameData.fileSize,
          version: updatedGameData.version || '1.0.0',
          addedDate: updatedGameData.addedDate || editingGame.addedDate,
          description: updatedGameData.description || '',
          image: updatedGameData.image || editingGame.image,
          status: updatedGameData.status || 'available',
          totalCopies: updatedGameData.totalCopies || 1,
          availableCopies: updatedGameData.availableCopies || 1,
          borrowedCount: updatedGameData.borrowedCount || editingGame.borrowedCount || 0,
        };

        setGames((prev) => prev.map((g) => (g.id === editingGame.id ? updatedGame : g)));
      setEditingGame(null);
        setGameImageUri(null);
        Alert.alert('Success', 'Game updated successfully!');
      } else {
        Alert.alert('Error', response.data.message || 'Failed to update game.');
      }
    } catch (error: any) {
      console.error('Update game error:', error);
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to update game. Please try again.');
    } finally {
      setUpdatingGame(false);
    }
  };

  const handleBorrowGame = async (game: Game) => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please login again.');
      return;
    }

    if (game.status !== 'available') {
      Alert.alert('Not Available', 'This game is not available for borrowing.');
      return;
    }

    if (game.availableCopies <= 0) {
      Alert.alert('Not Available', 'No copies available for borrowing.');
      return;
    }

    if (!game.addedBy || !game.addedBy.id) {
      Alert.alert('Error', 'Game owner information not available.');
      return;
    }

    // Check if user is trying to borrow their own game
    if (game.addedBy.id === userId) {
      Alert.alert('Not Allowed', 'You cannot borrow your own game.');
      return;
    }

    if (!goToPage) {
      Alert.alert('Error', 'Navigation not available.');
      return;
    }

    Alert.alert('Borrow Game', `Do you want to request to borrow "${game.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Request',
        onPress: async () => {
          try {
            // Create borrow request in backend
            const response = await api.post('/game/borrow', {
              gameId: game.id,
              borrowerId: userId,
              message: `Hi! I would like to borrow "${game.title}".`,
            });

            if (response.data.success) {
              // Navigate to PTP messaging with game owner
              if (!game.addedBy || !game.addedBy.id) {
                Alert.alert('Error', 'Game owner information not available.');
                return;
              }
              goToPage('ptpMessaging', {
                targetUserId: game.addedBy.id,
                targetUsername: game.addedBy.username || game.addedBy.name || 'User',
                targetUserAvatar: game.addedBy.picture,
              });

              Alert.alert(
                'Request Sent',
                `Your borrow request for "${game.title}" has been sent! You can now chat with the game owner.`,
                [{ text: 'OK' }]
              );
            } else {
              Alert.alert('Error', response.data.message || 'Failed to create borrow request.');
            }
          } catch (error: any) {
            console.error('Error creating borrow request:', error);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to create borrow request. Please try again.';
            Alert.alert('Error', errorMessage);
          }
        },
      },
    ]);
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please login again.');
      return;
    }

    Alert.alert('Delete Game', 'Are you sure you want to delete this game?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await api.delete(`/game/${gameId}`, {
              data: { userId },
            });

            if (response.data.success) {
              // Remove game from local state
              setGames((prev) => prev.filter((g) => g.id !== gameId));
              Alert.alert('Success', 'Game deleted successfully!');
            } else {
              Alert.alert('Error', response.data.message || 'Failed to delete game.');
            }
          } catch (error: any) {
            console.error('Delete game error:', error);
            Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to delete game. Please try again.');
          }
        },
      },
    ]);
  };

  // Render game card
  const renderGameCard = ({ item }: { item: Game }): React.ReactElement => {
    const StatusIcon = getStatusIcon(item.status);
    return (
      <TouchableOpacity 
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => setViewingGame(item)}
      >
        <View style={styles.cardImageWrap}>
          <Image source={{ uri: getImageUrl(item.image) || item.image }} style={styles.cardImage} resizeMode="cover" />
          <View style={styles.cardImageGradient} />
          
          {/* Top Badges */}
          <View style={styles.cardTopBadges}>
          <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
              <StatusIcon width={12} height={12} color="#fff" />
              <Text style={styles.statusBadgeText}>{item.status.toUpperCase()}</Text>
          </View>
          </View>

          {/* Platform Icons */}
          <View style={styles.platformsWrap}>
            {item.platform.slice(0, 2).map((p, idx) => {
              const PlatformIcon = getPlatformIcon(p);
              return (
                <View key={idx} style={styles.platformIconWrap}>
                  <PlatformIcon width={12} height={12} color="#fff" />
                </View>
              );
            })}
            {item.platform.length > 2 && (
              <View style={styles.platformIconWrap}>
                <Text style={styles.platformMoreText}>+{item.platform.length - 2}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.cardContent}>
          {/* Title & Genre */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.cardGenre}>{item.genre}</Text>
          </View>

          {/* Quick Info */}
          <View style={styles.cardQuickInfo}>
            <View style={styles.quickInfoItem}>
              <HardDrive width={12} height={12} color="#9b86c7" />
              <Text style={styles.quickInfoText}>{item.fileSize}</Text>
            </View>
            <View style={styles.quickInfoDivider} />
            <View style={styles.quickInfoItem}>
              <Text style={styles.quickInfoText}>{item.version}</Text>
            </View>
          </View>

          {/* Availability */}
          <View style={styles.availabilityRow}>
            <View style={styles.availabilityBadge}>
              <CheckCircle width={10} height={10} color="#34d399" />
              <Text style={styles.availabilityText}>
                {item.availableCopies}/{item.totalCopies} Available
              </Text>
            </View>
          </View>

          {/* Borrow Button */}
          <TouchableOpacity 
            style={styles.borrowButton} 
            onPress={(e) => {
              e.stopPropagation();
              handleBorrowGame(item);
            }}
          >
            <Download width={16} height={16} color="#fff" />
            <Text style={styles.borrowButtonText}>Borrow</Text>
          </TouchableOpacity>

          {/* Actions */}
          <View style={styles.cardActions}>
            <TouchableOpacity 
              style={styles.viewButton} 
              onPress={() => setViewingGame(item)}
            >
              <Eye width={14} height={14} color="#fff" />
              <Text style={styles.viewButtonText}>View</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.iconButton} 
              onPress={(e) => {
                e.stopPropagation();
                handleEditGame(item);
              }}
            >
              <Edit3 width={14} height={14} color="#9b86c7" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.iconButton, styles.deleteButton]} 
              onPress={(e) => {
                e.stopPropagation();
                handleDeleteGame(item.id);
              }}
            >
              <Trash2 width={14} height={14} color="#f87171" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };


  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.select({ ios: 'padding', android: undefined })}>
        {/* Header - Simplified */}
        <View style={styles.header}>
          <Text style={styles.title}>
            <Text style={styles.gradientText}>Game Borrowing</Text>
          </Text>
        </View>


      {/* Content - Scrollable */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              setRefreshing(true);
              await loadAllGames();
              setRefreshing(false);
            }} 
            tintColor="#7c3aed" 
          />
        }
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.content}>
          {/* Header Section with Stats */}
          <View style={styles.libraryHeader}>
            <View style={styles.libraryStats}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{games.length}</Text>
                <Text style={styles.statLabel}>Total Games</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{games.filter((g) => g.status === 'available').length}</Text>
                <Text style={styles.statLabel}>Available</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{games.filter((g) => g.status === 'borrowed').length}</Text>
                <Text style={styles.statLabel}>Borrowed</Text>
              </View>
            </View>
          </View>
          
          {/* Add Game Button Row */}
          <View style={styles.addButtonRow}>
            <TouchableOpacity style={styles.addButton} onPress={() => setIsAddingGame(true)}>
              <Plus width={18} height={18} color="#fff" />
              <Text style={styles.addButtonText}>Add Game</Text>
            </TouchableOpacity>
          </View>

          {/* Search & Filters */}
          <View style={styles.searchSection}>
            <View style={styles.searchBox}>
              <Search width={18} height={18} color="#9b86c7" />
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search games, developers, genres..."
                placeholderTextColor="#6b7280"
                style={styles.searchInput}
              />
            </View>
              </View>

          {/* Games Grid */}
          <View style={styles.gamesSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Game Library</Text>
              <Text style={styles.sectionSubtitle}>{filteredGames.length} {filteredGames.length === 1 ? 'game' : 'games'} found</Text>
              </View>
            {filteredGames.length === 0 ? (
              <View style={styles.emptyState}>
                <Gamepad2 width={64} height={64} color="#4b5563" />
                <Text style={styles.emptyText}>No games found</Text>
                <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
              </View>
            ) : (
              <View style={styles.gamesGrid}>
                {filteredGames.map((item) => (
                  <View key={item.id} style={styles.gameCardWrapper}>
                    {renderGameCard({ item })}
              </View>
                ))}
            </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add Game Modal */}
      <Modal visible={isAddingGame} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Game</Text>
              <TouchableOpacity 
                onPress={() => {
                  setIsAddingGame(false);
                  setGameImageUri(null);
                  setNewGame({
                    title: '',
                    genre: '',
                    platform: [],
                    fileSize: '',
                    version: '',
                    description: '',
                  });
                }}
              >
                <XCircle width={20} height={20} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formRow}>
                <Text style={styles.label}>Game Title *</Text>
                <TextInput
                  value={newGame.title}
                  onChangeText={(v) => setNewGame((prev) => ({ ...prev, title: v }))}
                  style={styles.input}
                  placeholder="Enter game title"
                  placeholderTextColor="#9b86c7"
                />
              </View>

              <View style={styles.formRow}>
                <Text style={styles.label}>Genre *</Text>
                <View style={styles.pickerSingle}>
                  <Picker selectedValue={newGame.genre || ''} onValueChange={(v) => setNewGame((p) => ({ ...p, genre: v }))}>
                    <Picker.Item label="Select genre" value="" />
                    {genres.slice(1).map((g) => (
                      <Picker.Item key={g} label={g} value={g} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.formRow}>
                <Text style={styles.label}>File Size *</Text>
                <TextInput
                  value={newGame.fileSize}
                  onChangeText={(v) => setNewGame((prev) => ({ ...prev, fileSize: v }))}
                  style={styles.input}
                  placeholder="e.g., 2.5 GB"
                  placeholderTextColor="#9b86c7"
                />
              </View>

              <View style={styles.formRow}>
                <Text style={styles.label}>Version</Text>
                <TextInput
                  value={newGame.version}
                  onChangeText={(v) => setNewGame((prev) => ({ ...prev, version: v }))}
                  style={styles.input}
                  placeholder="e.g., 1.0.0"
                  placeholderTextColor="#9b86c7"
                />
              </View>

              <View style={styles.formRow}>
                <Text style={styles.label}>Game Image *</Text>
                <TouchableOpacity style={styles.imageUploadButton} onPress={handlePickGameImage}>
                  {gameImageUri ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: gameImageUri.startsWith('file://') ? gameImageUri : (getImageUrl(gameImageUri) || gameImageUri) }} style={styles.imagePreview} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => setGameImageUri(null)}
                      >
                        <XCircle width={20} height={20} color="#fff" />
                      </TouchableOpacity>
              </View>
                  ) : (
                    <View style={styles.imageUploadPlaceholder}>
                      <Upload width={24} height={24} color="#9b86c7" />
                      <Text style={styles.imageUploadText}>Tap to upload image</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.formRow}>
                <Text style={styles.label}>Platforms *</Text>
                <View style={styles.platformsSelect}>
                  {platforms.map((p) => {
                    const selected = (newGame.platform || []).includes(p);
                    return (
                      <TouchableOpacity
                        key={p}
                        onPress={() => {
                          const current = newGame.platform || [];
                          const updated = current.includes(p) ? current.filter((x) => x !== p) : [...current, p];
                          setNewGame((prev) => ({ ...prev, platform: updated }));
                        }}
                        style={[styles.platformButton, selected ? styles.platformButtonSelected : null]}
                      >
                        <Text style={selected ? styles.platformButtonTextSelected : styles.platformButtonText}>{p}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formRow}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  value={newGame.description}
                  onChangeText={(v) => setNewGame((prev) => ({ ...prev, description: v }))}
                  style={[styles.input, styles.textarea]}
                  placeholder="Enter game description"
                  placeholderTextColor="#9b86c7"
                  multiline
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.modalCancel} 
                  onPress={() => {
                    setIsAddingGame(false);
                    setGameImageUri(null);
                    setNewGame({
                      title: '',
                      genre: '',
                      platform: [],
                      fileSize: '',
                      version: '',
                      description: '',
                    });
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalSave, uploadingGame && styles.modalSaveDisabled]} 
                  onPress={handleAddGame}
                  disabled={uploadingGame}
                >
                  {uploadingGame ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                  <Text style={styles.modalSaveText}>Add Game</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Game Modal */}
      <Modal visible={!!editingGame} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Game</Text>
              <TouchableOpacity onPress={() => setEditingGame(null)}>
                <XCircle width={20} height={20} />
              </TouchableOpacity>
            </View>

            {editingGame && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.formRow}>
                  <Text style={styles.label}>Game Title</Text>
                  <TextInput value={editingGame.title} onChangeText={(v) => setEditingGame({ ...editingGame, title: v })} style={styles.input} />
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.label}>File Size</Text>
                  <TextInput value={editingGame.fileSize} onChangeText={(v) => setEditingGame({ ...editingGame, fileSize: v })} style={styles.input} />
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.label}>Version</Text>
                  <TextInput value={editingGame.version} onChangeText={(v) => setEditingGame({ ...editingGame, version: v })} style={styles.input} />
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.label}>Total Copies</Text>
                  <TextInput
                    value={String(editingGame.totalCopies)}
                    onChangeText={(v) => setEditingGame({ ...editingGame, totalCopies: parseInt(v) || 1 })}
                    style={styles.input}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.label}>Status</Text>
                  <View style={styles.pickerSingle}>
                    <Picker
                      selectedValue={editingGame.status}
                      onValueChange={(v) =>
                        setEditingGame({ ...editingGame, status: v as 'available' | 'borrowed' | 'maintenance' })
                      }
                    >
                      <Picker.Item label="Available" value="available" />
                      <Picker.Item label="Borrowed" value="borrowed" />
                      <Picker.Item label="Maintenance" value="maintenance" />
                    </Picker>
                  </View>
                </View>

                <View style={styles.formRow}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    value={editingGame.description}
                    onChangeText={(v) => setEditingGame({ ...editingGame, description: v })}
                    style={[styles.input, styles.textarea]}
                    multiline
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setEditingGame(null)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalSave} onPress={handleSaveEdit}>
                    <Text style={styles.modalSaveText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* View Game Modal */}
      <Modal visible={!!viewingGame} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContent, { maxWidth: 900 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{viewingGame?.title}</Text>
              <TouchableOpacity onPress={() => setViewingGame(null)}>
                <XCircle width={20} height={20} />
              </TouchableOpacity>
            </View>

            {viewingGame && (
              <ScrollView style={styles.modalBody}>
                <Image source={{ uri: getImageUrl(viewingGame.image) || viewingGame.image }} style={styles.viewImage} />
                <View style={styles.viewSection}>
                  <Text style={styles.viewSectionTitle}>Availability</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Total Copies:</Text>
                    <Text style={styles.infoValue}>{viewingGame.totalCopies}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Available:</Text>
                    <Text style={styles.infoValue}>{viewingGame.availableCopies}</Text>
                  </View>
                </View>

                <View style={styles.viewSection}>
                  <Text style={styles.viewSectionTitle}>Description</Text>
                  <Text style={styles.descriptionText}>{viewingGame.description}</Text>
                </View>

                <View style={styles.viewSection}>
                  <Text style={styles.viewSectionTitle}>Technical Details</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>File Size:</Text>
                    <Text style={styles.infoValue}>{viewingGame.fileSize}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Version:</Text>
                    <Text style={styles.infoValue}>{viewingGame.version}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Genre:</Text>
                    <Text style={styles.infoValue}>{viewingGame.genre}</Text>
                  </View>
                </View>

                <View style={styles.viewSection}>
                  <Text style={styles.viewSectionTitle}>Supported Platforms</Text>
                  <View style={styles.platformsWrapView}>
                    {viewingGame.platform.map((p, idx) => {
                      const PlatformIcon = getPlatformIcon(p);
                      return (
                        <View key={idx} style={styles.platformItem}>
                          <PlatformIcon width={14} height={14} />
                          <Text style={styles.platformItemText}>{p}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1724' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  header: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderColor: '#2b2540' },
  title: { fontSize: 24, fontWeight: '800', color: '#fff', textAlign: 'center' },
  gradientText: { color: '#b794f4' },
  

  content: { paddingHorizontal: 16 },

  // Library Header
  libraryHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2540',
  },
  addButtonRow: {
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  libraryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    color: '#9b86c7',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#2a2540',
    marginHorizontal: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#7c3aed',
    borderRadius: 10,
    gap: 6,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  // Search Section
  searchSection: {
    marginBottom: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2540',
    marginBottom: 16,
  },
  searchInput: {
    marginLeft: 12,
    color: '#fff',
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  filterGroup: {
    flex: 1,
    minWidth: 100,
  },
  filterLabel: {
    color: '#c7b3e8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pickerContainer: {
    position: 'relative',
  },
  pickerWrap: {
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2540',
    overflow: 'hidden',
    opacity: 0,
    position: 'absolute',
    width: '100%',
    zIndex: 1,
  },
  picker: {
    color: '#fff',
    height: 44,
  },
  pickerValueDisplay: {
    backgroundColor: '#111827',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2540',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
    zIndex: 0,
  },
  pickerValueText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },

  // Games Section
  gamesSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: '#9b86c7',
    fontSize: 13,
  },

  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  gameCardWrapper: {
    width: '48%',
  },
  card: {
    backgroundColor: '#0b1220',
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    borderWidth: 1,
    borderColor: '#1f2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  cardImageWrap: {
    height: 160,
    position: 'relative',
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  cardTopBadges: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    zIndex: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusAvailable: {
    backgroundColor: '#22c55e',
  },
  statusBorrowed: {
    backgroundColor: '#eab308',
  },
  statusMaintenance: {
    backgroundColor: '#ef4444',
  },
  statusDefault: {
    backgroundColor: '#94a3b8',
  },

  ratingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  ratingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  platformsWrap: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 2,
  },
  platformIconWrap: {
    padding: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  platformMoreText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },

  cardContent: {
    padding: 12,
  },
  cardHeader: {
    marginBottom: 8,
  },
  cardTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 4,
    lineHeight: 20,
  },
  cardGenre: {
    color: '#9b86c7',
    fontSize: 11,
    fontWeight: '500',
  },

  cardQuickInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(17,24,39,0.5)',
    borderRadius: 8,
    gap: 8,
  },
  quickInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  quickInfoText: {
    color: '#d1d5db',
    fontSize: 11,
    fontWeight: '500',
  },
  quickInfoDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#374151',
  },

  availabilityRow: {
    marginBottom: 10,
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 6,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  availabilityText: {
    color: '#34d399',
    fontSize: 10,
    fontWeight: '600',
  },

  borrowButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#7c3aed',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  borrowButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },

  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#7c3aed',
    gap: 5,
  },
  viewButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#2a2540',
  },
  deleteButton: {
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderColor: 'rgba(248,113,113,0.3)',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#9b86c7',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },


  // modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  modalContent: { backgroundColor: '#0b1220', borderRadius: 12, padding: 12, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalBody: { paddingVertical: 4 },
  formRow: { marginBottom: 12 },
  label: { color: '#c7b3e8', marginBottom: 6 },
  input: { backgroundColor: '#111827', padding: 10, borderRadius: 8, color: '#fff' },
  textarea: { minHeight: 80, textAlignVertical: 'top' },

  pickerSingle: { backgroundColor: '#111827', borderRadius: 8, overflow: 'hidden' },

  platformsSelect: { flexDirection: 'row', flexWrap: 'wrap' },
  platformButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#2a2540', marginRight: 8, marginBottom: 8, backgroundColor: '#111827' },
  platformButtonSelected: { backgroundColor: '#6d28d9' },
  platformButtonText: { color: '#c7b3e8' },
  platformButtonTextSelected: { color: '#fff' },

  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  modalCancel: { padding: 10, marginRight: 8, borderRadius: 8, backgroundColor: '#111827' },
  modalCancelText: { color: '#c7b3e8' },
  modalSave: { padding: 10, borderRadius: 8, backgroundColor: '#6d28d9' },
  modalSaveDisabled: { opacity: 0.6 },
  modalSaveText: { color: '#fff' },
  
  // Image Upload Styles
  imageUploadButton: {
    marginTop: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2540',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
  },
  imageUploadPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#111827',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2a2540',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imageUploadText: {
    color: '#9b86c7',
    fontSize: 14,
    fontWeight: '500',
  },

  // view modal
  viewImage: { width: '100%', height: 180, borderRadius: 8, marginBottom: 12 },
  viewSection: { marginBottom: 12 },
  viewSectionTitle: { color: '#fff', fontWeight: '700', marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
  infoLabel: { color: '#9b86c7' },
  infoValue: { color: '#fff' },
  descriptionText: { color: '#d6c3f1', lineHeight: 18 },
  platformsWrapView: { flexDirection: 'row', flexWrap: 'wrap' },
  platformItem: { flexDirection: 'row', alignItems: 'center', marginRight: 10, padding: 6, backgroundColor: '#111827', borderRadius: 8 },
  platformItemText: { color: '#fff', marginLeft: 6 },
});

export default GameBorrowingPage;