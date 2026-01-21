import React, { useState, useEffect } from 'react';
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
  BarChart3,
} from 'lucide-react';
import { apiRequest, getImageUrl, getStoredUser, API_BASE_URL } from '../utils/api';
import { io } from 'socket.io-client';
import {
  localAvatarSources,
  localAvatarUris,
  isLocalAvatarUrl,
  getLocalAvatarFileUri,
} from '../utils/avatarUtils';

interface AdminProfilePageProps {
  goToPage?: (page: string, params?: any) => void;
}

const AdminProfilePage: React.FC<AdminProfilePageProps> = ({ goToPage }) => {
  const [userId, setUserId] = useState<string | null>(null);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showCoverPhotoModal, setShowCoverPhotoModal] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingCoverPhoto, setUploadingCoverPhoto] = useState(false);
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

  useEffect(() => {
    fetchUserData();
  }, []);

  // Setup socket connection for real-time profile updates
  useEffect(() => {
    if (!userId) return;

    const socketUrl = API_BASE_URL.replace('/api', '');
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
        
        // Update localStorage
        try {
          const user = getStoredUser();
          if (user) {
            const updatedUser = { ...user, coverPhoto: data.coverPhoto };
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
        } catch (error) {
          console.error('Error updating localStorage:', error);
        }
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
      const user = getStoredUser();
      if (user) {
        setUserId(user.id || '');
        setProfileData({
          username: user.username || '',
          fullName: user.name || '',
          email: user.email || '',
          dateOfBirth: user.dateOfBirth || '',
          location: (user as any).location || '',
          avatar: user.picture || '',
          coverPhoto: user.coverPhoto || 'https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=800',
          createdAt: user.createdAt || '',
        });
        setEditUsername(user.username || '');
        setEditDateOfBirth(user.dateOfBirth || '');
        setEditName(user.name || '');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Users are managed in the dedicated AdminUsersPage (not rendered here anymore)

  const handlePickImage = async (type: 'avatar' | 'cover') => {
    return new Promise<void>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (file) {
          if (type === 'avatar') {
            await handleUploadAvatar(file);
            setShowAvatarModal(false);
          } else {
            await handleUploadCoverPhoto(file);
            setShowCoverPhotoModal(false);
          }
          setShowImagePickerModal(false);
        }
        resolve();
      };
      
      input.click();
    });
  };

  const handleSelectAvatar = async (avatarUrl: string, avatarIndex: number) => {
    if (!userId) {
      alert('Error: User ID not found. Please login again.');
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
          alert('Error: Could not load avatar image. Please try again.');
          setUploadingImage(false);
          return;
        }
        
        console.log('[Avatar Upload] Got local file URI:', localFileUri);
        
        // For web, we need to fetch the image and convert it to a File object
        const response = await fetch(localFileUri);
        const blob = await response.blob();
        const file = new File([blob], `avatar_${avatarIndex}.jpg`, { type: 'image/jpeg' });
        
        // Upload the file using FormData
        const formData = new FormData();
        formData.append('picture', file);
        formData.append('userId', userId);

        const uploadResponse = await apiRequest<{ picture: string }>('/user/profile/picture', {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.success && uploadResponse.data) {
          const pictureUrl = uploadResponse.data.picture;
          
          // Update local state with server URL
          setProfileData(prev => ({
            ...prev,
            avatar: pictureUrl,
          }));

          // Update localStorage with server URL
          try {
            const user = getStoredUser();
            if (user) {
              const updatedUser = { ...user, picture: pictureUrl };
              localStorage.setItem('user', JSON.stringify(updatedUser));
            }
          } catch (error) {
            console.error('Error updating localStorage:', error);
          }

          alert('Success: Avatar uploaded successfully!');
        } else {
          alert('Error: ' + (uploadResponse.message || 'Failed to upload avatar.'));
        }
      } else {
        // For online avatars, save the URL directly
        const response = await apiRequest<{ picture: string }>('/user/profile/picture', {
          method: 'PUT',
          body: JSON.stringify({
            userId: userId,
            picture: avatarUrl,
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.success && response.data) {
          // Update local state
          setProfileData(prev => ({
            ...prev,
            avatar: avatarUrl,
          }));

          // Update localStorage
          try {
            const user = getStoredUser();
            if (user) {
              const updatedUser = { ...user, picture: avatarUrl };
              localStorage.setItem('user', JSON.stringify(updatedUser));
            }
          } catch (error) {
            console.error('Error updating localStorage:', error);
          }

          alert('Success: Avatar updated successfully!');
        } else {
          alert('Error: ' + (response.message || 'Failed to update avatar.'));
        }
      }
    } catch (error: any) {
      console.error('Avatar selection error:', error);
      alert('Error: ' + (error.response?.data?.message || error.message || 'Failed to upload avatar. Please try again.'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUploadAvatar = async (file: File) => {
    if (!userId) {
      alert('Error: User ID not found. Please login again.');
      return;
    }

    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('picture', file);
      formData.append('userId', userId);

      const response = await apiRequest<{ picture: string }>('/user/profile/picture', {
        method: 'POST',
        body: formData,
      });

      if (response.success && response.data) {
        const pictureUrl = response.data.picture;
        setProfileData(prev => ({
          ...prev,
          avatar: pictureUrl,
        }));

        try {
          const user = getStoredUser();
          if (user) {
            const updatedUser = { ...user, picture: pictureUrl };
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
        } catch (error) {
          console.error('Error updating localStorage:', error);
        }

        alert('Success: Profile picture uploaded successfully!');
      } else {
        alert('Error: ' + (response.message || 'Failed to upload profile picture.'));
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert('Upload Failed: ' + (error.message || 'Failed to upload profile picture. Please try again.'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUploadCoverPhoto = async (file: File) => {
    if (!userId) {
      alert('Error: User ID not found. Please login again.');
      return;
    }

    setUploadingCoverPhoto(true);

    try {
      const formData = new FormData();
      formData.append('coverPhoto', file);
      formData.append('userId', userId);

      const response = await apiRequest<{ coverPhoto: string }>('/user/profile/cover-photo', {
        method: 'POST',
        body: formData,
      });

      if (response.success && response.data) {
        const coverPhotoUrl = response.data.coverPhoto;
        setProfileData(prev => ({
          ...prev,
          coverPhoto: coverPhotoUrl,
        }));

        try {
          const user = getStoredUser();
          if (user) {
            const updatedUser = { ...user, coverPhoto: coverPhotoUrl };
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }
        } catch (error) {
          console.error('Error updating localStorage:', error);
        }

        alert('Success: Cover photo uploaded successfully!');
      } else {
        alert('Error: ' + (response.message || 'Failed to upload cover photo.'));
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert('Upload Failed: ' + (error.message || 'Failed to upload cover photo. Please try again.'));
    } finally {
      setUploadingCoverPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!userId) {
      alert('Error: User ID not found. Please login again.');
      return;
    }

    if (!editUsername.trim() || !editName.trim()) {
      alert('Error: Please fill in all required fields (Username and Name).');
      return;
    }

    setSavingProfile(true);

    try {
      // Don't send email field - admin cannot change email
      const response = await apiRequest<{ user: any }>('/user/profile/update', {
        method: 'PUT',
        body: JSON.stringify({
          userId,
          username: editUsername.trim(),
          name: editName.trim(),
          dateOfBirth: editDateOfBirth.trim() || undefined,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.success && response.data) {
        // Update local state with response data
        const updatedUser = response.data.user;
        setProfileData(prev => ({
          ...prev,
          username: updatedUser.username || editUsername.trim(),
          email: updatedUser.email || prev.email, // Keep existing email
          fullName: updatedUser.name || editName.trim(),
          dateOfBirth: updatedUser.dateOfBirth || editDateOfBirth.trim(),
        }));

        // Update localStorage
        try {
          const user = getStoredUser();
          if (user) {
            const updatedUserData = {
              ...user,
              username: updatedUser.username || editUsername.trim(),
              name: updatedUser.name || editName.trim(),
              dateOfBirth: updatedUser.dateOfBirth || (editDateOfBirth.trim() || undefined),
            };
            localStorage.setItem('user', JSON.stringify(updatedUserData));
          }
        } catch (error) {
          console.error('Error updating localStorage:', error);
        }

        // Refresh profile data from backend response
        await fetchUserData();
        
        alert('Success: Profile updated successfully!');
        setShowEditProfileModal(false);
      } else {
        alert('Error: ' + (response.message || 'Failed to update profile.'));
      }
    } catch (error: any) {
      console.error('Update error:', error);
      alert('Error: ' + (error.response?.data?.message || error.message || 'Failed to update profile. Please try again.'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!userId) {
      alert('Error: User ID not found. Please login again.');
      return;
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
      alert('Error: Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('Error: New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      alert('Error: New password must be at least 6 characters long.');
      return;
    }

    setChangingPassword(true);

    try {
      const response = await apiRequest('/user/change-password', {
        method: 'PUT',
        body: JSON.stringify({
          userId,
          oldPassword,
          newPassword,
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.success) {
        alert('Success: Password changed successfully!');
        setShowChangePasswordModal(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert('Error: ' + (response.message || 'Failed to change password.'));
      }
    } catch (error: any) {
      console.error('Change password error:', error);
      alert('Error: ' + (error.response?.data?.message || error.message || 'Failed to change password. Please try again.'));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId) {
      alert('Error: User ID not found. Please login again.');
      return;
    }

    if (!deleteAccountPassword) {
      alert('Error: Please enter your password to confirm account deletion.');
      return;
    }

    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      setDeletingAccount(true);
      try {
        const response = await apiRequest('/user/account', {
          method: 'DELETE',
          body: JSON.stringify({
            userId,
            password: deleteAccountPassword,
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.success) {
          alert('Success: Account deleted successfully.');
          // Clear localStorage and navigate to login
          localStorage.clear();
          if (goToPage) {
            goToPage('login');
          } else {
            window.location.href = '/';
          }
        } else {
          alert('Error: ' + (response.message || 'Failed to delete account.'));
        }
      } catch (error: any) {
        console.error('Delete account error:', error);
        alert('Error: ' + (error.response?.data?.message || error.message || 'Failed to delete account. Please try again.'));
      } finally {
        setDeletingAccount(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="overflow-y-auto">
        {/* Header */}
        <div className="bg-transparent">
          {/* Cover Photo */}
          <div className="relative w-full h-[280px]">
            <button
              onClick={() => {
                if (!uploadingCoverPhoto) {
                  setShowCoverPhotoModal(true);
                }
              }}
              disabled={uploadingCoverPhoto}
              className="relative w-full h-full"
            >
              <img
                src={getImageUrl(profileData.coverPhoto) || profileData.coverPhoto}
                alt="Cover"
                className="w-full h-full object-cover"
              />
              {uploadingCoverPhoto && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              )}
              <div className="absolute bottom-3 right-3 bg-black/60 p-2 rounded-lg">
                <Camera size={20} color="#ffffff" />
              </div>
            </button>
          </div>

          {/* Profile Info */}
          <div className="px-5 pb-6 -mt-15">
            {/* Avatar */}
            <div className="relative inline-block">
              <button
                onClick={() => {
                  if (!uploadingImage) {
                    setShowImagePickerModal(true);
                  }
                }}
                disabled={uploadingImage}
                className="relative w-32 h-32 rounded-full border-4 border-slate-900 bg-slate-800 overflow-hidden"
              >
                {profileData.avatar ? (
                  <img
                    src={getImageUrl(profileData.avatar) || profileData.avatar}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800">
                    <User size={40} color="#a78bfa" />
                  </div>
                )}
                {uploadingImage && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  </div>
                )}
                <div className="absolute bottom-0 right-0 bg-purple-600 w-9 h-9 rounded-full flex items-center justify-center border-3 border-slate-900">
                  <Camera size={16} color="#ffffff" />
                </div>
              </button>
            </div>

            {/* Admin Badge */}
            <div className="flex items-center self-start bg-amber-500/20 px-3 py-1.5 rounded-full mt-3">
              <Shield size={16} color="#f59e0b" />
              <span className="text-amber-500 text-sm font-semibold ml-1.5">Admin</span>
            </div>

            {/* Name and Username */}
            <div className="mt-4">
              <h1 className="text-2xl font-bold text-white">{profileData.fullName || 'Admin User'}</h1>
              <p className="text-purple-400 mt-1">@{profileData.username || 'admin'}</p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 mt-5">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setEditUsername(profileData.username);
                    setEditDateOfBirth(profileData.dateOfBirth);
                    setEditName(profileData.fullName);
                    setShowEditProfileModal(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 py-3 rounded-xl"
                >
                <Edit2 size={16} color="#ffffff" />
                <span className="text-white font-semibold">Edit Profile</span>
              </button>

              <button
                onClick={() => setShowMoreOptionsModal(true)}
                className="bg-purple-400/10 hover:bg-purple-400/20 p-3 rounded-xl border border-purple-400/20"
              >
                <MoreVertical size={20} color="#c4b5fd" />
              </button>
            </div>

            {/* Analytics Button */}
            <button
              onClick={() => {
                if (goToPage) {
                  goToPage('adminAnalytics');
                }
              }}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 py-3 rounded-xl mt-3 transition-all"
            >
              <BarChart3 size={18} color="#ffffff" />
              <span className="text-white font-semibold">View Analytics & Moderation</span>
            </button>
            </div>

            {/* Profile Info */}
            <div className="mt-6 space-y-3">
              {profileData.email && (
                <div className="flex items-center gap-3">
                  <Mail size={16} color="#a78bfa" />
                  <span className="text-slate-300">{profileData.email}</span>
                </div>
              )}

              {profileData.dateOfBirth && (
                <div className="flex items-center gap-3">
                  <Calendar size={16} color="#a78bfa" />
                  <span className="text-slate-300">{profileData.dateOfBirth}</span>
                </div>
              )}

              {profileData.location && (
                <div className="flex items-center gap-3">
                  <MapPin size={16} color="#a78bfa" />
                  <span className="text-slate-300">{profileData.location}</span>
                </div>
              )}

              {profileData.createdAt && (
                <div className="flex items-center gap-3">
                  <Calendar size={16} color="#a78bfa" />
                  <span className="text-slate-300">
                    Joined {new Date(profileData.createdAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Picker Modal */}
      {showImagePickerModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setShowImagePickerModal(false)}>
          <div className="w-full bg-slate-800 rounded-t-2xl p-5 pb-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-white">Profile Picture</h2>
              <button onClick={() => setShowImagePickerModal(false)} className="p-1">
                <X size={24} color="#9CA3AF" />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowImagePickerModal(false);
                  handlePickImage('avatar');
                }}
                disabled={uploadingImage}
                className="w-full flex items-center gap-3 py-4 border-b border-slate-700/50"
              >
                <Camera size={20} color="#7C3AED" />
                <span className="text-white">Choose from Gallery</span>
              </button>

              <button
                onClick={() => {
                  setShowImagePickerModal(false);
                  setShowAvatarModal(true);
                }}
                disabled={uploadingImage}
                className="w-full flex items-center gap-3 py-4 border-b border-slate-700/50"
              >
                <User size={20} color="#7C3AED" />
                <span className="text-white">Choose Avatar</span>
              </button>

              <button
                onClick={() => setShowImagePickerModal(false)}
                className="w-full py-4"
              >
                <span className="text-purple-400 font-semibold">Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Selection Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setShowAvatarModal(false)}>
          <div className="w-full bg-slate-800 rounded-t-2xl p-5 max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-white">Choose Avatar</h2>
              <button onClick={() => setShowAvatarModal(false)} className="p-1">
                <X size={24} color="#9CA3AF" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[60vh]">
              {avatarOptions.length > 0 ? (
                <div className="grid grid-cols-3 gap-4 py-2">
                  {avatarOptions.map((avatar, index) => {
                    const isSelected = profileData.avatar === avatar;
                    const hasFailed = failedAvatars.has(index);
                    const isLocalImage = index < localAvatarSources.length;
                    
                    // Determine image source
                    let imageSource: string;
                    if (isLocalImage) {
                      // For local images, use the source directly (it's already a string URL)
                      imageSource = localAvatarSources[index] || avatar;
                    } else {
                      // For online images, use URI with getImageUrl to convert localhost URLs
                      imageSource = getImageUrl(avatar) || avatar;
                    }
                    
                    return (
                      <button
                        key={`avatar-${index}`}
                        onClick={() => {
                          handleSelectAvatar(avatar, index);
                        }}
                        disabled={uploadingImage}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 ${
                          isSelected ? 'border-purple-600' : 'border-transparent'
                        }`}
                      >
                        {hasFailed ? (
                          <div className="w-full h-full bg-slate-700 flex flex-col items-center justify-center">
                            <User size={32} color="#9CA3AF" />
                            <span className="text-slate-400 text-xs mt-1">Failed</span>
                          </div>
                        ) : (
                          <img
                            src={imageSource}
                            alt={`Avatar ${index}`}
                            className="w-full h-full object-cover"
                            onError={() => {
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
                          <div className="absolute top-1 right-1 bg-slate-900/80 rounded-lg p-0.5">
                            <CheckCircle2 size={24} color="#7C3AED" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="w-full py-10 text-center">
                  <span className="text-slate-400">No avatars available</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cover Photo Modal */}
      {showCoverPhotoModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setShowCoverPhotoModal(false)}>
          <div className="w-full bg-slate-800 rounded-t-2xl p-5 pb-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-white">Change Cover Photo</h2>
              <button onClick={() => setShowCoverPhotoModal(false)} className="p-1">
                <X size={24} color="#9CA3AF" />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowCoverPhotoModal(false);
                  handlePickImage('cover');
                }}
                disabled={uploadingCoverPhoto}
                className="w-full flex items-center gap-3 py-4 border-b border-slate-700/50"
              >
                <Camera size={20} color="#7C3AED" />
                <span className="text-white">Choose from Gallery</span>
              </button>

              <button
                onClick={() => setShowCoverPhotoModal(false)}
                className="w-full py-4"
              >
                <span className="text-purple-400 font-semibold">Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setShowEditProfileModal(false)}>
          <div className="w-full bg-slate-800 rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-bold text-white">Edit Profile</h2>
              <button onClick={() => setShowEditProfileModal(false)} className="p-1">
                <X size={24} color="#ffffff" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">Username *</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full bg-slate-900 border border-slate-700/20 rounded-xl px-3.5 py-3.5 text-white text-base"
                />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">Full Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full bg-slate-900 border border-slate-700/20 rounded-xl px-3.5 py-3.5 text-white text-base"
                />
              </div>

              {/* Email display only - not editable for admin */}
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">Email (Cannot be changed)</label>
                <div className="w-full bg-slate-900 border border-slate-700/20 rounded-xl px-3.5 py-3.5 opacity-60">
                  <span className="text-slate-400 text-base">{profileData.email || 'N/A'}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">Date of Birth</label>
                <input
                  type="text"
                  value={editDateOfBirth}
                  onChange={(e) => setEditDateOfBirth(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  className="w-full bg-slate-900 border border-slate-700/20 rounded-xl px-3.5 py-3.5 text-white text-base"
                />
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className={`w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 py-3.5 rounded-xl mt-2.5 ${
                  savingProfile ? 'opacity-60' : ''
                }`}
              >
                {savingProfile ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Save size={16} color="#ffffff" />
                    <span className="text-white font-semibold">Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* More Options Modal */}
      {showMoreOptionsModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setShowMoreOptionsModal(false)}>
          <div className="w-full bg-slate-800 rounded-t-2xl p-5 pb-10" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowMoreOptionsModal(false);
                  setShowChangePasswordModal(true);
                }}
                className="w-full flex items-center gap-3 py-4 border-b border-slate-700/50"
              >
                <Lock size={20} color="#c4b5fd" />
                <span className="text-white">Change Password</span>
              </button>
              <button
                onClick={() => {
                  setShowMoreOptionsModal(false);
                  setShowDeleteAccountModal(true);
                }}
                className="w-full flex items-center gap-3 py-4 border-b border-slate-700/50"
              >
                <Trash2 size={20} color="#ef4444" />
                <span className="text-red-400">Delete Account</span>
              </button>
              <button
                onClick={() => setShowMoreOptionsModal(false)}
                className="w-full py-4"
              >
                <span className="text-purple-400 font-semibold">Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setShowChangePasswordModal(false)}>
          <div className="w-full bg-slate-800 rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-bold text-white">Change Password</h2>
              <button onClick={() => setShowChangePasswordModal(false)} className="p-1">
                <X size={24} color="#ffffff" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">Current Password *</label>
                <div className="flex items-center bg-slate-900 border border-slate-700/20 rounded-xl pr-3">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="flex-1 bg-transparent px-3.5 py-3.5 text-white text-base outline-none"
                  />
                  <button
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="px-2 py-1"
                  >
                    <span className="text-purple-400 text-sm font-semibold">{showOldPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">New Password *</label>
                <div className="flex items-center bg-slate-900 border border-slate-700/20 rounded-xl pr-3">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="flex-1 bg-transparent px-3.5 py-3.5 text-white text-base outline-none"
                  />
                  <button
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="px-2 py-1"
                  >
                    <span className="text-purple-400 text-sm font-semibold">{showNewPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">Confirm New Password *</label>
                <div className="flex items-center bg-slate-900 border border-slate-700/20 rounded-xl pr-3">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="flex-1 bg-transparent px-3.5 py-3.5 text-white text-base outline-none"
                  />
                  <button
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="px-2 py-1"
                  >
                    <span className="text-purple-400 text-sm font-semibold">{showConfirmPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
              </div>

              <button
                onClick={handleChangePassword}
                disabled={changingPassword}
                className={`w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 py-3.5 rounded-xl mt-2.5 ${
                  changingPassword ? 'opacity-60' : ''
                }`}
              >
                {changingPassword ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Lock size={16} color="#ffffff" />
                    <span className="text-white font-semibold">Change Password</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setShowDeleteAccountModal(false)}>
          <div className="w-full bg-slate-800 rounded-t-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-bold text-white">Delete Account</h2>
              <button onClick={() => setShowDeleteAccountModal(false)} className="p-1">
                <X size={24} color="#ffffff" />
              </button>
            </div>

            <div className="space-y-5">
              <p className="text-red-400 text-sm text-center leading-5">
                This action cannot be undone. All your data will be permanently deleted.
              </p>

              <div>
                <label className="block text-slate-300 text-sm font-semibold mb-2">Enter Password to Confirm *</label>
                <input
                  type="password"
                  value={deleteAccountPassword}
                  onChange={(e) => setDeleteAccountPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-slate-900 border border-slate-700/20 rounded-xl px-3.5 py-3.5 text-white text-base"
                />
              </div>

              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className={`w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 py-3.5 rounded-xl mt-2.5 ${
                  deletingAccount ? 'opacity-60' : ''
                }`}
              >
                {deletingAccount ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Trash2 size={16} color="#ffffff" />
                    <span className="text-white font-semibold">Delete Account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users */}
      <div className="px-5 py-6 mt-6 border-t border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Users</h2>
            <p className="text-slate-400 text-sm">Open the Users page to view and search all users.</p>
          </div>
          <button
            onClick={() => goToPage?.('adminUsers')}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 rounded-lg text-sm text-white font-semibold"
          >
            See all users
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminProfilePage;

