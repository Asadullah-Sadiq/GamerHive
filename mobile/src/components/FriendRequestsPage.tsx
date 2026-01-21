import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, UserPlus, CheckCircle, XCircle, Users } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../utils/api';
import { getAvatarImageSource } from '../utils/avatarUtils';
import { PageType } from '../../types';
import { playNotificationSound } from '../utils/sound';

interface FriendRequest {
  _id: string;
  id: string;
  name: string;
  username: string;
  picture?: string;
  email?: string;
}

interface FriendRequestsPageProps {
  goToPage?: (page: PageType, params?: any) => void;
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
      const userData = await AsyncStorage.getItem('user');
      if (!userData) {
        setLoading(false);
        return;
      }

      const user = JSON.parse(userData);
      setUserId(user.id);

      const response = await api.get(`/user/friend-request/received?userId=${user.id}`);
      if (response.data.success) {
        const requests = response.data.data.friendRequests.map((req: any) => {
          // Handle both populated and non-populated data
          const userData = req._id ? req : (req.userId || req);
          
          return {
            _id: userData._id || userData.id,
            id: userData._id || userData.id,
            name: userData.name || userData.username || 'Unknown User',
            username: userData.username || userData.name || 'unknown',
            picture: userData.picture || userData.avatar || "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50",
            email: userData.email || '',
          };
        });
        setFriendRequests(requests);
      }
    } catch (error) {
      console.error('Error loading friend requests:', error);
      Alert.alert('Error', 'Failed to load friend requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    if (!userId || processingIds.has(requestId)) return;

    try {
      setProcessingIds(prev => new Set(prev).add(requestId));

      const response = await api.post('/user/friend-request/accept', {
        userId: userId,
        targetUserId: requestId,
      });

      if (response.data.success) {
        // Remove from list
        setFriendRequests(prev => prev.filter(req => req.id !== requestId));
        
        // Play notification sound
        await playNotificationSound();
        
        Alert.alert('Success', 'Friend request accepted!');
      } else {
        Alert.alert('Error', response.data.message || 'Failed to accept friend request');
      }
    } catch (error: any) {
      console.error('Accept friend request error:', error);
      Alert.alert('Error', error.message || 'Failed to accept friend request');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  const handleReject = async (requestId: string) => {
    if (!userId || processingIds.has(requestId)) return;

    try {
      setProcessingIds(prev => new Set(prev).add(requestId));

      const response = await api.post('/user/friend-request/reject', {
        userId: userId,
        targetUserId: requestId,
      });

      if (response.data.success) {
        // Remove from list
        setFriendRequests(prev => prev.filter(req => req.id !== requestId));
        
        // Play notification sound
        await playNotificationSound();
        
        Alert.alert('Success', 'Friend request rejected');
      } else {
        Alert.alert('Error', response.data.message || 'Failed to reject friend request');
      }
    } catch (error: any) {
      console.error('Reject friend request error:', error);
      Alert.alert('Error', error.message || 'Failed to reject friend request');
    } finally {
      setProcessingIds(prev => {
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ArrowLeft width={24} height={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Friend Requests</Text>
        <View style={styles.headerRight}>
          <Text style={styles.requestCount}>{friendRequests.length}</Text>
        </View>
      </View>

      {/* Friend Requests List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : friendRequests.length > 0 ? (
        <FlatList
          data={friendRequests}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={async () => {
                setRefreshing(true);
                await loadFriendRequests();
                setRefreshing(false);
              }} 
              tintColor="#7c3aed" 
            />
          }
          renderItem={({ item }) => {
            const isProcessing = processingIds.has(item.id);
            return (
              <View style={styles.requestItem}>
                <View style={styles.topSection}>
                  <TouchableOpacity
                    style={styles.userInfo}
                    onPress={() => handleViewProfile(item.id)}
                    disabled={isProcessing}
                  >
                    <View style={styles.avatarContainer}>
                      <Image
                        source={getAvatarImageSource(item.picture)}
                        style={styles.userAvatar}
                      />
                    </View>
                    <Text style={styles.userName} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.acceptButton, isProcessing && styles.disabledButton]}
                    onPress={() => handleAccept(item.id)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <CheckCircle width={18} height={18} color="#fff" />
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rejectButton, isProcessing && styles.disabledButton]}
                    onPress={() => handleReject(item.id)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <XCircle width={18} height={18} color="#fff" />
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={true}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <UserPlus width={64} height={64} color="#9CA3AF" />
          <Text style={styles.emptyText}>No friend requests</Text>
          <Text style={styles.emptySubtext}>
            When someone sends you a friend request, it will appear here
          </Text>
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
  requestCount: {
    color: '#7C3AED',
    fontSize: 16,
    fontWeight: '600',
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
  requestItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  topSection: {
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  userName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
    minWidth: 100,
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
    minWidth: 100,
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
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

export default FriendRequestsPage;

