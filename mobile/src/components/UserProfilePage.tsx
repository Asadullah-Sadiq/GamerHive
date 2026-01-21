// UserProfilePage.tsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Switch,
  Pressable,
  Alert,
  Platform,
  Modal,
  ActivityIndicator,
  Linking,
  Keyboard,
  TouchableWithoutFeedback,
  RefreshControl,
  ViewStyle,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { VideoView, useVideoPlayer } from "expo-video";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { getImageUrl, submitRating, getRating } from "../utils/api";
import { playNotificationSound } from "../utils/sound";
import { notificationService } from "../utils/notificationService";
import { 
  getAvatarImageSource, 
  localAvatarSources, 
  localAvatarUris, 
  isLocalAvatarUrl, 
  getLocalAvatarIndex, 
  getLocalAvatarFileUri 
} from "../utils/avatarUtils";
import {
  User,
  Edit3,
  MapPin,
  Calendar,
  Trophy,
  Star,
  Users,
  MessageSquare,
  Gamepad2,
  Shield,
  Crown,
  Target,
  Zap,
  Settings,
  Lock,
  UserX,
  AlertCircle,
  Bell,
  Eye,
  EyeOff,
  Trash2,
  Camera,
  Save,
  X,
  Monitor,
  Smartphone,
  Headphones,
  Award,
  TrendingUp,
  Heart,
  UserPlus,
  BookOpen,
  Swords,
  Users2,
  ThumbsUp,
  Globe,
  Flag,
  Plus,
  MoreHorizontal,
  MoreVertical,
  Video,
  Image as ImageIcon,
  CheckCircle2,
  Share2,
  MessageCircle,
  Search,
  Send,
} from "lucide-react-native";
import { Picker } from "@react-native-picker/picker";
import { LinearGradient } from "expo-linear-gradient";
import { PageType } from "../../types";

// Video Player Component for Posts
const PostVideoPlayer: React.FC<{ videoUri: string }> = ({ videoUri }) => {
  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  // Use inline styles with proper TypeScript types
  const videoContainerStyle: ViewStyle = {
    width: '100%',
    height: 300,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  };

  const videoStyle: ViewStyle = {
    width: '100%',
    height: '100%',
  };

  return (
    <View style={videoContainerStyle}>
      <VideoView
        player={player}
        style={videoStyle}
        nativeControls
        contentFit="contain"
        allowsPictureInPicture={true}
      />
    </View>
  );
};

interface GlobalSettings {
  displayName: string;
  language: string;
  timezone: string;
  region: string;
  country: string;
  location: string;
  theme: string;
  fontSize: string;
  contentLayout: string;
}

interface UserProfilePageProps {
  globalSettings: GlobalSettings;
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void;
  targetUserId?: string; // Optional: If provided, view another user's profile
  goToPage?: (page: PageType, params?: any) => void; // Navigation function
}

const UserProfilePage: React.FC<UserProfilePageProps> = ({
  globalSettings,
  updateGlobalSettings,
  targetUserId,
  goToPage,
}) => {
  const [activeTab, setActiveTab] = useState<"posts" | "photos" | "reels" | "about">("posts");
  const [isEditing, setIsEditing] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showCoverPhotoModal, setShowCoverPhotoModal] = useState(false);
  const [showFriendsListModal, setShowFriendsListModal] = useState(false);
  const [friendsSearchTerm, setFriendsSearchTerm] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingCoverPhoto, setUploadingCoverPhoto] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [failedAvatars, setFailedAvatars] = useState<Set<number>>(new Set());
  const [showEnlargedProfilePicture, setShowEnlargedProfilePicture] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [friendRequestStatus, setFriendRequestStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'friends'>('none');
  const [isFriendRequestLoading, setIsFriendRequestLoading] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(targetUserId || null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [bio, setBio] = useState('');
  const [favoriteGames, setFavoriteGames] = useState<string[]>([]);
  const [skillLevels, setSkillLevels] = useState<{ [key: string]: string }>({});
  const [newGame, setNewGame] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDateOfBirth, setEditDateOfBirth] = useState('');
  const [editName, setEditName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [showMoreOptionsModal, setShowMoreOptionsModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [isAccountActive, setIsAccountActive] = useState(true);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showBlockedUsersModal, setShowBlockedUsersModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<Array<{
    _id: string;
    id: string;
    username: string;
    name: string;
    picture: string;
    isActive?: boolean;
  }>>([]);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const [isUserBlocked, setIsUserBlocked] = useState(false);
  const [checkingBlocked, setCheckingBlocked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportingUser, setReportingUser] = useState(false);
  
  // Post creation state
  const [postDescription, setPostDescription] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  
  // Comment state
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [replyInputs, setReplyInputs] = useState<{ [commentId: string]: string }>({});
  const [postingComment, setPostingComment] = useState<{ [key: string]: boolean }>({});
  const [likingPost, setLikingPost] = useState<{ [postId: string]: boolean }>({});
  
  // Edit post state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostDescription, setEditPostDescription] = useState('');
  const [isUpdatingPost, setIsUpdatingPost] = useState(false);

  // Rating state
  const [averageRating, setAverageRating] = useState<number>(0);
  const [totalRatings, setTotalRatings] = useState<number>(0);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [loadingRating, setLoadingRating] = useState(false);

  // Avatar options - Local avatars (from utils/avatar folder) + Online avatars
  // Local images from utils/avatar folder aur online URLs dono use ho sakte hain
  // Note: For local images, we store URI; for online, we store URL string
  const avatarOptions = [
    // Local avatars (from utils/avatar folder) - Added first
    ...localAvatarUris,
    // Online avatars
    "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=300",
    "https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=300",
    "https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=300",
    "https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=300",
    "https://images.pexels.com/photos/1043473/pexels-photo-1043473.jpeg?auto=compress&cs=tinysrgb&w=300",
    "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=300",
  ];

  const [profileData, setProfileData] = useState({
    username: globalSettings.displayName || "Choudhary Asad",
    fullName: "Choudhary Asad",
    bio: "Passionate gamer and esports enthusiast. Love competitive gaming and helping others improve their skills.",
   
    joinDate: "2022-03-15",
    avatar:"",
    coverPhoto: "",
    platforms: ["PC", "PlayStation", "Mobile"],
    skillLevel: "Pro",
    rank: "Diamond",
    favoriteGenres: ["FPS", "Battle Royale", "MOBA"],
    favoriteGames: [] as string[],
    skillLevels: {} as { [key: string]: string },
    email: "",
    dateOfBirth: "",
    createdAt: "",
    isActive: true,
    totalGames: 156,
    borrowedGames: 23,
    friendsCount: 0,
  });

  const tabs = [
    { id: "posts", label: "Posts" },
    { id: "about", label: "About" },
    // { id: "reels", label: "Reels" },
  ];
  const [friends, setFriends] = useState<Array<{
    id: string;
    name: string;
    username: string;
    avatar: string;
    status?: string;
    activeTime?: string;
    isActive?: boolean;
  }>>([]);

  const posts = [
    {
      id: 1,
      text: "marked himself safe during The Flooding in Punjab and Sindh, Pakistan.",
      date: "Aug 30",
      type: "safety_check",
      eventTitle: "The Flooding in Punjab and Sindh, Pakistan",
      markedSafe: ["Saad Mughal", "Saqlain Khalid Randhawa", "32 others"],
    },
  ];

  

  // Load user data function
  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        setUserId(user.id);
        
        // If targetUserId is provided, use it; otherwise use current user's ID
        const profileId = targetUserId || user.id;
        setProfileUserId(profileId);
        
        // Load profile data from backend
        await loadProfileData(profileId);
        
        // If viewing another user's profile, check friend request status
        if (targetUserId && targetUserId !== user.id) {
          await checkFriendRequestStatus(user.id, targetUserId);
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  };

  // Load profile data from backend
  const loadProfileData = async (profileId: string) => {
    try {
      const response = await api.get(`/user/profile/${profileId}`);
      if (response.data.success) {
        const user = response.data.data.user;
        setProfileData(prev => ({
          ...prev,
          username: user.username || user.name || prev.username,
          fullName: user.name || user.username || prev.fullName,
          avatar: user.picture || prev.avatar,
          coverPhoto: user.coverPhoto || prev.coverPhoto,
          friendsCount: user.friendsCount || 0,
          bio: user.bio || prev.bio,
          favoriteGames: user.favoriteGames || prev.favoriteGames || [],
          skillLevels: user.skillLevels || prev.skillLevels || {},
          email: user.email || prev.email,
          dateOfBirth: user.dateOfBirth || prev.dateOfBirth,
          createdAt: user.createdAt || prev.createdAt,
          isActive: user.isActive !== undefined ? user.isActive : true,
        }));
        
        // Set editable fields
        setBio(user.bio || '');
        setFavoriteGames(user.favoriteGames || []);
        setSkillLevels(user.skillLevels ? (typeof user.skillLevels === 'object' && !Array.isArray(user.skillLevels) ? user.skillLevels : {}) : {});
        
        // Set edit profile fields
        setEditUsername(user.username || '');
        setEditEmail(user.email || '');
        setEditName(user.name || '');
        if (user.dateOfBirth) {
          const dob = new Date(user.dateOfBirth);
          setEditDateOfBirth(dob.toISOString().split('T')[0]);
        } else {
          setEditDateOfBirth('');
        }
        
        // Load account status from AsyncStorage
        try {
          const userData = await AsyncStorage.getItem('user');
          if (userData) {
            const currentUser = JSON.parse(userData);
            if (currentUser.isActive !== undefined) {
              setIsAccountActive(currentUser.isActive);
            }
          }
        } catch (error) {
          console.error('Error loading account status:', error);
        }
        
        // Load friends list
        if (user.friends && user.friends.length > 0) {
          const friendsList = user.friends.map((friend: any) => ({
            id: friend._id || friend.id,
            name: friend.name || friend.username || 'Unknown',
            username: friend.username || friend.name || 'Unknown',
            avatar: friend.picture || "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50",
            status: friend.isActive ? "online" : "offline",
            isActive: friend.isActive !== undefined ? friend.isActive : false,
          }));
          setFriends(friendsList);
        } else {
          setFriends([]);
        }
        
        // Load user posts
        await loadUserPosts(profileId);
        
        // Load rating data
        await loadRatingData(profileId);
      }
    } catch (error) {
      console.error("Error loading profile data:", error);
    }
  };

  // Load rating data
  const loadRatingData = async (profileId: string) => {
    if (!profileId) return;
    setLoadingRating(true);
    try {
      const raterUserId = userId && userId !== profileId ? userId : undefined;
      const response = await getRating(profileId, raterUserId);
      if (response.success && response.data) {
        setAverageRating(response.data.averageRating || 0);
        setTotalRatings(response.data.totalRatings || 0);
        setUserRating(response.data.userRating?.rating || null);
      }
    } catch (error) {
      console.error("Error loading rating:", error);
    } finally {
      setLoadingRating(false);
    }
  };

  // Handle rating click
  const handleRatingClick = async (rating: number) => {
    if (!userId || !profileUserId || userId === profileUserId) return;
    if (submittingRating) return;

    setSubmittingRating(true);
    try {
      const response = await submitRating(profileUserId, userId, rating);
      if (response.success && response.data) {
        setAverageRating(response.data.averageRating || 0);
        setTotalRatings(response.data.totalRatings || 0);
        setUserRating(rating);
        Alert.alert("Success", "Rating submitted successfully!");
      } else {
        Alert.alert("Error", response.message || "Failed to submit rating");
      }
    } catch (error: any) {
      console.error("Error submitting rating:", error);
      Alert.alert("Error", error.message || "Failed to submit rating. Please try again.");
    } finally {
      setSubmittingRating(false);
    }
  };

  // Load user posts
  const loadUserPosts = async (profileId: string) => {
    try {
      setLoadingPosts(true);
      const response = await api.get(`/post/user/${profileId}`);
      if (response.data.success) {
        setUserPosts(response.data.data.posts || []);
      }
    } catch (error) {
      console.error("Error loading posts:", error);
      setUserPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  // Pick image for post
  const pickImageForPost = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permissions to select images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedMedia(result.assets[0].uri);
        setMediaType('image');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Pick video for post
  const pickVideoForPost = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need camera roll permissions to select videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedMedia(result.assets[0].uri);
        setMediaType('video');
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
    }
  };

  // Edit post
  const handleEditPost = (post: any) => {
    setEditingPostId(post.id);
    setEditPostDescription(post.description || '');
  };

  // Update post
  const handleUpdatePost = async (postId: string) => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found.');
      return;
    }

    if (!editPostDescription.trim()) {
      Alert.alert('Error', 'Post description cannot be empty.');
      return;
    }

    setIsUpdatingPost(true);

    try {
      const response = await api.put(`/post/${postId}`, {
        userId,
        description: editPostDescription.trim(),
      });

      if (response.data.success) {
        Alert.alert('Success', 'Post updated successfully!');
        
        // Update local state
        setUserPosts(prevPosts =>
          prevPosts.map(post =>
            post.id === postId
              ? {
                  ...post,
                  description: editPostDescription.trim(),
                }
              : post
          )
        );
        
        // Close edit mode
        setEditingPostId(null);
        setEditPostDescription('');
        
        // Reload posts to get fully updated data
        if (profileUserId) {
          await loadUserPosts(profileUserId);
        }
      } else {
        Alert.alert('Error', response.data.message || 'Failed to update post.');
      }
    } catch (error: any) {
      console.error('Update post error:', error);
      Alert.alert(
        'Error',
        error.message || error.response?.data?.message || 'Failed to update post. Please try again.'
      );
    } finally {
      setIsUpdatingPost(false);
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingPostId(null);
    setEditPostDescription('');
  };

  // Delete post
  const handleDeletePost = async (postId: string) => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found.');
      return;
    }

    try {
      const response = await api.delete(`/post/${postId}`, {
        data: { userId },
      });

      if (response.data.success) {
        Alert.alert('Success', 'Post deleted successfully!');
        
        // Reload posts
        if (profileUserId) {
          await loadUserPosts(profileUserId);
        }
      } else {
        Alert.alert('Error', response.data.message || 'Failed to delete post.');
      }
    } catch (error: any) {
      console.error('Delete post error:', error);
      Alert.alert(
        'Error',
        error.message || error.response?.data?.message || 'Failed to delete post. Please try again.'
      );
    }
  };

  // Handle like/unlike post
  const handleToggleLike = async (postId: string) => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found.');
      return;
    }

    setLikingPost(prev => ({ ...prev, [postId]: true }));

    try {
      const response = await api.post(`/post/${postId}/like`, { userId });

      if (response.data.success) {
        // Update post in local state
        setUserPosts(prevPosts =>
          prevPosts.map(post =>
            post.id === postId
              ? {
                  ...post,
                  likesCount: response.data.data.likesCount,
                  likes: response.data.data.likes || post.likes,
                }
              : post
          )
        );
      } else {
        Alert.alert('Error', response.data.message || 'Failed to like post.');
      }
    } catch (error: any) {
      console.error('Toggle like error:', error);
      Alert.alert(
        'Error',
        error.message || error.response?.data?.message || 'Failed to like post. Please try again.'
      );
    } finally {
      setLikingPost(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Handle add comment
  const handleAddComment = async (postId: string, parentCommentId?: string) => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found.');
      return;
    }

    const inputKey = parentCommentId ? `${postId}-${parentCommentId}` : postId;
    const commentText = parentCommentId 
      ? (replyInputs[parentCommentId] || '').trim()
      : (commentInputs[postId] || '').trim();

    if (!commentText) {
      Alert.alert('Error', 'Please enter a comment.');
      return;
    }

    setPostingComment(prev => ({ ...prev, [inputKey]: true }));

    try {
      const response = await api.post(`/post/${postId}/comment`, {
        userId,
        text: commentText,
        parentCommentId: parentCommentId || undefined,
      });

      if (response.data.success) {
        // Clear input text but keep input field open for replies
        if (parentCommentId) {
          // For replies, just clear the text but keep the input field visible
          setReplyInputs(prev => ({
            ...prev,
            [parentCommentId]: '', // Clear text but keep input open
          }));
          
          // Immediately update the post with the new reply
          if (response.data.data.reply) {
            setUserPosts(prevPosts =>
              prevPosts.map(post =>
                post.id === postId
                  ? {
                      ...post,
                      comments: post.comments.map((comment: any) =>
                        comment.id === parentCommentId
                          ? {
                              ...comment,
                              replies: [...(comment.replies || []), response.data.data.reply],
                              repliesCount: response.data.data.repliesCount,
                            }
                          : comment
                      ),
                    }
                  : post
              )
            );
          }
        } else {
          // For top-level comments, clear the input completely
          setCommentInputs(prev => {
            const newInputs = { ...prev };
            delete newInputs[postId];
            return newInputs;
          });
          
          // Immediately update the post with the new comment
          if (response.data.data.comment) {
            setUserPosts(prevPosts =>
              prevPosts.map(post =>
                post.id === postId
                  ? {
                      ...post,
                      comments: [...(post.comments || []), response.data.data.comment],
                      commentsCount: response.data.data.commentsCount,
                    }
                  : post
              )
            );
          }
        }

        // Reload posts to get fully updated data (in case of any other changes)
        if (profileUserId) {
          await loadUserPosts(profileUserId);
        }
      } else {
        Alert.alert('Error', response.data.message || 'Failed to add comment.');
      }
    } catch (error: any) {
      console.error('Add comment error:', error);
      Alert.alert(
        'Error',
        error.message || error.response?.data?.message || 'Failed to add comment. Please try again.'
      );
    } finally {
      setPostingComment(prev => {
        const newState = { ...prev };
        delete newState[inputKey];
        return newState;
      });
    }
  };

  // Handle delete comment
  const handleDeleteComment = async (postId: string, commentId: string, isReply: boolean, parentCommentId?: string) => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found.');
      return;
    }

    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.delete(`/post/${postId}/comment/${commentId}`, {
                data: {
                  userId,
                  isReply,
                  parentCommentId,
                },
              });

              if (response.data.success) {
                // Reload posts
                if (profileUserId) {
                  await loadUserPosts(profileUserId);
                }
              } else {
                Alert.alert('Error', response.data.message || 'Failed to delete comment.');
              }
            } catch (error: any) {
              console.error('Delete comment error:', error);
              Alert.alert(
                'Error',
                error.message || error.response?.data?.message || 'Failed to delete comment. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  // Toggle comments visibility
  const toggleComments = (postId: string) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  // Create post
  const handleCreatePost = async () => {
    if (!postDescription.trim() && !selectedMedia) {
      Alert.alert('Error', 'Please add a description or select a photo/video.');
      return;
    }

    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please login again.');
      return;
    }

    setIsCreatingPost(true);

    try {
      const formData = new FormData();
      
      formData.append('userId', userId);
      formData.append('description', postDescription.trim());
      
      // Add media file if selected
      if (selectedMedia) {
        const filename = selectedMedia.split('/').pop() || `post-${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`;
        const match = /\.(\w+)$/.exec(filename);
        const type = mediaType === 'video' 
          ? (match ? `video/${match[1]}` : 'video/mp4')
          : (match ? `image/${match[1]}` : 'image/jpeg');

        formData.append('media', {
          uri: selectedMedia,
          name: filename,
          type: type,
        } as any);
      }

      const response = await api.post('/post', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        Alert.alert('Success', 'Post created successfully!');
        
        // Reset form
        setPostDescription('');
        setSelectedMedia(null);
        setMediaType(null);
        
        // Reload posts
        if (profileUserId) {
          await loadUserPosts(profileUserId);
        }
      } else {
        Alert.alert('Error', response.data.message || 'Failed to create post.');
      }
    } catch (error: any) {
      console.error('Create post error:', error);
      Alert.alert(
        'Error',
        error.message || error.response?.data?.message || 'Failed to create post. Please try again.'
      );
    } finally {
      setIsCreatingPost(false);
    }
  };

  // Check friendship status
  const checkFriendshipStatus = async (currentUserId: string, targetUserId: string) => {
    try {
      const response = await api.get(`/user/friendship/check?userId=${currentUserId}&targetUserId=${targetUserId}`);
      if (response.data.success) {
        setIsFollowing(response.data.data.isFriend);
      }
    } catch (error) {
      console.error("Error checking friendship status:", error);
    }
  };

  // Check friend request status
  const checkFriendRequestStatus = async (currentUserId: string, targetUserId: string) => {
    try {
      const response = await api.get(`/user/friend-request/status?userId=${currentUserId}&targetUserId=${targetUserId}`);
      if (response.data.success) {
        const status = response.data.data.status;
        setFriendRequestStatus(status);
        setIsFollowing(status === 'friends');
      }
    } catch (error) {
      console.error("Error checking friend request status:", error);
    }
  };

  // Handle save profile (from Edit Profile modal)
  const handleSaveEditProfile = async () => {
    if (!userId) return;

    // Validation
    if (!editEmail.trim()) {
      Alert.alert('Error', 'Email is required');
      return;
    }
    
    if (!/^\S+@\S+\.\S+$/.test(editEmail.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (editUsername.trim() && (editUsername.trim().length < 3 || editUsername.trim().length > 30)) {
      Alert.alert('Error', 'Username must be between 3 and 30 characters');
      return;
    }

    try {
      setSavingProfile(true);
      const response = await api.put('/user/profile/update', {
        userId: userId,
        username: editUsername.trim(),
        email: editEmail.trim(),
        dateOfBirth: editDateOfBirth || null,
        name: editName.trim(),
      });

      if (response.data.success) {
        const updatedUser = response.data.data.user;
        
        // Update local state
        setProfileData(prev => ({
          ...prev,
          username: updatedUser.username || prev.username,
          fullName: updatedUser.name || prev.fullName,
          email: updatedUser.email || prev.email,
          dateOfBirth: updatedUser.dateOfBirth || prev.dateOfBirth,
        }));
        
        // Update AsyncStorage with all updated fields - IMPORTANT for login with new email
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          // Update all fields that were changed
          if (updatedUser.username) user.username = updatedUser.username;
          if (updatedUser.name) user.name = updatedUser.name;
          if (updatedUser.email) user.email = updatedUser.email; // This is critical for login
          if (updatedUser.dateOfBirth !== undefined) user.dateOfBirth = updatedUser.dateOfBirth;
          await AsyncStorage.setItem('user', JSON.stringify(user));
        }
        
        setShowEditProfileModal(false);
        Alert.alert(
          'Success', 
          'Profile updated successfully! You can now login with your new email.',
          [{ text: 'OK' }]
        );
        
        // Reload profile data to reflect changes
        if (profileUserId) {
          await loadProfileData(profileUserId);
        }
      } else {
        Alert.alert('Error', response.data.message || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Save profile error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save profile';
      Alert.alert('Error', errorMessage);
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle change password
  const handleChangePassword = async () => {
    if (!userId) return;

    // Validation
    if (!oldPassword.trim()) {
      Alert.alert('Error', 'Current password is required');
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert('Error', 'New password is required');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New password and confirm password do not match');
      return;
    }

    if (oldPassword === newPassword) {
      Alert.alert('Error', 'New password must be different from current password');
      return;
    }

    try {
      setChangingPassword(true);
      const response = await api.put('/user/change-password', {
        userId: userId,
        oldPassword: oldPassword,
        newPassword: newPassword,
      });

      if (response.data.success) {
        Alert.alert('Success', 'Password changed successfully!', [
          {
            text: 'OK',
            onPress: () => {
              setShowChangePasswordModal(false);
              setOldPassword('');
              setNewPassword('');
              setConfirmPassword('');
            },
          },
        ]);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to change password');
      }
    } catch (error: any) {
      console.error('Change password error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to change password';
      Alert.alert('Error', errorMessage);
    } finally {
      setChangingPassword(false);
    }
  };

  // Handle delete account
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone. All your data will be permanently deleted.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            setShowDeleteAccountModal(true);
          },
        },
      ]
    );
  };

  // Handle confirm delete account
  const handleConfirmDeleteAccount = async () => {
    if (!userId) {
      Alert.alert("Error", "User ID not found");
      return;
    }

    if (!deleteAccountPassword.trim()) {
      Alert.alert("Error", "Password is required to delete account");
      return;
    }

    try {
      setDeletingAccount(true);
      const response = await api.delete('/user/account', {
        data: {
          userId: userId,
          password: deleteAccountPassword,
        },
      });

      if (response.data.success) {
        // Clear AsyncStorage
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        
        Alert.alert(
          "Account Deleted",
          "Your account has been deleted successfully. You will be redirected to login page.",
          [
            {
              text: "OK",
              onPress: async () => {
                setShowDeleteAccountModal(false);
                // Stop notification polling
                try {
                  notificationService.stopPolling();
                } catch (error) {
                  console.error('Error stopping notifications:', error);
                }
                // App.tsx will automatically show login page when token is removed
              },
            },
          ]
        );
      } else {
        Alert.alert("Error", response.data.message || "Failed to delete account");
        setDeletingAccount(false);
      }
    } catch (error: any) {
      console.error('Delete account error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to delete account';
      Alert.alert("Error", errorMessage);
      setDeletingAccount(false);
    }
  };

  // Load blocked users
  const loadBlockedUsers = async () => {
    if (!userId) return;

    try {
      setLoadingBlockedUsers(true);
      const response = await api.get(`/user/blocked?userId=${userId}`);
      
      if (response.data.success) {
        const blockedList = response.data.data.blockedUsers.map((user: any) => ({
          _id: user._id || user.id,
          id: user._id || user.id,
          username: user.username || 'Unknown',
          name: user.name || user.username || 'Unknown',
          picture: user.picture || "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50",
          isActive: user.isActive !== undefined ? user.isActive : false,
        }));
        setBlockedUsers(blockedList);
      }
    } catch (error: any) {
      console.error('Load blocked users error:', error);
      Alert.alert('Error', 'Failed to load blocked users');
    } finally {
      setLoadingBlockedUsers(false);
    }
  };

  // Handle unblock user
  const handleUnblockUser = async (targetUserId: string) => {
    if (!userId) return;

    Alert.alert(
      "Unblock User",
      "Are you sure you want to unblock this user?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Unblock",
          style: "default",
          onPress: async () => {
            try {
              setUnblockingUserId(targetUserId);
              const response = await api.post('/user/unblock', {
                userId: userId,
                targetUserId: targetUserId,
              });

              if (response.data.success) {
                // Remove from blocked users list
                setBlockedUsers(prev => prev.filter(user => user.id !== targetUserId));
                Alert.alert("Success", "User unblocked successfully");
              } else {
                Alert.alert("Error", response.data.message || "Failed to unblock user");
              }
            } catch (error: any) {
              console.error('Unblock user error:', error);
              const errorMessage = error.response?.data?.message || error.message || 'Failed to unblock user';
              Alert.alert("Error", errorMessage);
            } finally {
              setUnblockingUserId(null);
            }
          },
        },
      ]
    );
  };

  // Check if user is blocked
  const checkIfUserBlocked = async () => {
    if (!userId || !profileUserId || userId === profileUserId) {
      return;
    }

    try {
      setCheckingBlocked(true);
      const response = await api.get(`/user/check-blocked?userId=${userId}&targetUserId=${profileUserId}`);
      
      if (response.data.success) {
        setIsUserBlocked(response.data.data.isBlocked);
      }
    } catch (error: any) {
      console.error('Check if blocked error:', error);
    } finally {
      setCheckingBlocked(false);
    }
  };

  // Handle block user
  const handleBlockUser = async () => {
    if (!userId || !profileUserId || userId === profileUserId) {
      return;
    }

    Alert.alert(
      "Block User",
      `Are you sure you want to block ${profileData.username || profileData.fullName}? You won't be able to see their posts or send them messages.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await api.post('/user/block', {
                userId: userId,
                targetUserId: profileUserId,
              });

              if (response.data.success) {
                setIsUserBlocked(true);
                setFriendRequestStatus('none');
                setIsFollowing(false);
                Alert.alert("Success", "User blocked successfully");
                // Reload profile data
                await loadProfileData(profileUserId);
              } else {
                Alert.alert("Error", response.data.message || "Failed to block user");
              }
            } catch (error: any) {
              console.error('Block user error:', error);
              const errorMessage = error.response?.data?.message || error.message || 'Failed to block user';
              Alert.alert("Error", errorMessage);
            }
          },
        },
      ]
    );
  };

  // Handle unblock user (from profile)
  const handleUnblockUserFromProfile = async () => {
    if (!userId || !profileUserId || userId === profileUserId) {
      return;
    }

    Alert.alert(
      "Unblock User",
      `Are you sure you want to unblock ${profileData.username || profileData.fullName}?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Unblock",
          style: "default",
          onPress: async () => {
            try {
              const response = await api.post('/user/unblock', {
                userId: userId,
                targetUserId: profileUserId,
              });

              if (response.data.success) {
                setIsUserBlocked(false);
                Alert.alert("Success", "User unblocked successfully");
                // Reload profile data
                await loadProfileData(profileUserId);
              } else {
                Alert.alert("Error", response.data.message || "Failed to unblock user");
              }
            } catch (error: any) {
              console.error('Unblock user error:', error);
              const errorMessage = error.response?.data?.message || error.message || 'Failed to unblock user';
              Alert.alert("Error", errorMessage);
            }
          },
        },
      ]
    );
  };

  // Handle report user
  const handleReportUser = async () => {
    if (!userId || !profileUserId || userId === profileUserId) {
      return;
    }

    if (!reportReason.trim()) {
      Alert.alert("Error", "Please select a reason for reporting");
      return;
    }

    try {
      setReportingUser(true);
      const response = await api.post('/user/report', {
        userId: userId,
        targetUserId: profileUserId,
        reason: reportReason,
        description: reportDescription,
      });

      if (response.data.success) {
        Alert.alert("Success", response.data.message || "User reported successfully. Our team will review this report.");
        setShowReportModal(false);
        setReportReason('');
        setReportDescription('');
      } else {
        Alert.alert("Error", response.data.message || "Failed to report user");
      }
    } catch (error: any) {
      console.error('Report user error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to report user';
      Alert.alert("Error", errorMessage);
    } finally {
      setReportingUser(false);
    }
  };

  // Handle save details
  const handleSaveDetails = async () => {
    if (!userId) return;

    try {
      setSavingDetails(true);
      const response = await api.put('/user/profile/details', {
        userId: userId,
        bio: bio,
        favoriteGames: favoriteGames,
        skillLevels: skillLevels,
      });

      if (response.data.success) {
        setProfileData(prev => ({
          ...prev,
          bio: bio,
          favoriteGames: favoriteGames,
          skillLevels: skillLevels,
        }));
        setIsEditingDetails(false);
        Alert.alert('Success', 'Details updated successfully!');
      } else {
        Alert.alert('Error', response.data.message || 'Failed to update details');
      }
    } catch (error: any) {
      console.error('Save details error:', error);
      Alert.alert('Error', error.message || 'Failed to save details');
    } finally {
      setSavingDetails(false);
    }
  };

  // Handle friend request / unfriend
  const handleFriendRequest = async () => {
    if (!userId || !profileUserId || userId === profileUserId) {
      return;
    }

    setIsFriendRequestLoading(true);
    try {
      if (friendRequestStatus === 'friends') {
        // Unfriend user
        Alert.alert(
          "Unfriend",
          `Are you sure you want to unfriend ${profileData.username}?`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setIsFriendRequestLoading(false),
            },
            {
              text: "Unfriend",
              style: "destructive",
              onPress: async () => {
                try {
                  const response = await api.post('/user/unfriend', {
                    userId: userId,
                    targetUserId: profileUserId,
                  });
                  
                  if (response.data.success) {
                    setFriendRequestStatus('none');
                    setIsFollowing(false);
                    await loadProfileData(profileUserId);
                    Alert.alert("Success", "User unfriended successfully");
                  } else {
                    Alert.alert("Error", response.data.message || "Failed to unfriend user");
                  }
                } catch (error: any) {
                  console.error("Unfriend error:", error);
                  Alert.alert("Error", error.message || "Failed to unfriend user. Please try again.");
                } finally {
                  setIsFriendRequestLoading(false);
                }
              },
            },
          ]
        );
        return;
      }

      if (friendRequestStatus === 'pending_sent') {
        // Cancel friend request
        const response = await api.post('/user/friend-request/reject', {
          userId: userId,
          targetUserId: profileUserId,
        });
        
        if (response.data.success) {
          setFriendRequestStatus('none');
          Alert.alert("Success", "Friend request canceled");
        } else {
          Alert.alert("Error", response.data.message || "Failed to cancel friend request");
        }
      } else if (friendRequestStatus === 'pending_received') {
        // Accept friend request
        const response = await api.post('/user/friend-request/accept', {
          userId: userId,
          targetUserId: profileUserId,
        });
        
        if (response.data.success) {
          setFriendRequestStatus('friends');
          setIsFollowing(true);
          await loadProfileData(profileUserId);
          // Play notification sound
          await playNotificationSound();
          Alert.alert("Success", "Friend request accepted! Aap ki friend request accept ho gayi hai.");
        } else {
          Alert.alert("Error", response.data.message || "Failed to accept friend request");
        }
      } else {
        // Send friend request
        const response = await api.post('/user/friend-request/send', {
          userId: userId,
          targetUserId: profileUserId,
        });
        
        if (response.data.success) {
          setFriendRequestStatus('pending_sent');
          Alert.alert("Success", "Friend request sent!");
          await loadProfileData(profileUserId);
        } else {
          Alert.alert("Error", response.data.message || "Failed to send friend request");
        }
      }
    } catch (error: any) {
      console.error("Friend request error:", error);
      Alert.alert("Error", error.message || "Failed to process friend request. Please try again.");
    } finally {
      setIsFriendRequestLoading(false);
    }
  };

  // Check if viewing own profile
  const isOwnProfile = userId && profileUserId && userId === profileUserId;
  
  // Check if viewing a friend's profile
  const isViewingFriend = friendRequestStatus === 'friends' && !isOwnProfile;
  
  // Check if should show posts (own profile or friends)
  const shouldShowPosts = isOwnProfile || friendRequestStatus === 'friends';

  // Filter friends based on search term
  const filteredFriends = friends.filter(friend => {
    const searchLower = friendsSearchTerm.toLowerCase();
    return (
      friend.name?.toLowerCase().includes(searchLower) ||
      friend.username?.toLowerCase().includes(searchLower)
    );
  });

  // Handle friend card click
  const handleFriendClick = (friendId: string) => {
    if (goToPage) {
      goToPage('profile', { targetUserId: friendId });
    }
  };

  // Load user data on mount
  useEffect(() => {
    loadUserData();
  }, []);

  // Reload user data when globalSettings change (after login)
  useEffect(() => {
    loadUserData();
    
    setProfileData(prev => ({
      ...prev,
      username: globalSettings.displayName || prev.username,
      
    }));
  }, [globalSettings]);

  // Load blocked users count when more options modal opens
  useEffect(() => {
    if (showMoreOptionsModal && isOwnProfile && userId) {
      loadBlockedUsers();
    }
  }, [showMoreOptionsModal, isOwnProfile, userId]);

  // Check if user is blocked when viewing another user's profile
  useEffect(() => {
    if (!isOwnProfile && userId && profileUserId) {
      checkIfUserBlocked();
    }
  }, [isOwnProfile, userId, profileUserId]);

  // Reload profile data when targetUserId changes
  useEffect(() => {
    if (targetUserId) {
      setProfileUserId(targetUserId);
      loadProfileData(targetUserId);
      // Check friend request status if we have current user ID
      if (userId && userId !== targetUserId) {
        checkFriendRequestStatus(userId, targetUserId);
      }
    }
  }, [targetUserId]);

  const handleProfileChange = (key: string, value: any) => {
    const newProfileData = { ...profileData, [key]: value };

    

    setProfileData(newProfileData);
  };

  const handleSaveProfile = () => {
    updateGlobalSettings({
      displayName: profileData.username,
      
    });
    setIsEditing(false);
    Alert.alert("Profile saved", "Global settings updated.");
  };

  // Request camera and media library permissions
  const requestPermissions = async (needsCamera: boolean = false) => {
    if (needsCamera) {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraStatus !== 'granted') {
        Alert.alert(
          'Camera Permission Required',
          'We need access to your camera to take photos. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              }
            }}
          ]
        );
        return false;
      }
    }

    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (mediaStatus !== 'granted') {
      Alert.alert(
        'Photo Library Permission Required',
        'We need access to your photo library to select photos. Please enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            }
          }}
        ]
      );
      return false;
    }
    return true;
  };

  // Handle image picker from camera
  const handleTakePhoto = async () => {
    setShowImagePickerModal(false);
    
    if (!userId) {
      Alert.alert("Error", "User ID not found. Please login again.");
      return;
    }

    // Small delay for iOS to close modal properly
    if (Platform.OS === 'ios') {
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const hasPermission = await requestPermissions(true);
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  // Handle image picker from gallery
  const handlePickImage = async () => {
    setShowImagePickerModal(false);
    
    if (!userId) {
      Alert.alert("Error", "User ID not found. Please login again.");
      return;
    }

    // Small delay for iOS to close modal properly
    if (Platform.OS === 'ios') {
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const hasPermission = await requestPermissions(false);
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadProfilePicture(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  // Upload profile picture
  const uploadProfilePicture = async (imageUri: string) => {
    if (!userId) {
      Alert.alert("Error", "User ID not found. Please login again.");
      return;
    }

    setUploadingImage(true);

    try {
      const formData = new FormData();
      
      // Get filename from URI
      const filename = imageUri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      formData.append('picture', {
        uri: imageUri,
        name: filename,
        type: type,
      } as any);
      
      formData.append('userId', userId);

      const response = await api.post('/user/profile/picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const pictureUrl = response.data.data.picture;
        
        // Update local state
        setProfileData(prev => ({
          ...prev,
          avatar: pictureUrl,
        }));

        // Update AsyncStorage
        try {
          const userData = await AsyncStorage.getItem("user");
          if (userData) {
            const user = JSON.parse(userData);
            user.picture = pictureUrl;
            await AsyncStorage.setItem("user", JSON.stringify(user));
          }
        } catch (error) {
          console.error("Error updating AsyncStorage:", error);
        }

        // Reload profile data from server to ensure we have the latest URL
        if (userId) {
          await loadProfileData(userId);
        }

        Alert.alert("Success", "Profile picture uploaded successfully!");
      } else {
        Alert.alert("Error", response.data.message || "Failed to upload profile picture.");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert(
        "Upload Failed",
        error.message || "Failed to upload profile picture. Please try again.",
      );
    } finally {
      setUploadingImage(false);
    }
  };

  // Select avatar
  const handleSelectAvatar = async (avatarUrl: string, avatarIndex: number) => {
    if (!userId) {
      Alert.alert("Error", "User ID not found. Please login again.");
      return;
    }

    setShowAvatarModal(false);
    setUploadingImage(true);

    try {
      // Check if this is a local avatar that needs to be uploaded
      const isLocal = isLocalAvatarUrl(avatarUrl) || avatarIndex < localAvatarSources.length;
      
      if (isLocal) {
        // For local avatars, upload the file to server
        console.log("[Avatar Upload] Starting local avatar upload, index:", avatarIndex);
        
        // Get the actual file URI for the local avatar
        console.log("[Avatar Upload] Getting local file URI...");
        const localFileUri = await getLocalAvatarFileUri(avatarIndex);
        
        if (!localFileUri) {
          console.error("[Avatar Upload] ❌ Failed to get local file URI");
          Alert.alert("Error", "Could not load avatar image. Please try again.");
          setUploadingImage(false);
          return;
        }
        
        console.log("[Avatar Upload] ✅ Got local file URI:", localFileUri);
        
        // Upload the file using the same method as gallery/camera uploads
        const formData = new FormData();
        const filename = `avatar_${avatarIndex}.jpg`;
        
        formData.append('picture', {
          uri: localFileUri,
          name: filename,
          type: 'image/jpeg',
        } as any);
        
        formData.append('userId', userId);

        console.log("[Avatar Upload] Uploading to server...");
        const response = await api.post('/user/profile/picture', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000, // 60 seconds timeout for file uploads
        });

        if (response.data.success) {
          const pictureUrl = response.data.data.picture;
          
          // Update local state with server URL
          setProfileData(prev => ({
            ...prev,
            avatar: pictureUrl,
          }));

          // Update AsyncStorage with server URL
          try {
            const userData = await AsyncStorage.getItem("user");
            if (userData) {
              const user = JSON.parse(userData);
              user.picture = pictureUrl;
              await AsyncStorage.setItem("user", JSON.stringify(user));
            }
          } catch (error) {
            console.error("Error updating AsyncStorage:", error);
          }

          Alert.alert("Success", "Avatar uploaded successfully!");
        } else {
          Alert.alert("Error", response.data.message || "Failed to upload avatar.");
        }
      } else {
        // For online avatars (like Pexels), save the URL directly
        const response = await api.put('/user/profile/picture', {
          userId: userId,
          picture: avatarUrl,
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.data.success) {
          // Update local state
          setProfileData(prev => ({
            ...prev,
            avatar: avatarUrl,
          }));

          // Update AsyncStorage
          try {
            const userData = await AsyncStorage.getItem("user");
            if (userData) {
              const user = JSON.parse(userData);
              user.picture = avatarUrl;
              await AsyncStorage.setItem("user", JSON.stringify(user));
            }
          } catch (error) {
            console.error("Error updating AsyncStorage:", error);
          }

          Alert.alert("Success", "Avatar selected successfully!");
        } else {
          Alert.alert("Error", response.data.message || "Failed to select avatar.");
        }
      }
    } catch (error: any) {
      console.error("[Avatar Upload] ❌ Error:", JSON.stringify(error, null, 2));
      Alert.alert(
        "Selection Failed",
        error.message || "Failed to select avatar. Please try again.",
      );
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle cover photo picker from camera
  const handleTakeCoverPhoto = async () => {
    setShowCoverPhotoModal(false);
    
    if (!userId) {
      Alert.alert("Error", "User ID not found. Please login again.");
      return;
    }

    // Small delay for iOS to close modal properly
    if (Platform.OS === 'ios') {
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const hasPermission = await requestPermissions(true);
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadCoverPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error taking cover photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  // Handle cover photo picker from gallery
  const handlePickCoverPhoto = async () => {
    setShowCoverPhotoModal(false);
    
    if (!userId) {
      Alert.alert("Error", "User ID not found. Please login again.");
      return;
    }

    // Small delay for iOS to close modal properly
    if (Platform.OS === 'ios') {
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const hasPermission = await requestPermissions(false);
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await uploadCoverPhoto(result.assets[0].uri);
      }
    } catch (error) {
      console.error("Error picking cover photo:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  // Upload cover photo
  const uploadCoverPhoto = async (imageUri: string) => {
    if (!userId) {
      Alert.alert("Error", "User ID not found. Please login again.");
      return;
    }

    setUploadingCoverPhoto(true);

    try {
      const formData = new FormData();
      
      const filename = imageUri.split('/').pop() || 'cover.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      formData.append('coverPhoto', {
        uri: imageUri,
        name: filename,
        type: type,
      } as any);
      
      formData.append('userId', userId);

      const response = await api.post('/user/profile/cover-photo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const coverPhotoUrl = response.data.data.coverPhoto;
        
        setProfileData(prev => ({
          ...prev,
          coverPhoto: coverPhotoUrl,
        }));

        try {
          const userData = await AsyncStorage.getItem("user");
          if (userData) {
            const user = JSON.parse(userData);
            user.coverPhoto = coverPhotoUrl;
            await AsyncStorage.setItem("user", JSON.stringify(user));
          }
        } catch (error) {
          console.error("Error updating AsyncStorage:", error);
        }

        // Reload profile data from server to ensure we have the latest URL
        if (userId) {
          await loadProfileData(userId);
        }

        Alert.alert("Success", "Cover photo uploaded successfully!");
      } else {
        Alert.alert("Error", response.data.message || "Failed to upload cover photo.");
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert(
        "Upload Failed",
        error.message || "Failed to upload cover photo. Please try again.",
      );
    } finally {
      setUploadingCoverPhoto(false);
    }
  };

  // Delete cover photo
  const handleDeleteCoverPhoto = async () => {
    if (!userId) {
      Alert.alert("Error", "User ID not found. Please login again.");
      return;
    }

    Alert.alert(
      "Delete Cover Photo",
      "Are you sure you want to delete your cover photo?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setUploadingCoverPhoto(true);
            try {
              const response = await api.delete('/user/profile/cover-photo', {
                data: { userId },
              });

              if (response.data.success) {
                setProfileData(prev => ({
                  ...prev,
                  coverPhoto: "https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=800",
                }));

                try {
                  const userData = await AsyncStorage.getItem("user");
                  if (userData) {
                    const user = JSON.parse(userData);
                    user.coverPhoto = undefined;
                    await AsyncStorage.setItem("user", JSON.stringify(user));
                  }
                } catch (error) {
                  console.error("Error updating AsyncStorage:", error);
                }

                Alert.alert("Success", "Cover photo deleted successfully!");
              } else {
                Alert.alert("Error", response.data.message || "Failed to delete cover photo.");
              }
            } catch (error: any) {
              console.error("Delete error:", error);
              Alert.alert(
                "Delete Failed",
                error.message || "Failed to delete cover photo. Please try again.",
              );
            } finally {
              setUploadingCoverPhoto(false);
            }
          },
        },
      ],
    );
  };

  // Delete profile picture
  const handleDeletePicture = async () => {
    if (!userId) {
      Alert.alert("Error", "User ID not found. Please login again.");
      return;
    }

    Alert.alert(
      "Delete Profile Picture",
      "Are you sure you want to delete your profile picture?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setUploadingImage(true);
            try {
              const response = await api.delete('/user/profile/picture', {
                data: { userId },
              });

              if (response.data.success) {
                // Update local state - set avatar to empty to show placeholder
                setProfileData(prev => ({
                  ...prev,
                  avatar: "",
                }));

                // Update AsyncStorage
                try {
                  const userData = await AsyncStorage.getItem("user");
                  if (userData) {
                    const user = JSON.parse(userData);
                    user.picture = undefined;
                    await AsyncStorage.setItem("user", JSON.stringify(user));
                  }
                } catch (error) {
                  console.error("Error updating AsyncStorage:", error);
                }

                Alert.alert("Success", "Profile picture deleted successfully!");
              } else {
                Alert.alert("Error", response.data.message || "Failed to delete profile picture.");
              }
            } catch (error: any) {
              console.error("Delete error:", error);
              Alert.alert(
                "Delete Failed",
                error.message || "Failed to delete profile picture. Please try again.",
              );
            } finally {
              setUploadingImage(false);
            }
          },
        },
      ],
    );
  };

  /* --- Small subcomponents to keep code organized --- */
  const Header = () => (
    <View style={styles.headerWrap}>
      {/* Cover Photo */}
      <View style={styles.coverPhotoContainer}>
        <Pressable
          onPress={() => {
            if (!uploadingCoverPhoto) {
              setShowCoverPhotoModal(true);
            }
          }}
          disabled={uploadingCoverPhoto}
        >
          <Image source={{ uri: getImageUrl(profileData.coverPhoto) || profileData.coverPhoto }} style={styles.coverPhoto} />
          {uploadingCoverPhoto && (
            <View style={styles.coverPhotoUploadingOverlay}>
              <ActivityIndicator size="large" color="#C4B5FD" />
            </View>
          )}
          <View style={styles.coverPhotoOverlay}>
            <Camera width={20} height={20} color="#fff" />
            {/* <Text style={styles.coverPhotoOverlayText}>Change cover photo</Text> */}
          </View>
        </Pressable>
        <Pressable 
          style={styles.profilePictureContainer}
          onPress={() => {
            // Only show image picker if enlarged view is not showing
            if (!showEnlargedProfilePicture) {
              setShowImagePickerModal(true);
            }
          }}
          onLongPress={() => {
            if (profileData.avatar && !uploadingImage) {
              setShowEnlargedProfilePicture(true);
            }
          }}
          disabled={uploadingImage}
        >
          {profileData.avatar ? (
            <View style={styles.profilePictureWrapper}>
              <Image 
                source={getAvatarImageSource(profileData.avatar)} 
                style={styles.profilePicture}
                resizeMode="cover"
                onError={(error) => {
                  // Silently handle SVG/image format errors - don't spam console
                  const errorMessage = error?.nativeEvent?.error || 'Unknown error';
                  if (errorMessage === 'unknown image format') {
                    // SVG or unsupported format - just log once, don't spam
                    console.log("Profile picture format not supported (likely SVG):", profileData.avatar);
                  } else {
                    console.error("Profile picture failed to load:", profileData.avatar, error);
                  }
                }}
              />
              {uploadingImage && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color="#C4B5FD" />
                </View>
              )}
              <View style={styles.profilePictureOverlay}>
                <Camera width={24} height={24} color="#fff" />
              </View>
              {/* Online Status Indicator - Show for own profile if active, or for other users if they are active */}
              {((isOwnProfile && isAccountActive) || (!isOwnProfile && profileData.isActive)) && (
                <View style={styles.onlineStatusDot} />
              )}
            </View>
          ) : (
            <View style={styles.profilePicturePlaceholder}>
              {uploadingImage ? (
                <ActivityIndicator size="large" color="#C4B5FD" />
              ) : (
                <>
                  <Camera width={32} height={32} color="#C4B5FD" />
                  <Text style={styles.addProfileText}>Add profile picture</Text>
                </>
              )}
            </View>
          )}
        </Pressable>
        {/* <View style={styles.currentlyWatching}>
          <Text style={styles.currentlyWatchingText}>Currently watching...</Text>
        </View> */}
      </View>

      {/* Profile Info Section */}
      <View style={styles.profileInfoSection}>
        <Text style={styles.profileName}>{profileData.username}</Text>
        <Text style={styles.friendsCount}>{profileData.friendsCount.toLocaleString()} friends</Text>

        {/* Action Buttons */}
        <View style={styles.actionButtonsRow}>
          {profileUserId && userId && profileUserId !== userId ? (
            <>
              {/* Viewing another user's profile - Show Friend Request button */}
            <TouchableOpacity 
              style={[
                styles.addStoryBtn, 
                (friendRequestStatus === 'pending_sent' || friendRequestStatus === 'pending_received') && styles.unfollowBtn,
                friendRequestStatus === 'friends' && styles.unfriendBtn
              ]}
              onPress={handleFriendRequest}
              disabled={isFriendRequestLoading}
            >
              {isFriendRequestLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  {friendRequestStatus === 'friends' ? (
                    <User width={16} height={16} color="#fff" />
                  ) : (
                    <UserPlus width={16} height={16} color="#fff" />
                  )}
                  <Text style={styles.addStoryText}>
                    {friendRequestStatus === 'friends' 
                      ? "Unfriend" 
                      : friendRequestStatus === 'pending_sent'
                      ? "Request Sent"
                      : friendRequestStatus === 'pending_received'
                      ? "Accept Request"
                      : "Add Friend"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
              {/* Messaging icon - only show when friends */}
              {friendRequestStatus === 'friends' && (
                <TouchableOpacity
                  style={styles.messageBtn}
                  onPress={() => {
                    if (goToPage && profileUserId) {
                      goToPage('ptpMessaging', {
                        targetUserId: profileUserId,
                        targetUsername: profileData.username,
                        targetUserAvatar: profileData.avatar,
                        profileParams: { targetUserId: profileUserId },
                      });
                    }
                  }}
                >
                  <MessageCircle width={20} height={20} color="#fff" />
                </TouchableOpacity>
              )}
            </>
          ) : null}
          {isOwnProfile && (
            // Only show Edit Profile button on own profile
            <TouchableOpacity 
              style={styles.editProfileBtn}
              onPress={() => setShowEditProfileModal(true)}
            >
              <Edit3 width={16} height={16} color="#C4B5FD" />
              <Text style={styles.editProfileText}>Edit profile</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.moreBtn}
            onPress={() => setShowMoreOptionsModal(true)}
          >
            <MoreHorizontal width={16} height={16} color="#C4B5FD" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Rating Section - Only show if viewing another user's profile */}
      {!isOwnProfile && profileUserId && userId && (
        <View style={styles.ratingCard}>
          <View style={styles.ratingHeader}>
            <Text style={styles.ratingTitle}>Rate this user</Text>
            {loadingRating && (
              <ActivityIndicator size="small" color="#C4B5FD" />
            )}
          </View>
          <View style={styles.ratingStars}>
            {[1, 2, 3, 4, 5].map((star) => {
              const isFilled = star <= (userRating || 0);
              return (
                <TouchableOpacity
                  key={star}
                  style={styles.ratingStarButton}
                  onPress={() => !submittingRating && handleRatingClick(star)}
                  disabled={submittingRating}
                >
                  <Star
                    width={32}
                    height={32}
                    color={isFilled ? "#FBBF24" : "#6B7280"}
                    fill={isFilled ? "#FBBF24" : "none"}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.ratingInfo}>
            <Text style={styles.ratingInfoText}>
              Average: <Text style={styles.ratingInfoValue}>{averageRating.toFixed(1)}</Text>
            </Text>
            <Text style={styles.ratingInfoSeparator}>•</Text>
            <Text style={styles.ratingInfoText}>
              {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'}
            </Text>
            {userRating && (
              <>
                <Text style={styles.ratingInfoSeparator}>•</Text>
                <Text style={styles.ratingInfoText}>
                  Your rating: <Text style={styles.ratingInfoValue}>{userRating}/5</Text>
                </Text>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );

  const TabNav = () => (
    <View style={styles.tabNavWrap}>
      <View style={styles.tabNavInner}>
        {tabs.map((t) => {
          const active = activeTab === (t.id as any);
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => setActiveTab(t.id as any)}
              style={[styles.tabButton, active && styles.tabButtonActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
              {active && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  /* --- Render functions for each tab --- */
  const renderAbout = () => {
    return (
      <View style={styles.section}>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>About</Text>
          
          {/* Name */}
          {profileData.fullName && (
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>Name</Text>
              <Text style={styles.aboutValue}>{profileData.fullName}</Text>
            </View>
          )}

          {/* Username */}
          {profileData.username && (
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>Username</Text>
              <Text style={styles.aboutValue}>@{profileData.username}</Text>
            </View>
          )}

          {/* Email (only show to own profile) */}
          {isOwnProfile && profileData.email && (
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>Email</Text>
              <Text style={styles.aboutValue}>{profileData.email}</Text>
            </View>
          )}

          {/* Date of Birth (only show to own profile) */}
          {isOwnProfile && profileData.dateOfBirth && (
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>Date of Birth</Text>
              <Text style={styles.aboutValue}>
                {new Date(profileData.dateOfBirth).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </Text>
            </View>
          )}

          {/* Bio */}
          {profileData.bio && (
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>Bio</Text>
              <Text style={styles.aboutValue}>{profileData.bio}</Text>
            </View>
          )}

          {/* Favorite Games */}
          {profileData.favoriteGames && profileData.favoriteGames.length > 0 && (
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>Favorite Games</Text>
              <View style={styles.aboutGamesList}>
                {profileData.favoriteGames.map((game: string, index: number) => (
                  <View key={index} style={styles.aboutGameTag}>
                    <Text style={styles.aboutGameTagText}>{game}</Text>
                    {profileData.skillLevels && profileData.skillLevels[game] && (
                      <Text style={styles.aboutSkillLevel}>
                        ({profileData.skillLevels[game]})
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Join Date */}
          <View style={styles.aboutItem}>
            <Text style={styles.aboutLabel}>Joined</Text>
            <Text style={styles.aboutValue}>
              {profileData.createdAt 
                ? new Date(profileData.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })
                : 'N/A'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderPosts = () => {
    // If viewing another user's profile and not friends, show message
    if (!isOwnProfile && friendRequestStatus !== 'friends') {
      return (
        <View style={styles.section}>
          {/* Details Section */}
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>Details</Text>
              {isOwnProfile && (
                <TouchableOpacity 
                  onPress={() => setIsEditingDetails(!isEditingDetails)}
                  style={styles.editDetailsButton}
                >
                  <Text style={styles.editDetailsText}>
                    {isEditingDetails ? 'Cancel' : 'Edit'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            
            {isEditingDetails && isOwnProfile ? (
              <View style={styles.editableDetailsContainer}>
                {/* Bio Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Bio</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Tell us about yourself..."
                    placeholderTextColor="#6B7280"
                    value={bio}
                    onChangeText={setBio}
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                    returnKeyType="done"
                    blurOnSubmit={true}
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                  <Text style={styles.charCount}>{bio.length}/500</Text>
                </View>

                {/* Favorite Games */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Favorite Games</Text>
                  <View style={styles.gamesContainer}>
                    {favoriteGames.map((game, index) => (
                      <View key={index} style={styles.gameTag}>
                        <Text style={styles.gameTagText}>{game}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            const newGames = favoriteGames.filter((_, i) => i !== index);
                            setFavoriteGames(newGames);
                            const newSkillLevels = { ...skillLevels };
                            delete newSkillLevels[game];
                            setSkillLevels(newSkillLevels);
                          }}
                        >
                          <X width={14} height={14} color="#9CA3AF" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                  <View style={styles.addGameContainer}>
                    <TextInput
                      style={styles.addGameInput}
                      placeholder="Add a game..."
                      placeholderTextColor="#6B7280"
                      value={newGame}
                      onChangeText={setNewGame}
                      onSubmitEditing={() => {
                        if (newGame.trim() && !favoriteGames.includes(newGame.trim())) {
                          setFavoriteGames([...favoriteGames, newGame.trim()]);
                          setNewGame('');
                        }
                      }}
                    />
                    <TouchableOpacity
                      style={styles.addGameButton}
                      onPress={() => {
                        if (newGame.trim() && !favoriteGames.includes(newGame.trim())) {
                          setFavoriteGames([...favoriteGames, newGame.trim()]);
                          setNewGame('');
                        }
                      }}
                    >
                      <Plus width={18} height={18} color="#7C3AED" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Skill Levels */}
                {favoriteGames.length > 0 && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Skill Levels</Text>
                    {favoriteGames.map((game) => (
                      <View key={game} style={styles.skillLevelRow}>
                        <Text style={styles.skillLevelLabel}>{game}:</Text>
                        <View style={styles.skillLevelOptions}>
                          {['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Pro'].map((level) => (
                            <TouchableOpacity
                              key={level}
                              style={[
                                styles.skillLevelButton,
                                skillLevels[game] === level && styles.skillLevelButtonActive,
                              ]}
                              onPress={() => {
                                setSkillLevels({ ...skillLevels, [game]: level });
                              }}
                            >
                              <Text
                                style={[
                                  styles.skillLevelButtonText,
                                  skillLevels[game] === level && styles.skillLevelButtonTextActive,
                                ]}
                              >
                                {level}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Save Button */}
                <TouchableOpacity
                  style={[styles.saveDetailsButton, savingDetails && styles.saveDetailsButtonDisabled]}
                  onPress={handleSaveDetails}
                  disabled={savingDetails}
                >
                  {savingDetails ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Save width={18} height={18} color="#fff" />
                      <Text style={styles.saveDetailsButtonText}>Save Details</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.detailsContent}>
                {profileData.bio ? (
                  <Text style={styles.detailsBio}>{profileData.bio}</Text>
                ) : (
                  <Text style={styles.detailsSubtext}>No bio added yet</Text>
                )}
                
                {profileData.favoriteGames && profileData.favoriteGames.length > 0 && (
                  <View style={styles.detailsGamesSection}>
                    <Text style={styles.detailsSectionTitle}>Favorite Games</Text>
                    <View style={styles.detailsGamesList}>
                      {profileData.favoriteGames.map((game: string, index: number) => (
                        <View key={index} style={styles.detailsGameTag}>
                          <Text style={styles.detailsGameTagText}>{game}</Text>
                          {profileData.skillLevels && profileData.skillLevels[game] && (
                            <Text style={styles.detailsSkillLevel}>
                              ({profileData.skillLevels[game]})
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Friends Section */}
          <View style={styles.friendsCard}>
            <View style={styles.friendsHeader}>
              <Text style={styles.friendsTitle}>Friends</Text>
              <View style={styles.friendsHeaderActions}>
                <TouchableOpacity 
                  onPress={() => {
                    if (goToPage) {
                      goToPage('friendRequests');
                    }
                  }}
                  style={styles.friendRequestButton}
                >
                  <Text style={styles.friendRequestLink}>Requests</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => {
                    if (goToPage) {
                      goToPage('friendsList');
                    }
                  }}
                >
                  <Text style={styles.findFriendsLink}>Find friends</Text>
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.friendsCountText}>{profileData.friendsCount.toLocaleString()} friends</Text>
            <View style={styles.friendsGrid}>
              {friends.length > 0 ? (
                friends.slice(0, 6).map((friend) => (
                  <TouchableOpacity 
                    key={friend.id} 
                    style={styles.friendCard}
                    onPress={() => handleFriendClick(friend.id)}
                  >
                    <View style={styles.friendCardAvatarContainer}>
                      <Image 
                        source={getAvatarImageSource(friend.avatar)} 
                        style={styles.friendCardAvatar}
                        resizeMode="cover"
                      />
                      {/* Online Status Dot for Friends */}
                      {friend.isActive && (
                        <View style={styles.friendOnlineStatusDot} />
                      )}
                    </View>
                    <Text style={styles.friendCardName}>{friend.name || friend.username}</Text>
                    {friend.activeTime && (
                      <Text style={styles.friendActiveTime}>{friend.activeTime}</Text>
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noFriendsText}>No friends yet</Text>
              )}
            </View>
            <View style={styles.friendsActionButtons}>
              <TouchableOpacity 
                style={[styles.seeAllFriendsBtn, styles.friendsActionBtn]}
                onPress={() => {
                  if (goToPage) {
                    goToPage('friendsList');
                  }
                }}
              >
                <Text style={styles.seeAllFriendsText}>See all friends</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.friendRequestBtn, styles.friendsActionBtn]}
                onPress={() => {
                  if (goToPage) {
                    goToPage('friendRequests');
                  }
                }}
              >
                <Text style={styles.friendRequestBtnText}>Requests</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Message to follow to see posts */}
          <View style={styles.followToSeePostsCard}>
            <View style={styles.followToSeePostsIcon}>
              <UserPlus width={48} height={48} color="#7C3AED" />
            </View>
            <Text style={styles.followToSeePostsTitle}>Add friend to see posts</Text>
            <Text style={styles.followToSeePostsText}>
              Add {profileData.username} as a friend to see their posts and updates.
            </Text>
            <TouchableOpacity 
              style={styles.followToSeePostsButton}
              onPress={handleFriendRequest}
              disabled={isFriendRequestLoading}
            >
              {isFriendRequestLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <UserPlus width={18} height={18} color="#fff" />
                  <Text style={styles.followToSeePostsButtonText}>
                    {friendRequestStatus === 'pending_sent' 
                      ? "Request Sent" 
                      : friendRequestStatus === 'pending_received'
                      ? "Accept Request"
                      : "Add Friend"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Show full posts section if own profile or following
    return (
      <View style={styles.section}>
        {/* Create Post Section - Only show on own profile */}
        {isOwnProfile && (
          <View style={styles.createPostCard}>
            <View style={styles.createPostHeader}>
              <Image source={getAvatarImageSource(profileData.avatar)} style={styles.createPostAvatar} />
              <TextInput
                style={styles.createPostInput}
                placeholder="What's on your mind?"
                placeholderTextColor="#9CA3AF"
                value={postDescription}
                onChangeText={setPostDescription}
                multiline
                maxLength={2000}
                returnKeyType="done"
                blurOnSubmit={true}
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {selectedMedia && (
                <TouchableOpacity 
                  style={styles.removeMediaBtn}
                  onPress={() => {
                    setSelectedMedia(null);
                    setMediaType(null);
                  }}
                >
                  <X width={16} height={16} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Selected Media Preview */}
            {selectedMedia && (
              <View style={styles.selectedMediaContainer}>
                {mediaType === 'image' ? (
                  <Image source={{ uri: getImageUrl(selectedMedia) || selectedMedia }} style={styles.selectedMediaImage} />
                ) : (
                  <View style={styles.selectedMediaVideo}>
                    <Video width={40} height={40} color="#fff" />
                    <Text style={styles.selectedMediaText}>Video Selected</Text>
                  </View>
                )}
              </View>
            )}
            
            <View style={styles.createPostActions}>
              <TouchableOpacity 
                style={styles.reelBtn}
                onPress={pickImageForPost}
                disabled={isCreatingPost}
              >
                <Camera width={18} height={18} color="#EF4444" />
                <Text style={styles.reelBtnText}>Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.liveBtn}
                onPress={pickVideoForPost}
                disabled={isCreatingPost}
              >
                <Video width={18} height={18} color="#EF4444" />
                <Text style={styles.liveBtnText}>Video</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.postButton,
                  (!postDescription.trim() && !selectedMedia) && styles.postButtonDisabled,
                  isCreatingPost && styles.postButtonDisabled
                ]}
                onPress={handleCreatePost}
                disabled={(!postDescription.trim() && !selectedMedia) || isCreatingPost}
              >
                {isCreatingPost ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.postButtonText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Details Section */}
        <View style={styles.detailsCard}>
          <View style={styles.detailsHeader}>
            <Text style={styles.detailsTitle}>Details</Text>
            {isOwnProfile && (
              <TouchableOpacity 
                onPress={() => setIsEditingDetails(!isEditingDetails)}
                style={styles.editDetailsButton}
              >
                <Text style={styles.editDetailsText}>
                  {isEditingDetails ? 'Cancel' : 'Edit'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          {isEditingDetails && isOwnProfile ? (
            <View style={styles.editableDetailsContainer}>
              {/* Bio Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Bio</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Tell us about yourself..."
                  placeholderTextColor="#6B7280"
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                />
                <Text style={styles.charCount}>{bio.length}/500</Text>
              </View>

              {/* Favorite Games */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Favorite Games</Text>
                <View style={styles.gamesContainer}>
                  {favoriteGames.map((game, index) => (
                    <View key={index} style={styles.gameTag}>
                      <Text style={styles.gameTagText}>{game}</Text>
                      <TouchableOpacity
                        onPress={() => {
                          const newGames = favoriteGames.filter((_, i) => i !== index);
                          setFavoriteGames(newGames);
                          const newSkillLevels = { ...skillLevels };
                          delete newSkillLevels[game];
                          setSkillLevels(newSkillLevels);
                        }}
                      >
                        <X width={14} height={14} color="#9CA3AF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View style={styles.addGameContainer}>
                  <TextInput
                    style={styles.addGameInput}
                    placeholder="Add a game..."
                    placeholderTextColor="#6B7280"
                    value={newGame}
                    onChangeText={setNewGame}
                    returnKeyType="done"
                    blurOnSubmit={true}
                    onSubmitEditing={() => {
                      if (newGame.trim() && !favoriteGames.includes(newGame.trim())) {
                        setFavoriteGames([...favoriteGames, newGame.trim()]);
                        setNewGame('');
                      }
                      Keyboard.dismiss();
                    }}
                  />
                  <TouchableOpacity
                    style={styles.addGameButton}
                    onPress={() => {
                      if (newGame.trim() && !favoriteGames.includes(newGame.trim())) {
                        setFavoriteGames([...favoriteGames, newGame.trim()]);
                        setNewGame('');
                      }
                    }}
                  >
                    <Plus width={18} height={18} color="#7C3AED" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Skill Levels */}
              {favoriteGames.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Skill Levels</Text>
                  {favoriteGames.map((game) => (
                    <View key={game} style={styles.skillLevelRow}>
                      <Text style={styles.skillLevelLabel}>{game}:</Text>
                      <View style={styles.skillLevelOptions}>
                        {['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Pro'].map((level) => (
                          <TouchableOpacity
                            key={level}
                            style={[
                              styles.skillLevelButton,
                              skillLevels[game] === level && styles.skillLevelButtonActive,
                            ]}
                            onPress={() => {
                              setSkillLevels({ ...skillLevels, [game]: level });
                            }}
                          >
                            <Text
                              style={[
                                styles.skillLevelButtonText,
                                skillLevels[game] === level && styles.skillLevelButtonTextActive,
                              ]}
                            >
                              {level}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveDetailsButton, savingDetails && styles.saveDetailsButtonDisabled]}
                onPress={handleSaveDetails}
                disabled={savingDetails}
              >
                {savingDetails ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Save width={18} height={18} color="#fff" />
                    <Text style={styles.saveDetailsButtonText}>Save Details</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.detailsContent}>
              {profileData.bio ? (
                <Text style={styles.detailsBio}>{profileData.bio}</Text>
              ) : (
                <Text style={styles.detailsSubtext}>No bio added yet</Text>
              )}
              
              {profileData.favoriteGames && profileData.favoriteGames.length > 0 && (
                <View style={styles.detailsGamesSection}>
                  <Text style={styles.detailsSectionTitle}>Favorite Games</Text>
                  <View style={styles.detailsGamesList}>
                    {profileData.favoriteGames.map((game: string, index: number) => (
                      <View key={index} style={styles.detailsGameTag}>
                        <Text style={styles.detailsGameTagText}>{game}</Text>
                        {profileData.skillLevels && profileData.skillLevels[game] && (
                          <Text style={styles.detailsSkillLevel}>
                            ({profileData.skillLevels[game]})
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Friends Section */}
        <View style={styles.friendsCard}>
          <View style={styles.friendsHeader}>
            <Text style={styles.friendsTitle}>Friends</Text>
            <TouchableOpacity 
              onPress={() => {
                if (goToPage) {
                  goToPage('friendsList');
                }
              }}
            >
              <Text style={styles.findFriendsLink}>Find friends</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.friendsCountText}>{profileData.friendsCount.toLocaleString()} friends</Text>
          <View style={styles.friendsGrid}>
            {friends.length > 0 ? (
              friends.slice(0, 6).map((friend) => (
                <TouchableOpacity 
                  key={friend.id} 
                  style={styles.friendCard}
                  onPress={() => handleFriendClick(friend.id)}
                >
                  <View style={styles.friendCardAvatarContainer}>
                    <Image source={getAvatarImageSource(friend.avatar)} style={styles.friendCardAvatar} />
                    {/* Online Status Dot for Friends */}
                    {friend.isActive && (
                      <View style={styles.friendOnlineStatusDot} />
                    )}
                  </View>
                  <Text style={styles.friendCardName}>{friend.name || friend.username}</Text>
                  {friend.activeTime && (
                    <Text style={styles.friendActiveTime}>{friend.activeTime}</Text>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.noFriendsText}>No friends yet</Text>
            )}
          </View>
          <View style={styles.friendsActionButtons}>
            <TouchableOpacity 
              style={[styles.seeAllFriendsBtn, styles.friendsActionBtn]}
              onPress={() => {
                if (goToPage) {
                  goToPage('friendsList');
                }
              }}
            >
              <Text style={styles.seeAllFriendsText}>See all friends</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.friendRequestBtn, styles.friendsActionBtn]}
              onPress={() => {
                if (goToPage) {
                  goToPage('friendRequests');
                }
              }}
            >
              <Text style={styles.friendRequestBtnText}>Requests</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Posts Feed - Only show if own profile or following */}
        {shouldShowPosts && (
          <View style={styles.postsFeed}>
            {loadingPosts ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#7C3AED" />
                <Text style={styles.loadingText}>Loading posts...</Text>
              </View>
            ) : userPosts.length === 0 ? (
              <View style={styles.noPostsContainer}>
                <Text style={styles.noPostsText}>No posts yet</Text>
                {isOwnProfile && (
                  <Text style={styles.noPostsSubtext}>Create your first post above!</Text>
                )}
              </View>
            ) : (
              userPosts.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <Image 
                      source={getAvatarImageSource(post.user?.picture || profileData.avatar)} 
                      style={styles.postAvatar} 
                    />
                    <View style={styles.postHeaderText}>
                      <Text style={styles.postAuthorName}>
                        {post.user?.username || post.user?.name || profileData.username}
                      </Text>
                      {editingPostId !== post.id && post.description ? (
                        <Text style={styles.postText}>{post.description}</Text>
                      ) : null}
                      <Text style={styles.postDate}>
                        {new Date(post.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: new Date(post.createdAt).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                        })}
                      </Text>
                    </View>
                    {isOwnProfile && (
                      <TouchableOpacity
                        style={styles.postMenuBtn}
                        onPress={() => setOpenDropdownId(openDropdownId === post.id ? null : post.id)}
                      >
                        <MoreVertical width={20} height={20} color="#9CA3AF" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  {/* Dropdown Menu */}
                  {openDropdownId === post.id && isOwnProfile && (
                    <View style={styles.postDropdown}>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setOpenDropdownId(null);
                          handleEditPost(post);
                        }}
                      >
                        <Edit3 width={16} height={16} color="#C4B5FD" />
                        <Text style={styles.dropdownItemText}>Edit post</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
                            { text: "Cancel", style: "cancel", onPress: () => setOpenDropdownId(null) },
                            { 
                              text: "Delete", 
                              style: "destructive", 
                              onPress: async () => {
                                setOpenDropdownId(null);
                                await handleDeletePost(post.id);
                              }
                            },
                          ]);
                        }}
                      >
                        <Trash2 width={16} height={16} color="#FB7185" />
                        <Text style={[styles.dropdownItemText, { color: "#FB7185" }]}>Delete post</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Edit Post UI */}
                  {editingPostId === post.id && (
                    <View style={styles.editPostContainer}>
                      <Text style={styles.editPostLabel}>Edit Description</Text>
                      <TextInput
                        style={styles.editPostInput}
                        placeholder="Edit post description..."
                        placeholderTextColor="#6B7280"
                        value={editPostDescription}
                        onChangeText={setEditPostDescription}
                        multiline
                        maxLength={2000}
                        returnKeyType="done"
                        blurOnSubmit={true}
                        onSubmitEditing={() => Keyboard.dismiss()}
                      />
                      <View style={styles.editPostActions}>
                        <TouchableOpacity
                          style={styles.editPostCancelButton}
                          onPress={handleCancelEdit}
                          disabled={isUpdatingPost}
                        >
                          <Text style={styles.editPostCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.editPostSaveButton,
                            (!editPostDescription.trim() || isUpdatingPost) && styles.editPostSaveButtonDisabled
                          ]}
                          onPress={() => handleUpdatePost(post.id)}
                          disabled={!editPostDescription.trim() || isUpdatingPost}
                        >
                          {isUpdatingPost ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.editPostSaveText}>Save</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Post Media */}
                  {post.media && (
                    <View style={styles.postMediaContainer}>
                      {post.mediaType === 'image' ? (
                        <Image source={{ uri: getImageUrl(post.media) || post.media }} style={styles.postMediaImage} />
                      ) : post.mediaType === 'video' ? (
                        <PostVideoPlayer 
                          videoUri={getImageUrl(post.media) || post.media} 
                          />
                      ) : null}
                    </View>
                  )}

                  {/* Post Actions */}
                  <View style={styles.postActionsRow}>
                    <TouchableOpacity 
                      style={styles.postActionBtn}
                      onPress={() => handleToggleLike(post.id)}
                      disabled={likingPost[post.id]}
                    >
                      <ThumbsUp 
                        width={18} 
                        height={18} 
                        color={post.likes?.some((like: any) => like.id === userId) ? "#7C3AED" : "#9CA3AF"} 
                      />
                      <Text style={[
                        styles.postActionText,
                        post.likes?.some((like: any) => like.id === userId) && styles.postActionTextActive
                      ]}>
                        {post.likesCount > 0 ? post.likesCount : ''} Like
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.postActionBtn}
                      onPress={() => toggleComments(post.id)}
                    >
                      <MessageCircle width={18} height={18} color="#9CA3AF" />
                      <Text style={styles.postActionText}>
                        {post.commentsCount > 0 ? post.commentsCount : ''} Comment
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Comments Section */}
                  {expandedComments.has(post.id) && (
                    <View style={styles.commentsSection}>
                      {/* Comment Input */}
                      <View style={styles.commentInputContainer}>
                        <Image 
                          source={getAvatarImageSource(profileData.avatar)} 
                          style={styles.commentInputAvatar} 
                        />
                        <View style={styles.commentInputWrapper}>
                          <TextInput
                            style={styles.commentInput}
                            placeholder="Write a comment..."
                            placeholderTextColor="#6B7280"
                            value={commentInputs[post.id] || ''}
                            onChangeText={(text) => setCommentInputs(prev => ({ ...prev, [post.id]: text }))}
                            multiline
                            maxLength={500}
                            returnKeyType="done"
                            blurOnSubmit={true}
                            onSubmitEditing={() => {
                              if (commentInputs[post.id]?.trim() && !postingComment[post.id]) {
                                handleAddComment(post.id);
                              }
                              Keyboard.dismiss();
                            }}
                          />
                          {commentInputs[post.id]?.trim() && (
                            <TouchableOpacity
                              style={styles.commentSendButton}
                              onPress={() => handleAddComment(post.id)}
                              disabled={postingComment[post.id]}
                            >
                              {postingComment[post.id] ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <Send width={18} height={18} color="#fff" />
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      {/* Comments List */}
                      {post.comments && post.comments.length > 0 ? (
                        <View style={styles.commentsList}>
                          {post.comments.map((comment: any) => (
                            <View key={comment.id} style={styles.commentItem}>
                              <Image 
                                source={getAvatarImageSource(comment.user?.picture)} 
                                style={styles.commentAvatar} 
                              />
                              <View style={styles.commentContent}>
                                <View style={styles.commentBubble}>
                                  <Text style={styles.commentAuthorName}>
                                    {comment.user?.username || comment.user?.name || 'User'}
                                  </Text>
                                  <Text style={styles.commentText}>{comment.text}</Text>
                                </View>
                                <View style={styles.commentActions}>
                                  <TouchableOpacity
                                    style={styles.commentActionButton}
                                    onPress={() => {
                                      // Toggle reply input - if not open, open it; if open, keep it open
                                      if (replyInputs[comment.id] === undefined) {
                                        setReplyInputs(prev => ({
                                          ...prev,
                                          [comment.id]: '' // Open reply input with empty text
                                        }));
                                      }
                                      // If already open, do nothing (keep it open for multiple replies)
                                    }}
                                  >
                                    <Text style={styles.commentActionText}>
                                      {replyInputs[comment.id] !== undefined ? 'Replying...' : 'Reply'}
                                    </Text>
                                  </TouchableOpacity>
                                  {comment.userId === userId && (
                                    <TouchableOpacity
                                      style={styles.commentActionButton}
                                      onPress={() => handleDeleteComment(post.id, comment.id, false)}
                                    >
                                      <Text style={[styles.commentActionText, { color: '#FB7185' }]}>Delete</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>

                                {/* Reply Input */}
                                {replyInputs[comment.id] !== undefined && (
                                  <View style={styles.replyInputContainer}>
                                    <Image 
                                      source={getAvatarImageSource(profileData.avatar)} 
                                      style={styles.replyInputAvatar} 
                                    />
                                    <View style={styles.replyInputWrapper}>
                                      <TextInput
                                        style={styles.replyInput}
                                        placeholder="Write a reply..."
                                        placeholderTextColor="#6B7280"
                                        value={replyInputs[comment.id] || ''}
                                        onChangeText={(text) => setReplyInputs(prev => ({ ...prev, [comment.id]: text }))}
                                        multiline
                                        maxLength={500}
                                        returnKeyType="done"
                                        blurOnSubmit={true}
                                        onSubmitEditing={() => {
                                          if (replyInputs[comment.id]?.trim() && !postingComment[`${post.id}-${comment.id}`]) {
                                            handleAddComment(post.id, comment.id);
                                          }
                                          Keyboard.dismiss();
                                        }}
                                      />
                                      <View style={styles.replyInputActions}>
                                        {replyInputs[comment.id]?.trim() && (
                                          <TouchableOpacity
                                            style={styles.replySendButton}
                                            onPress={() => handleAddComment(post.id, comment.id)}
                                            disabled={postingComment[`${post.id}-${comment.id}`]}
                                          >
                                            {postingComment[`${post.id}-${comment.id}`] ? (
                                              <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                              <Send width={16} height={16} color="#fff" />
                                            )}
                                          </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                          style={styles.replyCloseButton}
                                          onPress={() => {
                                            setReplyInputs(prev => {
                                              const newInputs = { ...prev };
                                              delete newInputs[comment.id];
                                              return newInputs;
                                            });
                                          }}
                                        >
                                          <X width={14} height={14} color="#9CA3AF" />
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                  </View>
                                )}

                                {/* Replies List */}
                                {comment.replies && comment.replies.length > 0 && (
                                  <View style={styles.repliesList}>
                                    {comment.replies.map((reply: any) => (
                                      <View key={reply.id} style={styles.replyItem}>
                                        <Image 
                                          source={getAvatarImageSource(reply.user?.picture)} 
                                          style={styles.replyAvatar} 
                                        />
                                        <View style={styles.replyContent}>
                                          <View style={styles.replyBubble}>
                                            <Text style={styles.replyAuthorName}>
                                              {reply.user?.username || reply.user?.name || 'User'}
                                            </Text>
                                            <Text style={styles.replyText}>{reply.text}</Text>
                                          </View>
                                          {reply.userId === userId && (
                                            <TouchableOpacity
                                              style={styles.commentActionButton}
                                              onPress={() => handleDeleteComment(post.id, reply.id, true, comment.id)}
                                            >
                                              <Text style={[styles.commentActionText, { color: '#FB7185' }]}>Delete</Text>
                                            </TouchableOpacity>
                                          )}
                                        </View>
                                      </View>
                                    ))}
                                  </View>
                                )}
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.noCommentsText}>No comments yet</Text>
                      )}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              setRefreshing(true);
              await loadUserData();
              setRefreshing(false);
            }} 
            tintColor="#7c3aed" 
          />
        }
      >
        <Header />
        <TabNav />

        <View style={styles.contentWrap}>
          {activeTab === "posts" && renderPosts()}
          {activeTab === "photos" && (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyTabText}>Photos</Text>
            </View>
          )}
          {activeTab === "reels" && (
            <View style={styles.emptyTab}>
              <Text style={styles.emptyTabText}>Reels</Text>
            </View>
          )}
          {activeTab === "about" && renderAbout()}
        </View>
      </ScrollView>

      {/* Image Picker Modal */}
      <Modal
        visible={showImagePickerModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowImagePickerModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowImagePickerModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile Picture</Text>
              <TouchableOpacity
                onPress={() => setShowImagePickerModal(false)}
                style={styles.modalCloseBtn}
              >
                <X width={24} height={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleTakePhoto}
                disabled={uploadingImage}
              >
                <Camera width={24} height={24} color="#7C3AED" />
                <Text style={styles.modalOptionText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOption}
                onPress={handlePickImage}
                disabled={uploadingImage}
              >
                <ImageIcon width={24} height={24} color="#7C3AED" />
                <Text style={styles.modalOptionText}>Choose from Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  console.log('Opening avatar modal. Total avatars:', avatarOptions.length);
                  console.log('Avatar URLs:', avatarOptions);
                  setShowImagePickerModal(false);
                  setShowAvatarModal(true);
                }}
                disabled={uploadingImage}
              >
                <User width={24} height={24} color="#7C3AED" />
                <Text style={styles.modalOptionText}>Choose Avatar</Text>
              </TouchableOpacity>

              {profileData.avatar && !profileData.avatar.includes("pexels.com") && !profileData.avatar.includes("dicebear.com") && !profileData.avatar.includes("api.dicebear.com") && (
                <TouchableOpacity
                  style={[styles.modalOption, styles.deleteOption]}
                  onPress={handleDeletePicture}
                  disabled={uploadingImage}
                >
                  <Trash2 width={24} height={24} color="#EF4444" />
                  <Text style={[styles.modalOptionText, { color: "#EF4444" }]}>Delete Picture</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Enlarged Profile Picture Modal */}
      <Modal
        visible={showEnlargedProfilePicture}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEnlargedProfilePicture(false)}
      >
        <Pressable
          style={styles.enlargedProfileModalOverlay}
          onPress={() => setShowEnlargedProfilePicture(false)}
          onPressOut={() => setShowEnlargedProfilePicture(false)}
        >
          <View style={styles.enlargedProfileContainer} onStartShouldSetResponder={() => true}>
            {profileData.avatar && (
              <Image
                source={getAvatarImageSource(profileData.avatar)}
                style={styles.enlargedProfileImage}
                resizeMode="cover"
              />
            )}
          </View>
        </Pressable>
      </Modal>

      {/* Cover Photo Modal */}
      <Modal
        visible={showCoverPhotoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCoverPhotoModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCoverPhotoModal(false)}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Cover Photo</Text>
              <TouchableOpacity
                onPress={() => setShowCoverPhotoModal(false)}
                style={styles.modalCloseBtn}
              >
                <X width={24} height={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleTakeCoverPhoto}
                disabled={uploadingCoverPhoto}
              >
                <Camera width={24} height={24} color="#7C3AED" />
                <Text style={styles.modalOptionText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOption}
                onPress={handlePickCoverPhoto}
                disabled={uploadingCoverPhoto}
              >
                <ImageIcon width={24} height={24} color="#7C3AED" />
                <Text style={styles.modalOptionText}>Choose from Gallery</Text>
              </TouchableOpacity>

              {profileData.coverPhoto && !profileData.coverPhoto.includes("pexels.com") && (
                <TouchableOpacity
                  style={[styles.modalOption, styles.deleteOption]}
                  onPress={handleDeleteCoverPhoto}
                  disabled={uploadingCoverPhoto}
                >
                  <Trash2 width={24} height={24} color="#EF4444" />
                  <Text style={[styles.modalOptionText, { color: "#EF4444" }]}>Delete Cover Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Avatar Selection Modal */}
      <Modal
        visible={showAvatarModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAvatarModal(false)}
        onShow={() => {
          console.log('Avatar modal opened. Showing', avatarOptions.length, 'avatars');
          console.log('Local avatar sources:', localAvatarSources);
          console.log('Avatar options:', avatarOptions);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAvatarModal(false)}
        >
          <View style={styles.avatarModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Avatar</Text>
              <TouchableOpacity
                onPress={() => setShowAvatarModal(false)}
                style={styles.modalCloseBtn}
              >
                <X width={24} height={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.avatarScrollView} 
              contentContainerStyle={styles.avatarGrid}
              showsVerticalScrollIndicator={true}
            >
              {avatarOptions.length > 0 ? (
                avatarOptions.map((avatar, index) => {
                  const isSelected = profileData.avatar === avatar;
                  const hasFailed = failedAvatars.has(index);
                  const isLocalImage = index < localAvatarSources.length;
                  
                  // Determine image source
                  let imageSource;
                  if (isLocalImage) {
                    // For local images, use require directly
                    imageSource = localAvatarSources[index];
                  } else {
                    // For online images, use URI
                    imageSource = { uri: avatar };
                  }
                  
                  return (
                    <TouchableOpacity
                      key={`avatar-${index}`}
                      style={[
                        styles.avatarOption,
                        isSelected && styles.selectedAvatar,
                      ]}
                      onPress={() => {
                        console.log(`Selecting avatar ${index}:`, avatar);
                        handleSelectAvatar(avatar, index);
                      }}
                      disabled={uploadingImage}
                    >
                      {hasFailed ? (
                        <View style={styles.avatarErrorPlaceholder}>
                          <User width={32} height={32} color="#9CA3AF" />
                          <Text style={styles.avatarErrorText}>Failed</Text>
                        </View>
                      ) : (
                        <Image 
                          source={imageSource}
                          style={styles.avatarImage}
                          resizeMode="cover"
                          defaultSource={require('../../assets/icon.png')}
                          onLoadStart={() => {
                            console.log(`Avatar ${index} loading started. IsLocal: ${isLocalImage}`);
                            console.log('Image source:', imageSource);
                          }}
                          onLoad={() => {
                            console.log(`Avatar ${index} loaded successfully. IsLocal: ${isLocalImage}`);
                          }}
                          onError={(error) => {
                            console.error(`Avatar ${index} failed to load. IsLocal: ${isLocalImage}`);
                            console.error('Image source:', imageSource);
                            console.error('Avatar value:', avatar);
                            console.error('Error details:', error);
                            setFailedAvatars(prev => {
                              const newSet = new Set(prev);
                              newSet.add(index);
                              return newSet;
                            });
                          }}
                        />
                      )}
                      {isSelected && (
                        <View style={styles.selectedAvatarCheck}>
                          <CheckCircle2 width={24} height={24} color="#7C3AED" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyAvatarGrid}>
                  <Text style={styles.emptyAvatarText}>No avatars available</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfileModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowEditProfileModal(false)}
        >
          <View style={styles.editProfileModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => setShowEditProfileModal(false)}
                style={styles.modalCloseBtn}
              >
                <X width={24} height={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editProfileScrollView} showsVerticalScrollIndicator={true}>
              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your name"
                  placeholderTextColor="#6B7280"
                  value={editName}
                  onChangeText={setEditName}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>

              {/* Username Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter username"
                  placeholderTextColor="#6B7280"
                  value={editUsername}
                  onChangeText={setEditUsername}
                  autoCapitalize="none"
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <Text style={styles.inputHint}>Username must be unique and 3-30 characters</Text>
              </View>

              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter email"
                  placeholderTextColor="#6B7280"
                  value={editEmail}
                  onChangeText={setEditEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <Text style={styles.inputHint}>Email must be unique and valid</Text>
              </View>

              {/* Date of Birth Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date of Birth</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#6B7280"
                  value={editDateOfBirth}
                  onChangeText={setEditDateOfBirth}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <Text style={styles.inputHint}>Format: YYYY-MM-DD (e.g., 2000-01-15)</Text>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveDetailsButton, savingProfile && styles.saveDetailsButtonDisabled]}
                onPress={handleSaveEditProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Save width={18} height={18} color="#fff" />
                    <Text style={styles.saveDetailsButtonText}>Save Profile</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* More Options Modal */}
      <Modal
        visible={showMoreOptionsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMoreOptionsModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowMoreOptionsModal(false)}
        >
          <View style={styles.moreOptionsModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>More Options</Text>
              <TouchableOpacity
                onPress={() => setShowMoreOptionsModal(false)}
                style={styles.modalCloseBtn}
              >
                <X width={24} height={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.moreOptionsScrollView} showsVerticalScrollIndicator={true}>
              {isOwnProfile ? (
                <>
                  {/* Security & Privacy Section */}
                  <View style={styles.moreOptionsSection}>
                    <View style={styles.moreOptionsSectionHeader}>
                      <Shield width={20} height={20} color="#7C3AED" />
                      <Text style={styles.moreOptionsSectionTitle}>Security & Privacy</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.moreOptionsItem}
                      onPress={() => {
                        setShowMoreOptionsModal(false);
                        setShowChangePasswordModal(true);
                      }}
                    >
                      <Lock width={18} height={18} color="#9CA3AF" />
                      <Text style={styles.moreOptionsItemText}>Change Password</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Account Status Section */}
                  <View style={styles.moreOptionsSection}>
                    <View style={styles.moreOptionsSectionHeader}>
                      <AlertCircle width={20} height={20} color="#7C3AED" />
                      <Text style={styles.moreOptionsSectionTitle}>Account Status</Text>
                    </View>
                    <View style={styles.moreOptionsItem}>
                      <CheckCircle2 width={18} height={18} color={isAccountActive ? "#10B981" : "#9CA3AF"} />
                      <Text style={styles.moreOptionsItemText}>Active</Text>
                      <Switch
                        value={isAccountActive}
                        onValueChange={async (value) => {
                          setIsAccountActive(value);
                          // Save account status to AsyncStorage
                          try {
                            const userData = await AsyncStorage.getItem('user');
                            if (userData) {
                              const user = JSON.parse(userData);
                              user.isActive = value;
                              await AsyncStorage.setItem('user', JSON.stringify(user));
                            }
                          } catch (error) {
                            console.error('Error saving account status:', error);
                          }
                          
                          // Update account status in backend
                          if (userId) {
                            try {
                              const response = await api.put('/user/account-status', {
                                userId: userId,
                                isActive: value,
                              });
                              
                              if (response.data.success) {
                                // Update profile data
                                setProfileData(prev => ({
                                  ...prev,
                                  isActive: value,
                                }));
                              }
                            } catch (error) {
                              console.error('Error updating account status:', error);
                            }
                          }
                        }}
                        trackColor={{ false: "#374151", true: "#10B981" }}
                        thumbColor={isAccountActive ? "#fff" : "#9CA3AF"}
                        ios_backgroundColor="#374151"
                      />
                    </View>
                    <TouchableOpacity 
                      style={styles.moreOptionsItem}
                      onPress={handleDeleteAccount}
                    >
                      <Trash2 width={18} height={18} color="#FB7185" />
                      <Text style={[styles.moreOptionsItemText, { color: "#FB7185" }]}>Delete Account</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Blocked Section */}
                  <View style={styles.moreOptionsSection}>
                    <View style={styles.moreOptionsSectionHeader}>
                      <UserX width={20} height={20} color="#7C3AED" />
                      <Text style={styles.moreOptionsSectionTitle}>Blocked</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.moreOptionsItem}
                      onPress={() => {
                        setShowMoreOptionsModal(false);
                        setShowBlockedUsersModal(true);
                        loadBlockedUsers();
                      }}
                    >
                      <UserX width={18} height={18} color="#9CA3AF" />
                      <Text style={styles.moreOptionsItemText}>Blocked Users</Text>
                      <Text style={styles.moreOptionsItemCount}>{blockedUsers.length}</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {/* Block/Unblock Section */}
                  <View style={styles.moreOptionsSection}>
                    <View style={styles.moreOptionsSectionHeader}>
                      <UserX width={20} height={20} color="#7C3AED" />
                      <Text style={styles.moreOptionsSectionTitle}>Actions</Text>
                    </View>
                    {checkingBlocked ? (
                      <View style={styles.moreOptionsItem}>
                        <ActivityIndicator size="small" color="#9CA3AF" />
                        <Text style={styles.moreOptionsItemText}>Checking...</Text>
                      </View>
                    ) : isUserBlocked ? (
                      <TouchableOpacity 
                        style={styles.moreOptionsItem}
                        onPress={() => {
                          setShowMoreOptionsModal(false);
                          handleUnblockUserFromProfile();
                        }}
                      >
                        <UserX width={18} height={18} color="#9CA3AF" />
                        <Text style={styles.moreOptionsItemText}>Unblock User</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        style={styles.moreOptionsItem}
                        onPress={() => {
                          setShowMoreOptionsModal(false);
                          handleBlockUser();
                        }}
                      >
                        <UserX width={18} height={18} color="#FB7185" />
                        <Text style={[styles.moreOptionsItemText, { color: "#FB7185" }]}>Block User</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={styles.moreOptionsItem}
                      onPress={() => {
                        setShowMoreOptionsModal(false);
                        setShowReportModal(true);
                      }}
                    >
                      <Flag width={18} height={18} color="#FB7185" />
                      <Text style={[styles.moreOptionsItemText, { color: "#FB7185" }]}>Report User</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowChangePasswordModal(false)}
        >
          <View style={styles.editProfileModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Password</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowChangePasswordModal(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                style={styles.modalCloseBtn}
              >
                <X width={24} height={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editProfileScrollView} showsVerticalScrollIndicator={true}>
              {/* Old Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter current password"
                    placeholderTextColor="#6B7280"
                    value={oldPassword}
                    onChangeText={setOldPassword}
                    secureTextEntry={!showOldPassword}
                    autoCapitalize="none"
                    returnKeyType="next"
                    blurOnSubmit={true}
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                  <TouchableOpacity
                    onPress={() => setShowOldPassword(!showOldPassword)}
                    style={styles.eyeIcon}
                  >
                    {showOldPassword ? (
                      <EyeOff width={20} height={20} color="#9CA3AF" />
                    ) : (
                      <Eye width={20} height={20} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* New Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter new password"
                    placeholderTextColor="#6B7280"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    returnKeyType="next"
                    blurOnSubmit={true}
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeIcon}
                  >
                    {showNewPassword ? (
                      <EyeOff width={20} height={20} color="#9CA3AF" />
                    ) : (
                      <Eye width={20} height={20} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.inputHint}>Password must be at least 6 characters</Text>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Confirm new password"
                    placeholderTextColor="#6B7280"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    returnKeyType="done"
                    blurOnSubmit={true}
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeIcon}
                  >
                    {showConfirmPassword ? (
                      <EyeOff width={20} height={20} color="#9CA3AF" />
                    ) : (
                      <Eye width={20} height={20} color="#9CA3AF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.saveDetailsButton, changingPassword && styles.saveDetailsButtonDisabled]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Save width={18} height={18} color="#fff" />
                    <Text style={styles.saveDetailsButtonText}>Change Password</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteAccountModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowDeleteAccountModal(false);
          setDeleteAccountPassword('');
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowDeleteAccountModal(false);
            setDeleteAccountPassword('');
          }}
        >
          <View style={styles.editProfileModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Confirm Account Deletion</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteAccountPassword('');
                }}
                style={styles.modalCloseBtn}
              >
                <X width={24} height={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.deleteAccountContent}>
              <Text style={styles.deleteAccountWarning}>
                ⚠️ This action cannot be undone. All your data will be permanently deleted.
              </Text>
              
              <Text style={styles.deleteAccountText}>
                Please enter your password to confirm:
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#6B7280"
                    value={deleteAccountPassword}
                    onChangeText={setDeleteAccountPassword}
                    secureTextEntry={true}
                    autoCapitalize="none"
                    returnKeyType="done"
                    blurOnSubmit={true}
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                </View>
              </View>

              <View style={styles.deleteAccountButtons}>
                <TouchableOpacity
                  style={styles.cancelDeleteButton}
                  onPress={() => {
                    setShowDeleteAccountModal(false);
                    setDeleteAccountPassword('');
                  }}
                >
                  <Text style={styles.cancelDeleteButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.confirmDeleteButton, deletingAccount && styles.confirmDeleteButtonDisabled]}
                  onPress={handleConfirmDeleteAccount}
                  disabled={deletingAccount}
                >
                  {deletingAccount ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.confirmDeleteButtonText}>Delete Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Blocked Users Modal */}
      <Modal
        visible={showBlockedUsersModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBlockedUsersModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowBlockedUsersModal(false)}
        >
          <View style={styles.editProfileModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Blocked Users</Text>
              <TouchableOpacity
                onPress={() => setShowBlockedUsersModal(false)}
                style={styles.modalCloseBtn}
              >
                <X width={24} height={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editProfileScrollView} showsVerticalScrollIndicator={true}>
              {loadingBlockedUsers ? (
                <View style={styles.blockedUsersLoadingContainer}>
                  <ActivityIndicator size="large" color="#7C3AED" />
                  <Text style={styles.blockedUsersLoadingText}>Loading blocked users...</Text>
                </View>
              ) : blockedUsers.length === 0 ? (
                <View style={styles.blockedUsersEmptyContainer}>
                  <UserX width={64} height={64} color="#9CA3AF" />
                  <Text style={styles.blockedUsersEmptyText}>No blocked users</Text>
                  <Text style={styles.blockedUsersEmptySubtext}>You haven't blocked any users yet</Text>
                </View>
              ) : (
                <View style={styles.blockedUsersList}>
                  {blockedUsers.map((user) => (
                    <View key={user.id} style={styles.blockedUserItem}>
                      <Image
                        source={getAvatarImageSource(user.picture)}
                        style={styles.blockedUserAvatar}
                      />
                      <View style={styles.blockedUserInfo}>
                        <Text style={styles.blockedUserName}>{user.name || user.username}</Text>
                        <Text style={styles.blockedUserUsername}>@{user.username}</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.unblockButton,
                          unblockingUserId === user.id && styles.unblockButtonDisabled
                        ]}
                        onPress={() => handleUnblockUser(user.id)}
                        disabled={unblockingUserId === user.id}
                      >
                        {unblockingUserId === user.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.unblockButtonText}>Unblock</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Report User Modal */}
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowReportModal(false);
          setReportReason('');
          setReportDescription('');
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowReportModal(false);
            setReportReason('');
            setReportDescription('');
          }}
        >
          <View style={styles.editProfileModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report User</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowReportModal(false);
                  setReportReason('');
                  setReportDescription('');
                }}
                style={styles.modalCloseBtn}
              >
                <X width={24} height={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editProfileScrollView} showsVerticalScrollIndicator={true}>
              <Text style={styles.reportModalText}>
                Help us understand the problem. Please select a reason and provide details.
              </Text>

              {/* Report Reason */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reason for Reporting</Text>
                <View style={styles.reportReasonContainer}>
                  {['Spam', 'Harassment', 'Inappropriate Content', 'Fake Account', 'Other'].map((reason) => (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.reportReasonButton,
                        reportReason === reason && styles.reportReasonButtonSelected
                      ]}
                      onPress={() => setReportReason(reason)}
                    >
                      <Text style={[
                        styles.reportReasonButtonText,
                        reportReason === reason && styles.reportReasonButtonTextSelected
                      ]}>
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Report Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Additional Details (Optional)</Text>
                <TextInput
                  style={[styles.textInput, { minHeight: 100 }]}
                  placeholder="Provide more details about the issue..."
                  placeholderTextColor="#6B7280"
                  value={reportDescription}
                  onChangeText={setReportDescription}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <Text style={styles.charCount}>{reportDescription.length}/500</Text>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.reportSubmitButton, (!reportReason.trim() || reportingUser) && styles.reportSubmitButtonDisabled]}
                onPress={handleReportUser}
                disabled={!reportReason.trim() || reportingUser}
              >
                {reportingUser ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Flag width={18} height={18} color="#fff" />
                    <Text style={styles.reportSubmitButtonText}>Submit Report</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Friends List Modal */}
      <Modal
        visible={showFriendsListModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFriendsListModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowFriendsListModal(false)}
        >
          <View style={styles.friendsListModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Friends ({friends.length})</Text>
              <TouchableOpacity
                onPress={() => setShowFriendsListModal(false)}
                style={styles.modalCloseBtn}
              >
                <X width={24} height={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.friendsSearchContainer}>
              <Search width={20} height={20} color="#9CA3AF" />
              <TextInput
                style={styles.friendsSearchInput}
                placeholder="Search friends..."
                placeholderTextColor="#9CA3AF"
                value={friendsSearchTerm}
                onChangeText={setFriendsSearchTerm}
                returnKeyType="done"
                blurOnSubmit={true}
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {friendsSearchTerm.length > 0 && (
                <TouchableOpacity onPress={() => setFriendsSearchTerm("")}>
                  <X width={18} height={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Friends List */}
            <ScrollView style={styles.friendsListScrollView}>
              {filteredFriends.length > 0 ? (
                filteredFriends.map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={styles.friendsListItem}
                    onPress={() => {
                      setShowFriendsListModal(false);
                      handleFriendClick(friend.id);
                    }}
                  >
                    <Image source={getAvatarImageSource(friend.avatar)} style={styles.friendsListItemAvatar} />
                    <View style={styles.friendsListItemInfo}>
                      <Text style={styles.friendsListItemName}>{friend.name || friend.username}</Text>
                      {friend.activeTime && (
                        <Text style={styles.friendsListItemTime}>{friend.activeTime}</Text>
                      )}
                    </View>
                    <Users width={20} height={20} color="#7C3AED" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyFriendsList}>
                  <Text style={styles.emptyFriendsText}>
                    {friendsSearchTerm ? "No friends found" : "No friends yet"}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

export default UserProfilePage;

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0B1020" },
  scrollContent: { paddingBottom: 40 },
  
  // Header Styles
  headerWrap: { backgroundColor: "#0B1020" },
  coverPhotoContainer: { position: "relative", width: "100%", height: 280 },
  coverPhoto: { width: "100%", height: "100%", resizeMode: "cover" },
  coverPhotoOverlay: {
    position: "absolute",
    bottom: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  coverPhotoOverlayText: { color: "#fff", fontSize: 13, fontWeight: "600", marginLeft: 6 },
  coverPhotoUploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  profilePictureContainer: { position: "absolute", left: 16, bottom: -60, width: 168, height: 168 },
  profilePicturePlaceholder: {
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderWidth: 4,
    borderColor: "#0B1020",
    justifyContent: "center",
    alignItems: "center",
  },
  addProfileText: { color: "#C4B5FD", marginTop: 8, fontSize: 12, fontWeight: "600" },
  currentlyWatching: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  currentlyWatchingText: { color: "#fff", fontSize: 12 },
  profileInfoSection: { paddingTop: 80, paddingHorizontal: 16, paddingBottom: 16 },
  profileName: { color: "#fff", fontSize: 28, fontWeight: "700", marginBottom: 4 },
  friendsCount: { color: "#C4B5FD", fontSize: 15, marginBottom: 16 },
  actionButtonsRow: { flexDirection: "row", marginBottom: 12 },
  addStoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7C3AED",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    marginRight: 8,
  },
  unfollowBtn: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.2)",
  },
  friendsBtn: {
    backgroundColor: "rgba(52,211,153,0.2)",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.4)",
  },
  unfriendBtn: {
    backgroundColor: "#EF4444",
  },
  messageBtn: {
    width: 48,
    height: 40,
    backgroundColor: "#7C3AED",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  addStoryText: { color: "#fff", fontWeight: "600", fontSize: 14, marginLeft: 6 },
  editProfileModalContent: {
    backgroundColor: "#0B1020",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "90%",
    width: "100%",
  },
  editProfileScrollView: {
    maxHeight: 600,
  },
  inputHint: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 4,
  },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.2)",
    marginRight: 8,
  },
  editProfileText: { color: "#C4B5FD", fontWeight: "600", fontSize: 14, marginLeft: 6 },
  ratingCard: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.2)",
  },
  ratingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  ratingTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  ratingStars: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  ratingStarButton: {
    padding: 4,
  },
  ratingInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  ratingInfoText: {
    color: "#C4B5FD",
    fontSize: 13,
  },
  ratingInfoValue: {
    color: "#fff",
    fontWeight: "600",
  },
  ratingInfoSeparator: {
    color: "#6B7280",
    fontSize: 13,
  },
  moreBtn: {
    backgroundColor: "rgba(15,23,42,0.6)",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.2)",
  },
  lockedProfileIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124,58,237,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  lockedProfileText: { color: "#C4B5FD", fontSize: 13, marginLeft: 8 },
  learnMoreText: { color: "#7C3AED", fontSize: 13, fontWeight: "600", marginLeft: 8 },

  // Tab Navigation
  tabNavWrap: { borderBottomWidth: 1, borderBottomColor: "rgba(148,163,184,0.1)" },
  tabNavInner: { flexDirection: "row", paddingHorizontal: 16 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: "center", position: "relative" },
  tabButtonActive: {},
  tabLabel: { color: "#9CA3AF", fontSize: 15, fontWeight: "500" },
  tabLabelActive: { color: "#7C3AED", fontWeight: "700" },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#7C3AED",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },

  contentWrap: { paddingHorizontal: 16, paddingTop: 16 },

  section: { marginBottom: 18 },

  // Create Post Card
  createPostCard: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.08)",
  },
  createPostHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  createPostAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  createPostInput: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 15,
    marginRight: 12,
  },
  createPostCameraBtn: { padding: 8 },
  removeMediaBtn: {
    padding: 4,
    marginLeft: 8,
  },
  selectedMediaContainer: {
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  selectedMediaImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  selectedMediaVideo: {
    width: '100%',
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedMediaText: {
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
  },
  createPostActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.1)",
    paddingTop: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reelBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    marginRight: 8,
  },
  reelBtnText: { color: "#9CA3AF", fontSize: 14, fontWeight: "600", marginLeft: 6 },
  liveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  liveBtnText: { color: "#9CA3AF", fontSize: 14, fontWeight: "600", marginLeft: 6 },
  postButton: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  postButtonDisabled: {
    backgroundColor: "rgba(124,58,237,0.5)",
    opacity: 0.5,
  },
  postButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  managePostsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    marginTop: 8,
  },
  managePostsText: { color: "#9CA3AF", fontSize: 14, marginLeft: 6 },

  // Details Card
  detailsCard: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.08)",
  },
  detailsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  detailsTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  detailsDots: { color: "#9CA3AF", fontSize: 20 },
  detailsSubtext: { color: "#9CA3AF", fontSize: 14, marginBottom: 12 },
  editDetailsButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(124,58,237,0.2)",
  },
  editDetailsText: {
    color: "#7C3AED",
    fontSize: 14,
    fontWeight: "600",
  },
  editableDetailsContainer: {
    marginTop: 12,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: "top",
  },
  charCount: {
    color: "#6B7280",
    fontSize: 12,
    textAlign: "right",
    marginTop: 4,
  },
  gamesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  gameTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124,58,237,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  gameTagText: {
    color: "#C4B5FD",
    fontSize: 14,
    fontWeight: "500",
  },
  addGameContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  addGameInput: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 14,
  },
  addGameButton: {
    padding: 12,
    backgroundColor: "rgba(124,58,237,0.2)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.4)",
  },
  skillLevelRow: {
    marginBottom: 12,
  },
  skillLevelLabel: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  skillLevelOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  skillLevelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },
  skillLevelButtonActive: {
    backgroundColor: "rgba(124,58,237,0.3)",
    borderColor: "#7C3AED",
  },
  skillLevelButtonText: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "500",
  },
  skillLevelButtonTextActive: {
    color: "#C4B5FD",
    fontWeight: "600",
  },
  saveDetailsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 8,
  },
  saveDetailsButtonDisabled: {
    opacity: 0.6,
  },
  saveDetailsButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  detailsContent: {
    marginTop: 12,
  },
  detailsBio: {
    color: "#E2E8F0",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  detailsGamesSection: {
    marginTop: 12,
  },
  detailsSectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  detailsGamesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailsGameTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124,58,237,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  detailsGameTagText: {
    color: "#C4B5FD",
    fontSize: 14,
    fontWeight: "500",
  },
  detailsSkillLevel: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  editPublicDetailsBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  editPublicDetailsText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  // Friends Card
  friendsCard: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.08)",
  },
  friendsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  friendsTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  findFriendsLink: { color: "#7C3AED", fontSize: 14, fontWeight: "600" },
  friendsHeaderActions: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  friendRequestButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(239,68,68,0.2)",
    borderRadius: 6,
  },
  friendRequestLink: { color: "#EF4444", fontSize: 14, fontWeight: "600" },
  friendsCountText: { color: "#9CA3AF", fontSize: 14, marginBottom: 12 },
  friendsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  friendCard: {
    width: "31%",
    marginBottom: 12,
    alignItems: "center",
  },
  friendCardAvatarContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: 1,
    marginBottom: 8,
    overflow: "hidden",
    borderRadius: 8,
  },
  friendCardAvatar: { 
    width: "100%", 
    height: "100%", 
    borderRadius: 8,
  },
  friendCardName: { color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "center" },
  friendActiveTime: { color: "#9CA3AF", fontSize: 11, marginTop: 4 },
  noFriendsText: { 
    color: "#9CA3AF", 
    fontSize: 14, 
    textAlign: "center", 
    width: "100%",
    paddingVertical: 20,
  },
  friendsActionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  friendsActionBtn: {
    flex: 1,
  },
  seeAllFriendsBtn: {
    backgroundColor: "rgba(15,23,42,0.5)",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  seeAllFriendsText: { color: "#C4B5FD", fontWeight: "600", fontSize: 14 },
  friendRequestBtn: {
    backgroundColor: "rgba(239,68,68,0.2)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  friendRequestBtnText: { color: "#EF4444", fontWeight: "600", fontSize: 14 },

  // Posts Feed
  postsFeed: { marginTop: 12 },
  postCard: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.08)",
  },
  postMediaContainer: {
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  postMediaImage: {
    width: '100%',
    height: 300,
    resizeMode: 'cover',
  },
  postMediaVideoContainer: {
    width: '100%',
    height: 300,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  postMediaVideo: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 12,
    fontSize: 14,
  },
  noPostsContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPostsText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
  },
  noPostsSubtext: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 8,
  },
  postHeader: {
    flexDirection: "row",
    marginBottom: 12,
    position: "relative",
  },
  postAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  postHeaderText: { flex: 1 },
  postAuthorName: { color: "#fff", fontSize: 15, fontWeight: "600", marginBottom: 4 },
  postText: { color: "#C4B5FD", fontSize: 14, marginBottom: 4 },
  postDate: { color: "#9CA3AF", fontSize: 12 },
  postMenuBtn: {
    position: "absolute",
    top: 0,
    right: 0,
    padding: 4,
  },
  postDropdown: {
    position: "absolute",
    top: 40,
    right: 0,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 8,
    padding: 8,
    minWidth: 160,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  dropdownItemText: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 10,
    fontWeight: "500",
  },
  editPostContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.3)",
  },
  editPostLabel: {
    color: "#C4B5FD",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  editPostInput: {
    backgroundColor: "rgba(15,23,42,0.8)",
    borderRadius: 8,
    padding: 12,
    color: "#fff",
    fontSize: 14,
    minHeight: 80,
    maxHeight: 150,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },
  editPostActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    gap: 8,
  },
  editPostCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
  },
  editPostCancelText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
  },
  editPostSaveButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#7C3AED",
  },
  editPostSaveButtonDisabled: {
    opacity: 0.5,
  },
  editPostSaveText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  safetyCheckCard: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 12,
  },
  safetyCheckMap: {
    height: 200,
    backgroundColor: "#1E3A8A",
    justifyContent: "center",
    alignItems: "center",
  },
  safetyCheckIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  safetyCheckFooter: {
    backgroundColor: "rgba(15,23,42,0.8)",
    padding: 16,
  },
  safetyCheckTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 8 },
  safetyCheckPeople: { color: "#9CA3AF", fontSize: 13, marginBottom: 12 },
  safetyCheckAvatars: {
    flexDirection: "row",
    marginBottom: 12,
  },
  safetyCheckAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(196,181,253,0.3)",
    borderWidth: 2,
    borderColor: "#0B1020",
    marginRight: -8,
  },
  postActionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.1)",
  },
  postActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  postActionText: {
    color: "#9CA3AF",
    fontSize: 14,
    marginLeft: 6,
  },
  postActionTextActive: {
    color: "#7C3AED",
  },
  commentsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.1)",
  },
  commentInputContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 8,
  },
  commentInputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 20,
    paddingRight: 4,
    paddingVertical: 4,
  },
  commentInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#fff",
    fontSize: 14,
    maxHeight: 100,
    minHeight: 36,
  },
  commentSendButton: {
    backgroundColor: "#7C3AED",
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
    marginBottom: 2,
  },
  commentSendButtonDisabled: {
    opacity: 0.5,
  },
  commentsList: {
    marginTop: 8,
  },
  commentItem: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 4,
  },
  commentAuthorName: {
    color: "#C4B5FD",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  commentText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: "row",
    gap: 12,
    marginLeft: 8,
    marginTop: 4,
  },
  commentActionButton: {
    paddingVertical: 4,
  },
  commentActionText: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  replyInputContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 8,
    marginLeft: 40,
    gap: 8,
  },
  replyInputAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  replyInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 18,
    paddingRight: 4,
    paddingVertical: 4,
  },
  replyInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: "#fff",
    fontSize: 13,
    maxHeight: 80,
    minHeight: 32,
  },
  replyInputActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  replySendButton: {
    backgroundColor: "#7C3AED",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  replyCloseButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  repliesList: {
    marginTop: 8,
    marginLeft: 40,
  },
  replyItem: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 8,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  replyContent: {
    flex: 1,
  },
  replyBubble: {
    backgroundColor: "rgba(15,23,42,0.5)",
    borderRadius: 12,
    padding: 8,
    marginBottom: 4,
  },
  replyAuthorName: {
    color: "#C4B5FD",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  replyText: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 18,
  },
  noCommentsText: {
    color: "#6B7280",
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 16,
  },

  // Empty Tab
  emptyTab: {
    padding: 40,
    alignItems: "center",
  },
  emptyTabText: { color: "#9CA3AF", fontSize: 16 },

  // Follow to See Posts Card
  followToSeePostsCard: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 12,
    padding: 32,
    marginTop: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  followToSeePostsIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(124,58,237,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  followToSeePostsTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  followToSeePostsText: {
    color: "#9CA3AF",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  followToSeePostsButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7C3AED",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  followToSeePostsButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    marginLeft: 8,
  },

  // Profile Picture Styles
  profilePictureWrapper: {
    width: 168,
    height: 168,
    borderRadius: 84,
    overflow: "hidden",
    position: "relative",
  },
  profilePicture: {
    width: "100%",
    height: "100%",
  },
  profilePictureOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
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
  modalOptions: {
    padding: 20,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.1)",
  },
  deleteOption: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderColor: "rgba(239,68,68,0.2)",
  },
  modalOptionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 12,
  },

  // Avatar Modal Styles
  avatarModalContent: {
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    maxHeight: "80%",
  },
  avatarScrollView: {
    maxHeight: 500,
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    padding: 20,
  },
  avatarOption: {
    width: "30%",
    aspectRatio: 1,
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(148,163,184,0.2)",
    position: "relative",
  },
  selectedAvatar: {
    borderColor: "#7C3AED",
    borderWidth: 3,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(15,23,42,0.5)",
  },
  selectedAvatarCheck: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(15,23,42,0.8)",
    borderRadius: 12,
    padding: 2,
  },
  avatarErrorPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(15,23,42,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarErrorText: {
    color: "#9CA3AF",
    fontSize: 10,
    marginTop: 4,
  },
  emptyAvatarGrid: {
    padding: 40,
    alignItems: "center",
  },
  emptyAvatarText: {
    color: "#9CA3AF",
    fontSize: 16,
  },

  // Enlarged Profile Picture Modal Styles
  enlargedProfileModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  enlargedProfileContainer: {
    width: 300,
    height: 300,
    borderRadius: 150,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "rgba(168, 85, 247, 0.5)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 10,
  },
  enlargedProfileImage: {
    width: "100%",
    height: "100%",
  },

  // Friends List Modal Styles
  friendsListModalContent: {
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    maxHeight: "80%",
  },
  friendsSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.6)",
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.1)",
  },
  friendsSearchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    marginLeft: 12,
  },
  friendsListScrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  friendsListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.1)",
  },
  friendsListItemAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  friendsListItemInfo: {
    flex: 1,
  },
  friendsListItemName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  friendsListItemTime: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  emptyFriendsList: {
    padding: 40,
    alignItems: "center",
  },
  emptyFriendsText: {
    color: "#9CA3AF",
    fontSize: 16,
  },
  // About Section Styles
  aboutCard: {
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.08)",
  },
  aboutTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 16,
  },
  aboutItem: {
    marginBottom: 16,
  },
  aboutLabel: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  aboutValue: {
    color: "#E2E8F0",
    fontSize: 16,
    lineHeight: 22,
  },
  aboutGamesList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  aboutGameTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124,58,237,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  aboutGameTagText: {
    color: "#C4B5FD",
    fontSize: 14,
    fontWeight: "500",
  },
  aboutSkillLevel: {
    color: "#9CA3AF",
    fontSize: 12,
  },
  // More Options Modal Styles
  moreOptionsModalContent: {
    backgroundColor: "#0B1020",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "80%",
    width: "100%",
  },
  moreOptionsScrollView: {
    maxHeight: 600,
  },
  moreOptionsSection: {
    marginBottom: 24,
  },
  moreOptionsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  moreOptionsSectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  moreOptionsItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.1)",
    gap: 12,
  },
  moreOptionsItemText: {
    flex: 1,
    color: "#E2E8F0",
    fontSize: 16,
    fontWeight: "500",
  },
  moreOptionsItemCount: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "600",
  },
  // Password Input Styles
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.1)",
    paddingHorizontal: 12,
  },
  passwordInput: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingVertical: 12,
  },
  eyeIcon: {
    padding: 4,
  },
  // Online Status Dot
  onlineStatusDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#0B1020",
  },
  // Friend Card Online Status
  friendOnlineStatusDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#0B1020",
  },
  // Delete Account Modal Styles
  deleteAccountContent: {
    padding: 20,
  },
  deleteAccountWarning: {
    color: "#FB7185",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  deleteAccountText: {
    color: "#E2E8F0",
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  deleteAccountButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cancelDeleteButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    alignItems: "center",
  },
  cancelDeleteButtonText: {
    color: "#E2E8F0",
    fontSize: 16,
    fontWeight: "600",
  },
  confirmDeleteButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#FB7185",
    borderRadius: 10,
    alignItems: "center",
  },
  confirmDeleteButtonDisabled: {
    opacity: 0.6,
  },
  confirmDeleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  // Blocked Users Modal Styles
  blockedUsersLoadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  blockedUsersLoadingText: {
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 12,
  },
  blockedUsersEmptyContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  blockedUsersEmptyText: {
    color: "#E2E8F0",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  blockedUsersEmptySubtext: {
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  blockedUsersList: {
    padding: 12,
  },
  blockedUserItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.1)",
  },
  blockedUserAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  blockedUserInfo: {
    flex: 1,
  },
  blockedUserName: {
    color: "#E2E8F0",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  blockedUserUsername: {
    color: "#9CA3AF",
    fontSize: 14,
  },
  unblockButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#7C3AED",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 80,
  },
  unblockButtonDisabled: {
    opacity: 0.6,
  },
  unblockButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  // Report Modal Styles
  reportModalText: {
    color: "#E2E8F0",
    fontSize: 14,
    marginBottom: 20,
    textAlign: "center",
  },
  reportReasonContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  reportReasonButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(15,23,42,0.6)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.1)",
  },
  reportReasonButtonSelected: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  reportReasonButtonText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontWeight: "500",
  },
  reportReasonButtonTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
  reportSubmitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FB7185",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 20,
    gap: 8,
  },
  reportSubmitButtonDisabled: {
    opacity: 0.6,
  },
  reportSubmitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
