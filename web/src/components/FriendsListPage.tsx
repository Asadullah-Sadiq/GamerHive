import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, ArrowLeft, Users } from 'lucide-react';
import { apiRequest, getStoredUser, getImageUrl } from '../utils/api';
import { getAvatarImageSource } from '../utils/avatarUtils';

interface Friend {
  id: string;
  name: string;
  username: string;
  avatar: string;
  status?: string;
  activeTime?: string;
  isActive?: boolean;
}

interface FriendsListPageProps {
  goToPage?: (page: string, params?: any) => void;
  onBack?: () => void;
}

const FriendsListPage: React.FC<FriendsListPageProps> = ({ goToPage, onBack }) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load friends list
  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const user = getStoredUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Load profile data to get friends
      const response = await apiRequest<{ user: any }>(`/user/profile/${user.id}`);
      if (response.success && response.data) {
        const userData = response.data.user;

        if (userData.friends && userData.friends.length > 0) {
          const friendsList = userData.friends.map((friend: any) => ({
            id: friend._id || friend.id,
            name: friend.name || friend.username || 'Unknown',
            username: friend.username || friend.name || 'Unknown',
            avatar:
              friend.picture ||
              friend.avatar ||
              'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
            status: friend.isActive ? 'online' : 'offline',
            isActive: friend.isActive !== undefined ? friend.isActive : false,
          }));
          setFriends(friendsList);
        } else {
          setFriends([]);
        }
      }
    } catch (error) {
      console.error('Error loading friends:', error);
      setFriends([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter friends based on search term
  const filteredFriends = useMemo(() => {
    if (!searchTerm.trim()) {
      return friends;
    }
    const term = searchTerm.toLowerCase();
    return friends.filter(
      (friend) =>
        friend.name.toLowerCase().includes(term) ||
        friend.username.toLowerCase().includes(term)
    );
  }, [friends, searchTerm]);

  const handleFriendClick = (friendId: string) => {
    if (goToPage) {
      goToPage('profile', { targetUserId: friendId });
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (goToPage) {
      goToPage('profile');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFriends();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        {onBack && (
          <button
            onClick={handleBack}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} color="#fff" />
          </button>
        )}
        <h1 className="text-xl font-bold text-white flex-1 text-center">Friends</h1>
        <div className="w-10" />
      </div>

      {/* Search Bar */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search friends..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-slate-800 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-slate-700 rounded"
            >
              <X size={16} color="#94a3b8" />
            </button>
          )}
        </div>
      </div>

      {/* Friends List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : filteredFriends.length > 0 ? (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-3 pb-10">
            {filteredFriends.map((friend) => {
              const avatarSource = getAvatarImageSource(friend.avatar);
              const avatarUrl = avatarSource?.uri ? getImageUrl(avatarSource.uri) : getImageUrl(friend.avatar);

              return (
                <button
                  key={friend.id}
                  onClick={() => handleFriendClick(friend.id)}
                  className="w-full flex items-center p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 hover:border-purple-500/50 transition-colors text-left"
                >
                  <div className="relative mr-3">
                    {avatarUrl ? (
                      <>
                        <img
                          src={avatarUrl}
                          alt={friend.name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-purple-500/30"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const placeholder = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                            if (placeholder) {
                              placeholder.style.display = 'flex';
                            }
                          }}
                        />
                        <div className="hidden absolute inset-0 w-14 h-14 rounded-full border-2 border-purple-500/30 bg-slate-700 items-center justify-center">
                          <Users size={24} color="#a78bfa" />
                        </div>
                      </>
                    ) : (
                      <div className="w-14 h-14 rounded-full border-2 border-purple-500/30 bg-slate-700 flex items-center justify-center">
                        <Users size={24} color="#a78bfa" />
                      </div>
                    )}
                    {friend.isActive && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-900"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-base font-semibold text-white">{friend.name}</p>
                    <p className="text-sm text-slate-400">@{friend.username}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-10">
          <Users size={64} color="#9CA3AF" />
          <p className="text-lg font-semibold text-gray-400 mt-4">
            {searchTerm ? 'No friends found' : 'No friends yet'}
          </p>
          <p className="text-sm text-gray-500 mt-2 text-center">
            {searchTerm
              ? 'Try a different search term'
              : 'Start adding friends to see them here'}
          </p>
        </div>
      )}

      {/* Refresh Button */}
      {!loading && (
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="fixed bottom-6 right-6 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg transition-colors disabled:opacity-50"
        >
          {refreshing ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          )}
        </button>
      )}
    </div>
  );
};

export default FriendsListPage;

