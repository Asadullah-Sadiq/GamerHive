import React, { useEffect, useMemo, useState } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import { apiRequest, getImageUrl, getStoredUser } from '../utils/api';
import { getAvatarImageSource } from '../utils/avatarUtils';

type ConversationRow = {
  userId: string;
  username: string;
  avatar?: string;
  lastMessage?: {
    id: string;
    content: string;
    type: string;
    timestamp: string;
  };
  unreadCount?: number;
};

interface FriendMessagingPageProps {
  onNavigate?: (page: string, params?: any) => void;
}

const FriendMessagingPage: React.FC<FriendMessagingPageProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationRow[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.username || '').toLowerCase().includes(q));
  }, [conversations, query]);

  const load = async () => {
    try {
      const user = getStoredUser();
      const userId = user?.id;
      if (!userId) {
        setConversations([]);
        return;
      }

      const resp = await apiRequest<{ conversations: ConversationRow[] }>(`/direct/conversations/${userId}`);
      if (resp.success && resp.data) {
        setConversations(resp.data.conversations || []);
      } else {
        setConversations([]);
      }
    } catch (e) {
      console.error('Error loading conversations:', e);
      setConversations([]);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleConversationClick = (item: ConversationRow) => {
    if (onNavigate) {
      // Navigate to PTP messaging page with target user info
      onNavigate('ptpMessaging', {
        targetUserId: item.userId,
        targetUsername: item.username,
        targetUserAvatar: item.avatar,
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 min-h-screen">
      {/* Header */}
      <div className="px-4 pt-2 pb-3">
        <div className="flex items-center gap-2.5 mb-2.5">
          <MessageSquare size={20} className="text-purple-400" />
          <h1 className="text-white text-lg font-bold">Friend Messaging</h1>
        </div>
        <div className="flex items-center gap-2.5 bg-white/6 rounded-xl px-3 py-2.5 border border-purple-400/18">
          <Search size={18} className="text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="pt-12 flex flex-col items-center">
              <p className="text-gray-200 text-base font-bold">No chats yet</p>
              <p className="text-gray-400 text-sm mt-1.5 text-center">Start a direct message from a profile.</p>
            </div>
          ) : (
            <div className="px-2 pb-4">
              {filtered.map((item) => {
                const avatar = item.avatar || '';
                const unread = item.unreadCount || 0;
                return (
                  <button
                    key={item.userId}
                    onClick={() => handleConversationClick(item)}
                    className="w-full flex items-center py-2.5 px-2.5 rounded-xl mb-1.5 bg-gray-900/55 border border-purple-400/12 hover:bg-gray-900/70 transition-colors active:opacity-80"
                  >
                    <img
                      src={(() => {
                        const source = getAvatarImageSource(getImageUrl(avatar));
                        return source?.uri || getImageUrl(avatar) || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=300';
                      })()}
                      alt={item.username}
                      className="w-11 h-11 rounded-full mr-3 bg-white/6 object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2.5">
                        <p className="text-white text-[15px] font-bold truncate">
                          {item.username || 'User'}
                        </p>
                        {unread > 0 && (
                          <div className="min-w-[22px] px-2 h-[22px] rounded-[11px] bg-purple-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-extrabold">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="text-gray-400 text-[13px] mt-0.5 truncate">
                        {item.lastMessage?.type === 'image'
                          ? '📷 Photo'
                          : item.lastMessage?.type === 'video'
                          ? '🎥 Video'
                          : item.lastMessage?.type === 'audio'
                          ? '🎤 Voice'
                          : item.lastMessage?.type === 'file'
                          ? '📎 File'
                          : item.lastMessage?.content || 'Start chatting'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          
          {/* Refresh button */}
          <div className="sticky bottom-4 flex justify-center px-4">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {refreshing ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Refreshing...
                </span>
              ) : (
                'Refresh'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FriendMessagingPage;

