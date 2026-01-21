import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Activity,
  Camera,
  CheckCircle2,
  Edit3,
  Flag,
  Image as ImageIcon,
  MessageCircle,
  MoreHorizontal,
  Save,
  Send,
  Trash2,
  User,
  UserPlus,
  UserX,
  X,
  Eye,
  EyeOff,
  Star,
} from 'lucide-react';
import { apiRequest as apiFetch, getImageUrl, submitRating, getRating } from '../utils/api';
import { getAvatarImageSource } from '../utils/avatarUtils';

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

export interface UserProfilePageProps {
  globalSettings: GlobalSettings;
  updateGlobalSettings: (settings: Partial<GlobalSettings>) => void;
  targetUserId?: string;
  goToPage?: (page: string, params?: any) => void;
}

async function apiRequest(path: string, init?: RequestInit) {
  const resp = await apiFetch<any>(path, init as any);
  if (!resp.success) {
    throw new Error(resp.message || 'Request failed');
  }
  return resp;
}

function downloadJsonFile(fileName: string, payload: any) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const PostVideoPlayer: React.FC<{ videoUri: string }> = ({ videoUri }) => {
  return (
    <div className="w-full h-[300px] bg-black rounded-lg overflow-hidden">
      <video className="w-full h-full" controls playsInline src={videoUri} />
    </div>
  );
};

const UserProfilePage: React.FC<UserProfilePageProps> = ({
  globalSettings,
  updateGlobalSettings,
  targetUserId,
  goToPage,
}) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'photos' | 'reels' | 'about'>('posts');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showCoverPhotoModal, setShowCoverPhotoModal] = useState(false);
  
  // Edit profile state
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editName, setEditName] = useState('');
  const [editDateOfBirth, setEditDateOfBirth] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Avatar options
  const avatarOptions = [
    "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=300",
    "https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=300",
    "https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=300",
    "https://images.pexels.com/photos/1040881/pexels-photo-1040881.jpeg?auto=compress&cs=tinysrgb&w=300",
    "https://images.pexels.com/photos/1043473/pexels-photo-1043473.jpeg?auto=compress&cs=tinysrgb&w=300",
    "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=300",
  ];

  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingCoverPhoto, setUploadingCoverPhoto] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(targetUserId || null);

  const [friendRequestStatus, setFriendRequestStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'friends'>('none');
  const [isFriendRequestLoading, setIsFriendRequestLoading] = useState(false);

  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [bio, setBio] = useState('');
  const [favoriteGames, setFavoriteGames] = useState<string[]>([]);
  const [skillLevels, setSkillLevels] = useState<{ [key: string]: string }>({});
  const [newGame, setNewGame] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);

  const [showMoreOptionsModal, setShowMoreOptionsModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [showBlockedUsersModal, setShowBlockedUsersModal] = useState(false);
  const [loadingBlockedUsers, setLoadingBlockedUsers] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: string; username: string; name: string; picture: string; isActive?: boolean }>>([]);
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
  const [selectedMediaFile, setSelectedMediaFile] = useState<File | null>(null);
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
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [loadingRating, setLoadingRating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const postMediaInputRef = useRef<HTMLInputElement | null>(null);

  const tabs = useMemo(() => ([
    { id: 'posts', label: 'Posts' as const },
    { id: 'about', label: 'About' as const },
  ]), []);

  const [profileData, setProfileData] = useState({
    username: globalSettings.displayName || 'User',
    fullName: 'User',
    bio: '',
    location: globalSettings.location || '',
    country: globalSettings.country || '',
    region: globalSettings.region || '',
    avatar: '',
    coverPhoto:'',
    email: '',
    dateOfBirth: '',
    createdAt: '',
    isActive: true,
    friendsCount: 0,
    favoriteGames: [] as string[],
    skillLevels: {} as { [key: string]: string },
  });

  const [friends, setFriends] = useState<Array<{ id: string; name: string; username: string; avatar: string; activeTime?: string; isActive?: boolean }>>([]);

  const isOwnProfile = !!(userId && profileUserId && userId === profileUserId);
  const shouldShowPosts = isOwnProfile || friendRequestStatus === 'friends';

  const loadProfileData = async (pid: string) => {
    const resp = await apiRequest(`/user/profile/${pid}`);
    const user = (resp as any).data?.user;
      setProfileData(prev => ({
        ...prev,
        username: user?.username || user?.name || prev.username,
        fullName: user?.name || user?.username || prev.fullName,
        avatar: user?.picture || user?.avatar || prev.avatar,
        coverPhoto: user?.coverPhoto || prev.coverPhoto,
        friendsCount: user?.friendsCount || 0,
        bio: user?.bio || prev.bio,
        favoriteGames: user?.favoriteGames || prev.favoriteGames || [],
        skillLevels: user?.skillLevels && typeof user.skillLevels === 'object' && !Array.isArray(user.skillLevels) ? user.skillLevels : (prev.skillLevels || {}),
        email: user?.email || prev.email,
        dateOfBirth: user?.dateOfBirth || prev.dateOfBirth,
        createdAt: user?.createdAt || prev.createdAt,
        isActive: user?.isActive !== undefined ? user.isActive : prev.isActive,
      }));

      setBio(user?.bio || '');
      setFavoriteGames(user?.favoriteGames || []);
      setSkillLevels(user?.skillLevels && typeof user.skillLevels === 'object' && !Array.isArray(user.skillLevels) ? user.skillLevels : {});
      
      // Set edit profile fields
      setEditUsername(user?.username || '');
      setEditEmail(user?.email || '');
      setEditName(user?.name || '');
      if (user?.dateOfBirth) {
        const dob = new Date(user.dateOfBirth);
        setEditDateOfBirth(dob.toISOString().split('T')[0]);
      } else {
        setEditDateOfBirth('');
      }

      // load account status from local user
      try {
        const u = localStorage.getItem('user');
        if (u) {
          // Account active status is available in parsed user data if needed
        }
      } catch {
        // ignore
      }

      // friends list
      if (user?.friends && Array.isArray(user.friends)) {
        setFriends(user.friends.map((f: any) => ({
          id: f._id || f.id,
          name: f.name || f.username || 'Unknown',
          username: f.username || f.name || 'Unknown',
          avatar: f.picture || f.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
          isActive: f.isActive !== undefined ? f.isActive : false,
        })));
      } else {
        setFriends([]);
      }
  };

  const loadRatingData = async (pid: string) => {
    if (!pid) return;
    setLoadingRating(true);
    try {
      const raterUserId = userId && userId !== pid ? userId : undefined;
      const resp = await getRating(pid, raterUserId);
      if (resp.success && resp.data) {
        setAverageRating(resp.data.averageRating || 0);
        setTotalRatings(resp.data.totalRatings || 0);
        setUserRating(resp.data.userRating?.rating || null);
      }
    } catch (e) {
      console.error('Error loading rating:', e);
    } finally {
      setLoadingRating(false);
    }
  };

  const handleRatingClick = async (rating: number) => {
    if (!userId || !profileUserId || userId === profileUserId) return;
    if (submittingRating) return;

    setSubmittingRating(true);
    try {
      const resp = await submitRating(profileUserId, userId, rating);
      if (resp.success && resp.data) {
        setAverageRating(resp.data.averageRating || 0);
        setTotalRatings(resp.data.totalRatings || 0);
        setUserRating(rating);
      } else {
        alert(resp.message || 'Failed to submit rating');
      }
    } catch (e: any) {
      console.error('Error submitting rating:', e);
      alert(e.message || 'Failed to submit rating. Please try again.');
    } finally {
      setSubmittingRating(false);
    }
  };

  const loadUserPosts = async (pid: string) => {
    setLoadingPosts(true);
    try {
      const resp = await apiRequest(`/post/user/${pid}`);
      setUserPosts((resp as any).data?.posts || []);
    } catch {
      setUserPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  const loadUserData = async () => {
    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setUserId(user.id);
        const pid = targetUserId || user.id;
        setProfileUserId(pid);
        await loadProfileData(pid);
        await loadUserPosts(pid);
        await loadRatingData(pid);

        if (targetUserId && targetUserId !== user.id) {
          await checkFriendRequestStatus(user.id, targetUserId);
        }
      }
    } catch (e) {
      console.error('Error loading user data:', e);
    }
  };

  const checkFriendRequestStatus = async (currentUserId: string, tid: string) => {
    try {
      const resp = await apiRequest(`/user/friend-request/status?userId=${currentUserId}&targetUserId=${tid}`);
      const status = (resp as any).data?.status;
      setFriendRequestStatus(status);
    } catch {
      // ignore
    }
  };

  const checkIfUserBlocked = async () => {
    if (!userId || !profileUserId || userId === profileUserId) return;
    try {
      setCheckingBlocked(true);
      const resp = await apiRequest(`/user/check-blocked?userId=${userId}&targetUserId=${profileUserId}`);
      setIsUserBlocked(!!(resp as any).data?.isBlocked);
    } catch {
      // ignore
    } finally {
      setCheckingBlocked(false);
    }
  };

  useEffect(() => {
    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setProfileData(prev => ({
      ...prev,
      username: globalSettings.displayName || prev.username,
      location: globalSettings.location || prev.location,
      country: globalSettings.country || prev.country,
      region: globalSettings.region || prev.region,
    }));
  }, [globalSettings]);

  useEffect(() => {
    if (targetUserId) {
      setProfileUserId(targetUserId);
      loadProfileData(targetUserId);
      loadUserPosts(targetUserId);
      loadRatingData(targetUserId);
      if (userId && userId !== targetUserId) checkFriendRequestStatus(userId, targetUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  useEffect(() => {
    checkIfUserBlocked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, profileUserId]);

  const handleSaveProfile = () => {
    updateGlobalSettings({
      displayName: profileData.username,
      location: profileData.location,
      country: profileData.country,
      region: profileData.region,
    });
    alert('Profile saved');
  };

  // ---- Upload helpers ----
  const uploadProfilePicture = async (file: File) => {
    if (!userId) {
      alert('User ID not found. Please login again.');
      return;
    }
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('picture', file);
      formData.append('userId', userId);
      const resp = await apiRequest('/user/profile/picture', {
        method: 'POST',
        body: formData,
      });
      if ((resp as any).success) {
        const pictureUrl = (resp as any).data?.picture;
        setProfileData(prev => ({ ...prev, avatar: pictureUrl || prev.avatar }));
        // Update localStorage user
        try {
          const u = localStorage.getItem('user');
          if (u) {
            const parsed = JSON.parse(u);
            parsed.picture = pictureUrl;
            localStorage.setItem('user', JSON.stringify(parsed));
          }
        } catch {
          // ignore
        }
        if (userId) await loadProfileData(userId);
        alert('Profile picture uploaded successfully!');
      } else {
        alert((resp as any).message || 'Failed to upload profile picture.');
      }
    } catch (e: any) {
      console.error('Upload error:', e);
      alert(e.message || 'Failed to upload profile picture. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const uploadCoverPhoto = async (file: File) => {
    if (!userId) {
      alert('User ID not found. Please login again.');
      return;
    }
    setUploadingCoverPhoto(true);
    try {
      const formData = new FormData();
      formData.append('coverPhoto', file);
      formData.append('userId', userId);
      const resp = await apiRequest('/user/profile/cover-photo', { method: 'POST', body: formData });
      if ((resp as any).success) {
        const coverPhotoUrl = (resp as any).data?.coverPhoto;
        setProfileData(prev => ({ ...prev, coverPhoto: coverPhotoUrl || prev.coverPhoto }));
        try {
          const u = localStorage.getItem('user');
          if (u) {
            const parsed = JSON.parse(u);
            parsed.coverPhoto = coverPhotoUrl;
            localStorage.setItem('user', JSON.stringify(parsed));
          }
        } catch {
          // ignore
        }
        if (userId) await loadProfileData(userId);
        alert('Cover photo uploaded successfully!');
      } else {
        alert((resp as any).message || 'Failed to upload cover photo.');
      }
    } catch (e: any) {
      console.error('Upload error:', e);
      alert(e.message || 'Failed to upload cover photo. Please try again.');
    } finally {
      setUploadingCoverPhoto(false);
    }
  };

  const handleDeletePicture = async () => {
    if (!userId) return;
    if (!confirm('Delete profile picture?')) return;
    setUploadingImage(true);
    try {
      const resp = await apiRequest('/user/profile/picture', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if ((resp as any).success) {
        setProfileData(prev => ({ ...prev, avatar: '' }));
        try {
          const u = localStorage.getItem('user');
          if (u) {
            const parsed = JSON.parse(u);
            delete parsed.picture;
            localStorage.setItem('user', JSON.stringify(parsed));
          }
        } catch {
          // ignore
        }
        alert('Profile picture deleted successfully!');
      } else {
        alert((resp as any).message || 'Failed to delete profile picture.');
      }
    } catch (e: any) {
      console.error('Delete error:', e);
      alert(e.message || 'Failed to delete profile picture.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteCoverPhoto = async () => {
    if (!userId) return;
    if (!confirm('Delete cover photo?')) return;
    setUploadingCoverPhoto(true);
    try {
      const resp = await apiRequest('/user/profile/cover-photo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if ((resp as any).success) {
        setProfileData(prev => ({
          ...prev,
          coverPhoto: 'https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=800',
        }));
        try {
          const u = localStorage.getItem('user');
          if (u) {
            const parsed = JSON.parse(u);
            delete parsed.coverPhoto;
            localStorage.setItem('user', JSON.stringify(parsed));
          }
        } catch {
          // ignore
        }
        alert('Cover photo deleted successfully!');
      } else {
        alert((resp as any).message || 'Failed to delete cover photo.');
      }
    } catch (e: any) {
      console.error('Delete error:', e);
      alert(e.message || 'Failed to delete cover photo.');
    } finally {
      setUploadingCoverPhoto(false);
    }
  };

  // ---- Friends / messaging navigation ----
  const handleFriendClick = (friendId: string) => {
    goToPage?.('profile', { targetUserId: friendId });
  };

  const handleFriendRequest = async () => {
    if (!userId || !profileUserId || userId === profileUserId) return;
    setIsFriendRequestLoading(true);
    try {
      if (friendRequestStatus === 'friends') {
        if (!confirm(`Unfriend ${profileData.username}?`)) return;
        const resp = await apiRequest('/user/unfriend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, targetUserId: profileUserId }),
        });
        if ((resp as any).success) {
          setFriendRequestStatus('none');
          await loadProfileData(profileUserId);
          alert('User unfriended successfully');
        } else {
          alert((resp as any).message || 'Failed to unfriend user');
        }
        return;
      }

      if (friendRequestStatus === 'pending_sent') {
        const resp = await apiRequest('/user/friend-request/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, targetUserId: profileUserId }),
        });
        if ((resp as any).success) {
          setFriendRequestStatus('none');
          alert('Friend request canceled');
        } else {
          alert((resp as any).message || 'Failed to cancel friend request');
        }
      } else if (friendRequestStatus === 'pending_received') {
        const resp = await apiRequest('/user/friend-request/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, targetUserId: profileUserId }),
        });
        if ((resp as any).success) {
          setFriendRequestStatus('friends');
          await loadProfileData(profileUserId);
          alert('Friend request accepted');
        } else {
          alert((resp as any).message || 'Failed to accept friend request');
        }
      } else {
        const resp = await apiRequest('/user/friend-request/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, targetUserId: profileUserId }),
        });
        if ((resp as any).success) {
          setFriendRequestStatus('pending_sent');
          alert('Friend request sent!');
          await loadProfileData(profileUserId);
        } else {
          alert((resp as any).message || 'Failed to send friend request');
        }
      }
    } catch (e: any) {
      console.error('Friend request error:', e);
      alert(e.message || 'Failed to process friend request.');
    } finally {
      setIsFriendRequestLoading(false);
    }
  };

  // ---- Block / unblock / report ----
  const loadBlockedUsers = async () => {
    if (!userId) return;
    setLoadingBlockedUsers(true);
    try {
      const resp = await apiRequest(`/user/blocked?userId=${userId}`);
      if ((resp as any).success) {
        const list = ((resp as any).data?.blockedUsers || []).map((u: any) => ({
          id: u._id || u.id,
          username: u.username || 'Unknown',
          name: u.name || u.username || 'Unknown',
          picture: u.picture || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
          isActive: u.isActive !== undefined ? u.isActive : false,
        }));
        setBlockedUsers(list);
      }
    } catch (e) {
      console.error('Load blocked users error:', e);
      alert('Failed to load blocked users');
    } finally {
      setLoadingBlockedUsers(false);
    }
  };

  const handleUnblockUser = async (tid: string) => {
    if (!userId) return;
    if (!confirm('Unblock this user?')) return;
    setUnblockingUserId(tid);
    try {
      const resp = await apiRequest('/user/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetUserId: tid }),
      });
      if ((resp as any).success) {
        setBlockedUsers(prev => prev.filter(u => u.id !== tid));
        alert('User unblocked successfully');
      } else {
        alert((resp as any).message || 'Failed to unblock user');
      }
    } catch (e: any) {
      console.error('Unblock user error:', e);
      alert(e.message || 'Failed to unblock user');
    } finally {
      setUnblockingUserId(null);
    }
  };

  const handleBlockUser = async () => {
    if (!userId || !profileUserId || userId === profileUserId) return;
    if (!confirm(`Block ${profileData.username}?`)) return;
    try {
      const resp = await apiRequest('/user/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetUserId: profileUserId }),
      });
      if ((resp as any).success) {
        setIsUserBlocked(true);
        setFriendRequestStatus('none');
        alert('User blocked successfully');
        await loadProfileData(profileUserId);
      } else {
        alert((resp as any).message || 'Failed to block user');
      }
    } catch (e) {
      console.error('Block user error:', e);
      alert('Failed to block user');
    }
  };

  const handleReportUser = async () => {
    if (!userId || !profileUserId || userId === profileUserId) return;
    if (!reportReason.trim()) {
      alert('Please select a reason for reporting');
      return;
    }
    try {
      setReportingUser(true);
      const resp = await apiRequest('/user/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          targetUserId: profileUserId,
          reason: reportReason,
          description: reportDescription,
        }),
      });
      if ((resp as any).success) {
        alert((resp as any).message || 'User reported successfully');
        setShowReportModal(false);
        setReportReason('');
        setReportDescription('');
      } else {
        alert((resp as any).message || 'Failed to report user');
      }
    } catch (e: any) {
      console.error('Report user error:', e);
      alert(e.message || 'Failed to report user');
    } finally {
      setReportingUser(false);
    }
  };

  // ---- Profile details save ----
  const handleSaveDetails = async () => {
    if (!userId) return;
    try {
      setSavingDetails(true);
      const resp = await apiRequest('/user/profile/details', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, bio, favoriteGames, skillLevels }),
      });
      if ((resp as any).success) {
        setProfileData(prev => ({ ...prev, bio, favoriteGames, skillLevels }));
        setIsEditingDetails(false);
        alert('Details updated successfully!');
      } else {
        alert((resp as any).message || 'Failed to update details');
      }
    } catch (e: any) {
      console.error('Save details error:', e);
      alert(e.message || 'Failed to save details');
    } finally {
      setSavingDetails(false);
    }
  };

  // ---- Password / account ----
  const handleChangePassword = async () => {
    if (!userId) return;
    if (!oldPassword.trim()) return alert('Current password is required');
    if (!newPassword.trim()) return alert('New password is required');
    if (newPassword.length < 6) return alert('New password must be at least 6 characters');
    if (newPassword !== confirmPassword) return alert('New password and confirm password do not match');
    if (oldPassword === newPassword) return alert('New password must be different from current password');

    try {
      setChangingPassword(true);
      const resp = await apiRequest('/user/change-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, oldPassword, newPassword }),
      });
      if ((resp as any).success) {
        alert('Password changed successfully!');
        setShowChangePasswordModal(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert((resp as any).message || 'Failed to change password');
      }
    } catch (e: any) {
      console.error('Change password error:', e);
      alert(e.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteAccountModal(true);
  };

  const handleConfirmDeleteAccount = async () => {
    if (!userId) return alert('User ID not found');
    if (!deleteAccountPassword.trim()) return alert('Password is required to delete account');
    try {
      setDeletingAccount(true);
      const resp = await apiRequest('/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password: deleteAccountPassword }),
      });
      if ((resp as any).success) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        alert('Account deleted successfully');
        window.location.reload();
      } else {
        alert((resp as any).message || 'Failed to delete account');
      }
    } catch (e: any) {
      console.error('Delete account error:', e);
      alert(e.message || 'Failed to delete account');
    } finally {
      setDeletingAccount(false);
    }
  };

  // ---- Posts ----
  const handleCreatePost = async () => {
    if (!postDescription.trim() && !selectedMediaFile) {
      alert('Please add a description or select a photo/video.');
      return;
    }
    if (!userId) {
      alert('User ID not found. Please login again.');
      return;
    }
    setIsCreatingPost(true);
    try {
      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('description', postDescription.trim());
      if (selectedMediaFile) {
        formData.append('media', selectedMediaFile);
      }
      const resp = await apiRequest('/post', { method: 'POST', body: formData });
      if ((resp as any).success) {
        alert('Post created successfully!');
        if (selectedMedia) URL.revokeObjectURL(selectedMedia);
        setPostDescription('');
        setSelectedMedia(null);
        setSelectedMediaFile(null);
        setMediaType(null);
        if (profileUserId) await loadUserPosts(profileUserId);
      } else {
        alert((resp as any).message || 'Failed to create post.');
      }
    } catch (e: any) {
      console.error('Create post error:', e);
      alert(e.message || 'Failed to create post.');
    } finally {
      setIsCreatingPost(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!userId) return alert('User ID not found.');
    if (!confirm('Delete this post?')) return;
    try {
      const resp = await apiRequest(`/post/${postId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if ((resp as any).success) {
        alert('Post deleted successfully!');
        if (profileUserId) await loadUserPosts(profileUserId);
      } else {
        alert((resp as any).message || 'Failed to delete post.');
      }
    } catch (e: any) {
      console.error('Delete post error:', e);
      alert(e.message || 'Failed to delete post.');
    }
  };

  const handleUpdatePost = async (postId: string) => {
    if (!userId) return alert('User ID not found.');
    if (!editPostDescription.trim()) return alert('Post description cannot be empty.');
    setIsUpdatingPost(true);
    try {
      const resp = await apiRequest(`/post/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, description: editPostDescription.trim() }),
      });
      if ((resp as any).success) {
        alert('Post updated successfully!');
        setEditingPostId(null);
        setEditPostDescription('');
        if (profileUserId) await loadUserPosts(profileUserId);
      } else {
        alert((resp as any).message || 'Failed to update post.');
      }
    } catch (e: any) {
      console.error('Update post error:', e);
      alert(e.message || 'Failed to update post.');
    } finally {
      setIsUpdatingPost(false);
    }
  };

  const handleToggleLike = async (postId: string) => {
    if (!userId) return alert('User ID not found.');
    setLikingPost(prev => ({ ...prev, [postId]: true }));
    try {
      const resp = await apiRequest(`/post/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if ((resp as any).success) {
        await loadUserPosts(profileUserId || userId);
      } else {
        alert((resp as any).message || 'Failed to like post.');
      }
    } catch (e: any) {
      console.error('Toggle like error:', e);
      alert(e.message || 'Failed to like post.');
    } finally {
      setLikingPost(prev => ({ ...prev, [postId]: false }));
    }
  };

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  };

  const handleAddComment = async (postId: string, parentCommentId?: string) => {
    if (!userId) return alert('User ID not found.');
    const inputKey = parentCommentId ? `${postId}-${parentCommentId}` : postId;
    const text = parentCommentId ? (replyInputs[parentCommentId] || '').trim() : (commentInputs[postId] || '').trim();
    if (!text) return alert('Please enter a comment.');
    setPostingComment(prev => ({ ...prev, [inputKey]: true }));
    try {
      const resp = await apiRequest(`/post/${postId}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, text, parentCommentId: parentCommentId || undefined }),
      });
      if ((resp as any).success) {
        if (parentCommentId) setReplyInputs(prev => ({ ...prev, [parentCommentId]: '' }));
        else setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        await loadUserPosts(profileUserId || userId);
      } else {
        alert((resp as any).message || 'Failed to add comment.');
      }
    } catch (e: any) {
      console.error('Add comment error:', e);
      alert(e.message || 'Failed to add comment.');
    } finally {
      setPostingComment(prev => {
        const next = { ...prev };
        delete next[inputKey];
        return next;
      });
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string, isReply: boolean, parentCommentId?: string) => {
    if (!userId) return alert('User ID not found.');
    if (!confirm('Delete this comment?')) return;
    try {
      const resp = await apiRequest(`/post/${postId}/comment/${commentId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isReply, parentCommentId }),
      });
      if ((resp as any).success) await loadUserPosts(profileUserId || userId);
      else alert((resp as any).message || 'Failed to delete comment.');
    } catch (e: any) {
      console.error('Delete comment error:', e);
      alert(e.message || 'Failed to delete comment.');
    }
  };

  const onPickProfilePictureFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadProfilePicture(file);
    e.target.value = '';
  };

  const onPickCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadCoverPhoto(file);
    e.target.value = '';
  };

  const handleExportProfileData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      currentUserId: userId,
      profileUserId,
      profileData,
      friends,
      posts: userPosts,
    };
    downloadJsonFile(`profile-${profileUserId || 'me'}-${Date.now()}.json`, payload);
  };

  // Handle select avatar
  const handleSelectAvatar = async (avatarUrl: string) => {
    if (!userId) {
      alert('User ID not found. Please login again.');
      return;
    }
    setShowAvatarModal(false);
    setUploadingImage(true);
    try {
      const resp = await apiRequest('/user/profile/picture', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, picture: avatarUrl }),
      });
      if ((resp as any).success) {
        setProfileData(prev => ({ ...prev, avatar: avatarUrl }));
        try {
          const u = localStorage.getItem('user');
          if (u) {
            const parsed = JSON.parse(u);
            parsed.picture = avatarUrl;
            localStorage.setItem('user', JSON.stringify(parsed));
          }
        } catch {
          // ignore
        }
        if (userId) await loadProfileData(userId);
        alert('Avatar selected successfully!');
      } else {
        alert((resp as any).message || 'Failed to select avatar.');
      }
    } catch (e: any) {
      console.error('Select avatar error:', e);
      alert(e.message || 'Failed to select avatar. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle save edit profile
  const handleSaveEditProfile = async () => {
    if (!userId) return;
    if (!editEmail.trim()) {
      alert('Email is required');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(editEmail.trim())) {
      alert('Please enter a valid email address');
      return;
    }
    if (editUsername.trim() && (editUsername.trim().length < 3 || editUsername.trim().length > 30)) {
      alert('Username must be between 3 and 30 characters');
      return;
    }
    try {
      setSavingProfile(true);
      const resp = await apiRequest('/user/profile/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          username: editUsername.trim(),
          email: editEmail.trim(),
          dateOfBirth: editDateOfBirth || null,
          name: editName.trim(),
        }),
      });
      if ((resp as any).success) {
        const updatedUser = (resp as any).data?.user;
        setProfileData(prev => ({
          ...prev,
          username: updatedUser?.username || prev.username,
          fullName: updatedUser?.name || prev.fullName,
          email: updatedUser?.email || prev.email,
          dateOfBirth: updatedUser?.dateOfBirth || prev.dateOfBirth,
        }));
        try {
          const u = localStorage.getItem('user');
          if (u) {
            const user = JSON.parse(u);
            if (updatedUser?.username) user.username = updatedUser.username;
            if (updatedUser?.name) user.name = updatedUser.name;
            if (updatedUser?.email) user.email = updatedUser.email;
            if (updatedUser?.dateOfBirth !== undefined) user.dateOfBirth = updatedUser.dateOfBirth;
            localStorage.setItem('user', JSON.stringify(user));
          }
        } catch {
          // ignore
        }
        setShowEditProfileModal(false);
        alert('Profile updated successfully! You can now login with your new email.');
        if (profileUserId) await loadProfileData(profileUserId);
      } else {
        alert((resp as any).message || 'Failed to update profile');
      }
    } catch (e: any) {
      console.error('Save profile error:', e);
      alert(e.message || 'Failed to save profile');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Cover */}
      <div className="relative h-[280px] w-full">
        <img
          className="h-full w-full object-cover"
          src={getImageUrl(profileData.coverPhoto) || profileData.coverPhoto || 'https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=800'}
          alt="Cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = 'https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=800';
          }}
        />
        <div className="absolute inset-0 bg-black/30" />
        {isOwnProfile && (
          <button
            className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-sm font-semibold text-white hover:bg-black/70"
            onClick={() => setShowCoverPhotoModal(true)}
            disabled={uploadingCoverPhoto}
          >
            <Camera className="h-4 w-4" />
            Change cover
          </button>
        )}
        </div>

      {/* Avatar + meta */}
      <div className="-mt-16 px-6 pb-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="flex items-end gap-4">
              <div className="relative">
                <img
                  className="h-32 w-32 rounded-full border-4 border-slate-900 object-cover bg-slate-800"
                  src={getAvatarImageSource(profileData.avatar)?.uri || profileData.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=300'}
                  alt="Avatar"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=300';
                  }}
                />
                {isOwnProfile && (
                  <button
                    className="absolute bottom-1 right-1 rounded-full bg-purple-600 p-2 text-white hover:bg-purple-500"
                    onClick={() => setShowImagePickerModal(true)}
                    disabled={uploadingImage}
                    title="Change profile picture"
                  >
                    <Camera className="h-4 w-4" />
                </button>
              )}
                {uploadingImage && (
                  <div className="absolute inset-0 rounded-full bg-black/60 grid place-items-center">
                    <span className="text-white text-sm">Uploading...</span>
            </div>
                )}
          </div>

            <div>
                <h1 className="text-2xl font-bold text-white">{profileData.username}</h1>
                <p className="text-purple-200/80">{profileData.bio || ' '}</p>
                <p className="text-sm text-purple-300/70">{profileData.friendsCount.toLocaleString()} friends</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!isOwnProfile && profileUserId && userId && (
                <>
                  <button
                    className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                      friendRequestStatus === 'friends'
                        ? 'bg-red-500 text-white hover:bg-red-400'
                        : friendRequestStatus === 'pending_sent' || friendRequestStatus === 'pending_received'
                          ? 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-600'
                          : 'bg-purple-600 text-white hover:bg-purple-500'
                    }`}
                    onClick={handleFriendRequest}
                    disabled={isFriendRequestLoading}
                  >
                    {isFriendRequestLoading ? <Activity className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    {friendRequestStatus === 'friends'
                      ? 'Unfriend'
                      : friendRequestStatus === 'pending_sent'
                        ? 'Request Sent'
                        : friendRequestStatus === 'pending_received'
                          ? 'Accept Request'
                          : 'Add Friend'}
                  </button>

                  {friendRequestStatus === 'friends' && (
                    <button
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-purple-600 text-white hover:bg-purple-500"
                      onClick={() => {
                        goToPage?.('ptpMessaging', {
                          targetUserId: profileUserId,
                          targetUsername: profileData.username,
                          targetUserAvatar: profileData.avatar,
                          profileParams: { targetUserId: profileUserId },
                        });
                      }}
                      title="Message"
                    >
                      <MessageCircle className="h-5 w-5" />
                    </button>
                  )}
                </>
              )}

              {isOwnProfile && (
                <>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-purple-200 hover:bg-slate-700 border border-slate-600"
                    onClick={() => setShowEditProfileModal(true)}
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit profile
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-purple-200 hover:bg-slate-700 border border-slate-600"
                    onClick={() => setShowMoreOptionsModal(true)}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    More
                  </button>
                </>
              )}
            </div>
            </div>

          {/* Rating Section - Only show if viewing another user's profile */}
          {!isOwnProfile && profileUserId && userId && (
            <div className="mt-6 rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="text-white font-bold">Rate this user</div>
                {loadingRating && (
                  <Activity className="h-4 w-4 animate-spin text-purple-300" />
                )}
              </div>
              <div className="flex items-center gap-2 mb-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const displayRating = hoveredRating !== null ? hoveredRating : userRating;
                  const isFilled = star <= (displayRating || 0);
                  return (
                    <button
                      key={star}
                      className={`transition-colors ${
                        isFilled
                          ? 'text-yellow-400 hover:text-yellow-300'
                          : 'text-slate-500 hover:text-yellow-400'
                      } ${submittingRating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      onMouseEnter={() => !submittingRating && setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(null)}
                      onClick={() => !submittingRating && handleRatingClick(star)}
                      disabled={submittingRating}
                      title={`Rate ${star} out of 5`}
                    >
                      <Star
                        className={`h-6 w-6 ${
                          isFilled ? 'fill-current' : ''
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="text-purple-300/80">
                  Average: <span className="font-semibold text-white">{averageRating.toFixed(1)}</span>
                </div>
                <div className="text-slate-400">•</div>
                <div className="text-purple-300/80">
                  {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'}
                </div>
                {userRating && (
                  <>
                    <div className="text-slate-400">•</div>
                    <div className="text-purple-300/80">
                      Your rating: <span className="font-semibold text-white">{userRating}/5</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="mt-6 border-b border-slate-700/50">
            <div className="flex gap-3">
              {tabs.map(t => (
                <button
                  key={t.id}
                  className={`px-3 py-2 text-sm font-semibold ${
                    activeTab === t.id ? 'text-white border-b-2 border-purple-500' : 'text-purple-300/70 hover:text-white'
                  }`}
                  onClick={() => setActiveTab(t.id as 'posts' | 'photos' | 'reels' | 'about')}
                >
                  {t.label}
                </button>
              ))}
                </div>
          </div>

          {/* Content */}
          <div className="py-6">
            {activeTab === 'about' && (
              <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
                <h2 className="text-lg font-bold text-white mb-4">About</h2>

                {profileData.fullName && (
                  <div className="mb-3">
                    <div className="text-sm text-purple-300/80">Name</div>
                    <div className="text-white">{profileData.fullName}</div>
                </div>
              )}

                {profileData.username && (
                  <div className="mb-3">
                    <div className="text-sm text-purple-300/80">Username</div>
                    <div className="text-white">@{profileData.username}</div>
            </div>
                )}

                {isOwnProfile && profileData.email && (
                  <div className="mb-3">
                    <div className="text-sm text-purple-300/80">Email</div>
                    <div className="text-white">{profileData.email}</div>
            </div>
                )}

                {isOwnProfile && profileData.dateOfBirth && (
                  <div className="mb-3">
                    <div className="text-sm text-purple-300/80">Date of Birth</div>
                    <div className="text-white">{new Date(profileData.dateOfBirth).toLocaleDateString()}</div>
            </div>
                )}

                {profileData.bio && (
                  <div className="mb-3">
                    <div className="text-sm text-purple-300/80">Bio</div>
                    <div className="text-white">{profileData.bio}</div>
          </div>
                )}

                {profileData.favoriteGames?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-sm text-purple-300/80">Favorite Games</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profileData.favoriteGames.map((g: string) => (
                        <span key={g} className="rounded-full bg-purple-600/20 border border-purple-500/30 px-3 py-1 text-sm text-purple-200">
                          {g} {profileData.skillLevels?.[g] ? <span className="text-purple-300/80">({profileData.skillLevels[g]})</span> : null}
                        </span>
                      ))}
        </div>
                  </div>
                )}

                <div className="mt-6 flex items-center gap-2">
              <button
                    className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
                    onClick={handleSaveProfile}
                  >
                    <Save className="h-4 w-4" />
                    Save to global settings
              </button>
          </div>
        </div>
            )}

            {activeTab === 'posts' && (
              <div className="space-y-6">
                {!shouldShowPosts ? (
                  <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-6 text-center">
                    <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-purple-600/20 grid place-items-center">
                      <UserPlus className="h-7 w-7 text-purple-300" />
                    </div>
                    <div className="text-white font-bold text-lg">Add friend to see posts</div>
                    <div className="text-purple-300/70 mt-1">Add {profileData.username} as a friend to see their posts and updates.</div>
            <button
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500"
                      onClick={handleFriendRequest}
                      disabled={isFriendRequestLoading}
                    >
                      <UserPlus className="h-4 w-4" />
                      {friendRequestStatus === 'pending_sent'
                        ? 'Request Sent'
                        : friendRequestStatus === 'pending_received'
                          ? 'Accept Request'
                          : 'Add Friend'}
            </button>
          </div>
                ) : (
                  <>
                    {isOwnProfile && (
                      <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
                        <div className="flex items-start gap-3">
                          <img
                            className="h-10 w-10 rounded-full object-cover"
                            src={getAvatarImageSource(profileData.avatar)?.uri || profileData.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=300'}
                            alt="me"
                          />
                          <div className="flex-1">
                            <textarea
                              className="w-full rounded-xl bg-slate-800/60 border border-slate-600/50 px-3 py-2 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                              placeholder="What's on your mind?"
                              value={postDescription}
                              onChange={(e) => setPostDescription(e.target.value)}
                              rows={3}
                              maxLength={2000}
                            />
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <button
                                  className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-purple-200 hover:bg-slate-700 border border-slate-600"
                                  onClick={() => postMediaInputRef.current?.click()}
                                  disabled={isCreatingPost}
                                >
                                  <Camera className="h-4 w-4 text-red-400" />
                                  Photo/Video
                                </button>
                                <input
                                  ref={postMediaInputRef}
                                  type="file"
                                  accept="image/*,video/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const blobUrl = URL.createObjectURL(file);
                                    setSelectedMedia(blobUrl);
                                    setSelectedMediaFile(file);
                                    setMediaType(file.type.startsWith('video') ? 'video' : 'image');
                                    e.target.value = '';
                                  }}
                                />
                                {selectedMedia && (
                                  <button
                                    className="inline-flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/30 border border-red-500/30"
                                    onClick={() => {
                                      if (selectedMedia) URL.revokeObjectURL(selectedMedia);
                                      setSelectedMedia(null);
                                      setSelectedMediaFile(null);
                                      setMediaType(null);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                    Remove media
                                  </button>
                                )}
                              </div>
                              <button
                                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                                onClick={handleCreatePost}
                                disabled={isCreatingPost || (!postDescription.trim() && !selectedMediaFile)}
                              >
                                {isCreatingPost ? <Activity className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Post
                              </button>
      </div>

                            {selectedMedia && (
                              <div className="mt-3 overflow-hidden rounded-xl border border-slate-700/50">
                                {mediaType === 'image' ? (
                                  <img className="w-full max-h-[360px] object-cover" src={getImageUrl(selectedMedia) || selectedMedia} alt="selected" />
                                ) : (
                                  <div className="bg-black">
                                    <video className="w-full max-h-[360px]" controls playsInline src={getImageUrl(selectedMedia) || selectedMedia} />
                </div>
                                )}
                </div>
                            )}
              </div>
        </div>
      </div>
                    )}

                    <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-white font-bold">Details</div>
                        {isOwnProfile && (
                          <button
                            className="rounded-lg bg-purple-600/20 border border-purple-500/30 px-3 py-1.5 text-sm font-semibold text-purple-200 hover:bg-purple-600/30"
                            onClick={() => setIsEditingDetails(v => !v)}
                          >
                            {isEditingDetails ? 'Cancel' : 'Edit'}
                          </button>
                        )}
    </div>

                      {isEditingDetails && isOwnProfile ? (
                        <div className="mt-4 space-y-4">
                          <div>
                            <div className="text-sm text-purple-200/80 mb-1">Bio</div>
                            <textarea
                              className="w-full rounded-lg bg-slate-800/60 border border-slate-600/50 px-3 py-2 text-white"
                              value={bio}
                              onChange={(e) => setBio(e.target.value)}
                              rows={4}
                              maxLength={500}
                            />
                            <div className="text-right text-xs text-slate-400">{bio.length}/500</div>
            </div>

                          <div>
                            <div className="text-sm text-purple-200/80 mb-1">Favorite Games</div>
                            <div className="flex flex-wrap gap-2">
                              {favoriteGames.map((g, idx) => (
                                <span key={`${g}-${idx}`} className="inline-flex items-center gap-2 rounded-full bg-purple-600/20 border border-purple-500/30 px-3 py-1 text-sm text-purple-200">
                                  {g}
                                  <button
                                    className="text-slate-300 hover:text-white"
                                    onClick={() => {
                                      const newGames = favoriteGames.filter((_, i) => i !== idx);
                                      setFavoriteGames(newGames);
                                      const newSkill = { ...skillLevels };
                                      delete newSkill[g];
                                      setSkillLevels(newSkill);
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </span>
                              ))}
            </div>
                            <div className="mt-2 flex gap-2">
                              <input
                                className="flex-1 rounded-lg bg-slate-800/60 border border-slate-600/50 px-3 py-2 text-white"
                                placeholder="Add a game..."
                                value={newGame}
                                onChange={(e) => setNewGame(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const ng = newGame.trim();
                                    if (ng && !favoriteGames.includes(ng)) {
                                      setFavoriteGames([...favoriteGames, ng]);
                                      setNewGame('');
                                    }
                                  }
                                }}
                              />
                              <button
                                className="rounded-lg bg-purple-600/20 border border-purple-500/30 px-4 py-2 text-sm font-semibold text-purple-200 hover:bg-purple-600/30"
                                onClick={() => {
                                  const ng = newGame.trim();
                                  if (ng && !favoriteGames.includes(ng)) {
                                    setFavoriteGames([...favoriteGames, ng]);
                                    setNewGame('');
                                  }
                                }}
                              >
                                Add
                              </button>
          </div>
        </div>

                          {!!favoriteGames.length && (
                            <div>
                              <div className="text-sm text-purple-200/80 mb-2">Skill Levels</div>
                              <div className="space-y-3">
                                {favoriteGames.map((g) => (
                                  <div key={g} className="flex flex-col gap-2">
                                    <div className="text-sm text-slate-300">{g}:</div>
                                    <div className="flex flex-wrap gap-2">
                                      {['Beginner', 'Intermediate', 'Advanced', 'Expert', 'Pro'].map((lvl) => (
                                        <button
                                          key={lvl}
                                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${
                                            skillLevels[g] === lvl
                                              ? 'bg-purple-600/30 border-purple-500 text-white'
                                              : 'bg-slate-800/60 border-slate-600 text-slate-200 hover:border-purple-500/40'
                                          }`}
                                          onClick={() => setSkillLevels(prev => ({ ...prev, [g]: lvl }))}
                                        >
                                          {lvl}
                                        </button>
                                      ))}
            </div>
            </div>
                                ))}
          </div>
        </div>
                          )}

                          <button
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                            onClick={handleSaveDetails}
                            disabled={savingDetails}
                          >
                            {savingDetails ? <Activity className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save Details
                          </button>
                </div>
                      ) : (
                        <div className="mt-3 text-slate-200/90">
                          {profileData.bio ? <div className="whitespace-pre-wrap">{profileData.bio}</div> : <div className="text-slate-400">No bio added yet</div>}
                </div>
                      )}
      </div>

                    <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-white font-bold">Friends</div>
                </div>
                      <div className="mt-2 text-sm text-purple-300/70">{profileData.friendsCount.toLocaleString()} friends</div>
                      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
                        {friends.slice(0, 6).map((f) => (
                          <button
                            key={f.id}
                            className="rounded-lg bg-slate-800/40 border border-slate-700/50 p-3 text-left hover:bg-slate-800/60"
                            onClick={() => handleFriendClick(f.id)}
                          >
                            <div className="relative overflow-hidden rounded-lg">
                              <img 
                                className="h-24 w-full object-cover" 
                                src={getAvatarImageSource(f.avatar)?.uri || f.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50'} 
                                alt={f.username}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50';
                                }}
                              />
                              {f.isActive ? <div className="absolute bottom-2 right-2 h-3 w-3 rounded-full bg-emerald-400 border-2 border-slate-900" /> : null}
                </div>
                            <div className="mt-2 text-sm font-semibold text-white">{f.name || f.username}</div>
                          </button>
                        ))}
                        {friends.length === 0 && <div className="text-slate-400">No friends yet</div>}
              </div>
                      {/* Action Buttons */}
                      <div className="flex gap-3 mt-3">
                        <button
                          className="flex-1 bg-slate-900/50 py-3 rounded-lg text-center hover:bg-slate-900/70 transition-colors"
                          onClick={() => {
                            if (goToPage) {
                              goToPage('friendsList');
                            }
                          }}
                        >
                          <span className="text-purple-300 font-semibold text-sm">See all friends</span>
                        </button>
                        <button
                          className="flex-1 bg-red-500/20 border border-red-500/40 py-3 rounded-lg text-center hover:bg-red-500/30 transition-colors"
                          onClick={() => {
                            if (goToPage) {
                              goToPage('friendRequests');
                            }
                          }}
                        >
                          <span className="text-red-400 font-semibold text-sm">Requests</span>
                        </button>
        </div>
      </div>

                    <div className="space-y-4">
                      {loadingPosts ? (
                        <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-6 text-center text-slate-200">
                          <Activity className="mx-auto h-6 w-6 animate-spin text-purple-300" />
                          <div className="mt-2">Loading posts...</div>
              </div>
                      ) : userPosts.length === 0 ? (
                        <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-6 text-center text-slate-300">
                          No posts yet
            </div>
                      ) : (
                        userPosts.map((post: any) => (
                          <div key={post.id} className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
                            <div className="flex items-start gap-3">
                              <img
                                className="h-10 w-10 rounded-full object-cover"
                                src={getImageUrl(post.user?.picture || profileData.avatar) || (post.user?.picture || profileData.avatar)}
                                alt="author"
                              />
                              <div className="flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="text-white font-semibold">{post.user?.username || post.user?.name || profileData.username}</div>
                                    <div className="text-xs text-slate-400">{new Date(post.createdAt || Date.now()).toLocaleString()}</div>
        </div>
                                  {isOwnProfile && (
                                    <button
                                      className="rounded-lg p-2 text-slate-300 hover:bg-slate-800/60"
                                      onClick={() => setOpenDropdownId(openDropdownId === post.id ? null : post.id)}
                                    >
                                      <MoreHorizontal className="h-5 w-5" />
                                    </button>
                                  )}
      </div>

                                {openDropdownId === post.id && isOwnProfile && (
                                  <div className="mt-2 w-48 rounded-lg border border-slate-700 bg-slate-900 p-2">
                                    <button
                                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-purple-200 hover:bg-slate-800"
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        setEditingPostId(post.id);
                                        setEditPostDescription(post.description || '');
                                      }}
                                    >
                                      <Edit3 className="h-4 w-4" />
                                      Edit post
                                    </button>
                                    <button
                                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-200 hover:bg-slate-800"
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        handleDeletePost(post.id);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Delete post
                                    </button>
        </div>
                                )}

                                {editingPostId === post.id ? (
                                  <div className="mt-3 rounded-lg border border-purple-500/30 bg-slate-800/40 p-3">
                                    <div className="text-sm font-semibold text-purple-200">Edit Description</div>
                                    <textarea
                                      className="mt-2 w-full rounded-lg bg-slate-900/60 border border-slate-600/50 px-3 py-2 text-white"
                                      value={editPostDescription}
                                      onChange={(e) => setEditPostDescription(e.target.value)}
                                      rows={3}
                                      maxLength={2000}
                                    />
                                    <div className="mt-2 flex justify-end gap-2">
                                      <button
                                        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 border border-slate-600"
                                        onClick={() => {
                                          setEditingPostId(null);
                                          setEditPostDescription('');
                                        }}
                                        disabled={isUpdatingPost}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                                        onClick={() => handleUpdatePost(post.id)}
                                        disabled={isUpdatingPost || !editPostDescription.trim()}
                                      >
                                        {isUpdatingPost ? 'Saving...' : 'Save'}
                                      </button>
      </div>
    </div>
                                ) : (
                                  post.description ? <div className="mt-2 text-purple-200/90 whitespace-pre-wrap">{post.description}</div> : null
                                )}

                                {post.media && (
                                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-700/50">
                                    {post.mediaType === 'image' ? (
                                      <img className="w-full max-h-[420px] object-cover" src={getImageUrl(post.media) || post.media} alt="post media" />
                                    ) : post.mediaType === 'video' ? (
                                      <PostVideoPlayer videoUri={getImageUrl(post.media) || post.media} />
                                    ) : null}
              </div>
                                )}

                                <div className="mt-3 flex items-center justify-between border-t border-slate-700/50 pt-3">
                                  <button
                                    className="inline-flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                                    onClick={() => handleToggleLike(post.id)}
                                    disabled={!!likingPost[post.id]}
                                  >
                                    <span>👍</span>
                                    Like
                                  </button>
                                  <button
                                    className="inline-flex items-center gap-2 rounded-lg bg-slate-800/50 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
                                    onClick={() => toggleComments(post.id)}
                                  >
                                    <MessageCircle className="h-4 w-4" />
                                    Comment
                                  </button>
      </div>

                                {expandedComments.has(post.id) && (
                                  <div className="mt-3">
                                    <div className="flex items-start gap-2">
                                      <img className="h-8 w-8 rounded-full object-cover" src={getImageUrl(profileData.avatar) || profileData.avatar} alt="me" />
                                      <div className="flex-1 flex items-end gap-2 rounded-2xl bg-slate-800/50 border border-slate-700 px-3 py-2">
                                        <textarea
                                          className="flex-1 bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                                          placeholder="Write a comment..."
                                          value={commentInputs[post.id] || ''}
                                          onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                          rows={1}
                                        />
                                        {!!(commentInputs[post.id] || '').trim() && (
                                          <button
                                            className="rounded-full bg-purple-600 p-2 text-white hover:bg-purple-500 disabled:opacity-50"
                                            onClick={() => handleAddComment(post.id)}
                                            disabled={!!postingComment[post.id]}
                                          >
                                            <Send className="h-4 w-4" />
                                          </button>
                                        )}
              </div>
                                    </div>

                                    <div className="mt-3 space-y-3">
                                      {(post.comments || []).map((comment: any) => (
                                        <div key={comment.id} className="flex items-start gap-2">
                                          <img className="h-8 w-8 rounded-full object-cover" src={getImageUrl(comment.user?.picture) || comment.user?.picture} alt="c" />
              <div className="flex-1">
                                            <div className="rounded-2xl bg-slate-800/40 border border-slate-700 px-3 py-2">
                                              <div className="text-sm font-semibold text-purple-200">{comment.user?.username || comment.user?.name || 'User'}</div>
                                              <div className="text-white">{comment.text}</div>
              </div>
                                            <div className="mt-1 flex gap-3 text-xs text-slate-400">
                                              <button
                                                className="hover:text-white"
                                                onClick={() => {
                                                  if (replyInputs[comment.id] === undefined) {
                                                    setReplyInputs(prev => ({ ...prev, [comment.id]: '' }));
                                                  }
                                                }}
                                              >
                                                {replyInputs[comment.id] !== undefined ? 'Replying...' : 'Reply'}
              </button>
                                              {comment.userId === userId && (
                                                <button
                                                  className="text-red-300 hover:text-red-200"
                                                  onClick={() => handleDeleteComment(post.id, comment.id, false)}
                                                >
                                                  Delete
                                                </button>
                                              )}
            </div>

                                            {replyInputs[comment.id] !== undefined && (
                                              <div className="mt-2 flex items-start gap-2 ml-6">
                                                <img className="h-7 w-7 rounded-full object-cover" src={getImageUrl(profileData.avatar) || profileData.avatar} alt="me" />
                                                <div className="flex-1 flex items-end gap-2 rounded-2xl bg-slate-800/50 border border-slate-700 px-3 py-2">
                                                  <textarea
                                                    className="flex-1 bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
                                                    placeholder="Write a reply..."
                                                    value={replyInputs[comment.id] || ''}
                                                    onChange={(e) => setReplyInputs(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                                    rows={1}
                                                  />
                                                  <button
                                                    className="rounded-full bg-slate-700 p-1.5 text-slate-200 hover:bg-slate-600"
                                                    onClick={() => {
                                                      setReplyInputs(prev => {
                                                        const next = { ...prev };
                                                        delete next[comment.id];
                                                        return next;
                                                      });
                                                    }}
                                                    title="Close"
                                                  >
                                                    <X className="h-4 w-4" />
                                                  </button>
                                                  {!!(replyInputs[comment.id] || '').trim() && (
                                                    <button
                                                      className="rounded-full bg-purple-600 p-2 text-white hover:bg-purple-500 disabled:opacity-50"
                                                      onClick={() => handleAddComment(post.id, comment.id)}
                                                      disabled={!!postingComment[`${post.id}-${comment.id}`]}
                                                    >
                                                      <Send className="h-4 w-4" />
                                                    </button>
                                                  )}
        </div>
      </div>
                                            )}

                                            {(comment.replies || []).length > 0 && (
                                              <div className="mt-2 space-y-2 ml-6">
                                                {(comment.replies || []).map((reply: any) => (
                                                  <div key={reply.id} className="flex items-start gap-2">
                                                    <img className="h-7 w-7 rounded-full object-cover" src={getImageUrl(reply.user?.picture) || reply.user?.picture} alt="r" />
                                                    <div className="flex-1">
                                                      <div className="rounded-2xl bg-slate-800/30 border border-slate-700 px-3 py-2">
                                                        <div className="text-xs font-semibold text-purple-200">{reply.user?.username || reply.user?.name || 'User'}</div>
                                                        <div className="text-white text-sm">{reply.text}</div>
            </div>
                                                      {reply.userId === userId && (
                                                        <button
                                                          className="mt-1 text-xs text-red-300 hover:text-red-200"
                                                          onClick={() => handleDeleteComment(post.id, reply.id, true, comment.id)}
                                                        >
                                                          Delete
                                                        </button>
                                                      )}
            </div>
                                                  </div>
                                                ))}
              </div>
                                            )}
            </div>
          </div>
                                      ))}
                                      {(post.comments || []).length === 0 && (
                                        <div className="text-sm text-slate-400 text-center py-2">No comments yet</div>
                                      )}
        </div>
            </div>
                                )}
            </div>
              </div>
            </div>
                        ))
                      )}
          </div>
                  </>
                )}
        </div>
            )}
      </div>
    </div>
            </div>

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickProfilePictureFile} />
      <input ref={coverFileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickCoverFile} />

      {/* Modals */}
      {showImagePickerModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4" onClick={() => setShowImagePickerModal(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-white font-bold">Profile Picture</div>
              <button className="p-2 rounded-lg hover:bg-slate-800" onClick={() => setShowImagePickerModal(false)}>
                <X className="h-5 w-5 text-slate-300" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <button
                className="w-full flex items-center gap-3 rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3 text-white hover:bg-slate-800"
                onClick={() => {
                  setShowImagePickerModal(false);
                  fileInputRef.current?.click();
                }}
                disabled={uploadingImage}
              >
                <ImageIcon className="h-5 w-5 text-purple-300" />
                Choose from Gallery
          </button>
              <button
                className="w-full flex items-center gap-3 rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3 text-white hover:bg-slate-800"
                onClick={() => {
                  setShowImagePickerModal(false);
                  setShowAvatarModal(true);
                }}
                disabled={uploadingImage}
              >
                <User className="h-5 w-5 text-purple-300" />
                Choose Avatar
              </button>
              {profileData.avatar && (
                <button
                  className="w-full flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-200 hover:bg-red-500/20"
                  onClick={() => {
                    setShowImagePickerModal(false);
                    handleDeletePicture();
                  }}
                  disabled={uploadingImage}
                >
                  <Trash2 className="h-5 w-5" />
                  Delete Picture
                </button>
              )}
        </div>
      </div>
        </div>
      )}

      {showCoverPhotoModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4" onClick={() => setShowCoverPhotoModal(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-white font-bold">Cover Photo</div>
              <button className="p-2 rounded-lg hover:bg-slate-800" onClick={() => setShowCoverPhotoModal(false)}>
                <X className="h-5 w-5 text-slate-300" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <button
                className="w-full flex items-center gap-3 rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3 text-white hover:bg-slate-800"
                onClick={() => {
                  setShowCoverPhotoModal(false);
                  coverFileInputRef.current?.click();
                }}
                disabled={uploadingCoverPhoto}
              >
                <ImageIcon className="h-5 w-5 text-purple-300" />
                Choose from Gallery
              </button>
              <button
                className="w-full flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-200 hover:bg-red-500/20"
                onClick={() => {
                  setShowCoverPhotoModal(false);
                  handleDeleteCoverPhoto();
                }}
                disabled={uploadingCoverPhoto}
              >
                <Trash2 className="h-5 w-5" />
                Delete Cover Photo
          </button>
        </div>
      </div>
      </div>
      )}


      {/* More options (web port) */}
      {showMoreOptionsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4" onClick={() => setShowMoreOptionsModal(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-white font-bold">More Options</div>
              <button className="p-2 rounded-lg hover:bg-slate-800" onClick={() => setShowMoreOptionsModal(false)}>
                <X className="h-5 w-5 text-slate-300" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <button
                className="w-full flex items-center gap-3 rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3 text-white hover:bg-slate-800"
                onClick={() => {
                  setShowMoreOptionsModal(false);
                  setShowChangePasswordModal(true);
                }}
              >
                <Edit3 className="h-5 w-5 text-purple-300" />
                Change Password
          </button>
              <button
                className="w-full flex items-center gap-3 rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3 text-white hover:bg-slate-800"
                onClick={() => {
                  setShowMoreOptionsModal(false);
                  handleExportProfileData();
                }}
              >
                <CheckCircle2 className="h-5 w-5 text-purple-300" />
                Export Profile (JSON)
              </button>
              <button
                className="w-full flex items-center gap-3 rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3 text-white hover:bg-slate-800"
                onClick={() => {
                  setShowMoreOptionsModal(false);
                  setShowBlockedUsersModal(true);
                  loadBlockedUsers();
                }}
              >
                <UserX className="h-5 w-5 text-purple-300" />
                Blocked Users ({blockedUsers.length})
              </button>
              <button
                className="w-full flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-red-200 hover:bg-red-500/20"
                onClick={() => {
                  setShowMoreOptionsModal(false);
                  handleDeleteAccount();
                }}
              >
                <Trash2 className="h-5 w-5" />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4" onClick={() => setShowChangePasswordModal(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-white font-bold">Change Password</div>
              <button className="p-2 rounded-lg hover:bg-slate-800" onClick={() => setShowChangePasswordModal(false)}>
                <X className="h-5 w-5 text-slate-300" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-sm text-slate-300 mb-1">Current password</div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-800/50 border border-slate-700 px-3 py-2">
                  <input
                    className="flex-1 bg-transparent text-white focus:outline-none"
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                  />
                  <button className="p-1 rounded hover:bg-slate-700" onClick={() => setShowOldPassword(v => !v)}>
                    {showOldPassword ? <EyeOff className="h-4 w-4 text-slate-300" /> : <Eye className="h-4 w-4 text-slate-300" />}
              </button>
            </div>
      </div>
              <div>
                <div className="text-sm text-slate-300 mb-1">New password</div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-800/50 border border-slate-700 px-3 py-2">
                  <input
                    className="flex-1 bg-transparent text-white focus:outline-none"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button className="p-1 rounded hover:bg-slate-700" onClick={() => setShowNewPassword(v => !v)}>
                    {showNewPassword ? <EyeOff className="h-4 w-4 text-slate-300" /> : <Eye className="h-4 w-4 text-slate-300" />}
                  </button>
    </div>
              </div>
              <div>
                <div className="text-sm text-slate-300 mb-1">Confirm new password</div>
                <div className="flex items-center gap-2 rounded-xl bg-slate-800/50 border border-slate-700 px-3 py-2">
                  <input
                    className="flex-1 bg-transparent text-white focus:outline-none"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button className="p-1 rounded hover:bg-slate-700" onClick={() => setShowConfirmPassword(v => !v)}>
                    {showConfirmPassword ? <EyeOff className="h-4 w-4 text-slate-300" /> : <Eye className="h-4 w-4 text-slate-300" />}
                  </button>
        </div>
      </div>

              <button
                className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                onClick={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? <Activity className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Change Password
              </button>
            </div>
        </div>
      </div>
      )}

      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4" onClick={() => setShowDeleteAccountModal(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-white font-bold">Confirm Account Deletion</div>
              <button className="p-2 rounded-lg hover:bg-slate-800" onClick={() => setShowDeleteAccountModal(false)}>
                <X className="h-5 w-5 text-slate-300" />
              </button>
            </div>
            <div className="mt-3 text-red-200 font-semibold">This action cannot be undone.</div>
            <div className="mt-3">
              <div className="text-sm text-slate-300 mb-1">Enter password to confirm</div>
              <input
                className="w-full rounded-xl bg-slate-800/50 border border-slate-700 px-3 py-2 text-white"
                type="password"
                value={deleteAccountPassword}
                onChange={(e) => setDeleteAccountPassword(e.target.value)}
              />
              </div>
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 rounded-xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                onClick={() => setShowDeleteAccountModal(false)}
              >
                Cancel
          </button>
              <button
                className="flex-1 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                onClick={handleConfirmDeleteAccount}
                disabled={deletingAccount}
              >
                {deletingAccount ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBlockedUsersModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4" onClick={() => setShowBlockedUsersModal(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-white font-bold">Blocked Users</div>
              <button className="p-2 rounded-lg hover:bg-slate-800" onClick={() => setShowBlockedUsersModal(false)}>
                <X className="h-5 w-5 text-slate-300" />
              </button>
            </div>

            <div className="mt-3 max-h-[60vh] overflow-auto space-y-2">
              {loadingBlockedUsers ? (
                <div className="text-center text-slate-200 py-10">
                  <Activity className="mx-auto h-6 w-6 animate-spin text-purple-300" />
                  <div className="mt-2">Loading blocked users...</div>
                </div>
              ) : blockedUsers.length === 0 ? (
                <div className="text-center text-slate-400 py-10">No blocked users</div>
              ) : (
                blockedUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 rounded-xl bg-slate-800/40 border border-slate-700 px-3 py-2">
                    <img className="h-10 w-10 rounded-full object-cover" src={getImageUrl(u.picture) || u.picture} alt={u.username} />
                    <div className="flex-1">
                      <div className="text-white font-semibold">{u.name}</div>
                      <div className="text-xs text-slate-400">@{u.username}</div>
                    </div>
                <button
                      className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                      onClick={() => handleUnblockUser(u.id)}
                      disabled={unblockingUserId === u.id}
                    >
                      {unblockingUserId === u.id ? '...' : 'Unblock'}
          </button>
        </div>
                ))
              )}
      </div>
    </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4" onClick={() => setShowReportModal(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="text-white font-bold">Report User</div>
              <button className="p-2 rounded-lg hover:bg-slate-800" onClick={() => setShowReportModal(false)}>
                <X className="h-5 w-5 text-slate-300" />
              </button>
              </div>
            <div className="mt-3 text-slate-200">Select a reason and add details.</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Spam', 'Harassment', 'Inappropriate Content', 'Fake Account', 'Other'].map((r) => (
                <button
                  key={r}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold border ${
                    reportReason === r ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-purple-500/40'
                  }`}
                  onClick={() => setReportReason(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-3">
              <textarea
                className="w-full rounded-xl bg-slate-800/50 border border-slate-700 px-3 py-2 text-white"
                placeholder="Additional details (optional)"
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                rows={4}
                maxLength={500}
              />
              <div className="text-right text-xs text-slate-400">{reportDescription.length}/500</div>
          </div>
            <button
              className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-50"
              onClick={handleReportUser}
              disabled={!reportReason.trim() || reportingUser}
            >
              {reportingUser ? <Activity className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
              Submit Report
            </button>
        </div>
      </div>
      )}

      {/* Avatar Selection Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4" onClick={() => setShowAvatarModal(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 p-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-white font-bold">Choose Avatar</div>
              <button className="p-2 rounded-lg hover:bg-slate-800" onClick={() => setShowAvatarModal(false)}>
                <X className="h-5 w-5 text-slate-300" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-3">
                {avatarOptions.map((avatar, index) => {
                  const isSelected = profileData.avatar === avatar;
              return (
                <button
                      key={index}
                      className={`relative aspect-square rounded-xl overflow-hidden border-2 ${
                        isSelected ? 'border-purple-500' : 'border-slate-700'
                      } hover:border-purple-400`}
                      onClick={() => handleSelectAvatar(avatar)}
                      disabled={uploadingImage}
                    >
                      <img className="w-full h-full object-cover" src={avatar} alt={`Avatar ${index + 1}`} />
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-purple-600 rounded-full p-1">
                          <CheckCircle2 className="h-5 w-5 text-white" />
                        </div>
                      )}
                </button>
              );
            })}
        </div>
      </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end justify-center p-4" onClick={() => setShowEditProfileModal(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700 p-4 max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-white font-bold">Edit Profile</div>
              <button className="p-2 rounded-lg hover:bg-slate-800" onClick={() => setShowEditProfileModal(false)}>
                <X className="h-5 w-5 text-slate-300" />
              </button>
        </div>
            <div className="overflow-y-auto flex-1 space-y-4">
              <div>
                <div className="text-sm text-slate-300 mb-1">Name</div>
                <input
                  className="w-full rounded-xl bg-slate-800/50 border border-slate-700 px-3 py-2 text-white"
                  placeholder="Enter your name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
      </div>
              <div>
                <div className="text-sm text-slate-300 mb-1">Username</div>
                <input
                  className="w-full rounded-xl bg-slate-800/50 border border-slate-700 px-3 py-2 text-white"
                  placeholder="Enter username"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                />
                <div className="text-xs text-slate-400 mt-1">Username must be unique and 3-30 characters</div>
              </div>
              <div>
                <div className="text-sm text-slate-300 mb-1">Email</div>
                <input
                  className="w-full rounded-xl bg-slate-800/50 border border-slate-700 px-3 py-2 text-white"
                  type="email"
                  placeholder="Enter email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
                <div className="text-xs text-slate-400 mt-1">Email must be unique and valid</div>
              </div>
              <div>
                <div className="text-sm text-slate-300 mb-1">Date of Birth</div>
                <input
                  className="w-full rounded-xl bg-slate-800/50 border border-slate-700 px-3 py-2 text-white"
                  type="date"
                  value={editDateOfBirth}
                  onChange={(e) => setEditDateOfBirth(e.target.value)}
                />
                <div className="text-xs text-slate-400 mt-1">Format: YYYY-MM-DD (e.g., 2000-01-15)</div>
              </div>
              <button
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                onClick={handleSaveEditProfile}
                disabled={savingProfile}
              >
                {savingProfile ? <Activity className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons when viewing another user */}
      {!isOwnProfile && profileUserId && userId && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-2">
          {checkingBlocked ? (
            <div className="rounded-xl bg-slate-900/80 border border-slate-700 px-4 py-3 text-slate-200">
              Checking...
        </div>
          ) : isUserBlocked ? (
            <div className="rounded-xl bg-slate-900/80 border border-slate-700 px-4 py-3 text-slate-200">
              You have blocked this user.
      </div>
          ) : (
            <>
              <button
                className="rounded-xl bg-slate-900/80 border border-slate-700 px-4 py-3 text-slate-200 hover:bg-slate-900"
                onClick={() => setShowReportModal(true)}
              >
                Report
              </button>
              <button
                className="rounded-xl bg-red-500/80 border border-red-500/30 px-4 py-3 text-white hover:bg-red-500"
                onClick={handleBlockUser}
              >
                Block
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
};

export default UserProfilePage;