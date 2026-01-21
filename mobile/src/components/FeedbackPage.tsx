import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import {
  ArrowLeft,
  Mail,
  User,
  MessageSquare,
  Calendar,
  CheckCircle,
  Circle,
  Reply,
  Trash2,
  Filter,
  X,
} from 'lucide-react-native';
import api from '../utils/api';
import { getImageUrl } from '../utils/api';
import {
  getAvatarImageSource,
  isLocalAvatarUrl,
} from '../utils/avatarUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Feedback {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'resolved';
  reply?: {
    message: string;
    repliedBy?: {
      id: string;
      username: string;
      email: string;
      picture?: string;
    } | null;
    repliedAt: string;
  } | null;
  userId?: {
    id: string;
    username: string;
    email: string;
    picture?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface FeedbackPageProps {
  onBack: () => void;
}

const FeedbackPage: React.FC<FeedbackPageProps> = ({ onBack }) => {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    read: 0,
    replied: 0,
    resolved: 0,
  });

  useEffect(() => {
    fetchFeedback();
    fetchStats();
    loadAdminId();
  }, [selectedStatus]);

  const loadAdminId = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        setCurrentAdminId(user.id || user._id);
      }
    } catch (error) {
      console.error('Error loading admin ID:', error);
    }
  };

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, limit: 100 };
      if (selectedStatus) {
        params.status = selectedStatus;
      }

      const response = await api.get('/feedback', { params });
      if (response.data.success) {
        setFeedback(response.data.data.feedback);
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
      Alert.alert('Error', 'Failed to load feedback');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/feedback/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching feedback stats:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeedback();
    fetchStats();
  };

  const handleStatusChange = async (feedbackId: string, newStatus: 'new' | 'read' | 'replied' | 'resolved') => {
    try {
      // If changing to "replied", show reply input
      if (newStatus === 'replied' && !selectedFeedback?.reply) {
        setShowReplyInput(true);
        return;
      }

      const response = await api.put(`/feedback/${feedbackId}/status`, { status: newStatus });
      if (response.data.success) {
        const updatedFeedback = response.data.data.feedback;
        setFeedback((prev) =>
          prev.map((f) => (f.id === feedbackId ? updatedFeedback : f))
        );
        fetchStats();
        if (selectedFeedback?.id === feedbackId) {
          setSelectedFeedback(updatedFeedback);
        }
        Alert.alert('Success', 'Status updated successfully');
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !selectedFeedback || !currentAdminId) {
      Alert.alert('Error', 'Please enter a reply message');
      return;
    }

    setSendingReply(true);
    try {
      const response = await api.post(`/feedback/${selectedFeedback.id}/reply`, {
        replyMessage: replyMessage.trim(),
        adminId: currentAdminId,
      });

      if (response.data.success) {
        const updatedFeedback = response.data.data.feedback;
        setFeedback((prev) =>
          prev.map((f) => (f.id === selectedFeedback.id ? updatedFeedback : f))
        );
        setSelectedFeedback(updatedFeedback);
        setReplyMessage('');
        setShowReplyInput(false);
        fetchStats();
        Alert.alert('Success', 'Reply sent successfully');
      }
    } catch (error: any) {
      console.error('Error sending reply:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleDelete = async (feedbackId: string) => {
    Alert.alert(
      'Delete Feedback',
      'Are you sure you want to delete this feedback?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await api.delete(`/feedback/${feedbackId}`);
              if (response.data.success) {
                setFeedback((prev) => prev.filter((f) => f.id !== feedbackId));
                fetchStats();
                if (selectedFeedback?.id === feedbackId) {
                  setShowDetailModal(false);
                  setSelectedFeedback(null);
                }
                Alert.alert('Success', 'Feedback deleted successfully');
              }
            } catch (error: any) {
              console.error('Error deleting feedback:', error);
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete feedback');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return '#3B82F6';
      case 'read':
        return '#8B5CF6';
      case 'replied':
        return '#10B981';
      case 'resolved':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new':
        return <Circle size={12} color="#3B82F6" fill="#3B82F6" />;
      case 'read':
        return <CheckCircle size={12} color="#8B5CF6" />;
      case 'replied':
        return <Reply size={12} color="#10B981" />;
      case 'resolved':
        return <CheckCircle size={12} color="#6B7280" />;
      default:
        return <Circle size={12} color="#6B7280" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User Feedback</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Stats Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsContainer}
        contentContainerStyle={styles.statsContent}
      >
        <TouchableOpacity
          style={[styles.statCard, selectedStatus === null && styles.statCardActive]}
          onPress={() => setSelectedStatus(null)}
        >
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, selectedStatus === 'new' && styles.statCardActive]}
          onPress={() => setSelectedStatus('new')}
        >
          <View style={styles.statCardHeader}>
            <Text style={[styles.statValue, { color: '#3B82F6' }]}>{stats.new}</Text>
            {stats.new > 0 && (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>{stats.new}</Text>
              </View>
            )}
          </View>
          <Text style={styles.statLabel}>New (Unread)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, selectedStatus === 'read' && styles.statCardActive]}
          onPress={() => setSelectedStatus('read')}
        >
          <Text style={[styles.statValue, { color: '#8B5CF6' }]}>{stats.read}</Text>
          <Text style={styles.statLabel}>Read</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, selectedStatus === 'replied' && styles.statCardActive]}
          onPress={() => setSelectedStatus('replied')}
        >
          <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.replied}</Text>
          <Text style={styles.statLabel}>Replied</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statCard, selectedStatus === 'resolved' && styles.statCardActive]}
          onPress={() => setSelectedStatus('resolved')}
        >
          <Text style={[styles.statValue, { color: '#6B7280' }]}>{stats.resolved}</Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Feedback List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : feedback.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Mail size={48} color="#64748b" />
          <Text style={styles.emptyText}>No feedback found</Text>
          <Text style={styles.emptySubtext}>
            {selectedStatus ? `No ${selectedStatus} feedback` : 'No feedback submitted yet'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />}
        >
          {feedback.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.feedbackCard}
              onPress={async () => {
                // Mark as read if it's new
                if (item.status === 'new') {
                  try {
                    await api.put(`/feedback/${item.id}/status`, { status: 'read' });
                    // Update local state
                    setFeedback((prev) =>
                      prev.map((f) => (f.id === item.id ? { ...f, status: 'read' } : f))
                    );
                    // Update stats
                    fetchStats();
                    // Update selected feedback with new status
                    setSelectedFeedback({ ...item, status: 'read' });
                  } catch (error: any) {
                    console.error('Error marking feedback as read:', error);
                    // Still open the modal even if status update fails
                    setSelectedFeedback(item);
                  }
                } else {
                  setSelectedFeedback(item);
                }
                setShowDetailModal(true);
              }}
            >
              {/* Unread indicator */}
              {item.status === 'new' && (
                <View style={styles.unreadIndicator}>
                  <View style={styles.unreadDot} />
                </View>
              )}
              <View style={styles.feedbackHeader}>
                <View style={styles.feedbackHeaderLeft}>
                  {/* User Profile Picture or Status Indicator */}
                  {item.userId?.picture ? (
                    <View style={styles.profileImageContainer}>
                      <Image
                        source={getAvatarImageSource(item.userId.picture)}
                        style={styles.profileImage}
                        onError={() => {
                          // Silently handle image errors
                        }}
                      />
                    </View>
                  ) : (
                    <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) }]}>
                      {getStatusIcon(item.status)}
                    </View>
                  )}
                  <View style={styles.feedbackInfo}>
                    <Text style={styles.feedbackName}>
                      {item.userId?.username || item.name}
                    </Text>
                    <Text style={styles.feedbackEmail}>
                      {item.userId?.email || item.email}
                    </Text>
                  </View>
                </View>
                <Text style={styles.feedbackDate}>{formatDate(item.createdAt)}</Text>
              </View>
              <Text style={styles.feedbackSubject}>{item.subject}</Text>
              <Text style={styles.feedbackMessage} numberOfLines={2}>
                {item.message}
              </Text>
              {item.userId && (
                <View style={styles.userBadge}>
                  <User size={12} color="#a78bfa" />
                  <Text style={styles.userBadgeText}>Registered User: {item.userId.username}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowDetailModal(false);
          setShowReplyInput(false);
          setReplyMessage('');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowDetailModal(false);
              setShowReplyInput(false);
              setReplyMessage('');
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
              style={styles.modalContent}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Feedback Details</Text>
                <TouchableOpacity onPress={() => {
                  setShowDetailModal(false);
                  setShowReplyInput(false);
                  setReplyMessage('');
                }}>
                  <X size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              {selectedFeedback && (
                <ScrollView
                  style={styles.modalBody}
                  contentContainerStyle={styles.modalBodyContent}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                >
                {/* User Profile Section */}
                <View style={styles.detailSection}>
                  {selectedFeedback.userId?.picture ? (
                    <View style={styles.detailProfileHeader}>
                      <Image
                        source={getAvatarImageSource(selectedFeedback.userId.picture)}
                        style={styles.detailProfileHeaderImage}
                        onError={() => {
                          // Silently handle image errors
                        }}
                      />
                      <View style={styles.detailProfileHeaderInfo}>
                        <Text style={styles.detailProfileHeaderName}>
                          {selectedFeedback.userId.username}
                        </Text>
                        <Text style={styles.detailProfileHeaderEmail}>
                          {selectedFeedback.userId.email}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.detailRow}>
                      <User size={18} color="#a78bfa" />
                      <View style={styles.detailInfo}>
                        <Text style={styles.detailLabel}>Name</Text>
                        <Text style={styles.detailValue}>{selectedFeedback.name}</Text>
                      </View>
                    </View>
                  )}
                </View>

                {!selectedFeedback.userId && (
                  <View style={styles.detailSection}>
                    <View style={styles.detailRow}>
                      <Mail size={18} color="#a78bfa" />
                      <View style={styles.detailInfo}>
                        <Text style={styles.detailLabel}>Email</Text>
                        <Text style={styles.detailValue}>{selectedFeedback.email}</Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <MessageSquare size={18} color="#a78bfa" />
                    <View style={styles.detailInfo}>
                      <Text style={styles.detailLabel}>Subject</Text>
                      <Text style={styles.detailValue}>{selectedFeedback.subject}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Message</Text>
                  <Text style={styles.detailMessage}>{selectedFeedback.message}</Text>
                </View>

                <View style={styles.detailSection}>
                  <View style={styles.detailRow}>
                    <Calendar size={18} color="#a78bfa" />
                    <View style={styles.detailInfo}>
                      <Text style={styles.detailLabel}>Submitted</Text>
                      <Text style={styles.detailValue}>{formatDate(selectedFeedback.createdAt)}</Text>
                    </View>
                  </View>
                </View>

                {/* Reply Section */}
                {selectedFeedback.reply ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Admin Reply</Text>
                    <View style={styles.replyContainer}>
                      <Text style={styles.replyMessage}>{selectedFeedback.reply.message}</Text>
                      <Text style={styles.replyDate}>
                        Replied on {formatDate(selectedFeedback.reply.repliedAt)}
                      </Text>
                    </View>
                  </View>
                ) : showReplyInput ? (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>Reply to User</Text>
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Type your reply message..."
                      placeholderTextColor="#94A3B8"
                      multiline
                      numberOfLines={4}
                      value={replyMessage}
                      onChangeText={setReplyMessage}
                    />
                    <View style={styles.replyActions}>
                      <TouchableOpacity
                        style={styles.cancelReplyButton}
                        onPress={() => {
                          setShowReplyInput(false);
                          setReplyMessage('');
                        }}
                      >
                        <Text style={styles.cancelReplyText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.sendReplyButton, (!replyMessage.trim() || sendingReply) && styles.sendReplyButtonDisabled]}
                        onPress={handleSendReply}
                        disabled={!replyMessage.trim() || sendingReply}
                      >
                        {sendingReply ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.sendReplyText}>Send Reply</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={styles.statusButtons}>
                    {(['new', 'read', 'replied', 'resolved'] as const).map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.statusButton,
                          selectedFeedback.status === status && styles.statusButtonActive,
                          { borderColor: getStatusColor(status) },
                        ]}
                        onPress={() => handleStatusChange(selectedFeedback.id, status)}
                      >
                        <Text
                          style={[
                            styles.statusButtonText,
                            selectedFeedback.status === status && { color: getStatusColor(status) },
                          ]}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(selectedFeedback.id)}
                >
                  <Trash2 size={18} color="#EF4444" />
                  <Text style={styles.deleteButtonText}>Delete Feedback</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  placeholder: {
    width: 40,
  },
  statsContainer: {
    maxHeight: 100,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  statsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statCard: {
    backgroundColor: '#0B1020',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statCardActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#1E1B4B',
  },
  statCardHeader: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  newBadge: {
    position: 'absolute',
    top: -8,
    right: -12,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0B1020',
  },
  newBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  listContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  feedbackCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
  },
  unreadIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  feedbackHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#7C3AED',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  statusIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailProfileImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#7C3AED',
  },
  detailProfileImage: {
    width: '100%',
    height: '100%',
  },
  feedbackInfo: {
    flex: 1,
  },
  feedbackName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  feedbackEmail: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  feedbackDate: {
    fontSize: 12,
    color: '#64748B',
  },
  feedbackSubject: {
    fontSize: 15,
    fontWeight: '600',
    color: '#A78BFA',
    marginBottom: 8,
  },
  feedbackMessage: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  userBadgeText: {
    fontSize: 12,
    color: '#A78BFA',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Dimensions.get('window').height * 0.9,
    width: '100%',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailProfileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#0B1020',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  detailProfileHeaderImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#7C3AED',
  },
  detailProfileHeaderInfo: {
    marginLeft: 16,
    flex: 1,
  },
  detailProfileHeaderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  detailProfileHeaderEmail: {
    fontSize: 14,
    color: '#94A3B8',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailInfo: {
    marginLeft: 12,
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#94A3B8',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  detailMessage: {
    fontSize: 15,
    color: '#CBD5E1',
    lineHeight: 22,
    marginTop: 8,
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: '#0B1020',
  },
  statusButtonActive: {
    backgroundColor: '#1E1B4B',
  },
  statusButtonText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1F2937',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '600',
    marginLeft: 8,
  },
  replyContainer: {
    backgroundColor: '#0B1020',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 8,
  },
  replyMessage: {
    fontSize: 15,
    color: '#CBD5E1',
    lineHeight: 22,
    marginBottom: 8,
  },
  replyDate: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  replyInput: {
    backgroundColor: '#0B1020',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#fff',
    fontSize: 15,
    textAlignVertical: 'top',
    minHeight: 100,
    marginTop: 8,
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 12,
  },
  cancelReplyButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelReplyText: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  sendReplyButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
  },
  sendReplyButtonDisabled: {
    opacity: 0.5,
  },
  sendReplyText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default FeedbackPage;

