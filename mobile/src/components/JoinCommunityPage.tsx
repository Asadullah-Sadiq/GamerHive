import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Pressable,
  Dimensions,
  ActionSheetIOS,
  ActivityIndicator,
  PanResponder,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
// Expo SDK 54: the old function-based FileSystem API is now under the legacy import.
// Using the non-legacy import can throw deprecation errors at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { VideoView, useVideoPlayer } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { getImageUrl } from '../utils/api';
import { getAvatarImageSource } from '../utils/avatarUtils';
import { 
  socketService, 
  ConnectionStatus, 
  SocketMessage, 
  TypingUser 
} from '../utils/socketService';
import {
  ArrowLeft,
  Send,
  Smile,
  Camera,
  Mic,
  Paperclip,
  Phone,
  Video,
  MoreVertical,
  Users,
  Search,
  VolumeX,
  Volume2,
  Image as ImageIcon,
  Play,
  Pause,
  Reply,
  Copy,
  Edit3,
  Trash2,
  Crown,
  Shield,
  Star,
  User,
  Clock,
  CheckCircle,
  Check,
  X,
  Video as VideoIcon,
  ImagePlus,
  MessageSquare,
  AlertTriangle,
  Settings,
  Bell,
  LogOut,
  Share2,
  Wifi,
  WifiOff,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Lightweight video player wrapper (Expo SDK 54+)
const CommunityVideoPlayer: React.FC<{ videoUri: string }> = ({ videoUri }) => {
  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  return (
    <View
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        nativeControls
        contentFit="contain"
        allowsPictureInPicture={true}
      />
    </View>
  );
};

export interface Community {
  id: string;
  name: string;
  game: string;
  description: string;
  members: number;
  activeMembers: number;
  createdDate: string;
  category: string;
  categories?: string[]; // Optional for backward compatibility
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro';
  image: string;
  color: string;
  icon: React.ComponentType<any>;
  isMember?: boolean;
}

interface Message {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  duration?: string;
  isEdited?: boolean;
  replyTo?: {
    id: string;
    username: string;
    content: string;
    type: string;
  };
  reactions?: {
    emoji: string;
    users: string[];
    count: number;
  }[];
  status: 'sending' | 'sent' | 'delivered' | 'read';
  readBy?: Array<{ userId: string; readAt: string }>;
  readCount?: number;
  totalRecipients?: number;
  moderationCategory?: 'SAFE' | 'MILD_INSULT' | 'HARMFUL' | null;
  hasWarning?: boolean;
}

interface Member {
  id: string;
  userId?: string;
  username: string;
  avatar: string;
  role: 'owner' | 'admin' | 'moderator' | 'member';
  status: 'online' | 'away' | 'offline';
  lastSeen?: string;
  joinDate: string;
  email?: string;
}

interface JoinCommunityPageProps {
  community: Community;
  onBack: () => void;
  onViewProfile?: (userId: string) => void;
}

const JoinCommunityPage: React.FC<JoinCommunityPageProps> = ({ community, onBack, onViewProfile }) => {
  const [showCommunityInfo, setShowCommunityInfo] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [infoTab, setInfoTab] = useState<'members' | 'media'>('members');
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [communityData, setCommunityData] = useState<Community>(community);

  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedMedia, setSelectedMedia] = useState<Message | null>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  // Socket-related state
  const [socketConnected, setSocketConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map()); // userId -> username
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<FlatList<Message>>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const swipeAnimations = useRef<Map<string, Animated.Value>>(new Map());
  const swipeOffsets = useRef<Map<string, number>>(new Map());
  
  // Chunked streaming state
  const receivingChunks = useRef<Map<string, { chunks: string[]; totalChunks: number; receivedChunks: number; fileName: string; fileType: string }>>(new Map());
  const CHUNK_SIZE = 64 * 1024; // 64KB chunks
  // Some Expo/Metro environments can omit `FileSystem.EncodingType` at runtime.
  // Fall back to the literal encoding string to avoid crashes like:
  // "Cannot read property 'Base64' of undefined"
  const BASE64_ENCODING: any = (FileSystem as any)?.EncodingType?.Base64 ?? 'base64';

  // Load current user from AsyncStorage and initialize socket
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          setCurrentUser(user);
        }
      } catch (error) {
        console.error('Error loading current user:', error);
      }
    };
    loadCurrentUser();
  }, []);

  // Socket connection and event handling
  useEffect(() => {
    if (!currentUser || !communityData.id) return;

    const userId = currentUser.id || currentUser._id;
    const username = currentUser.username || 'User';

    // Set up socket event handlers BEFORE connecting
    socketService.setEventHandlers({
      onConnect: () => {
        console.log('[JoinCommunityPage] Socket connected');
        setSocketConnected(true);
        setConnectionStatus('connected');
        // Join the community room
        socketService.joinCommunity(communityData.id);
      },

      onDisconnect: (reason) => {
        console.log('[JoinCommunityPage] Socket disconnected:', reason);
        setSocketConnected(false);
        setConnectionStatus('disconnected');
      },

      onConnectionStatusChange: (status) => {
        setConnectionStatus(status);
        setSocketConnected(status === 'connected');
      },

      onChunkedMediaStart: (data) => {
        console.log('[Socket] 📦 Chunked media start received:', {
          messageId: data.messageId,
          fileName: data.fileName,
          fileType: data.fileType,
          totalChunks: data.totalChunks,
          fileSize: data.fileSize,
        });
        receivingChunks.current.set(data.messageId, {
          chunks: new Array(data.totalChunks),
          totalChunks: data.totalChunks,
          receivedChunks: 0,
          fileName: data.fileName,
          fileType: data.fileType,
        });
        
        // Update message status to show it's receiving chunks
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id === data.messageId || msg.fileName === data.fileName) {
              return {
                ...msg,
                status: 'sending' as const,
              };
            }
            return msg;
          })
        );
      },

      onChunkedMediaChunk: async (data) => {
        let chunkData = receivingChunks.current.get(data.messageId);
        if (!chunkData) {
          // If chunk data doesn't exist, create it (might have missed start event)
          console.warn('[Socket] Received chunk for unknown message, creating entry:', data.messageId);
          chunkData = {
            chunks: [],
            totalChunks: 0, // Will be updated
            receivedChunks: 0,
            fileName: `file_${data.messageId}`,
            fileType: 'image',
          };
          receivingChunks.current.set(data.messageId, chunkData);
        }

        // Initialize chunks array if needed
        if (!chunkData.chunks || chunkData.chunks.length === 0) {
          chunkData.chunks = new Array(chunkData.totalChunks || 1000); // Large array for safety
        }

        chunkData.chunks[data.chunkIndex] = data.chunk;
        chunkData.receivedChunks++;

        const progress = chunkData.totalChunks > 0 
          ? ((chunkData.receivedChunks / chunkData.totalChunks) * 100).toFixed(1)
          : '0';
        console.log(`[Socket] 📦 Chunk ${data.chunkIndex + 1}/${chunkData.totalChunks} received (${progress}%) for ${data.messageId}`);

        // Update message with progress indicator
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id === data.messageId) {
              return {
                ...msg,
                status: chunkData.receivedChunks === chunkData.totalChunks ? 'sent' as const : 'sending' as const,
              };
            }
            return msg;
          })
        );

        // If all chunks received, reassemble
        if (data.isLastChunk && chunkData.receivedChunks === chunkData.totalChunks) {
          try {
            // Filter out undefined chunks (in case of gaps)
            const validChunks = chunkData.chunks.filter(chunk => chunk !== undefined && chunk !== null);
            const base64Data = validChunks.join('');
            
            // Generate unique filename
            const timestamp = Date.now();
            const ext = chunkData.fileName.split('.').pop() || (chunkData.fileType === 'image' ? 'jpg' : 'mp4');
            const fileName = `${chunkData.fileType}_${timestamp}.${ext}`;
            const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
            
            // Save reassembled file
            await FileSystem.writeAsStringAsync(fileUri, base64Data, {
              encoding: BASE64_ENCODING,
            });

            console.log('[Socket] ✅ File reassembled and saved:', fileUri);

            // Update message with reassembled file
            setMessages(prev =>
              prev.map(msg => {
                if (msg.id === data.messageId || msg.fileName === chunkData.fileName) {
                  return {
                    ...msg,
                    fileUrl: fileUri,
                    fileName: fileName,
                    status: 'sent' as const,
                  };
                }
                return msg;
              })
            );
          } catch (error) {
            console.error('[Socket] ❌ Error reassembling file:', error);
          } finally {
            receivingChunks.current.delete(data.messageId);
          }
        }
      },

      onChunkedMediaComplete: (data) => {
        console.log('[Socket] ✅ Chunked media complete:', data.messageId);
        // Update message with final file URL from server
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id === data.messageId) {
              return {
                ...msg,
                fileUrl: data.fileUrl,
                status: 'sent' as const,
              };
            }
            return msg;
          })
        );
      },

      onNewMessage: (socketMessage: SocketMessage) => {
        console.log('[Socket] 📨 New message received:', socketMessage.username, '-', socketMessage.content?.substring(0, 30));
        console.log('[Socket] Message details:', {
          id: socketMessage.id,
          type: socketMessage.type,
          fileUrl: socketMessage.fileUrl,
          hasFileUrl: !!socketMessage.fileUrl,
        });
        
        const newMsg: Message = {
          id: socketMessage.id || socketMessage._id || `temp-${Date.now()}-${Math.random()}`,
          userId: socketMessage.userId,
          username: socketMessage.username,
          avatar: socketMessage.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
          content: socketMessage.content,
          timestamp: socketMessage.timestamp,
          type: socketMessage.type,
          fileUrl: socketMessage.fileUrl, // This should be localhost URL from server
          fileName: socketMessage.fileName,
          fileSize: socketMessage.fileSize,
          duration: socketMessage.duration,
          status: (socketMessage as any).status || 'sent',
          readBy: (socketMessage as any).readBy || [],
          readCount: (socketMessage as any).readCount || 0,
          totalRecipients: (socketMessage as any).totalRecipients || 0,
          replyTo: socketMessage.replyTo ? {
            id: socketMessage.replyTo.id,
            username: socketMessage.replyTo.username,
            content: socketMessage.replyTo.content,
            type: socketMessage.replyTo.type,
          } : undefined,
          reactions: socketMessage.reactions,
        };

        setMessages(prev => {
          // Check for duplicates by ID
          const existingIndex = prev.findIndex(m => {
            const msgId = m.id?.toString();
            const newMsgId = newMsg.id?.toString();
            const socketId = socketMessage._id?.toString();
            return msgId === newMsgId || msgId === socketId || 
                   (msgId && newMsgId && msgId === newMsgId);
          });
          
          if (existingIndex !== -1) {
            // Update existing message (e.g., update status, fileUrl, etc.)
            console.log('[Socket] Message already exists, updating with socket data...', {
              existingId: prev[existingIndex].id,
              newId: newMsg.id,
              hasFileUrl: !!newMsg.fileUrl,
            });
            const updated = [...prev];
            updated[existingIndex] = { 
              ...updated[existingIndex], 
              ...newMsg, // This will update fileUrl, status, etc. from socket
              // Preserve status from socket message, don't override with 'read'
              status: newMsg.status || updated[existingIndex].status,
              // Ensure fileUrl is updated from socket
              fileUrl: newMsg.fileUrl || updated[existingIndex].fileUrl,
            };
            return updated;
          }
          
          console.log('[Socket] Adding new message to chat', {
            id: newMsg.id,
            type: newMsg.type,
            hasFileUrl: !!newMsg.fileUrl,
          });
          return [...prev, newMsg];
        });

        // Scroll to bottom for new messages
        setTimeout(() => {
          messagesEndRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },

      onUserJoined: (data) => {
        setOnlineUserIds(prev => {
          const newSet = new Set(prev);
          newSet.add(data.userId);
          return newSet;
        });
        // Update members status
        setMembers(prev => prev.map(m => 
          m.userId === data.userId ? { ...m, status: 'online' as const } : m
        ));
      },

      onUserLeft: (data) => {
        setOnlineUserIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
        // Update members status
        setMembers(prev => prev.map(m => 
          m.userId === data.userId ? { ...m, status: 'offline' as const } : m
        ));
        // Remove from typing users
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });
      },

      onOnlineUsers: (data) => {
        console.log('[Socket] 👥 Online users update:', data.users);
        setOnlineUserIds(new Set(data.users));
        // Update members status based on online users
        setMembers(prev => prev.map(m => {
          const userId = m.userId || m.id;
          const isOnline = data.users.includes(userId);
          if (isOnline && m.status !== 'online') {
            console.log(`[Socket] User ${m.username} is now online`);
          }
          return {
            ...m,
            status: isOnline ? 'online' as const : 'offline' as const,
          };
        }));
        // Update active members count
        setCommunityData(prev => ({
          ...prev,
          activeMembers: data.users.length,
        }));
      },

      onUserTyping: (data: TypingUser) => {
        // Don't show typing for current user
        if (data.userId === (currentUser?.id || currentUser?._id)) return;
        
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.set(data.userId, data.username);
          return newMap;
        });
      },

      onUserStoppedTyping: (data) => {
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });
      },

      onMessageDeleted: (data) => {
        const currentUserId = currentUser?.id || currentUser?._id;
        // For "delete for me", server emits only to this user, but guard anyway.
        if (data?.scope === 'me' && data?.userId && currentUserId && data.userId !== currentUserId) return;

        // Clear event
        if (data?.cleared) {
          setMessages([]);
          return;
        }

        // Bulk delete event (delete-for-me multi-device sync)
        if (Array.isArray(data?.messageIds)) {
          // messageIds can be [] meaning "clear chat for me"
          if (data.messageIds.length === 0 && data?.scope === 'me') {
            setMessages([]);
            return;
          }
          const ids = new Set(data.messageIds.map(String));
          setMessages(prev => prev.filter(m => !ids.has(String(m.id))));
          return;
        }

        // Single delete event (delete-for-everyone)
        if (data?.messageId) {
          setMessages(prev => prev.filter(m => String(m.id) !== String(data.messageId)));
        }
      },

      onMessageEdited: (data) => {
        setMessages(prev => prev.map(m => 
          m.id === data.messageId 
            ? { ...m, content: data.newContent, isEdited: data.isEdited }
            : m
        ));
      },

      onReactionUpdated: (data) => {
        setMessages(prev => prev.map(m =>
          m.id === data.messageId
            ? { ...m, reactions: data.reactions }
            : m
        ));
      },

      onMessageModerationUpdate: (data) => {
        console.log('[Socket] 🛡️ Moderation update received:', data);
        setMessages(prev => prev.map(m => {
          if (String(m.id) === String(data.messageId)) {
            return {
              ...m,
              content: data.content,
              moderationCategory: data.moderationCategory as 'SAFE' | 'MILD_INSULT' | 'HARMFUL' | null,
              hasWarning: data.hasWarning,
            };
          }
          return m;
        }));
      },

      onMessagesReadReceipt: (data: any) => {
        // Update message status based on read receipts in real-time
        console.log('[Socket] 📬 Read receipt received:', data);
        if (data.statusUpdates && Array.isArray(data.statusUpdates)) {
          setMessages(prev => prev.map(msg => {
            // Match by both id and _id to handle different ID formats
            const update = data.statusUpdates.find((u: any) => {
              const updateId = u.messageId?.toString();
              const msgId = msg.id?.toString();
              const msg_id = (msg as any)._id?.toString();
              return updateId === msgId || updateId === msg_id;
            });
            if (update) {
              const newReadCount = update.readCount ?? (update.readBy?.length || 0);
              const newTotalRecipients = update.totalRecipients ?? msg.totalRecipients ?? 0;
              
              // Use the status from backend (it's already calculated correctly)
              const finalStatus = update.status || msg.status;
              
              console.log(`[Socket] Updating message ${msg.id}: status=${msg.status}->${finalStatus}, readCount=${newReadCount}/${newTotalRecipients}`);
              return {
                ...msg,
                status: finalStatus,
                readBy: update.readBy || msg.readBy || [],
                readCount: newReadCount,
                totalRecipients: newTotalRecipients,
              };
            }
            return msg;
          }));
        }
      },

      onMessageStatusUpdate: (data: any) => {
        // Update individual message status in real-time
        console.log('[Socket] 📊 Status update received:', data);
        setMessages(prev => prev.map(msg => {
          // Match by both id and _id to handle different ID formats
          const dataMessageId = data.messageId?.toString();
          const msgId = msg.id?.toString();
          const msg_id = (msg as any)._id?.toString();
          
          if (dataMessageId === msgId || dataMessageId === msg_id) {
            const newReadCount = data.readCount ?? (data.readBy?.length || 0);
            const newTotalRecipients = data.totalRecipients ?? msg.totalRecipients ?? 0;
            
            // Use the status from backend (it's already calculated correctly)
            const finalStatus = data.status || msg.status;
            
            console.log(`[Socket] Updating message ${msg.id}: status=${msg.status}->${finalStatus}, readCount=${newReadCount}/${newTotalRecipients}`);
            return {
              ...msg,
              status: finalStatus,
              readBy: data.readBy || msg.readBy || [],
              readCount: newReadCount,
              totalRecipients: newTotalRecipients,
            };
          }
          return msg;
        }));
      },

      onError: (error) => {
        const errorMessage = error?.message || (error as any)?.message || 'An error occurred';
        if (errorMessage.includes('Inappropriate message') || errorMessage === 'Inappropriate message') {
          // Show popup for inappropriate message (not an error)
          Alert.alert('Message Blocked', 'Your message contains inappropriate content and cannot be sent.');
          return;
        }
        // Only log actual errors (not inappropriate messages)
        console.error('[JoinCommunityPage] Socket error:', error);
      },
    });

    // Initialize socket connection AFTER setting event handlers
    socketService.connect(userId, username, communityData.id);

    // Check connection status immediately and periodically until connected
    const checkConnection = () => {
      const currentStatus = socketService.getConnectionStatus();
      const isConnected = socketService.isConnected();
      
      console.log('[JoinCommunityPage] Checking connection status:', { currentStatus, isConnected });
      
      if (isConnected || currentStatus === 'connected') {
        setSocketConnected(true);
        setConnectionStatus('connected');
        socketService.joinCommunity(communityData.id);
        return true; // Connected, stop checking
      } else if (currentStatus === 'connecting' || currentStatus === 'reconnecting') {
        setConnectionStatus(currentStatus);
        return false; // Still connecting, keep checking
      } else {
        setConnectionStatus(currentStatus);
        return false; // Not connected, keep checking
      }
    };

    // Check immediately
    const isConnectedNow = checkConnection();
    
    // If not connected, check periodically (every 500ms for up to 5 seconds)
    let intervalRef: NodeJS.Timeout | null = null;
    if (!isConnectedNow) {
      let attempts = 0;
      const maxAttempts = 10;
      intervalRef = setInterval(() => {
        attempts++;
        const connected = checkConnection();
        if (connected || attempts >= maxAttempts) {
          if (intervalRef) {
            clearInterval(intervalRef);
            intervalRef = null;
          }
        }
      }, 500);
    }

    // Cleanup on unmount
    return () => {
      if (intervalRef) {
        clearInterval(intervalRef);
      }
      // Clear typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      socketService.stopTyping(communityData.id);
      socketService.leaveCommunity(communityData.id);
      socketService.clearEventHandlers();
    };
  }, [currentUser, communityData.id]);

  // Mark messages as read when they're viewed (with debouncing to avoid too many requests)
  useEffect(() => {
    if (!currentUser || !socketConnected || messages.length === 0) return;

    // Debounce: wait a bit before marking as read to batch multiple messages
    const timeoutId = setTimeout(() => {
      // Get unread messages (messages not sent by current user that haven't been read by current user)
      const unreadMessageIds = messages
        .filter(msg => {
          const isNotFromCurrentUser = msg.userId !== (currentUser.id || currentUser._id);
          const isNotRead = !msg.readBy?.some(r => r.userId === (currentUser.id || currentUser._id));
          return isNotFromCurrentUser && isNotRead;
        })
        .map(msg => msg.id);

      // Mark messages as read if there are any unread messages
      if (unreadMessageIds.length > 0 && socketService.isConnected()) {
        console.log(`[Read Receipt] Marking ${unreadMessageIds.length} messages as read`);
        socketService.markMessagesRead(communityData.id, unreadMessageIds);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [messages, currentUser, socketConnected, communityData.id]);

  // Mark messages as read when they're viewed (with debouncing to avoid too many requests)
  useEffect(() => {
    if (!currentUser || !socketConnected || messages.length === 0) return;

    // Debounce: wait a bit before marking as read to batch multiple messages
    const timeoutId = setTimeout(() => {
      // Get unread messages (messages not sent by current user that haven't been read by current user)
      const unreadMessageIds = messages
        .filter(msg => {
          const isNotFromCurrentUser = msg.userId !== (currentUser.id || currentUser._id);
          const isNotRead = !msg.readBy?.some(r => r.userId === (currentUser.id || currentUser._id));
          return isNotFromCurrentUser && isNotRead;
        })
        .map(msg => msg.id);

      // Mark messages as read if there are any unread messages
      if (unreadMessageIds.length > 0 && socketService.isConnected()) {
        console.log(`[Read Receipt] Marking ${unreadMessageIds.length} messages as read`);
        socketService.markMessagesRead(communityData.id, unreadMessageIds);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [messages, currentUser, socketConnected, communityData.id]);

  // Handle typing indicator
  const handleTextChange = useCallback((text: string) => {
    setNewMessage(text);
    
    if (!communityData.id) return;

    // Start typing indicator
    if (text.length > 0) {
      socketService.startTyping(communityData.id);
    } else {
      socketService.stopTyping(communityData.id);
    }
  }, [communityData.id]);

  // Fetch messages from API
  const fetchMessages = async () => {
    try {
      setLoadingMessages(true);
      const currentUserId = currentUser?.id || currentUser?._id;
      const response = await api.get(`/community/${communityData.id}/messages`, {
        // required for "delete for me" filtering on backend
        params: currentUserId ? { userId: currentUserId } : undefined,
      });
      if (response.data.success) {
        const fetchedMessages = response.data.data.messages.map((msg: any) => ({
          id: msg._id || msg.id,
          userId: msg.userId || msg.user?._id || msg.user?.id,
          username: msg.user?.username || msg.username || 'Unknown',
          avatar: msg.user?.picture || msg.user?.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
          content: msg.content || '',
          timestamp: msg.createdAt || msg.timestamp,
          type: msg.type || 'text',
          fileUrl: msg.fileUrl || msg.file?.url,
          fileName: msg.fileName || msg.file?.name,
          fileSize: msg.fileSize || msg.file?.size,
          duration: msg.duration,
          status: (msg as any).status || 'sent',
          readBy: (msg as any).readBy || [],
          readCount: (msg as any).readCount ?? ((msg as any).readBy?.length || 0),
          // totalRecipients should exclude the sender, so it's members.length - 1
          totalRecipients: (msg as any).totalRecipients ?? Math.max(0, members.length - 1),
          reactions: msg.reactions || [],
          replyTo: msg.replyTo ? {
            id: msg.replyTo._id || msg.replyTo.id,
            username: msg.replyTo.username || 'Unknown',
            content: msg.replyTo.content || '',
            type: msg.replyTo.type || 'text',
          } : undefined,
        }));
        setMessages(fetchedMessages);
      }
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      // If endpoint doesn't exist yet, just set empty array
      if (error.response?.status !== 404) {
        Alert.alert('Error', 'Failed to load messages. Please try again.');
      }
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const isCommunityOwner = () => {
    const currentUserId = currentUser?.id || currentUser?._id;
    if (!currentUserId) return false;
    const me = members.find(m => (m.userId || m.id) === currentUserId);
    return me?.role === 'owner';
  };

  const deleteCommunityMessages = async (messageIds: string[], scope: 'me' | 'everyone') => {
    const currentUserId = currentUser?.id || currentUser?._id;
    if (!currentUserId) {
      Alert.alert('Error', 'User not found. Please login again.');
      return false;
    }
    const resp = await api.delete(`/community/${communityData.id}/messages`, {
      data: { userId: currentUserId, messageIds, scope },
    });
    if (!resp.data.success) {
      throw new Error(resp.data.message || 'Failed to delete messages');
    }
    return true;
  };

  // Fetch members from API
  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const response = await api.get(`/community/${communityData.id}/members`);
      if (response.data.success) {
        const fetchedMembers = response.data.data.members.map((member: any) => ({
          id: member.id || member._id || member.userId,
          userId: member.userId || member.id || member._id,
          username: member.username || 'Unknown',
          avatar: member.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
          role: member.role || 'member',
          // Check if user is in onlineUserIds to set correct initial status
          status: onlineUserIds.has(member.userId || member.id || member._id) ? 'online' as const : (member.status || 'offline' as const),
          lastSeen: member.lastSeen,
          joinDate: member.joinDate || new Date().toISOString(),
          email: member.email,
        }));
        // Sort members: owner first, then admin, then members
        fetchedMembers.sort((a: Member, b: Member) => {
          const roleOrder: { [key: string]: number } = { owner: 0, admin: 1, moderator: 2, member: 3 };
          return (roleOrder[a.role] || 3) - (roleOrder[b.role] || 3);
        });
        setMembers(fetchedMembers);
        // Update community data with actual members count
        setCommunityData(prev => ({
          ...prev,
          members: fetchedMembers.length,
          activeMembers: fetchedMembers.filter((m: { status: string; }) => m.status === 'online').length,
        }));
      }
    } catch (error: any) {
      console.error('Error fetching members:', error);
      // If endpoint doesn't exist yet, just set empty array
      if (error.response?.status !== 404) {
        Alert.alert('Error', 'Failed to load members. Please try again.');
      }
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Update community data when prop changes
  useEffect(() => {
    setCommunityData(community);
  }, [community]);

  // Load messages and members on mount
  useEffect(() => {
    if (communityData.id) {
      fetchMessages();
      fetchMembers();
    }
  }, [communityData.id]);

  useEffect(() => {
    // Request permissions on mount
    (async () => {
      if (Platform.OS !== 'web') {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
          Alert.alert(
            'Permissions Required',
            'Please grant camera and media library permissions to send photos and videos.'
          );
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  useEffect(() => {
    if (isRecording) {
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      setRecordingDuration(0);
    }
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const shouldShowDateSeparator = (currentMessage: Message, previousMessage: Message | null) => {
    if (!previousMessage) return true;
    const currentDate = new Date(currentMessage.timestamp).toDateString();
    const previousDate = new Date(previousMessage.timestamp).toDateString();
    return currentDate !== previousDate;
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !replyingTo) return;
    if (!currentUser) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    const messageContent = newMessage.trim();
    const userId = currentUser.id || currentUser._id;

    // Clear input immediately for better UX
    setNewMessage('');
    setReplyingTo(null);
    setSendingMessage(true);

    // Use socket if connected (real-time messaging with emit/broadcast)
    if (socketConnected && socketService.isConnected()) {
      console.log('[Socket] 📤 Sending message via socket emit...');
      try {
        socketService.sendMessage({
          communityId: communityData.id,
          content: messageContent,
          type: 'text',
          replyTo: replyingTo?.id,
        });
        setSendingMessage(false);
        // Message will be broadcast back to all users (including sender) via 'new_message' event
        console.log('[Socket] ✅ Message emitted, waiting for broadcast...');
        return;
      } catch (error) {
        console.warn('[Socket] ❌ Failed to send via socket, falling back to REST API');
        // Fall through to REST API
      }
    } else {
      console.log('[Socket] Not connected, using REST API fallback');
    }

    // Fallback to REST API if socket is not connected
    const tempId = Date.now().toString();
    const tempMessage: Message = {
      id: tempId,
      userId: userId,
      username: currentUser.username || 'You',
      avatar: currentUser.picture || currentUser.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
      content: messageContent,
      timestamp: new Date().toISOString(),
      type: 'text',
      status: 'sending',
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            username: replyingTo.username,
            content: replyingTo.content.substring(0, 50),
            type: replyingTo.type,
          }
        : undefined,
    };

    // Add message optimistically
    setMessages(prev => [...prev, tempMessage]);

    try {
      const response = await api.post(`/community/${communityData.id}/messages`, {
        userId: userId,
        content: messageContent,
        type: 'text',
        replyTo: replyingTo?.id,
      });

      if (response.data.success) {
        const newMsg = response.data.data.message;
        // Replace temp message with actual message from server
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempId
              ? {
                  id: newMsg._id || newMsg.id,
                  userId: newMsg.userId || userId,
                  username: currentUser.username || 'You',
                  avatar: currentUser.picture || currentUser.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
                  content: newMsg.content,
                  timestamp: newMsg.createdAt || newMsg.timestamp,
                  type: newMsg.type || 'text',
                  status: 'read',
                  replyTo: newMsg.replyTo ? {
                    id: newMsg.replyTo._id || newMsg.replyTo.id,
                    username: newMsg.replyTo.username,
                    content: newMsg.replyTo.content,
                    type: newMsg.replyTo.type,
                  } : undefined,
                }
              : msg
          )
        );
      } else {
        throw new Error(response.data.message || 'Failed to send message');
      }
    } catch (error: any) {
      // Remove failed message
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to send message. Please try again.';
      if (errorMessage.includes('Inappropriate message') || errorMessage === 'Inappropriate message') {
        // Show popup for inappropriate message (not an error)
        Alert.alert('Message Blocked', 'Your message contains inappropriate content and cannot be sent.');
      } else {
        // Only log actual errors
        console.error('Error sending message:', error);
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setSendingMessage(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatVideoDuration = (durationMsOrSec?: number | null): string => {
    if (!durationMsOrSec || durationMsOrSec <= 0) return '0:00';
    // Expo ImagePicker commonly reports video duration in milliseconds.
    const secondsTotal = Math.round(durationMsOrSec > 1000 ? durationMsOrSec / 1000 : durationMsOrSec);
    const hours = Math.floor(secondsTotal / 3600);
    const minutes = Math.floor((secondsTotal % 3600) / 60);
    const seconds = secondsTotal % 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Convert file to binary and send in chunks
  const sendFileInChunks = async (
    fileUri: string,
    fileName: string,
    fileType: 'image' | 'video',
    messageId: string,
    communityId: string
  ) => {
    try {
      console.log(`[Chunked] 📤 Starting chunked upload for ${fileType}:`, fileName);
      
      // Read file as base64
      const base64Data = await FileSystem.readAsStringAsync(fileUri, {
        encoding: BASE64_ENCODING,
      });
      
      const fileSize = base64Data.length;
      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
      
      console.log(`[Chunked] File size: ${fileSize} bytes, Total chunks: ${totalChunks}`);
      
      // Send metadata first
      if (socketConnected && socketService.isConnected()) {
        socketService.sendChunkedMediaStart({
          messageId,
          communityId,
          fileName,
          fileType,
          totalChunks,
          fileSize,
        });
      }
      
      // Send chunks with delay to avoid overwhelming the socket
      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileSize);
        const chunk = base64Data.substring(start, end);
        
        if (socketConnected && socketService.isConnected()) {
          socketService.sendChunkedMediaChunk({
            messageId,
            communityId,
            chunkIndex,
            chunk,
            isLastChunk: chunkIndex === totalChunks - 1,
          });
          
          // Small delay between chunks to prevent overwhelming
          if (chunkIndex < totalChunks - 1) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        } else {
          throw new Error('Socket disconnected during chunked upload');
        }
      }
      
      console.log(`[Chunked] ✅ All chunks sent for ${fileType}:`, fileName);
    } catch (error) {
      console.error(`[Chunked] ❌ Error sending chunks:`, error);
      throw error;
    }
  };

  /**
   * When we optimistically insert a temp message, the server may broadcast the
   * real message (with the real id) *before* we receive the `message_sent`
   * confirmation. If we later change tempId -> messageId, we can end up with
   * two items with the same id, which triggers the React warning about
   * duplicate keys.
   *
   * This makes the update idempotent by merging/removing duplicates.
   */
  const reconcileTempMessageId = (tempId: string, messageId: string) => {
    if (!messageId || tempId === messageId) return;

    setMessages(prev => {
      const tempIndex = prev.findIndex(m => m.id === tempId);
      if (tempIndex === -1) return prev;

      const existingIndex = prev.findIndex(m => m.id === messageId);

      // If the broadcast already added the real message, merge local temp data
      // (e.g., local preview `fileUrl`) into the existing item and drop temp.
      if (existingIndex !== -1 && existingIndex !== tempIndex) {
        const tempMsg = prev[tempIndex];
        const existingMsg = prev[existingIndex];

        const merged: Message = {
          ...existingMsg,
          ...tempMsg,
          id: messageId,
          // Prefer server/broadcast values when present, but keep local preview.
          fileUrl: existingMsg.fileUrl || tempMsg.fileUrl,
          fileName: existingMsg.fileName || tempMsg.fileName,
          fileSize: existingMsg.fileSize || tempMsg.fileSize,
          duration: existingMsg.duration || tempMsg.duration,
          status: existingMsg.status || tempMsg.status,
        };

        const withoutTemp = prev.filter((_, idx) => idx !== tempIndex);
        const idxInWithout = withoutTemp.findIndex(m => m.id === messageId);
        if (idxInWithout === -1) {
          // Extremely unlikely, but keep data safe.
          return [...withoutTemp, merged];
        }

        const next = [...withoutTemp];
        next[idxInWithout] = merged;
        return next;
      }

      // Otherwise, just convert tempId -> messageId in-place.
      return prev.map(m => (m.id === tempId ? { ...m, id: messageId } : m));
    });
  };

  const handleTakePhoto = async () => {
    setShowAttachmentMenu(false);
    if (!currentUser) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileSize = asset.fileSize || 0;
        const tempId = Date.now().toString();
        
        const tempMessage: Message = {
          id: tempId,
          userId: currentUser.id || currentUser._id,
          username: currentUser.username || 'You',
          avatar: currentUser.picture || currentUser.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
          content: 'Photo',
          timestamp: new Date().toISOString(),
          type: 'image',
          fileUrl: asset.uri,
          fileName: asset.fileName || 'photo.jpg',
          fileSize: formatFileSize(fileSize),
          status: 'sending',
        };
        setMessages(prev => [...prev, tempMessage]);
        
        // Send via chunked streaming
        try {
          if (socketConnected && socketService.isConnected()) {
            // First create message placeholder via socket
            socketService.sendMessage({
              communityId: communityData.id,
              content: 'Photo',
              type: 'image',
              fileName: asset.fileName || 'photo.jpg',
              fileSize: formatFileSize(fileSize),
              replyTo: replyingTo?.id,
            });
            
            // Wait for message_sent confirmation to get message ID
            const messageIdPromise = new Promise<string>((resolve) => {
              const handler = (data: any) => {
                if (data.messageId) {
                  socketService.off('message_sent', handler);
                  resolve(data.messageId);
                }
              };
              socketService.on('message_sent', handler);
              
              // Timeout after 5 seconds
              setTimeout(() => {
                socketService.off('message_sent', handler);
                resolve(tempId); // Fallback to tempId
              }, 5000);
            });
            
            const messageId = await messageIdPromise;
            
            // Update temp message with actual message ID
            reconcileTempMessageId(tempId, messageId);
            
            // Then send file in chunks
            await sendFileInChunks(
              asset.uri,
              asset.fileName || 'photo.jpg',
              'image',
              messageId,
              communityData.id
            );
            
            // Clear reply if was replying
            if (replyingTo) {
              setReplyingTo(null);
            }
          } else {
            throw new Error('Socket not connected');
          }
        } catch (error: any) {
          console.error('Error sending image:', error);
          setMessages(prev => prev.filter(msg => msg.id !== tempId));
          Alert.alert('Error', error.message || 'Failed to send photo. Please try again.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      console.error('Camera error:', error);
    }
  };

  const handleSendImage = async () => {
    setShowAttachmentMenu(false);
    if (!currentUser) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileSize = asset.fileSize || 0;
        const tempId = Date.now().toString();
        
        const tempMessage: Message = {
          id: tempId,
          userId: currentUser.id || currentUser._id,
          username: currentUser.username || 'You',
          avatar: currentUser.picture || currentUser.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
          content: 'Photo',
          timestamp: new Date().toISOString(),
          type: 'image',
          fileUrl: asset.uri,
          fileName: asset.fileName || 'image.jpg',
          fileSize: formatFileSize(fileSize),
          status: 'sending',
        };
        setMessages(prev => [...prev, tempMessage]);
        
        // Send via chunked streaming
        try {
          if (socketConnected && socketService.isConnected()) {
            // First create message placeholder via socket
            socketService.sendMessage({
              communityId: communityData.id,
              content: 'Photo',
              type: 'image',
              fileName: asset.fileName || 'image.jpg',
              fileSize: formatFileSize(fileSize),
              replyTo: replyingTo?.id,
            });
            
            // Wait for message_sent confirmation to get message ID
            const messageIdPromise = new Promise<string>((resolve) => {
              const handler = (data: any) => {
                if (data.messageId) {
                  socketService.off('message_sent', handler);
                  resolve(data.messageId);
                }
              };
              socketService.on('message_sent', handler);
              
              // Timeout after 5 seconds
              setTimeout(() => {
                socketService.off('message_sent', handler);
                resolve(tempId); // Fallback to tempId
              }, 5000);
            });
            
            const messageId = await messageIdPromise;
            
            // Update temp message with actual message ID
            reconcileTempMessageId(tempId, messageId);
            
            // Then send file in chunks
            await sendFileInChunks(
              asset.uri,
              asset.fileName || 'image.jpg',
              'image',
              messageId,
              communityData.id
            );
            
            // Clear reply if was replying
            if (replyingTo) {
              setReplyingTo(null);
            }
          } else {
            throw new Error('Socket not connected');
          }
        } catch (error: any) {
          console.error('Error sending image:', error);
          setMessages(prev => prev.filter(msg => msg.id !== tempId));
          Alert.alert('Error', error.message || 'Failed to send image. Please try again.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image. Please try again.');
      console.error('Image picker error:', error);
    }
  };

  const handleSendVideo = async () => {
    setShowAttachmentMenu(false);
    if (!currentUser) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
        videoMaxDuration: 300, // 5 minutes max
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fileSize = asset.fileSize || 0;
        const durationString = formatVideoDuration(asset.duration);
        const tempId = Date.now().toString();
        
        const tempMessage: Message = {
          id: tempId,
          userId: currentUser.id || currentUser._id,
          username: currentUser.username || 'You',
          avatar: currentUser.picture || currentUser.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
          content: 'Video',
          timestamp: new Date().toISOString(),
          type: 'video',
          fileUrl: asset.uri,
          fileName: asset.fileName || 'video.mp4',
          fileSize: formatFileSize(fileSize),
          duration: durationString,
          status: 'sending',
        };
        setMessages(prev => [...prev, tempMessage]);
        
        // Send via chunked streaming
        try {
          if (socketConnected && socketService.isConnected()) {
            // First create message placeholder via socket
            socketService.sendMessage({
              communityId: communityData.id,
              content: 'Video',
              type: 'video',
              fileName: asset.fileName || 'video.mp4',
              fileSize: formatFileSize(fileSize),
              duration: durationString,
              replyTo: replyingTo?.id,
            });
            
            // Wait for message_sent confirmation to get message ID
            const messageIdPromise = new Promise<string>((resolve) => {
              const handler = (data: any) => {
                if (data.messageId) {
                  socketService.off('message_sent', handler);
                  resolve(data.messageId);
                }
              };
              socketService.on('message_sent', handler);
              
              // Timeout after 5 seconds
              setTimeout(() => {
                socketService.off('message_sent', handler);
                resolve(tempId); // Fallback to tempId
              }, 5000);
            });
            
            const messageId = await messageIdPromise;
            
            // Update temp message with actual message ID
            reconcileTempMessageId(tempId, messageId);
            
            // Then send file in chunks
            await sendFileInChunks(
              asset.uri,
              asset.fileName || 'video.mp4',
              'video',
              messageId,
              communityData.id
            );
            
            // Clear reply if was replying
            if (replyingTo) {
              setReplyingTo(null);
            }
          } else {
            throw new Error('Socket not connected');
          }
        } catch (error: any) {
          console.error('Error sending video:', error);
          setMessages(prev => prev.filter(msg => msg.id !== tempId));
          Alert.alert('Error', error.message || 'Failed to send video. Please try again.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick video. Please try again.');
      console.error('Video picker error:', error);
    }
  };


  const handleStartRecording = () => {
    setIsRecording(true);
    setShowAttachmentMenu(false);
    // TODO: Integrate with expo-av for audio recording
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    if (recordingDuration > 0 && currentUser) {
      const tempId = Date.now().toString();
      const durationString = formatTime(recordingDuration);
      
      const tempMessage: Message = {
        id: tempId,
        userId: currentUser.id || currentUser._id,
        username: currentUser.username || 'You',
        avatar: currentUser.picture || currentUser.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
        content: 'Voice message',
        timestamp: new Date().toISOString(),
        type: 'audio',
        duration: durationString,
        status: 'sending',
      };
      setMessages(prev => [...prev, tempMessage]);
      
      // TODO: Upload audio file and send message via API
      // For now, just mark as sent
      setTimeout(() => {
        setMessages(prev =>
          prev.map(msg => (msg.id === tempId ? { ...msg, status: 'read' } : msg))
        );
      }, 1000);
    }
  };

  const handlePlayAudio = (messageId: string) => {
    setPlayingAudio(playingAudio === messageId ? null : messageId);
    // TODO: Integrate with expo-av for audio playback
  };

  const handleMoreMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Clear Chat', 'Export Chat', 'Mute Notifications', 'Group Settings'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleClearChat();
          } else if (buttonIndex === 2) {
            handleExportChat();
          } else if (buttonIndex === 3) {
            Alert.alert('Notifications', 'Notifications muted');
          } else if (buttonIndex === 4) {
            setShowCommunityInfo(true);
          }
        }
      );
    } else {
      setShowMoreMenu(true);
    }
  };

  const handleClearChat = async () => {
    const currentUserId = currentUser?.id || currentUser?._id;
    if (!currentUserId) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    const clearForMe = async () => {
      await deleteCommunityMessages([], 'me'); // backend: add deletedFor for this user
      setMessages([]);
      setIsSelectionMode(false);
      setSelectedMessages(new Set());
    };

    const clearForEveryone = async () => {
      await deleteCommunityMessages([], 'everyone'); // backend: owner-only clear (soft delete)
      setMessages([]);
      setIsSelectionMode(false);
      setSelectedMessages(new Set());
    };

    const canClearEveryone = isCommunityOwner();

    Alert.alert('Clear Chat', 'Choose how you want to clear this chat:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear for me',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearForMe();
          } catch (error: any) {
            console.error('Error clearing chat:', error);
            Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to clear chat. Please try again.');
          }
        },
      },
      ...(canClearEveryone
        ? [{
            text: 'Clear for everyone',
            style: 'destructive' as const,
            onPress: async () => {
              try {
                await clearForEveryone();
              } catch (error: any) {
                console.error('Error clearing chat:', error);
                Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to clear chat. Please try again.');
              }
            },
          }]
        : []),
    ]);
  };

  const handleExportChat = async () => {
    try {
      const currentUserId = currentUser?.id || currentUser?._id;
      const payload = {
        exportedAt: new Date().toISOString(),
        community: {
          id: communityData.id,
          name: communityData.name,
        },
        currentUser: currentUserId
          ? { id: currentUserId, username: currentUser?.username }
          : null,
        messages,
      };
      const json = JSON.stringify(payload, null, 2);
      const fileName = `community-chat-${communityData.id}-${Date.now()}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      const UTF8_ENCODING: any = (FileSystem as any)?.EncodingType?.UTF8 ?? 'utf8';
      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: UTF8_ENCODING });

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        UTI: Platform.OS === 'ios' ? 'public.json' : undefined,
      });
    } catch (error: any) {
      console.error('Error exporting chat:', error);
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to export chat');
    } finally {
      setShowMoreMenu(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleMessageLongPress = (messageId: string) => {
    setIsSelectionMode(true);
    setSelectedMessages(new Set([messageId]));
    setReplyingTo(null); // Clear reply when entering selection mode
  };

  const handleMessagePress = (messageId: string) => {
    if (isSelectionMode) {
      setSelectedMessages(prev => {
        const newSet = new Set(prev);
        if (newSet.has(messageId)) {
          newSet.delete(messageId);
        } else {
          newSet.add(messageId);
        }
        if (newSet.size === 0) {
          setIsSelectionMode(false);
        }
        return newSet;
      });
    }
  };

  const canCurrentUserDeleteMessage = (message: Message) => {
    const currentUserId = currentUser?.id || currentUser?._id;
    if (!currentUserId) return false;

    const isOwnerOfMessage = message.userId === currentUserId;
    if (isOwnerOfMessage) return true;

    // Allow admins/owners to delete any message (best-effort; depends on members list being loaded)
    const me = members.find(m => (m.userId || m.id) === currentUserId);
    return me?.role === 'owner' || me?.role === 'admin';
  };

  const handleDeleteSingleMessage = async (messageId: string) => {
    try {
      const currentUserId = currentUser?.id || currentUser?._id;
      if (!currentUserId) {
        Alert.alert('Error', 'User not found. Please login again.');
        return;
      }
      const msg = messages.find(m => m.id === messageId);
      const isMine = msg?.userId === currentUserId;
      const canDeleteForEveryone = isCommunityOwner() || isMine;

      const doDelete = async (scope: 'me' | 'everyone') => {
        await deleteCommunityMessages([messageId], scope);
        setMessages(prev => prev.filter(m => m.id !== messageId));
        setSelectedMessages(prev => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
      };

      Alert.alert('Delete', 'Delete this message?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete for me',
          style: 'destructive',
          onPress: async () => {
            try {
              await doDelete('me');
            } catch (error: any) {
              console.error('Error deleting message:', error);
              Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to delete. Please try again.');
            }
          },
        },
        ...(canDeleteForEveryone
          ? [{
              text: 'Delete for everyone',
              style: 'destructive' as const,
              onPress: async () => {
                try {
                  await doDelete('everyone');
                } catch (error: any) {
                  console.error('Error deleting message:', error);
                  Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to delete. Please try again.');
                }
              },
            }]
          : []),
      ]);
    } catch (error: any) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to delete. Please try again.');
    }
  };

  const handleDeleteSelectedMessages = async () => {
    if (selectedMessages.size === 0) return;
    const messageIds = Array.from(selectedMessages);
    const currentUserId = currentUser?.id || currentUser?._id;
    if (!currentUserId) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    const selected = messages.filter(m => selectedMessages.has(m.id));
    const allMine = selected.length > 0 && selected.every(m => m.userId === currentUserId);
    const canDeleteForEveryone = isCommunityOwner() || allMine;

    const deleteForMe = async () => {
      await deleteCommunityMessages(messageIds, 'me');
      setMessages(prev => prev.filter(msg => !selectedMessages.has(msg.id)));
      setSelectedMessages(new Set());
      setIsSelectionMode(false);
    };

    const deleteForEveryone = async () => {
      await deleteCommunityMessages(messageIds, 'everyone');
      setMessages(prev => prev.filter(msg => !selectedMessages.has(msg.id)));
      setSelectedMessages(new Set());
      setIsSelectionMode(false);
    };

    Alert.alert(
      'Delete Messages',
      `Delete ${messageIds.length} message${messageIds.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete for me',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteForMe();
            } catch (error: any) {
              console.error('Error deleting messages:', error);
              Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to delete messages. Please try again.');
            }
          },
        },
        ...(canDeleteForEveryone
          ? [{
              text: 'Delete for everyone',
              style: 'destructive' as const,
              onPress: async () => {
                try {
                  await deleteForEveryone();
                } catch (error: any) {
                  console.error('Error deleting messages:', error);
                  Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to delete messages. Please try again.');
                }
              },
            }]
          : []),
      ]
    );
  };

  const handleCancelSelection = () => {
    setSelectedMessages(new Set());
    setIsSelectionMode(false);
  };

  const commonEmojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
    '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰',
    '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜',
    '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏',
    '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠',
    '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨',
    '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
    '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧',
    '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐',
    '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑',
    '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻',
    '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸',
    '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
  ];

  const getStatusIcon = (message: Message) => {
    if (message.status === 'sending') {
      return <Clock size={12} color="#a78bfa80" />;
    }

    const isCurrentUser = currentUser && (message.userId === (currentUser.id || currentUser._id));
    
    if (!isCurrentUser) {
      return null;
    }

    const totalRecipients = message.totalRecipients ?? Math.max(0, members.length - 1);
    const readCount = message.readCount ?? (message.readBy?.length || 0);
    
    // Debug logging in development
    if (__DEV__ && (message.status === 'read' || (readCount >= totalRecipients && totalRecipients > 0))) {
      console.log(`[StatusIcon] Message ${message.id}: status=${message.status}, readCount=${readCount}, totalRecipients=${totalRecipients}, shouldShowBlue=${message.status === 'read' || (readCount >= totalRecipients && totalRecipients > 0)}`);
    }
    
    // Priority 1: Check if status is explicitly 'read' (from backend)
    if (message.status === 'read') {
      return (
        <View style={{ flexDirection: 'row', marginLeft: -2 }}>
          <Check size={12} color="#06b6d4" style={{ marginRight: -4 }} />
          <Check size={12} color="#06b6d4" />
        </View>
      );
    }
    
    // Priority 2: Check if all recipients have read (readCount >= totalRecipients)
    if (totalRecipients > 0 && readCount >= totalRecipients) {
      return (
        <View style={{ flexDirection: 'row', marginLeft: -2 }}>
          <Check size={12} color="#06b6d4" style={{ marginRight: -4 }} />
          <Check size={12} color="#06b6d4" />
        </View>
      );
    }
    
    // Priority 3: Check if status is 'delivered' or some have read
    if (message.status === 'delivered' || (readCount > 0 && readCount < totalRecipients)) {
      return (
        <View style={{ flexDirection: 'row', marginLeft: -2 }}>
          <Check size={12} color="#a78bfa80" style={{ marginRight: -4 }} />
          <Check size={12} color="#a78bfa80" />
        </View>
      );
    }
    
    // Priority 4: Single grey tick for 'sent' or no reads yet
    if (message.status === 'sent' || (readCount === 0 && totalRecipients > 0)) {
      return <Check size={12} color="#a78bfa80" />;
    }

    // Default: single grey tick
    return <Check size={12} color="#a78bfa80" />;
  };

  const renderDateSeparator = (date: string) => (
    <View style={styles.dateSeparator}>
      <View style={styles.dateSeparatorLine} />
      <Text style={styles.dateSeparatorText}>{formatDate(date)}</Text>
      <View style={styles.dateSeparatorLine} />
    </View>
  );

  // Generate a consistent color based on username for message sender identification
  const getUsernameColor = (username: string) => {
    const colors = [
      '#f87171', // red
      '#fb923c', // orange
      '#fbbf24', // amber
      '#a3e635', // lime
      '#34d399', // emerald
      '#22d3ee', // cyan
      '#60a5fa', // blue
      '#a78bfa', // violet
      '#f472b6', // pink
      '#c084fc', // purple
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  // Create swipe gesture handler for reply functionality
  const createSwipeHandler = useCallback((message: Message) => {
    // Initialize animation value for this message if not exists
    if (!swipeAnimations.current.has(message.id)) {
      swipeAnimations.current.set(message.id, new Animated.Value(0));
    }
    const translateX = swipeAnimations.current.get(message.id)!;

    const panResponder = PanResponder.create({
      onStartShouldSetPanResponder: () => !isSelectionMode,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to horizontal swipes (right swipe)
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
        // Reset animation when gesture starts
        // Get current offset from our tracking ref, default to 0
        const currentOffset = swipeOffsets.current.get(message.id) || 0;
        translateX.setOffset(currentOffset);
        translateX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow right swipe (positive dx)
        if (gestureState.dx > 0) {
          // Limit swipe distance
          const maxSwipe = 80;
          const swipeDistance = Math.min(gestureState.dx, maxSwipe);
          translateX.setValue(swipeDistance);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // Get current value before flattening (offset + value)
        const currentOffset = swipeOffsets.current.get(message.id) || 0;
        const currentValue = gestureState.dx;
        const totalValue = currentOffset + currentValue;
        
        translateX.flattenOffset();
        // Update our tracking ref with the flattened value
        swipeOffsets.current.set(message.id, totalValue);
        
        // If swiped more than 50px to the right, trigger reply
        if (gestureState.dx > 50 && !isSelectionMode) {
          // Set message as reply target
          setReplyingTo(message);
          // Scroll to input area
          setTimeout(() => {
            messagesEndRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
        
        // Animate back to original position
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start(() => {
          // Reset offset tracking after animation completes
          swipeOffsets.current.set(message.id, 0);
        });
      },
    });

    return { panResponder, translateX };
  }, [isSelectionMode]);

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isCurrentUser = currentUser && (item.userId === (currentUser.id || currentUser._id));
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showDateSeparator = shouldShowDateSeparator(item, previousMessage);
    
    // Show avatar and username when:
    // 1. It's the first message from this user in a sequence
    // 2. After a date separator
    // 3. Different user from previous message
    const isFirstMessageFromUser = !previousMessage || 
      previousMessage.userId !== item.userId || 
      showDateSeparator;
    
    const showUserInfo = !isCurrentUser && isFirstMessageFromUser;

    // Create swipe handler for this message
    const { panResponder, translateX } = createSwipeHandler(item);

    return (
      <View>
        {showDateSeparator && renderDateSeparator(item.timestamp)}
        <Animated.View
          style={[
            styles.messageWrapper,
            isCurrentUser ? styles.messageWrapperRight : styles.messageWrapperLeft,
            {
              transform: [{ translateX }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Avatar for received messages */}
          {!isCurrentUser && showUserInfo && (
            <TouchableOpacity 
              onPress={() => onViewProfile?.(item.userId)}
              activeOpacity={0.7}
            >
              <Image 
                source={getAvatarImageSource(item.avatar) || { uri: getImageUrl(item.avatar) || item.avatar }} 
                style={styles.messageAvatar}
                onError={(error) => {
                  console.error('Error loading message avatar:', error);
                }}
              />
            </TouchableOpacity>
          )}
          {!isCurrentUser && !showUserInfo && <View style={styles.messageAvatarPlaceholder} />}
          
          {isSelectionMode && (
            <TouchableOpacity
              style={styles.selectionCheckbox}
              onPress={() => handleMessagePress(item.id)}
            >
              {selectedMessages.has(item.id) && (
                <View style={styles.selectionCheckboxSelected}>
                  <Check size={16} color="#ffffff" />
                </View>
              )}
            </TouchableOpacity>
          )}
          
          <View style={styles.messageContentWrapper}>
            {/* Username above message bubble (like WhatsApp) */}
            {showUserInfo && (
              <TouchableOpacity 
                onPress={() => onViewProfile?.(item.userId)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.messageSenderName,
                  { color: getUsernameColor(item.username) }
                ]}>
                  {item.username}
                </Text>
              </TouchableOpacity>
            )}
            
            <Pressable
              style={[
                styles.messageBubble,
                isCurrentUser ? styles.messageBubbleSent : styles.messageBubbleReceived,
                isSelectionMode && selectedMessages.has(item.id) && styles.messageBubbleSelected,
                !isCurrentUser && showUserInfo && styles.messageBubbleWithUsername,
              ]}
              onLongPress={() => {
                if (!isSelectionMode) {
                  handleMessageLongPress(item.id);
                }
              }}
              onPress={() => {
                if (isSelectionMode) {
                  handleMessagePress(item.id);
                } else {
                  // Normal press behavior - could open media, etc.
                }
              }}
            >
              {item.replyTo && (
                <View style={styles.replyContainer}>
                  <View style={styles.replyIndicator} />
                  <View style={styles.replyContent}>
                    <Text style={styles.replyUsername}>{item.replyTo.username}</Text>
                    <Text style={styles.replyText} numberOfLines={1}>
                      {item.replyTo.type === 'text'
                        ? item.replyTo.content
                        : `${item.replyTo.type.charAt(0).toUpperCase() + item.replyTo.type.slice(1)} message`}
                    </Text>
                  </View>
                </View>
              )}

              {item.type === 'text' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {item.hasWarning && (
                    <AlertTriangle size={16} color="#f59e0b" />
                  )}
                <Text style={[styles.messageText, isCurrentUser && styles.messageTextSent]}>
                  {item.content}
                </Text>
                </View>
              )}

            {item.type === 'image' && (
              <TouchableOpacity
                onPress={() => {
                  if (!isSelectionMode) {
                    setSelectedMedia(item);
                    setShowMediaModal(true);
                  }
                }}
                disabled={isSelectionMode}
              >
                <Image source={{ uri: getImageUrl(item.fileUrl || item.content) || item.fileUrl || item.content }} style={styles.messageImage} />
              </TouchableOpacity>
            )}

            {item.type === 'video' && (
              <TouchableOpacity
                onPress={() => {
                  if (!isSelectionMode) {
                    setSelectedMedia(item);
                    setShowMediaModal(true);
                  }
                }}
                style={styles.messageVideoContainer}
                disabled={isSelectionMode}
              >
                <View style={styles.messageVideoThumbnailFallback}>
                  <VideoIcon size={42} color="#ffffff" />
                  <Text style={styles.messageVideoLabel}>Video</Text>
                </View>
                <View style={styles.messageVideoOverlay}>
                  <Play size={32} color="#ffffff" fill="#ffffff" />
                </View>
                {item.duration && (
                  <View style={styles.videoDuration}>
                    <Text style={styles.videoDurationText}>{item.duration}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {item.type === 'audio' && (
              <View style={styles.audioContainer}>
                <TouchableOpacity
                  style={styles.audioPlayButton}
                  onPress={() => handlePlayAudio(item.id)}
                >
                  {playingAudio === item.id ? (
                    <Pause size={20} color="#ffffff" />
                  ) : (
                    <Play size={20} color="#ffffff" />
                  )}
                </TouchableOpacity>
                <View style={styles.audioWaveform}>
                  <View style={[styles.audioWave, { height: 20 }]} />
                  <View style={[styles.audioWave, { height: 30 }]} />
                  <View style={[styles.audioWave, { height: 25 }]} />
                  <View style={[styles.audioWave, { height: 35 }]} />
                  <View style={[styles.audioWave, { height: 20 }]} />
                  <View style={[styles.audioWave, { height: 28 }]} />
                  <View style={[styles.audioWave, { height: 22 }]} />
                </View>
                <Text style={styles.audioDuration}>{item.duration || '0:00'}</Text>
              </View>
            )}


            <View style={styles.messageFooter}>
              <Text style={[styles.messageTime, isCurrentUser && styles.messageTimeSent]}>
                {formatMessageTime(item.timestamp)}
              </Text>
              {isCurrentUser && (
                <View style={styles.messageStatus}>{getStatusIcon(item)}</View>
              )}
            </View>
          </Pressable>
          </View>
        </Animated.View>
      </View>
    );
  };

  const renderAttachmentMenu = () => (
    <Modal
      visible={showAttachmentMenu}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAttachmentMenu(false)}
    >
      <Pressable style={styles.modalOverlay} onPress={() => setShowAttachmentMenu(false)}>
        <View style={styles.attachmentMenu}>
          <TouchableOpacity style={styles.attachmentOption} onPress={handleTakePhoto}>
            <View style={[styles.attachmentIcon, { backgroundColor: '#7c3aed20' }]}>
              <Camera size={24} color="#a78bfa" />
            </View>
            <Text style={styles.attachmentText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachmentOption} onPress={handleSendImage}>
            <View style={[styles.attachmentIcon, { backgroundColor: '#7c3aed20' }]}>
              <ImageIcon size={24} color="#a78bfa" />
            </View>
            <Text style={styles.attachmentText}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachmentOption} onPress={handleSendVideo}>
            <View style={[styles.attachmentIcon, { backgroundColor: '#2563eb20' }]}>
              <VideoIcon size={24} color="#60a5fa" />
            </View>
            <Text style={styles.attachmentText}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachmentOption} onPress={handleStartRecording}>
            <View style={[styles.attachmentIcon, { backgroundColor: '#ef444420' }]}>
              <Mic size={24} color="#f87171" />
            </View>
            <Text style={styles.attachmentText}>Voice Message</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );

  const renderMediaModal = () => (
    <Modal
      visible={showMediaModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowMediaModal(false)}
    >
      <View style={styles.mediaModalOverlay}>
        <TouchableOpacity
          style={styles.mediaModalClose}
          onPress={() => setShowMediaModal(false)}
        >
          <X size={24} color="#ffffff" />
        </TouchableOpacity>
        {selectedMedia && (
          <View style={styles.mediaModalContent}>
            {selectedMedia.type === 'image' && (
              <Image
                source={{ uri: getImageUrl(selectedMedia.fileUrl || selectedMedia.content) || selectedMedia.fileUrl || selectedMedia.content }}
                style={styles.mediaModalImage}
                resizeMode="contain"
              />
            )}
            {selectedMedia.type === 'video' && (
              <CommunityVideoPlayer
                videoUri={
                  getImageUrl(selectedMedia.fileUrl || selectedMedia.content) ||
                  selectedMedia.fileUrl ||
                  selectedMedia.content
                }
              />
            )}

            <View style={styles.mediaModalActions}>
              {!!(currentUser?.id || currentUser?._id) && (
                <TouchableOpacity
                  style={styles.mediaModalDeleteButton}
                  onPress={() => {
                    const idToDelete = selectedMedia.id;
                    setShowMediaModal(false);
                    setSelectedMedia(null);
                    handleDeleteSingleMessage(idToDelete);
                  }}
                >
                  <Trash2 size={18} color="#ffffff" />
                  <Text style={styles.mediaModalDeleteText}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );

  const renderMediaTab = () => {
    const mediaMessages = messages.filter(m => m.type === 'image' || m.type === 'video');
    return (
      <View style={styles.mediaTabContainer}>
        {mediaMessages.length === 0 ? (
          <View style={styles.emptyState}>
            <ImageIcon size={48} color="#a78bfa80" />
            <Text style={styles.emptyStateText}>No media shared yet</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.mediaGrid}>
            {mediaMessages.map((media, index) => (
              <TouchableOpacity
                key={media.id}
                style={styles.mediaGridItem}
                onPress={() => {
                  if (isSelectionMode) {
                    handleMessagePress(media.id);
                    return;
                  }
                  setSelectedMedia(media);
                  setShowMediaModal(true);
                }}
                onLongPress={() => {
                  if (!isSelectionMode) handleMessageLongPress(media.id);
                }}
              >
                {isSelectionMode && (
                  <View
                    style={[
                      styles.mediaGridSelectionOverlay,
                      selectedMessages.has(media.id) && styles.mediaGridSelectionOverlaySelected,
                    ]}
                  >
                    {selectedMessages.has(media.id) && (
                      <View style={styles.mediaGridCheck}>
                        <Check size={16} color="#ffffff" />
                      </View>
                    )}
                  </View>
                )}
                {media.type === 'image' ? (
                  <Image
                    source={{ uri: getImageUrl(media.fileUrl || media.content) || media.fileUrl || media.content }}
                    style={styles.mediaGridImage}
                  />
                ) : (
                  <View style={styles.mediaGridVideo}>
                    <VideoIcon size={24} color="#ffffff" />
                    {media.duration && (
                      <Text style={styles.mediaGridDuration}>{media.duration}</Text>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderCommunityInfoModal = () => {
    const mediaMessages = messages.filter(m => m.type === 'image' || m.type === 'video');

    return (
      <Modal
        visible={showCommunityInfo}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCommunityInfo(false)}
      >
        <LinearGradient
          colors={['#0f172a', '#4c1d95', '#1e3a8a']}
          style={styles.container}
        >
          <LinearGradient
            colors={['rgba(15, 23, 42, 0.95)', 'rgba(76, 29, 149, 0.95)']}
            style={styles.infoHeader}
          >
            <TouchableOpacity
              onPress={() => setShowCommunityInfo(false)}
              style={styles.backButton}
            >
              <ArrowLeft size={24} color="#c4b5fd" />
            </TouchableOpacity>
            <View style={styles.infoHeaderContent}>
              <Image source={{ uri: getImageUrl(communityData.image) || communityData.image }} style={styles.infoCommunityAvatar} />
              <Text style={styles.infoCommunityName}>{communityData.name}</Text>
              <Text style={styles.infoCommunitySub}>
                {loadingMembers ? communityData.members : (members.length || communityData.members)} members • {loadingMembers ? communityData.activeMembers : members.filter(m => m.status === 'online').length} online
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.infoTabs}>
            <TouchableOpacity
              style={[styles.infoTabButton, infoTab === 'members' && styles.activeInfoTabButton]}
              onPress={() => setInfoTab('members')}
            >
              <Users size={20} color={infoTab === 'members' ? '#c4b5fd' : '#a78bfa80'} />
              <Text
                style={[styles.infoTabText, infoTab === 'members' && styles.activeInfoTabText, { marginLeft: 8 }]}
              >
                Members ({members.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.infoTabButton, infoTab === 'media' && styles.activeInfoTabButton]}
              onPress={() => setInfoTab('media')}
            >
              <ImageIcon size={20} color={infoTab === 'media' ? '#c4b5fd' : '#a78bfa80'} />
              <Text
                style={[styles.infoTabText, infoTab === 'media' && styles.activeInfoTabText, { marginLeft: 8 }]}
              >
                Media ({mediaMessages.length})
              </Text>
            </TouchableOpacity>
          </View>

          {infoTab === 'members' && (
            <ScrollView style={styles.infoContent}>
              {loadingMembers ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#a78bfa" />
                  <Text style={styles.loadingText}>Loading members...</Text>
                </View>
              ) : members.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Users size={48} color="#a78bfa80" />
                  <Text style={styles.emptyText}>No members found</Text>
                </View>
              ) : (
                members.map(member => (
                <TouchableOpacity
                  key={member.id}
                  style={styles.memberItem}
                  onPress={() => {
                    if (onViewProfile && member.userId) {
                      onViewProfile(member.userId);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.memberAvatarContainer}>
                    <Image 
                    source={getAvatarImageSource(member.avatar) || { uri: getImageUrl(member.avatar) || member.avatar }} 
                    style={styles.memberAvatar}
                    onError={(error) => {
                      console.error('Error loading member avatar:', error);
                    }}
                  />
                    <View
                      style={[
                        styles.memberStatus,
                        {
                          backgroundColor:
                            member.status === 'online'
                              ? '#10b981'
                              : member.status === 'away'
                              ? '#f59e0b'
                              : '#6b7280',
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.memberInfo}>
                    <View style={styles.memberNameRow}>
                      <Text style={styles.memberName}>{member.username}</Text>
                      {member.role === 'owner' && <Crown size={16} color="#fbbf24" />}
                      {member.role === 'admin' && <Shield size={16} color="#a78bfa" />}
                    </View>
                    <Text style={styles.memberRole}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)} • {member.status}
                    </Text>
                  </View>
                </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}

          {infoTab === 'media' && (
            <ScrollView contentContainerStyle={styles.infoContent}>
              {mediaMessages.length === 0 ? (
                <View style={styles.emptyState}>
                  <ImageIcon size={48} color="#a78bfa80" />
                  <Text style={styles.emptyStateText}>No media shared yet</Text>
                </View>
              ) : (
                <View style={styles.mediaGrid}>
                  {mediaMessages.map(media => (
                    <TouchableOpacity
                      key={media.id}
                      style={styles.mediaGridItem}
                      onPress={() => {
                        if (isSelectionMode) {
                          handleMessagePress(media.id);
                          return;
                        }
                        setSelectedMedia(media);
                        setShowMediaModal(true);
                        setShowCommunityInfo(false);
                      }}
                      onLongPress={() => {
                        if (!isSelectionMode) handleMessageLongPress(media.id);
                      }}
                    >
                      {isSelectionMode && (
                        <View
                          style={[
                            styles.mediaGridSelectionOverlay,
                            selectedMessages.has(media.id) && styles.mediaGridSelectionOverlaySelected,
                          ]}
                        >
                          {selectedMessages.has(media.id) && (
                            <View style={styles.mediaGridCheck}>
                              <Check size={16} color="#ffffff" />
                            </View>
                          )}
                        </View>
                      )}
                      {media.type === 'image' ? (
                        <Image
                          source={{ uri: getImageUrl(media.fileUrl || media.content) || media.fileUrl || media.content }}
                          style={styles.mediaGridImage}
                        />
                      ) : (
                        <View style={styles.mediaGridVideo}>
                          <VideoIcon size={24} color="#ffffff" />
                          {media.duration && (
                            <Text style={styles.mediaGridDuration}>{media.duration}</Text>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </LinearGradient>
      </Modal>
    );
  };

  const renderEmojiPicker = () => (
    <Modal
      visible={showEmojiPicker}
      transparent
      animationType="slide"
      onRequestClose={() => setShowEmojiPicker(false)}
    >
      <Pressable
        style={styles.emojiPickerOverlay}
        onPress={() => setShowEmojiPicker(false)}
      >
        <Pressable style={styles.emojiPickerContainer} onPress={(e) => e.stopPropagation()}>
          <View style={styles.emojiPickerHeader}>
            <Text style={styles.emojiPickerTitle}>Emoji</Text>
            <TouchableOpacity onPress={() => setShowEmojiPicker(false)}>
              <X size={24} color="#c4b5fd" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.emojiGrid}>
            {commonEmojis.map((emoji, index) => (
              <TouchableOpacity
                key={index}
                style={styles.emojiItem}
                onPress={() => handleEmojiSelect(emoji)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const renderMoreMenu = () => (
    <Modal
      visible={showMoreMenu}
      transparent
      animationType="fade"
      onRequestClose={() => setShowMoreMenu(false)}
    >
      <Pressable style={styles.moreMenuOverlay} onPress={() => setShowMoreMenu(false)}>
        <View style={styles.moreMenuContainer}>
          <TouchableOpacity
            style={styles.moreMenuItem}
            onPress={() => {
              setShowMoreMenu(false);
              handleClearChat();
            }}
          >
            <Trash2 size={20} color="#ef4444" />
            <Text style={[styles.moreMenuText, { color: '#ef4444', marginLeft: 12 }]}>Clear Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.moreMenuItem}
            onPress={() => {
              setShowMoreMenu(false);
              handleExportChat();
            }}
          >
            <Share2 size={20} color="#c4b5fd" />
            <Text style={[styles.moreMenuText, { marginLeft: 12 }]}>Export Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.moreMenuItem}
            onPress={() => {
              setShowMoreMenu(false);
              Alert.alert('Notifications', 'Notifications muted');
            }}
          >
            <Bell size={20} color="#c4b5fd" />
            <Text style={[styles.moreMenuText, { marginLeft: 12 }]}>Mute Notifications</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.moreMenuItem}
            onPress={() => {
              setShowMoreMenu(false);
              setShowCommunityInfo(true);
            }}
          >
            <Settings size={20} color="#c4b5fd" />
            <Text style={[styles.moreMenuText, { marginLeft: 12 }]}>Group Settings</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );


  return (
    <LinearGradient
      colors={['#0f172a', '#4c1d95', '#1e3a8a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.95)', 'rgba(76, 29, 149, 0.95)']}
          style={styles.header}
        >
          {isSelectionMode ? (
            <>
              <TouchableOpacity onPress={handleCancelSelection} style={styles.backButton}>
                <X size={24} color="#c4b5fd" />
              </TouchableOpacity>
              <View style={styles.headerInfo}>
                <Text style={styles.selectionCount}>
                  {selectedMessages.size} {selectedMessages.size === 1 ? 'message' : 'messages'} selected
                </Text>
              </View>
              {selectedMessages.size > 0 && (
                <TouchableOpacity
                  style={styles.headerButton}
                  onPress={handleDeleteSelectedMessages}
                >
                  <Trash2 size={24} color="#ef4444" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.headerButton} onPress={handleMoreMenu}>
                <MoreVertical size={24} color="#c4b5fd" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <ArrowLeft size={24} color="#c4b5fd" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerInfo}
                onPress={() => setShowCommunityInfo(true)}
                activeOpacity={0.7}
              >
                <View style={styles.avatarContainer}>
                  <Image source={{ uri: getImageUrl(communityData.image) || communityData.image }} style={styles.communityAvatar} />
                  {/* Real-time connection indicator */}
                  <View style={[
                    styles.headerConnectionDot,
                    socketConnected ? styles.headerConnectionOnline : styles.headerConnectionOffline
                  ]} />
                </View>
                <View style={styles.headerTextContainer}>
                  <View style={styles.headerTitleRow}>
                    <Text style={styles.communityName}>{communityData.name}</Text>
                    {socketConnected && (
                      <Wifi size={12} color="#10b981" style={{ marginLeft: 6 }} />
                    )}
                  </View>
                  <Text style={styles.communitySub}>
                    {onlineUserIds.size > 0 ? onlineUserIds.size : (loadingMembers ? communityData.activeMembers : members.filter(m => m.status === 'online').length)} online • {loadingMembers ? communityData.members : (members.length || communityData.members)} members
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerButton} onPress={handleMoreMenu}>
                <MoreVertical size={24} color="#c4b5fd" />
              </TouchableOpacity>
            </>
          )}
        </LinearGradient>

        {/* Chat Messages */}
        {loadingMessages ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#a78bfa" />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MessageSquare size={48} color="#a78bfa80" />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start the conversation!</Text>
          </View>
        ) : (
          <FlatList
            ref={messagesEndRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesList}
            inverted={false}
          />
        )}

        {replyingTo && !isSelectionMode && (
          <View style={styles.replyBanner}>
            <View style={styles.replyBannerContent}>
              <Reply size={16} color="#a78bfa" />
              <View style={styles.replyBannerText}>
                <Text style={styles.replyBannerUsername}>Replying to {replyingTo.username}</Text>
                <Text style={styles.replyBannerMessage} numberOfLines={1}>
                  {replyingTo.type === 'text' 
                    ? replyingTo.content 
                    : replyingTo.type === 'image' 
                    ? '📷 Photo'
                    : replyingTo.type === 'video'
                    ? '🎥 Video'
                    : replyingTo.type === 'audio'
                    ? '🎤 Audio'
                    : 'Media'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <X size={20} color="#c4b5fd" />
            </TouchableOpacity>
          </View>
        )}

        {isRecording && !isSelectionMode && (
          <View style={styles.recordingBanner}>
            <View style={styles.recordingIndicator} />
            <Text style={styles.recordingText}>Recording... {formatTime(recordingDuration)}</Text>
            <TouchableOpacity
              style={styles.stopRecordingButton}
              onPress={handleStopRecording}
            >
              <Text style={styles.stopRecordingText}>Stop</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Typing Indicator */}
        {typingUsers.size > 0 && !isSelectionMode && (
          <View style={styles.typingIndicatorContainer}>
            <View style={styles.typingDots}>
              <View style={[styles.typingDot, styles.typingDot1]} />
              <View style={[styles.typingDot, styles.typingDot2]} />
              <View style={[styles.typingDot, styles.typingDot3]} />
            </View>
            <Text style={styles.typingText}>
              {typingUsers.size === 1
                ? `${Array.from(typingUsers.values())[0]} is typing...`
                : typingUsers.size === 2
                ? `${Array.from(typingUsers.values()).join(' and ')} are typing...`
                : `${typingUsers.size} people are typing...`}
            </Text>
          </View>
        )}

        {/* Message Input */}
        {!isSelectionMode && (
          <View style={styles.inputContainer}>
          {/* Connection Status Indicator */}
          {connectionStatus !== 'connected' && (
            <View style={[
              styles.connectionIndicator,
              connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
                ? styles.connectionIndicatorConnecting
                : styles.connectionIndicatorDisconnected
            ]}>
              {(connectionStatus === 'connecting' || connectionStatus === 'reconnecting') ? (
                <ActivityIndicator size="small" color="#fbbf24" />
              ) : (
                <View style={styles.connectionDot} />
              )}
            </View>
          )}
          <TouchableOpacity
            style={styles.inputIconButton}
            onPress={() => setShowAttachmentMenu(true)}
          >
            <Paperclip size={24} color="#a78bfa" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={handleTextChange}
            placeholder={socketConnected ? "Type a message..." : "Connecting..."}
            placeholderTextColor="#a78bfa80"
            multiline
            maxLength={1000}
          />
          <View style={styles.inputRightButtons}>
            {newMessage.trim() ? (
              <TouchableOpacity 
                style={styles.sendButton} 
                onPress={handleSendMessage}
                disabled={sendingMessage}
              >
                <LinearGradient
                  colors={socketConnected ? ['#7c3aed', '#2563eb', '#06b6d4'] : ['#6b7280', '#4b5563', '#374151']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendButtonGradient}
                >
                  {sendingMessage ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Send size={20} color="#ffffff" />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.emojiButton, { marginRight: 8 }]}
                  onPress={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  <LinearGradient
                    colors={['#fbbf24', '#f59e0b', '#d97706']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.emojiButtonGradient}
                  >
                    <Text style={styles.emojiIcon}>😊</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.voiceButton}
                  onPress={handleStartRecording}
                  onLongPress={handleStartRecording}
                >
                  <LinearGradient
                    colors={['#10b981', '#059669', '#047857']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.voiceButtonGradient}
                  >
                    <Mic size={20} color="#ffffff" />
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
        )}
      </KeyboardAvoidingView>

      {renderAttachmentMenu()}
      {renderMediaModal()}
      {renderCommunityInfoModal()}
      {renderEmojiPicker()}
      {renderMoreMenu()}
    </LinearGradient>
  );
};

export default JoinCommunityPage;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.3)',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  communityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  communityName: {
    color: '#c4b5fd',
    fontWeight: '600',
    fontSize: 16,
  },
  headerConnectionDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(15, 23, 42, 1)',
  },
  headerConnectionOnline: {
    backgroundColor: '#10b981',
  },
  headerConnectionOffline: {
    backgroundColor: '#6b7280',
  },
  communitySub: {
    color: '#a78bfa80',
    fontSize: 12,
    marginTop: 2,
  },
  headerButton: {
    padding: 8,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginVertical: 2,
    maxWidth: '80%',
  },
  messageWrapperLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-end',
  },
  messageWrapperRight: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginTop: 4,
  },
  messageAvatarPlaceholder: {
    width: 32,
    marginRight: 8,
  },
  messageContentWrapper: {
    flexShrink: 1,
    maxWidth: '100%',
  },
  messageSenderName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
    marginLeft: 4,
  },
  messageBubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start', // Shrink to content width
  },
  messageBubbleWithUsername: {
    borderTopLeftRadius: 4,
  },
  messageBubbleSent: {
    backgroundColor: '#7c3aed',
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end', // Align sent messages to right
  },
  messageBubbleReceived: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    alignSelf: 'flex-start', // Align received messages to left
  },
  messageText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextSent: {
    color: '#ffffff',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTime: {
    color: '#a78bfa80',
    fontSize: 11,
    marginRight: 4,
  },
  messageTimeSent: {
    color: '#ffffff80',
  },
  messageStatus: {
    marginLeft: 2,
  },
  replyContainer: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingLeft: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#a78bfa',
  },
  replyIndicator: {
    width: 3,
    backgroundColor: '#a78bfa',
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replyUsername: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyText: {
    color: '#c4b5fd80',
    fontSize: 12,
  },
  messageImage: {
    width: 250,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
  },
  messageVideoContainer: {
    width: 250,
    height: 200,
    borderRadius: 8,
    marginBottom: 4,
    position: 'relative',
  },
  messageVideoThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  messageVideoThumbnailFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageVideoLabel: {
    marginTop: 6,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.9,
  },
  messageVideoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  videoDurationText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 200,
    paddingVertical: 4,
  },
  audioPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#a78bfa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  audioWaveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    marginRight: 8,
  },
  audioWave: {
    width: 3,
    backgroundColor: '#a78bfa',
    marginHorizontal: 2,
    borderRadius: 2,
  },
  audioDuration: {
    color: '#ffffff',
    fontSize: 12,
    minWidth: 35,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
  },
  dateSeparatorText: {
    color: '#a78bfa80',
    fontSize: 12,
    marginHorizontal: 12,
    fontWeight: '500',
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.3)',
    padding: 12,
    paddingHorizontal: 16,
  },
  replyBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  replyBannerText: {
    marginLeft: 8,
    flex: 1,
  },
  replyBannerUsername: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyBannerMessage: {
    color: '#c4b5fd80',
    fontSize: 12,
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(248, 113, 113, 0.3)',
    padding: 12,
    paddingHorizontal: 16,
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  recordingText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  stopRecordingButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#ef4444',
    borderRadius: 8,
  },
  stopRecordingText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.3)',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
  },
  inputIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 8,
    overflow: 'hidden',
  },
  sendButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  attachmentMenu: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.3)',
  },
  attachmentOption: {
    alignItems: 'center',
    minWidth: 80,
  },
  attachmentIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  attachmentText: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: '500',
  },
  mediaModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaModalClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaModalContent: {
    width: SCREEN_WIDTH,
    height: '70%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaModalActions: {
    position: 'absolute',
    bottom: 18,
    left: 18,
    right: 18,
    alignItems: 'center',
  },
  mediaModalDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  mediaModalDeleteText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  mediaModalImage: {
    width: '100%',
    height: '100%',
  },
  mediaModalVideo: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaModalText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  mediaModalSubtext: {
    color: '#a78bfa80',
    fontSize: 14,
  },
  membersTabContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.1)',
  },
  memberAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  memberStatus: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(15, 23, 42, 1)',
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    color: '#c4b5fd',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
  memberRole: {
    color: '#a78bfa80',
    fontSize: 13,
  },
  mediaTabContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
  },
  mediaGridItem: {
    width: (SCREEN_WIDTH - 32) / 3,
    height: (SCREEN_WIDTH - 32) / 3,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaGridSelectionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.0)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 6,
    zIndex: 2,
  },
  mediaGridSelectionOverlaySelected: {
    backgroundColor: 'rgba(124, 58, 237, 0.25)',
  },
  mediaGridCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaGridImage: {
    width: '100%',
    height: '100%',
  },
  mediaGridVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  mediaGridDuration: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    color: '#ffffff',
    fontSize: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    color: '#a78bfa80',
    fontSize: 16,
    marginTop: 12,
  },
  inputRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  emojiButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiIcon: {
    fontSize: 20,
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  voiceButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.3)',
  },
  infoHeaderContent: {
    flex: 1,
    alignItems: 'center',
    marginLeft: 8,
  },
  infoCommunityAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: 'rgba(139, 92, 246, 0.5)',
  },
  infoCommunityName: {
    color: '#c4b5fd',
    fontWeight: '700',
    fontSize: 22,
    marginBottom: 4,
  },
  infoCommunitySub: {
    color: '#a78bfa80',
    fontSize: 14,
  },
  infoTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.3)',
  },
  infoTabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeInfoTabButton: {
    borderBottomColor: '#a78bfa',
  },
  infoTabText: {
    color: '#a78bfa80',
    fontWeight: '500',
    fontSize: 14,
  },
  activeInfoTabText: {
    color: '#c4b5fd',
    fontWeight: '600',
  },
  infoContent: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  emojiPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  emojiPickerContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '50%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  emojiPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.3)',
  },
  emojiPickerTitle: {
    color: '#c4b5fd',
    fontSize: 18,
    fontWeight: '600',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
  },
  emojiItem: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  emojiText: {
    fontSize: 28,
  },
  moreMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  moreMenuContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.98)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  moreMenuText: {
    color: '#c4b5fd',
    fontSize: 16,
    fontWeight: '500',
  },
  selectionCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#a78bfa',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCheckboxSelected: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#a78bfa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubbleSelected: {
    opacity: 0.7,
    borderWidth: 2,
    borderColor: '#a78bfa',
  },
  selectionCount: {
    color: '#c4b5fd',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#a78bfa80',
    fontSize: 14,
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#a78bfa80',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#a78bfa60',
    fontSize: 14,
    marginTop: 4,
  },
  // Typing indicator styles
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.2)',
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#a78bfa',
    marginHorizontal: 2,
  },
  typingDot1: {
    opacity: 1,
  },
  typingDot2: {
    opacity: 0.7,
  },
  typingDot3: {
    opacity: 0.4,
  },
  typingText: {
    color: '#a78bfa80',
    fontSize: 12,
    fontStyle: 'italic',
  },
  // Connection status styles
  connectionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  connectionIndicatorConnecting: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
  },
  connectionIndicatorDisconnected: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
});
