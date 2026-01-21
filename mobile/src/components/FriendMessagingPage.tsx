import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, MessageSquare } from 'lucide-react-native';
import api, { getImageUrl } from '../utils/api';
import { getAvatarImageSource } from '../utils/avatarUtils';
import { PageType } from '../../types';

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
  goToPage: (page: PageType, params?: any) => void;
}

const FriendMessagingPage: React.FC<FriendMessagingPageProps> = ({ goToPage }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => (c.username || '').toLowerCase().includes(q));
  }, [conversations, query]);

  const load = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      const user = userData ? JSON.parse(userData) : null;
      const userId = user?.id || user?._id;
      setCurrentUserId(userId || null);
      if (!userId) {
        setConversations([]);
        return;
      }

      const resp = await api.get(`/direct/conversations/${userId}`);
      if (resp.data?.success) {
        setConversations(resp.data.data?.conversations || []);
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

  const renderItem = ({ item }: { item: ConversationRow }) => {
    const avatar = item.avatar || '';
    const unread = item.unreadCount || 0;
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.8}
        onPress={() => {
          goToPage('ptpMessaging', {
            targetUserId: item.userId,
            targetUsername: item.username,
            targetUserAvatar: item.avatar,
          });
        }}
      >
        <Image
          source={getAvatarImageSource(getImageUrl(avatar))}
          style={styles.avatar}
        />
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.username} numberOfLines={1}>
              {item.username || 'User'}
            </Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
          <Text style={styles.preview} numberOfLines={1}>
            {item.lastMessage?.type === 'image'
              ? '📷 Photo'
              : item.lastMessage?.type === 'video'
              ? '🎥 Video'
              : item.lastMessage?.type === 'audio'
              ? '🎤 Voice'
              : item.lastMessage?.type === 'file'
              ? '📎 File'
              : item.lastMessage?.content || 'Start chatting'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MessageSquare size={20} color="#a78bfa" />
          <Text style={styles.title}>Friend Messaging</Text>
        </View>
        <View style={styles.searchBox}>
          <Search size={18} color="#9CA3AF" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor="#6B7280"
            style={styles.searchInput}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#a78bfa" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.userId}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#a78bfa" />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No chats yet</Text>
              <Text style={styles.emptySub}>Start a direct message from a profile.</Text>
            </View>
          }
        />
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.18)',
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 8, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginBottom: 6,
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.12)',
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  username: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  preview: { color: '#9CA3AF', fontSize: 13, marginTop: 3 },
  unreadBadge: {
    minWidth: 22,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  empty: { paddingTop: 50, alignItems: 'center' },
  emptyTitle: { color: '#E5E7EB', fontSize: 16, fontWeight: '700' },
  emptySub: { color: '#9CA3AF', fontSize: 13, marginTop: 6, textAlign: 'center' },
});

export default FriendMessagingPage;


