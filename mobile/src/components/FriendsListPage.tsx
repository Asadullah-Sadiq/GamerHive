import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, X, ArrowLeft, Users } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';
import { getAvatarImageSource } from '../utils/avatarUtils';
import { PageType } from '../../types';

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
  goToPage?: (page: PageType, params?: any) => void;
  onBack?: () => void;
}

const FriendsListPage: React.FC<FriendsListPageProps> = ({ goToPage, onBack }) => {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Load friends list
  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      setLoading(true);
      const userData = await AsyncStorage.getItem('user');
      if (!userData) {
        setLoading(false);
        return;
      }

      const user = JSON.parse(userData);
      setUserId(user.id);

      // Load profile data to get friends
      const response = await api.get(`/user/profile/${user.id}`);
      if (response.data.success) {
        const userData = response.data.data.user;
        
        if (userData.friends && userData.friends.length > 0) {
          const friendsList = userData.friends.map((friend: any) => ({
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
      }
    } catch (error) {
      console.error('Error loading friends:', error);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter friends based on search term
  const filteredFriends = useMemo(() => {
    if (!searchTerm.trim()) {
      return friends;
    }

    const searchLower = searchTerm.toLowerCase();
    return friends.filter(friend => {
      return (
        friend.name.toLowerCase().includes(searchLower) ||
        friend.username.toLowerCase().includes(searchLower)
      );
    });
  }, [friends, searchTerm]);

  // Handle friend click - navigate to friend's profile
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft width={24} height={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={styles.headerRight}>
          <Text style={styles.friendsCount}>{friends.length}</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search width={20} height={20} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          placeholderTextColor="#9CA3AF"
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearButton}>
            <X width={18} height={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Friends List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : filteredFriends.length > 0 ? (
        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={async () => {
                setRefreshing(true);
                await loadFriends();
                setRefreshing(false);
              }} 
              tintColor="#7c3aed" 
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.friendItem}
              onPress={() => handleFriendClick(item.id)}
            >
              <View style={styles.friendAvatarContainer}>
                <Image
                  source={getAvatarImageSource(item.avatar)}
                  style={styles.friendAvatar}
                />
                {/* Online Status Dot */}
                {item.isActive && (
                  <View style={styles.friendOnlineStatusDot} />
                )}
              </View>
              <View style={styles.friendInfo}>
                <Text style={styles.friendName}>{item.name}</Text>
                <Text style={styles.friendUsername}>@{item.username}</Text>
                {item.activeTime && (
                  <Text style={styles.friendActiveTime}>{item.activeTime}</Text>
                )}
              </View>
              <Users width={20} height={20} color="#7C3AED" />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={true}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Users width={64} height={64} color="#9CA3AF" />
          <Text style={styles.emptyText}>
            {searchTerm ? 'No friends found' : 'No friends yet'}
          </Text>
          {!searchTerm && (
            <Text style={styles.emptySubtext}>
              Start adding friends to see them here
            </Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1020',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  friendsCount: {
    color: '#7C3AED',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.6)',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.1)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  clearButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.1)',
  },
  friendAvatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  friendAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
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
  friendInfo: {
    flex: 1,
  },
  friendName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  friendUsername: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  friendActiveTime: {
    color: '#7C3AED',
    fontSize: 12,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
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

export default FriendsListPage;

