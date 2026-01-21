import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { getImageUrl } from '../utils/api';
import { io } from 'socket.io-client';
import { API_CONFIG } from '../utils/api';
import {
  getAvatarImageSource,
  localAvatarSources,
  localAvatarUris,
  isLocalAvatarUrl,
  getLocalAvatarFileUri,
} from '../utils/avatarUtils';
import {
  Camera,
  X,
  Edit2,
  Save,
  Lock,
  Trash2,
  Shield,
  Mail,
  User,
  Calendar,
  MapPin,
  MoreVertical,
  CheckCircle2,
  Users,
  ChartBar,
} from 'lucide-react-native';

import { PageType } from '../../types';

interface AdminProfilePageProps {
  goToPage?: (page: PageType, params?: any) => void;
}

const AdminProfilePage: React.FC<AdminProfilePageProps> = ({ goToPage }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showCoverPhotoModal, setShowCoverPhotoModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingCoverPhoto, setUploadingCoverPhoto] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failedAvatars, setFailedAvatars] = useState<Set<number>>(new Set());
  
  // Avatar options - Local avatars from utils/avatar folder
  const avatarOptions = localAvatarUris;
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showMoreOptionsModal, setShowMoreOptionsModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);

  const [editUsername, setEditUsername] = useState('');
  const [editDateOfBirth, setEditDateOfBirth] = useState('');
  const [editName, setEditName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [profileData, setProfileData] = useState({
    username: '',
    fullName: '',
    email: '',
    dateOfBirth: '',
    location: '',
    avatar: '',
    coverPhoto: '',
    createdAt: '',
  });

  // Users list is shown only on AdminUsersPage

  useEffect(() => {
    fetchUserData();
  }, []);


  // Setup socket connection for real-time profile updates
  useEffect(() => {
    if (!userId) return;

    const socketUrl = API_CONFIG.BASE_URL.replace('/api', '');
    const socket = io(socketUrl, {
      auth: {
        userId: userId,
        username: profileData.username || 'admin',
      },
      transports: ['websocket', 'polling'],
    });

      socket.on('profile_updated', (data: any) => {
        if (data.userId === userId && data.type === 'coverPhoto') {
          console.log('📡 Received cover photo update:', data.coverPhoto);
          setProfileData(prev => ({
            ...prev,
            coverPhoto: data.coverPhoto,
          }));
          
          // Update AsyncStorage
          AsyncStorage.getItem('user').then(userData => {
            if (userData) {
              const user = JSON.parse(userData);
              user.coverPhoto = data.coverPhoto;
              AsyncStorage.setItem('user', JSON.stringify(user));
            }
          }).catch(error => {
            console.error('Error updating AsyncStorage:', error);
          });
        }
      });

    socket.on('connect', () => {
      console.log('📡 Socket connected for profile updates');
    });

    socket.on('disconnect', () => {
      console.log('📡 Socket disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, profileData.username]);

  const fetchUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setUserId(user.id || user._id);
        setProfileData({
          username: user.username || '',
          fullName: user.name || user.fullName || '',
          email: user.email || '',
          dateOfBirth: user.dateOfBirth || '',
          location: user.location || '',
          avatar: user.picture || '',
          coverPhoto: user.coverPhoto || 'https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=800',
          createdAt: user.createdAt || '',
        });
        setEditUsername(user.username || '');
        setEditDateOfBirth(user.dateOfBirth || '');
        setEditName(user.name || user.fullName || '');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // (Users list/search removed from this screen)

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera roll permissions to upload images.');
      return false;
    }
    return true;
  };

  const handlePickImage = async (type: 'avatar' | 'cover') => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (type === 'avatar') {
          await handleUploadAvatar(result.assets[0].uri);
          setShowAvatarModal(false);
        } else {
          await handleUploadCoverPhoto(result.assets[0].uri);
          setShowCoverPhotoModal(false);
        }
        setShowImagePickerModal(false);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleSelectAvatar = async (avatarUrl: string, avatarIndex: number) => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please login again.');
      return;
    }

    setShowAvatarModal(false);
    setUploadingImage(true);

    try {
      // Check if this is a local avatar that needs to be uploaded
      const isLocal = isLocalAvatarUrl(avatarUrl) || avatarIndex < localAvatarSources.length;
      
      if (isLocal) {
        // For local avatars, upload the file to server
        console.log('[Avatar Upload] Starting local avatar upload, index:', avatarIndex);
        
        // Get the actual file URI for the local avatar
        const localFileUri = await getLocalAvatarFileUri(avatarIndex);
        
        if (!localFileUri) {
          console.error('[Avatar Upload] Failed to get local file URI');
          Alert.alert('Error', 'Could not load avatar image. Please try again.');
          setUploadingImage(false);
          return;
        }
        
        console.log('[Avatar Upload] Got local file URI:', localFileUri);
        
        // Upload the file using the same method as gallery/camera uploads
        const formData = new FormData();
        const filename = `avatar_${avatarIndex}.jpg`;
        
        formData.append('picture', {
          uri: localFileUri,
          name: filename,
          type: 'image/jpeg',
        } as any);
        
        formData.append('userId', userId);

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
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
              const user = JSON.parse(userData);
              user.picture = pictureUrl;
              await AsyncStorage.setItem('user', JSON.stringify(user));
            }
          } catch (error) {
            console.error('Error updating AsyncStorage:', error);
          }

          Alert.alert('Success', 'Avatar uploaded successfully!');
        } else {
          Alert.alert('Error', response.data.message || 'Failed to upload avatar.');
        }
      } else {
        // For online avatars, save the URL directly (shouldn't happen with local avatars, but handle it)
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
            const userData = await AsyncStorage.getItem('user');
            if (userData) {
              const user = JSON.parse(userData);
              user.picture = avatarUrl;
              await AsyncStorage.setItem('user', JSON.stringify(user));
            }
          } catch (error) {
            console.error('Error updating AsyncStorage:', error);
          }

          Alert.alert('Success', 'Avatar updated successfully!');
        } else {
          Alert.alert('Error', response.data.message || 'Failed to update avatar.');
        }
      }
    } catch (error: any) {
      console.error('Avatar selection error:', error);
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to upload avatar. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUploadAvatar = async (imageUri: string) => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please login again.');
      return;
    }

    setUploadingImage(true);

    try {
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'avatar.jpg';
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
        setProfileData(prev => ({
          ...prev,
          avatar: pictureUrl,
        }));

        try {
          const userData = await AsyncStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            user.picture = pictureUrl;
            await AsyncStorage.setItem('user', JSON.stringify(user));
          }
        } catch (error) {
          console.error('Error updating AsyncStorage:', error);
        }

        Alert.alert('Success', 'Profile picture uploaded successfully!');
      } else {
        Alert.alert('Error', response.data.message || 'Failed to upload profile picture.');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload profile picture. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUploadCoverPhoto = async (imageUri: string) => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please login again.');
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
          const userData = await AsyncStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            user.coverPhoto = coverPhotoUrl;
            await AsyncStorage.setItem('user', JSON.stringify(user));
          }
        } catch (error) {
          console.error('Error updating AsyncStorage:', error);
        }

        Alert.alert('Success', 'Cover photo uploaded successfully!');
      } else {
        Alert.alert('Error', response.data.message || 'Failed to upload cover photo.');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload cover photo. Please try again.');
    } finally {
      setUploadingCoverPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please login again.');
      return;
    }

    if (!editUsername.trim() || !editName.trim()) {
      Alert.alert('Error', 'Please fill in all required fields (Username and Name).');
      return;
    }

    setSavingProfile(true);

    try {
      // Don't send email field - admin cannot change email
      const response = await api.put('/user/profile/update', {
        userId,
        username: editUsername.trim(),
        name: editName.trim(),
        dateOfBirth: editDateOfBirth.trim() || undefined,
      });

      if (response.data.success) {
        // Update local state with response data
        const updatedUser = response.data.data.user;
        setProfileData(prev => ({
          ...prev,
          username: updatedUser.username || editUsername.trim(),
          email: updatedUser.email || prev.email, // Keep existing email
          fullName: updatedUser.name || editName.trim(),
          dateOfBirth: updatedUser.dateOfBirth || editDateOfBirth.trim(),
        }));

        // Update AsyncStorage
        try {
          const userData = await AsyncStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            user.username = updatedUser.username || editUsername.trim();
            // Don't update email - keep existing email
            user.name = updatedUser.name || editName.trim();
            user.dateOfBirth = updatedUser.dateOfBirth || (editDateOfBirth.trim() || undefined);
            await AsyncStorage.setItem('user', JSON.stringify(user));
          }
        } catch (error) {
          console.error('Error updating AsyncStorage:', error);
        }

        // Refresh profile data from backend response
        await fetchUserData();
        
        Alert.alert('Success', 'Profile updated successfully!');
        setShowEditProfileModal(false);
      } else {
        Alert.alert('Error', response.data.message || 'Failed to update profile.');
      }
    } catch (error: any) {
      console.error('Update error:', error);
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to update profile. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please login again.');
      return;
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters long.');
      return;
    }

    setChangingPassword(true);

    try {
      const response = await api.put('/user/change-password', {
        userId,
        oldPassword,
        newPassword,
      });

      if (response.data.success) {
        Alert.alert('Success', 'Password changed successfully!');
        setShowChangePasswordModal(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        Alert.alert('Error', response.data.message || 'Failed to change password.');
      }
    } catch (error: any) {
      console.error('Change password error:', error);
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to change password. Please try again.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please login again.');
      return;
    }

    if (!deleteAccountPassword) {
      Alert.alert('Error', 'Please enter your password to confirm account deletion.');
      return;
    }

    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              const response = await api.delete('/user/account', {
                data: {
                  userId,
                  password: deleteAccountPassword,
                },
              });

              if (response.data.success) {
                Alert.alert('Success', 'Account deleted successfully.');
                // Clear AsyncStorage and navigate to login
                await AsyncStorage.clear();
                if (goToPage) {
                  goToPage('login');
                }
              } else {
                Alert.alert('Error', response.data.message || 'Failed to delete account.');
              }
            } catch (error: any) {
              console.error('Delete account error:', error);
              Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to delete account. Please try again.');
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => {
              setRefreshing(true);
              await fetchUserData();
              setRefreshing(false);
            }} 
            tintColor="#7c3aed" 
          />
        }
      >
        {/* Header */}
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
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator size="large" color="#ffffff" />
                </View>
              )}
              <View style={styles.coverPhotoEditOverlay}>
                <Camera size={20} color="#ffffff" />
              </View>
            </Pressable>
          </View>

          {/* Profile Info */}
          <View style={styles.profileInfoContainer}>
            {/* Avatar */}
            <Pressable
              style={styles.avatarContainer}
              onPress={() => {
                if (!uploadingImage) {
                  setShowImagePickerModal(true);
                }
              }}
              disabled={uploadingImage}
            >
              {profileData.avatar ? (
                <Image 
                  source={getAvatarImageSource(profileData.avatar)} 
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={40} color="#a78bfa" />
                </View>
              )}
              {uploadingImage && (
                <View style={styles.avatarUploadOverlay}>
                  <ActivityIndicator size="small" color="#ffffff" />
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Camera size={16} color="#ffffff" />
              </View>
            </Pressable>

            {/* Admin Badge */}
            <View style={styles.adminBadge}>
              <Shield size={16} color="#f59e0b" />
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>

            {/* Name and Username */}
            <View style={styles.nameContainer}>
              <Text style={styles.fullName}>{profileData.fullName || 'Admin User'}</Text>
              <Text style={styles.username}>@{profileData.username || 'admin'}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => {
        setEditUsername(profileData.username);
        setEditDateOfBirth(profileData.dateOfBirth);
        setEditName(profileData.fullName);
                  setShowEditProfileModal(true);
                }}
              >
                <Edit2 size={16} color="#ffffff" />
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.moreButton}
                onPress={() => setShowMoreOptionsModal(true)}
              >
                <MoreVertical size={20} color="#c4b5fd" />
              </TouchableOpacity>
            </View>

            {/* Analytics Button */}
            <TouchableOpacity
              style={styles.analyticsButton}
              onPress={() => {
                if (goToPage) {
                  goToPage('adminAnalytics');
                }
              }}
            >
              <ChartBar size={18} color="#ffffff" />
              <Text style={styles.analyticsButtonText}>View Analytics & Moderation</Text>
            </TouchableOpacity>

            {/* Profile Info */}
            <View style={styles.infoContainer}>
              {profileData.email && (
                <View style={styles.infoItem}>
                  <Mail size={16} color="#a78bfa" />
                  <Text style={styles.infoText}>{profileData.email}</Text>
                </View>
              )}

              {profileData.dateOfBirth && (
                <View style={styles.infoItem}>
                  <Calendar size={16} color="#a78bfa" />
                  <Text style={styles.infoText}>{profileData.dateOfBirth}</Text>
                </View>
              )}

              {profileData.location && (
                <View style={styles.infoItem}>
                  <MapPin size={16} color="#a78bfa" />
                  <Text style={styles.infoText}>{profileData.location}</Text>
                </View>
              )}

              {profileData.createdAt && (
                <View style={styles.infoItem}>
                  <Calendar size={16} color="#a78bfa" />
                  <Text style={styles.infoText}>
                    Joined {new Date(profileData.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Users */}
          <View style={styles.usersSection}>
            <View style={styles.usersSectionHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.usersSectionTitle}>Users</Text>
                <Text style={styles.usersSectionSubtitle}>Open Users page to view and search all users</Text>
              </View>
              <TouchableOpacity
                onPress={() => goToPage?.('adminUsers')}
                style={styles.seeAllUsersBtn}
              >
                <Text style={styles.seeAllUsersText}>See all</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Image Picker Modal */}
      <Modal
        visible={showImagePickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImagePickerModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowImagePickerModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Profile Picture</Text>
              <TouchableOpacity
                onPress={() => setShowImagePickerModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setShowImagePickerModal(false);
                  handlePickImage('avatar');
                }}
                disabled={uploadingImage}
              >
                <Camera size={20} color="#7C3AED" />
                <Text style={styles.modalOptionText}>Choose from Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setShowImagePickerModal(false);
                  setShowAvatarModal(true);
                }}
                disabled={uploadingImage}
              >
                <User size={20} color="#7C3AED" />
                <Text style={styles.modalOptionText}>Choose Avatar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => setShowImagePickerModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Avatar Selection Modal */}
      <Modal
        visible={showAvatarModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAvatarModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAvatarModal(false)}>
          <View style={styles.avatarModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Avatar</Text>
              <TouchableOpacity
                onPress={() => setShowAvatarModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={24} color="#9CA3AF" />
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
                    // For online images, use URI with getImageUrl to convert localhost URLs
                    imageSource = { uri: getImageUrl(avatar) || avatar };
                  }
                  
                  return (
                    <TouchableOpacity
                      key={`avatar-${index}`}
                      style={[
                        styles.avatarOption,
                        isSelected && styles.selectedAvatar,
                      ]}
                      onPress={() => {
                        handleSelectAvatar(avatar, index);
                      }}
                      disabled={uploadingImage}
                    >
                      {hasFailed ? (
                        <View style={styles.avatarErrorPlaceholder}>
                          <User size={32} color="#9CA3AF" />
                          <Text style={styles.avatarErrorText}>Failed</Text>
                        </View>
                      ) : (
                        <Image 
                          source={imageSource}
                          style={styles.avatarImage}
                          resizeMode="cover"
                          onError={(error) => {
                            console.error(`Avatar ${index} failed to load`);
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
                          <CheckCircle2 size={24} color="#7C3AED" />
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

      {/* Cover Photo Modal */}
      <Modal
        visible={showCoverPhotoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCoverPhotoModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCoverPhotoModal(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Cover Photo</Text>
              <TouchableOpacity
                onPress={() => setShowCoverPhotoModal(false)}
                style={styles.modalCloseBtn}
              >
                <X size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setShowCoverPhotoModal(false);
                  handlePickImage('cover');
                }}
                disabled={uploadingCoverPhoto}
              >
                <Camera size={20} color="#7C3AED" />
                <Text style={styles.modalOptionText}>Choose from Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => setShowCoverPhotoModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfileModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => setShowEditProfileModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editModalScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Username *</Text>
                <TextInput
                  style={styles.input}
                  value={editUsername}
                  onChangeText={setEditUsername}
                  placeholder="Enter username"
                  placeholderTextColor="#6b7280"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter full name"
                  placeholderTextColor="#6b7280"
                />
              </View>

              {/* Email display only - not editable for admin */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email (Cannot be changed)</Text>
                <View style={styles.disabledInput}>
                  <Text style={styles.disabledInputText}>{profileData.email || 'N/A'}</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date of Birth</Text>
                <TextInput
                  style={styles.input}
                  value={editDateOfBirth}
                  onChangeText={setEditDateOfBirth}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#6b7280"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveButton, savingProfile && styles.saveButtonDisabled]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Save size={16} color="#ffffff" />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* More Options Modal */}
      <Modal
        visible={showMoreOptionsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreOptionsModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowMoreOptionsModal(false)}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => {
                setShowMoreOptionsModal(false);
                setShowChangePasswordModal(true);
              }}
            >
              <Lock size={20} color="#c4b5fd" />
              <Text style={styles.modalOptionText}>Change Password</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalOption, styles.deleteOption]}
              onPress={() => {
                setShowMoreOptionsModal(false);
                setShowDeleteAccountModal(true);
              }}
            >
              <Trash2 size={20} color="#ef4444" />
              <Text style={[styles.modalOptionText, styles.deleteOptionText]}>Delete Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => setShowMoreOptionsModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={showChangePasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Change Password</Text>
              <TouchableOpacity
                onPress={() => setShowChangePasswordModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editModalScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Current Password *</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={oldPassword}
                    onChangeText={setOldPassword}
                    placeholder="Enter current password"
                    placeholderTextColor="#6b7280"
                    secureTextEntry={!showOldPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowOldPassword(!showOldPassword)}
                    style={styles.passwordToggle}
                  >
                    <Text style={styles.passwordToggleText}>{showOldPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>New Password *</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor="#6b7280"
                    secureTextEntry={!showNewPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.passwordToggle}
                  >
                    <Text style={styles.passwordToggleText}>{showNewPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm New Password *</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor="#6b7280"
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.passwordToggle}
                  >
                    <Text style={styles.passwordToggleText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, changingPassword && styles.saveButtonDisabled]}
                onPress={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Lock size={16} color="#ffffff" />
                    <Text style={styles.saveButtonText}>Change Password</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteAccountModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDeleteAccountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Delete Account</Text>
              <TouchableOpacity
                onPress={() => setShowDeleteAccountModal(false)}
                style={styles.closeButton}
              >
                <X size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.editModalScrollView} showsVerticalScrollIndicator={false}>
              <Text style={styles.warningText}>
                This action cannot be undone. All your data will be permanently deleted.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Enter Password to Confirm *</Text>
                <TextInput
                  style={styles.input}
                  value={deleteAccountPassword}
                  onChangeText={setDeleteAccountPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#6b7280"
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.deleteAccountButton, deletingAccount && styles.saveButtonDisabled]}
                onPress={handleDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Trash2 size={16} color="#ffffff" />
                    <Text style={styles.deleteAccountButtonText}>Delete Account</Text>
                  </>
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
  headerWrap: {
    backgroundColor: 'transparent',
  },
  coverPhotoContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1e293b',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverPhotoEditOverlay: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 8,
  },
  profileInfoContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    marginTop: -60,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#0f172a',
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
  avatarUploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#7c3aed',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0f172a',
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  adminBadgeText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  nameContainer: {
    marginTop: 16,
  },
  fullName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  username: {
    fontSize: 16,
    color: '#a78bfa',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  moreButton: {
    backgroundColor: 'rgba(196, 181, 253, 0.1)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.2)',
  },
  analyticsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 12,
  },
  analyticsButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoContainer: {
    marginTop: 24,
    gap: 12,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
    gap: 12,
  },
  modalOptionText: {
    color: '#ffffff',
    fontSize: 16,
  },
  modalCancelText: {
    color: '#a78bfa',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteOption: {
    borderBottomWidth: 0,
  },
  deleteOptionText: {
    color: '#ef4444',
  },
  editModalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
    width: '100%',
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  editModalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  editModalScrollView: {
    maxHeight: 600,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 12,
    padding: 14,
    color: '#ffffff',
    fontSize: 16,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 12,
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    color: '#ffffff',
    fontSize: 16,
  },
  passwordToggle: {
    padding: 8,
  },
  passwordToggleText: {
    color: '#a78bfa',
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
    gap: 8,
  },
  deleteAccountButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  warningText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  disabledInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 12,
    padding: 14,
    opacity: 0.6,
  },
  disabledInputText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalOptions: {
    gap: 12,
  },
  avatarModalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
    width: '100%',
  },
  avatarScrollView: {
    maxHeight: 500,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  avatarOption: {
    width: '30%',
    aspectRatio: 1,
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  selectedAvatar: {
    borderColor: '#7c3aed',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  selectedAvatarCheck: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 12,
    padding: 2,
  },
  avatarErrorPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarErrorText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 4,
  },
  emptyAvatarGrid: {
    width: '100%',
    padding: 40,
    alignItems: 'center',
  },
  emptyAvatarText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  usersSection: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  usersSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  usersSectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  usersSectionSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  seeAllUsersBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.15)',
  },
  seeAllUsersText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default AdminProfilePage;

