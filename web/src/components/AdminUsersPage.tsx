import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, X, Users, Shield } from 'lucide-react';
import { apiRequest, getImageUrl, getStoredUser } from '../utils/api';
import { getAvatarImageSource } from '../utils/avatarUtils';

interface AdminUsersPageProps {
  onBack: () => void;
  goToPage?: (page: string, params?: any) => void;
}

type AdminUserRow = {
  id: string;
  username?: string;
  name?: string;
  email?: string;
  picture?: string | null;
  isAdmin?: boolean;
  isActive?: boolean;
  createdAt?: string;
  friendsCount?: number;
};

export default function AdminUsersPage({ onBack, goToPage }: AdminUsersPageProps) {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const me = getStoredUser();
      const userId = me?.id;
      if (!userId) {
        alert('User not found. Please login again.');
        return;
      }
      const res = await apiRequest<any>(`/user/all?userId=${userId}`);
      if (res.success && res.data?.users) {
        setUsers(res.data.users);
      } else {
        setUsers([]);
      }
    } catch (e: any) {
      console.error('Error loading users:', e);
      alert(e?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase();
    return users.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const username = (u.username || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      return name.includes(term) || username.includes(term) || email.includes(term);
    });
  }, [users, searchTerm]);

  const handleUserClick = (userId: string) => {
    if (goToPage) goToPage('profile', { targetUserId: userId });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-900">
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-sm border-b border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
            <ArrowLeft size={22} color="#fff" />
          </button>
          <div className="flex-1">
            <div className="text-xl font-bold text-white">All Users</div>
            <div className="text-xs text-slate-400">Total: {users.length}</div>
          </div>
          <div className="w-10" />
        </div>

        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-slate-800 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded"
              >
                <X size={16} color="#94a3b8" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
          </div>
        ) : filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((user) => {
              const avatarUrl = user.picture ? (getImageUrl(user.picture) || user.picture) : null;
              const displayName = user.name || user.username || 'Unknown User';
              return (
                <button
                  key={user.id}
                  onClick={() => handleUserClick(user.id)}
                  className="w-full flex items-center p-3 bg-slate-800/60 rounded-xl border border-slate-700/50 hover:border-purple-500/50 transition-colors text-left"
                >
                  <div className="relative mr-3">
                    <img
                      src={getAvatarImageSource(avatarUrl || '')?.uri || avatarUrl || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50'}
                      className="w-14 h-14 rounded-full object-cover border-2 border-purple-500/30"
                      alt={displayName}
                    />
                    {user.isActive && (
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-900" />
                    )}
                    {user.isAdmin && (
                      <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5">
                        <Shield size={12} color="#ffffff" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-base font-semibold text-white truncate">{displayName}</p>
                      {user.isAdmin && (
                        <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full flex-shrink-0">
                          Admin
                        </span>
                      )}
                      {user.isActive === false && (
                        <span className="text-xs bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full flex-shrink-0">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400 truncate">@{user.username || 'no-username'}</p>
                  </div>
                  <Users size={20} color="#7C3AED" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-10">
            <Users size={64} color="#9CA3AF" />
            <p className="text-lg font-semibold text-gray-400 mt-4">
              {searchTerm ? 'No users found' : 'No users yet'}
            </p>
            <p className="text-sm text-gray-500 mt-2 text-center">
              {searchTerm ? 'Try a different search term' : 'Users will appear here once they register'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

