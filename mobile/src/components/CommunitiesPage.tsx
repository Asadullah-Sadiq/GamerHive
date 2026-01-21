import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
  Platform,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import api, { getImageUrl } from "../utils/api";
import {
  Users,
  Calendar,
  Activity,
  Search,
  Trophy,
  Target,
  Zap,
  Plus,
  X,
  Camera,
  Image as ImageIcon,
  Save,
  Trash2,
  CheckSquare,
  Square,
  Edit,
} from "lucide-react-native";
import { Community } from "./JoinCommunityPage"; // ✅ import Community type

interface CommunitiesPageProps {
  onSelectCommunity: (community: Community) => void; // ✅ new prop
  selectedCommunityId?: string; // Optional: ID of community to highlight/scroll to
}

// Admin email - change this to your admin email
const ADMIN_EMAIL = "asadullahsadiq3@gmail.com"; // Change this to your admin email

const CommunitiesPage: React.FC<CommunitiesPageProps> = ({ onSelectCommunity, selectedCommunityId }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCommunities, setSelectedCommunities] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [joiningCommunityId, setJoiningCommunityId] = useState<string | null>(null);
  const [editingCommunityId, setEditingCommunityId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    game: "",
    description: "",
    categories: [] as string[],
    image: "",
    color: "#7c3aed",
    icon: "Target",
  });

  // Check if user is admin and get userId
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const userData = await AsyncStorage.getItem("user");
        if (userData) {
          const user = JSON.parse(userData);
          setUserId(user.id);
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

  const fetchCommunities = async (targetUserId?: string | null) => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      const finalUserId = targetUserId ?? userId;
      if (finalUserId) {
        params.userId = finalUserId;
      }
      const response = await api.get('/community', { params });
      
      if (response.data.success) {
        // Map backend data to frontend Community type
        const mappedCommunities = response.data.data.communities.map((comm: any) => {
          // Map icon string to component
          let IconComponent = Target;
          switch (comm.icon) {
            case 'Trophy':
              IconComponent = Trophy;
              break;
            case 'Zap':
              IconComponent = Zap;
              break;
            case 'Users':
              IconComponent = Users;
              break;
            default:
              IconComponent = Target;
          }

          return {
            id: comm.id,
            name: comm.name,
            game: comm.game,
            description: comm.description,
            categories: comm.categories || [comm.category || 'Other'],
            category: comm.category || comm.categories?.[0] || 'Other',
            members: comm.members || 0,
            activeMembers: comm.activeMembers || 0,
            createdDate: comm.createdDate || new Date().toISOString(),
            image: comm.image || null,
            color: comm.color || '#7c3aed',
            icon: IconComponent,
            level: 'Pro' as const, // Keep for backward compatibility
            isMember: comm.isMember || false,
          };
        });
        
        setCommunities(mappedCommunities);
      }
    } catch (error) {
      console.error("Error fetching communities:", error);
      // Keep default communities on error
    } finally {
      setLoading(false);
    }
  };

  // Fetch communities from backend
  useEffect(() => {
    fetchCommunities(userId);
  }, [userId]);


  const categories = [
    "All",
    "Battle Royale",
    "FPS",
    "Sports",
    "Fighting",
    "MOBA",
    "Sandbox",
  ];

  const filteredCommunities = communities.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.game.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || 
      c.category === selectedCategory ||
      (c.categories && Array.isArray(c.categories) && c.categories.includes(selectedCategory));
    return matchesSearch && matchesCategory;
  });

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const formatNumber = (num: number) =>
    num >= 1000 ? (num / 1000).toFixed(1) + "K" : num.toString();

  // Icon options mapping
  const iconOptions = [
    { name: "Target", component: Target },
    { name: "Trophy", component: Trophy },
    { name: "Zap", component: Zap },
    { name: "Users", component: Users },
  ];

  // Request permissions for image picker
  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
      Alert.alert(
        'Permission Required',
        'We need access to your camera and photo library to upload community images.',
      );
      return false;
    }
    return true;
  };

  // Handle image picker from camera
  const handleTakePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFormData(prev => ({ ...prev, image: result.assets[0].uri }));
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
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
        setFormData(prev => ({ ...prev, image: result.assets[0].uri }));
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  // Handle create community
  const handleCreateCommunity = async () => {
    if (!formData.name || !formData.game || !formData.description || !formData.image || formData.categories.length === 0) {
      Alert.alert("Error", "Please fill all required fields and select at least one category.");
      return;
    }

    if (!userId) {
      Alert.alert("Error", "User ID not found. Please login again.");
      return;
    }

    setIsCreating(true);

    try {
      const formDataToSend = new FormData();
      
      // Add image file if it's a local URI
      if (formData.image && !formData.image.startsWith('http')) {
        const filename = formData.image.split('/').pop() || 'community.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        formDataToSend.append('image', {
          uri: formData.image,
          name: filename,
          type: type,
        } as any);
      } else if (formData.image) {
        // If it's a URL, send it directly
        formDataToSend.append('image', formData.image);
      }

      formDataToSend.append('userId', userId);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('game', formData.game);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('categories', JSON.stringify(formData.categories));
      formDataToSend.append('color', formData.color);
      formDataToSend.append('icon', formData.icon);

      const response = await api.post('/community', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        Alert.alert("Success", "Community created successfully!");
        setShowAddModal(false);
        // Reset form
        setFormData({
          name: "",
          game: "",
          description: "",
          categories: [],
          image: "",
          color: "#7c3aed",
          icon: "Target",
        });
        // Refresh communities list
        fetchCommunities();
      } else {
        Alert.alert("Error", response.data.message || "Failed to create community.");
      }
    } catch (error: any) {
      console.error("Create community error:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to create community. Please try again.",
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddCommunity = () => {
    setEditingCommunityId(null);
    setFormData({
      name: "",
      game: "",
      description: "",
      categories: [],
      image: "",
      color: "#7c3aed",
      icon: "Target",
    });
    setShowAddModal(true);
  };

  const handleEditCommunity = (community: Community) => {
    // Map icon component back to string
    let iconString = "Target";
    if (community.icon === Trophy) iconString = "Trophy";
    else if (community.icon === Zap) iconString = "Zap";
    else if (community.icon === Users) iconString = "Users";
    
    setEditingCommunityId(community.id);
    setFormData({
      name: community.name,
      game: community.game,
      description: community.description,
      categories: community.categories || [community.category || 'Other'],
      image: community.image,
      color: community.color || "#7c3aed",
      icon: iconString,
    });
    setShowAddModal(true);
  };

  // Handle update community
  const handleUpdateCommunity = async () => {
    if (!formData.name || !formData.game || !formData.description || !formData.image || formData.categories.length === 0) {
      Alert.alert("Error", "Please fill all required fields and select at least one category.");
      return;
    }

    if (!userId || !editingCommunityId) {
      Alert.alert("Error", "User ID or Community ID not found. Please try again.");
      return;
    }

    setIsUpdating(true);

    try {
      const formDataToSend = new FormData();
      
      // Always send image - either as file or URL
      if (formData.image) {
        if (!formData.image.startsWith('http')) {
          // Local file - upload as file
          const filename = formData.image.split('/').pop() || 'community.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : `image/jpeg`;

          formDataToSend.append('image', {
            uri: formData.image,
            name: filename,
            type: type,
          } as any);
        } else {
          // URL - send as string
          formDataToSend.append('image', formData.image);
        }
      }

      // Always send all required fields
      formDataToSend.append('userId', userId);
      formDataToSend.append('name', formData.name);
      formDataToSend.append('game', formData.game);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('categories', JSON.stringify(formData.categories));
      formDataToSend.append('color', formData.color);
      formDataToSend.append('icon', formData.icon);

      console.log('Updating community:', {
        communityId: editingCommunityId,
        name: formData.name,
        game: formData.game,
        hasImage: !!formData.image,
        imageType: formData.image?.startsWith('http') ? 'URL' : 'File',
        imageValue: formData.image,
      });

      const response = await api.put(`/community/${editingCommunityId}`, formDataToSend, {
        headers: {
          // Don't set Content-Type for FormData - axios will set it automatically with boundary
        },
      });

      console.log('Update response:', response.data);

      if (response.data.success) {
        const updatedCommunity = response.data.data.community;
        
        console.log('Updated community image URL:', updatedCommunity.image);
        
        // Update the community in the local state immediately
        setCommunities(prevCommunities => {
          const updated = prevCommunities.map(comm => 
            comm.id === editingCommunityId 
              ? {
                  ...comm,
                  name: updatedCommunity.name,
                  game: updatedCommunity.game,
                  description: updatedCommunity.description,
                  categories: updatedCommunity.categories || [updatedCommunity.category || 'Other'],
                  category: updatedCommunity.category || updatedCommunity.categories?.[0] || 'Other',
                  image: updatedCommunity.image, // Update image immediately
                  color: updatedCommunity.color,
                  icon: comm.icon, // Keep icon component
                  members: updatedCommunity.members,
                  activeMembers: updatedCommunity.activeMembers,
                }
              : comm
          );
          console.log('Updated communities state, new image:', updated.find(c => c.id === editingCommunityId)?.image);
          return updated;
        });
        
        Alert.alert("Success", "Community updated successfully!");
        setShowAddModal(false);
        setEditingCommunityId(null);
        // Reset form
        setFormData({
          name: "",
          game: "",
          description: "",
          categories: [],
          image: "",
          color: "#7c3aed",
          icon: "Target",
        });
        // Refresh communities list to ensure everything is in sync
        fetchCommunities();
      } else {
        Alert.alert("Error", response.data.message || "Failed to update community.");
      }
    } catch (error: any) {
      console.error("Update community error:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to update community. Please try again.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleJoinCommunity = (community: Community) => {
    if (isAdmin) {
      return; // Admins cannot join communities
    }

    if (!userId) {
      Alert.alert('Login Required', 'Please login to join communities.');
      return;
    }

    Alert.alert(
      'Join Community',
      `Do you want to join "${community.name}" community?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Join',
          onPress: () => {
            joinCommunity(community);
          },
        },
      ],
    );
  };

  const joinCommunity = async (community: Community) => {
    if (!userId) return;
    setJoiningCommunityId(community.id);
    try {
      const response = await api.post('/community/join', {
        userId,
        communityId: community.id,
      });

      if (response.data.success) {
        Alert.alert('Joined', response.data.message || 'Community joined successfully!');
        setCommunities(prev =>
          prev.map(c =>
            c.id === community.id ? { ...c, isMember: true, members: (c.members || 0) + 1 } : c,
          ),
        );

        try {
          const storedUser = await AsyncStorage.getItem('user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            const joinedSet = new Set(parsedUser.joinedCommunities || []);
            joinedSet.add(community.id);
            parsedUser.joinedCommunities = Array.from(joinedSet);
            await AsyncStorage.setItem('user', JSON.stringify(parsedUser));
          }
        } catch (error) {
          console.error('Error updating AsyncStorage after joining community:', error);
        }
      } else {
        Alert.alert('Error', response.data.message || 'Failed to join community.');
      }
    } catch (error: any) {
      console.error('Join community error:', error);
      Alert.alert('Error', error.message || 'Failed to join community. Please try again.');
    } finally {
      setJoiningCommunityId(null);
    }
  };

  // Toggle community selection
  const toggleCommunitySelection = (communityId: string) => {
    setSelectedCommunities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(communityId)) {
        newSet.delete(communityId);
      } else {
        newSet.add(communityId);
      }
      return newSet;
    });
  };

  // Delete selected communities
  const handleDeleteSelected = async () => {
    if (selectedCommunities.size === 0) {
      Alert.alert("Error", "Please select communities to delete.");
      return;
    }

    Alert.alert(
      "Delete Communities",
      `Are you sure you want to delete ${selectedCommunities.size} communit${selectedCommunities.size > 1 ? 'ies' : 'y'}?`,
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
              const communityIds = Array.from(selectedCommunities);
              const response = await api.delete('/community', {
                data: {
                  userId,
                  communityIds,
                },
              });

              if (response.data.success) {
                Alert.alert("Success", response.data.message);
                setIsSelectionMode(false);
                setSelectedCommunities(new Set());
                fetchCommunities();
              } else {
                Alert.alert("Error", response.data.message || "Failed to delete communities.");
              }
            } catch (error: any) {
              console.error("Delete error:", error);
              Alert.alert(
                "Error",
                error.message || "Failed to delete communities. Please try again.",
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const renderHeader = () => (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>🎮 Gaming Communities</Text>
        {!isAdmin && (
          <Text style={styles.subtitle}>
            Join thousands of gamers in specialized communities. Find your tribe,
            compete, and level up together.
          </Text>
        )}
        {isAdmin && (
          <View style={styles.adminActions}>
            <TouchableOpacity
              style={styles.addCommunityButton}
              onPress={handleAddCommunity}
            >
              <Plus width={18} height={18} color="#fff" />
              <Text style={styles.addCommunityText}>Add Community</Text>
            </TouchableOpacity>
            {communities.length > 0 && !isSelectionMode && (
              <TouchableOpacity
                style={styles.addCommunityButton}
                onPress={() => {
                  setIsSelectionMode(true);
                  setSelectedCommunities(new Set());
                }}
              >
                <Trash2 width={18} height={18} color="#fff" />
                <Text style={styles.addCommunityText}>Delete Communities</Text>
              </TouchableOpacity>
            )}
            {isSelectionMode && selectedCommunities.size > 0 && (
              <TouchableOpacity
                style={[styles.addCommunityButton, styles.deleteButton]}
                onPress={handleDeleteSelected}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Trash2 width={18} height={18} color="#fff" />
                    <Text style={styles.addCommunityText}>
                      Delete ({selectedCommunities.size})
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {isSelectionMode && (
              <TouchableOpacity
                style={[styles.addCommunityButton, styles.cancelButton]}
                onPress={() => {
                  setIsSelectionMode(false);
                  setSelectedCommunities(new Set());
                }}
              >
                <X width={18} height={18} color="#fff" />
                <Text style={styles.addCommunityText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {isSelectionMode && (
        <View style={styles.selectionModeBanner}>
          <Text style={styles.selectionModeText}>
            Select communities to delete ({selectedCommunities.size} selected)
          </Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity
              style={styles.selectionActionBtn}
              onPress={() => {
                const allIds = new Set(filteredCommunities.map(c => c.id));
                setSelectedCommunities(allIds);
              }}
            >
              <Text style={styles.selectionActionText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.selectionActionBtn}
              onPress={() => setSelectedCommunities(new Set())}
            >
              <Text style={styles.selectionActionText}>Deselect All</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.filters}>
        <View style={styles.searchBox}>
          <Search color="#a855f7" size={20} style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Search communities or games..."
            placeholderTextColor="#aaa"
            style={styles.input}
            value={searchTerm}
            onChangeText={setSearchTerm}
            editable={!isSelectionMode}
          />
        </View>

        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedCategory === item && styles.filterActive,
              ]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedCategory === item && styles.filterTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredCommunities}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ justifyContent: "space-between" }}
        ListHeaderComponent={renderHeader}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              setRefreshing(true);
              await fetchCommunities(userId);
              setRefreshing(false);
            }} 
            tintColor="#7c3aed" 
          />
        }
        renderItem={({ item }) => {
          const IconComponent = item.icon;
          const isSelected = selectedCommunities.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => {
                if (isSelectionMode) {
                  toggleCommunitySelection(item.id);
                }
                // When not in selection mode, taps on the card do not navigate.
              }}
              onLongPress={() => {
                if (isAdmin && !isSelectionMode) {
                  setIsSelectionMode(true);
                  toggleCommunitySelection(item.id);
                }
              }}
              activeOpacity={0.8}
            >
              {isSelectionMode && (
                <View style={styles.selectionIndicator}>
                  {isSelected ? (
                    <CheckSquare width={24} height={24} color="#7C3AED" />
                  ) : (
                    <Square width={24} height={24} color="#9CA3AF" />
                  )}
                </View>
              )}
              {item.image ? (
                <Image 
                  key={`${item.id}-${item.image}`} // Force re-render when image URL changes
                  source={{ 
                    uri: getImageUrl(item.image) || item.image,
                  }} 
                  style={styles.image}
                  resizeMode="cover"
                  onError={(error) => {
                    console.error('Error loading community image for:', item.name);
                    console.error('Original URL:', item.image);
                    console.error('Converted URL:', getImageUrl(item.image) || item.image);
                    console.error('Error details:', error.nativeEvent.error);
                  }}
                />
              ) : (
                <View style={[styles.image, { backgroundColor: '#3b3b3b', justifyContent: 'center', alignItems: 'center' }]}>
                  <ImageIcon color="#a78bfa" size={40} />
                </View>
              )}

              <View style={styles.cardContent}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <IconComponent color="#fff" size={18} />
                  <Text style={styles.cardTitle}>{item.name}</Text>
                </View>
                <Text style={styles.cardGame}>{item.game}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {item.description}
                </Text>

                <View style={styles.stats}>
                  <View style={styles.statRow}>
                    <Users color="#a855f7" size={16} />
                    <Text style={styles.statText}>
                      {formatNumber(item.members)} Members
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <Activity color="#22c55e" size={16} />
                    <Text style={styles.statText}>
                      {formatNumber(item.activeMembers)} Active
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <Calendar color="#3b82f6" size={16} />
                    <Text style={styles.statText}>
                      {formatDate(item.createdDate)}
                    </Text>
                  </View>
                </View>

                {/* Edit button for admins */}
                {isAdmin && !isSelectionMode && (
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => handleEditCommunity(item)}
                  >
                    <Edit width={16} height={16} color="#fff" />
                    <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
                )}

                {/* Join/Enter button - hidden for admins */}
                {!isAdmin && (
                  <TouchableOpacity
                    style={[
                      styles.joinButton,
                      item.isMember && styles.enterButton,
                      (joiningCommunityId === item.id || isSelectionMode) && styles.joinButtonDisabled,
                    ]}
                    onPress={() => {
                      if (isSelectionMode) {
                        toggleCommunitySelection(item.id);
                        return;
                      }
                      if (item.isMember) {
                        onSelectCommunity(item);
                      } else {
                        handleJoinCommunity(item);
                      }
                    }}
                    disabled={isSelectionMode || joiningCommunityId === item.id}
                  >
                    {joiningCommunityId === item.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.joinText}>
                        {item.isMember ? 'Enter Community' : 'Join Community'}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 50 }}
      />

      {/* Add Community Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAddModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCommunityId ? 'Edit Community' : 'Create Community'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  setEditingCommunityId(null);
                  setFormData({
                    name: "",
                    game: "",
                    description: "",
                    categories: [],
                    image: "",
                    color: "#7c3aed",
                    icon: "Target",
                  });
                }}
                style={styles.modalCloseBtn}
              >
                <X width={24} height={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={true}>
              {/* Image Upload */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Community Image *</Text>
                {formData.image ? (
                  <View style={styles.imagePreviewContainer}>
                    <Image 
                      source={{ uri: getImageUrl(formData.image) || formData.image }} 
                      style={styles.imagePreview}
                      onError={(error) => {
                        console.error('Error loading preview image:', error);
                      }}
                    />
                    <TouchableOpacity
                      style={styles.changeImageBtn}
                      onPress={() => {
                        Alert.alert(
                          "Change Image",
                          "Choose an option",
                          [
                            { text: "Cancel", style: "cancel" },
                            { text: "Camera", onPress: handleTakePhoto },
                            { text: "Gallery", onPress: handlePickImage },
                          ]
                        );
                      }}
                    >
                      <Text style={styles.changeImageText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.imagePickerContainer}>
                    <TouchableOpacity
                      style={styles.imagePickerBtn}
                      onPress={() => {
                        Alert.alert(
                          "Select Image",
                          "Choose an option",
                          [
                            { text: "Cancel", style: "cancel" },
                            { text: "Camera", onPress: handleTakePhoto },
                            { text: "Gallery", onPress: handlePickImage },
                          ]
                        );
                      }}
                    >
                      <Camera width={24} height={24} color="#7C3AED" />
                      <Text style={styles.imagePickerText}>Select Image</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Name */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Community Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g., PUBG Warriors"
                  placeholderTextColor="#9CA3AF"
                  value={formData.name}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                />
              </View>

              {/* Game */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Game Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g., PUBG Mobile"
                  placeholderTextColor="#9CA3AF"
                  value={formData.game}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, game: text }))}
                />
              </View>

              {/* Description */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Description *</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Describe your community..."
                  placeholderTextColor="#9CA3AF"
                  value={formData.description}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Categories - Multiple Selection */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Categories * (Select multiple)</Text>
                <View style={styles.categoryContainer}>
                  {categories.filter(c => c !== "All").map((cat) => {
                    const isSelected = formData.categories.includes(cat);
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.categoryChip,
                          isSelected && styles.categoryChipActive,
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setFormData(prev => ({
                              ...prev,
                              categories: prev.categories.filter(c => c !== cat)
                            }));
                          } else {
                            setFormData(prev => ({
                              ...prev,
                              categories: [...prev.categories, cat]
                            }));
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            isSelected && styles.categoryChipTextActive,
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {formData.categories.length === 0 && (
                  <Text style={styles.errorText}>Please select at least one category</Text>
                )}
              </View>

              {/* Icon */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Icon</Text>
                <View style={styles.iconContainer}>
                  {iconOptions.map((icon) => {
                    const IconComponent = icon.component;
                    return (
                      <TouchableOpacity
                        key={icon.name}
                        style={[
                          styles.iconOption,
                          formData.icon === icon.name && styles.iconOptionActive,
                        ]}
                        onPress={() => setFormData(prev => ({ ...prev, icon: icon.name }))}
                      >
                        <IconComponent
                          color={formData.icon === icon.name ? "#7C3AED" : "#9CA3AF"}
                          size={24}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Color */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Color</Text>
                <View style={styles.colorContainer}>
                  {["#7c3aed", "#ff4d4d", "#8b5cf6", "#22c55e", "#3b82f6", "#f59e0b"].map((color) => (
                    <TouchableOpacity
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        formData.color === color && styles.colorOptionActive,
                      ]}
                      onPress={() => setFormData(prev => ({ ...prev, color }))}
                    />
                  ))}
                </View>
              </View>

              {/* Create/Update Button */}
              <TouchableOpacity
                style={[
                  styles.createButton, 
                  (isCreating || isUpdating) && styles.createButtonDisabled
                ]}
                onPress={editingCommunityId ? handleUpdateCommunity : handleCreateCommunity}
                disabled={isCreating || isUpdating}
              >
                {(isCreating || isUpdating) ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Save width={18} height={18} color="#fff" />
                    <Text style={styles.createButtonText}>
                      {editingCommunityId ? 'Update Community' : 'Create Community'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

export default CommunitiesPage;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", padding: 12 },
  header: { alignItems: "center", marginVertical: 20 },
  title: { fontSize: 26, fontWeight: "700", color: "#c084fc", marginBottom: 12 },
  subtitle: {
    color: "#c4b5fd",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    opacity: 0.8,
  },
  addCommunityButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7c3aed",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  addCommunityText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  adminActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  deleteButton: {
    backgroundColor: "#ef4444",
  },
  cancelButton: {
    backgroundColor: "#6b7280",
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: "#7C3AED",
  },
  selectionIndicator: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    padding: 4,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: 4,
  },
  selectionModeBanner: {
    backgroundColor: "rgba(124,58,237,0.2)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.3)",
  },
  selectionModeText: {
    color: "#C4B5FD",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  selectionActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
  },
  selectionActionBtn: {
    backgroundColor: "rgba(124,58,237,0.3)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  selectionActionText: {
    color: "#C4B5FD",
    fontSize: 12,
    fontWeight: "600",
  },
  filters: { marginBottom: 16 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e1b4b",
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  input: { flex: 1, color: "#fff" },
  filterButton: {
    backgroundColor: "#1e1b4b",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
  },
  filterText: { color: "#aaa", fontSize: 14 },
  filterActive: { backgroundColor: "#6d28d9" },
  filterTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#1e1b4b",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    flex: 0.48,
  },
  image: { height: 120, width: "100%" },
  cardContent: { padding: 10 },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 6,
  },
  cardGame: { color: "#a855f7", fontSize: 12, marginBottom: 4 },
  cardDesc: { color: "#ddd", fontSize: 12, marginBottom: 8 },
  stats: { marginBottom: 8 },
  statRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  statText: { color: "#aaa", fontSize: 12, marginLeft: 6 },
  joinButton: {
    backgroundColor: "#7c3aed",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  joinText: { color: "#fff", fontWeight: "600" },
  enterButton: {
    backgroundColor: "#22c55e",
  },
  joinButtonDisabled: {
    opacity: 0.7,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 8,
    gap: 6,
  },
  editButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.1)",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScrollView: {
    maxHeight: 600,
    padding: 20,
  },
  
  // Form Styles
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 12,
    padding: 12,
    color: "#fff",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.1)",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  
  // Image Picker Styles
  imagePickerContainer: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(124,58,237,0.3)",
    borderStyle: "dashed",
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePickerBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  imagePickerText: {
    color: "#7C3AED",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  imagePreviewContainer: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
  },
  imagePreview: {
    width: "100%",
    height: 200,
    borderRadius: 12,
  },
  changeImageBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  changeImageText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  
  // Category Styles
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    backgroundColor: "rgba(15,23,42,0.6)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },
  categoryChipActive: {
    backgroundColor: "#7c3aed",
    borderColor: "#7c3aed",
  },
  categoryChipText: {
    color: "#9CA3AF",
    fontSize: 13,
    fontWeight: "500",
  },
  categoryChipTextActive: {
    color: "#fff",
  },
  
  // Icon Styles
  iconContainer: {
    flexDirection: "row",
    gap: 12,
  },
  iconOption: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(148,163,184,0.2)",
  },
  iconOptionActive: {
    borderColor: "#7C3AED",
    backgroundColor: "rgba(124,58,237,0.1)",
  },
  
  // Color Styles
  colorContainer: {
    flexDirection: "row",
    gap: 12,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "transparent",
  },
  colorOptionActive: {
    borderColor: "#fff",
    transform: [{ scale: 1.2 }],
  },
  
  // Create Button
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7c3aed",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
    marginBottom: 30,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
