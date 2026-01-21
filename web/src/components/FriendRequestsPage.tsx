import React, { useState, useEffect } from 'react';
import { ArrowLeft, UserPlus, CheckCircle2, XCircle } from 'lucide-react';
import { apiRequest, getStoredUser, getImageUrl } from '../utils/api';
import { getAvatarImageSource } from '../utils/avatarUtils';

interface FriendRequest {
  _id: string;
  id: string;
  name: string;
  username: string;
  picture?: string;
  email?: string;
}

interface FriendRequestsPageProps {
  goToPage?: (page: string, params?: any) => void;
  onBack?: () => void;
}

const FriendRequestsPage: React.FC<FriendRequestsPageProps> = ({ goToPage, onBack }) => {
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadFriendRequests();
  }, []);

  const loadFriendRequests = async () => {
    try {
      setLoading(true);
      const user = getStoredUser();
      if (!user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const response = await apiRequest<{ friendRequests: any[] }>(
        `/user/friend-request/received?userId=${user.id}`
      );
      if (response.success && response.data) {
        const requests = response.data.friendRequests.map((req: any) => {
          // Handle both populated and non-populated data
          const userData = req._id ? req : req.userId || req;

          return {
            _id: userData._id || userData.id,
            id: userData._id || userData.id,
            name: userData.name || userData.username || 'Unknown User',
            username: userData.username || userData.name || 'unknown',
            picture:
              userData.picture ||
              userData.avatar ||
              'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
            email: userData.email || '',
          };
        });
        setFriendRequests(requests);
      }
    } catch (error) {
      console.error('Error loading friend requests:', error);
      window.alert('Error\nFailed to load friend requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    if (!userId || processingIds.has(requestId)) return;

    try {
      setProcessingIds((prev) => new Set(prev).add(requestId));

      const response = await apiRequest('/user/friend-request/accept', {
        method: 'POST',
        body: JSON.stringify({
          userId: userId,
          targetUserId: requestId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.success) {
        // Remove from list
        setFriendRequests((prev) => prev.filter((req) => req.id !== requestId));

        window.alert('Success\nFriend request accepted!');
      } else {
        window.alert(`Error\n${response.message || 'Failed to accept friend request'}`);
      }
    } catch (error: any) {
      console.error('Accept friend request error:', error);
      window.alert(`Error\n${error.message || 'Failed to accept friend request'}`);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const handleReject = async (requestId: string) => {
    if (!userId || processingIds.has(requestId)) return;

    try {
      setProcessingIds((prev) => new Set(prev).add(requestId));

      const response = await apiRequest('/user/friend-request/reject', {
        method: 'POST',
        body: JSON.stringify({
          userId: userId,
          targetUserId: requestId,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.success) {
        // Remove from list
        setFriendRequests((prev) => prev.filter((req) => req.id !== requestId));

        window.alert('Success\nFriend request rejected');
      } else {
        window.alert(`Error\n${response.message || 'Failed to reject friend request'}`);
      }
    } catch (error: any) {
      console.error('Reject friend request error:', error);
      window.alert(`Error\n${error.message || 'Failed to reject friend request'}`);
    } finally {
      setProcessingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const handleViewProfile = (requestId: string) => {
    if (goToPage) {
      goToPage('profile', { targetUserId: requestId });
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
    await loadFriendRequests();
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
        <h1 className="text-xl font-bold text-white flex-1 text-center">Friend Requests</h1>
        <div className="w-10 flex items-center justify-end">
          <span className="text-purple-500 text-base font-semibold">{friendRequests.length}</span>
        </div>
      </div>

      {/* Friend Requests List */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : friendRequests.length > 0 ? (
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-3 pb-10">
            {friendRequests.map((item) => {
              const isProcessing = processingIds.has(item.id);
              const avatarSource = getAvatarImageSource(item.picture);
              const avatarUrl = avatarSource?.uri ? getImageUrl(avatarSource.uri) : getImageUrl(item.picture);

              return (
                <div
                  key={item.id}
                  className="py-4 px-4 bg-slate-800/60 rounded-xl border border-slate-700/50 shadow-lg"
                >
                  <div className="mb-3">
                    <button
                      onClick={() => handleViewProfile(item.id)}
                      disabled={isProcessing}
                      className={`flex items-center w-full text-left ${
                        isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
                      } transition-opacity`}
                    >
                      <div className="mr-3 relative">
                        {avatarUrl ? (
                          <>
                            <img
                              src={avatarUrl}
                              alt={item.name}
                              className="w-[60px] h-[60px] rounded-full border-2 border-purple-500/30 object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const placeholder = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                                if (placeholder) {
                                  placeholder.style.display = 'flex';
                                }
                              }}
                            />
                            <div className="hidden absolute inset-0 w-[60px] h-[60px] rounded-full border-2 border-purple-500/30 bg-slate-700 items-center justify-center">
                              <UserPlus size={24} color="#a78bfa" />
                            </div>
                          </>
                        ) : (
                          <div className="w-[60px] h-[60px] rounded-full border-2 border-purple-500/30 bg-slate-700 flex items-center justify-center">
                            <UserPlus size={24} color="#a78bfa" />
                          </div>
                        )}
                      </div>
                      <p className="text-lg font-bold text-white flex-1 line-clamp-1">{item.name}</p>
                    </button>
                  </div>
                  <div className="flex gap-2.5 items-center mt-2">
                    <button
                      onClick={() => handleAccept(item.id)}
                      disabled={isProcessing}
                      className={`flex items-center justify-center bg-green-500 px-4.5 py-3 rounded-lg gap-1.5 min-w-[100px] shadow-lg shadow-green-500/30 ${
                        isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'
                      } transition-colors`}
                    >
                      {isProcessing ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <CheckCircle2 size={18} color="#fff" />
                          <span className="text-white text-sm font-semibold">Accept</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleReject(item.id)}
                      disabled={isProcessing}
                      className={`flex items-center justify-center bg-red-500 px-4.5 py-3 rounded-lg gap-1.5 min-w-[100px] shadow-lg shadow-red-500/30 ${
                        isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'
                      } transition-colors`}
                    >
                      {isProcessing ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <XCircle size={18} color="#fff" />
                          <span className="text-white text-sm font-semibold">Reject</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-10">
          <UserPlus size={64} color="#9CA3AF" />
          <p className="text-lg font-semibold text-gray-400 mt-4">No friend requests</p>
          <p className="text-sm text-gray-500 mt-2 text-center">
            When someone sends you a friend request, it will appear here
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

export default FriendRequestsPage;

