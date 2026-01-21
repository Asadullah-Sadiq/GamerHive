import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  Linking,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Audio } from 'expo-av';
import { VideoView, useVideoPlayer } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { getImageUrl } from '../utils/api';
import { getAvatarImageSource } from '../utils/avatarUtils';
import { socketService } from '../utils/socketService';
import {
  ArrowLeft,
  Send,
  User,
  Paperclip,
  Camera,
  Image as ImageIcon,
  Video,
  FileText,
  Mic,
  Play,
  Pause,
  Download,
  Trash2,
  X,
  Check,
  Clock,
  MoreVertical,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DirectVideoPlayer: React.FC<{ videoUri: string }> = ({ videoUri }) => {
  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  return (
    <View style={styles.mediaModalVideoPlayer}>
      <VideoView
        player={player}
        style={styles.mediaModalVideoPlayerView}
        nativeControls
        contentFit="contain"
        allowsPictureInPicture={true}
      />
    </View>
  );
};

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  duration?: string;
  isRead?: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

interface PTPMessagingPageProps {
  targetUserId?: string;
  targetUsername?: string;
  targetUserAvatar?: string;
  onBack?: () => void;
}

const PTPMessagingPage: React.FC<PTPMessagingPageProps> = ({
  targetUserId,
  targetUsername,
  targetUserAvatar,
  onBack,
}) => {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<Message | null>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [targetUser, setTargetUser] = useState<{
    id: string;
    username: string;
    avatar: string;
  } | null>(null);

  const messagesEndRef = useRef<FlatList<Message>>(null);
  const flatListRef = useRef<FlatList<Message>>(null);
  const recordingRef = useRef<any>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const soundRef = useRef<any>(null);

  // Load current user data
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          setCurrentUserId(user.id || user._id);
          setCurrentUserAvatar(user.picture || '');
        }
      } catch (error) {
        console.error('Error loading current user:', error);
      }
    };
    loadCurrentUser();
  }, []);

  // Load target user data
  useEffect(() => {
    const loadTargetUser = async () => {
      if (!targetUserId) return;

      try {
        setLoading(true);
        // Try to fetch user profile if not provided
        if (!targetUsername || !targetUserAvatar) {
          const response = await api.get(`/user/profile/${targetUserId}`);
          if (response.data.success) {
            const user = response.data.data.user;
            setTargetUser({
              id: user._id || user.id,
              username: user.username || user.name || 'User',
              avatar: user.picture || '',
            });
          }
        } else {
          setTargetUser({
            id: targetUserId,
            username: targetUsername,
            avatar: targetUserAvatar || '',
          });
        }
      } catch (error) {
        console.error('Error loading target user:', error);
        Alert.alert('Error', 'Failed to load user information');
      } finally {
        setLoading(false);
      }
    };

    loadTargetUser();
  }, [targetUserId, targetUsername, targetUserAvatar]);

  // Download and save media file to device
  const downloadAndSaveMedia = async (
    messageId: string,
    fileUrl: string,
    mediaType: 'audio' | 'video' | 'image' | 'file',
    fileName?: string
  ): Promise<string | null> => {
    try {
      // Always convert localhost URLs to the proper IP address for mobile devices
      // getImageUrl handles localhost conversion automatically - use it for all URLs
      let fullUrl: string;
      
      // Use getImageUrl which properly converts localhost URLs to the device-accessible IP address
      const convertedUrl = getImageUrl(fileUrl);
      fullUrl = convertedUrl || fileUrl;
      
      // Log for debugging (can be removed later)
      if (fileUrl !== fullUrl) {
        console.log(`[Download Media] Converted localhost URL: ${fileUrl} -> ${fullUrl}`);
      }
      
      // Create appropriate directory based on media type
      let mediaDir: string;
      switch (mediaType) {
        case 'audio':
          mediaDir = `${FileSystem.documentDirectory}voiceNotes/`;
          break;
        case 'video':
          mediaDir = `${FileSystem.documentDirectory}videos/`;
          break;
        case 'image':
          mediaDir = `${FileSystem.documentDirectory}images/`;
          break;
        case 'file':
          mediaDir = `${FileSystem.documentDirectory}files/`;
          break;
        default:
          mediaDir = `${FileSystem.documentDirectory}media/`;
      }

      // Create directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(mediaDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(mediaDir, { intermediates: true });
      }

      // Generate filename
      let fileExtension = fileName?.split('.').pop();
      if (!fileExtension) {
        // Default extensions based on type
        switch (mediaType) {
          case 'audio':
            fileExtension = 'm4a';
            break;
          case 'video':
            fileExtension = 'mp4';
            break;
          case 'image':
            fileExtension = 'jpg';
            break;
          default:
            fileExtension = 'bin';
        }
      }

      const prefix = mediaType === 'audio' ? 'voice_' : mediaType === 'video' ? 'video_' : mediaType === 'image' ? 'image_' : 'file_';
      const savedFileName = `${prefix}${messageId}.${fileExtension}`;
      const localFilePath = `${mediaDir}${savedFileName}`;

      // Check if file already exists
      const fileInfo = await FileSystem.getInfoAsync(localFilePath);
      if (fileInfo.exists) {
        return localFilePath;
      }

      // Download file
      const downloadResult = await FileSystem.downloadAsync(fullUrl, localFilePath);
      return downloadResult.uri;
    } catch (error) {
      console.error(`Error downloading ${mediaType}:`, error);
      return null;
    }
  };

  // Load messages from backend
  useEffect(() => {
    const loadMessages = async () => {
      if (!currentUserId || !targetUserId) return;

      try {
        setLoading(true);
        const response = await api.get(`/direct/messages/${currentUserId}/${targetUserId}`);
        if (response.data.success) {
          const formattedMessages = await Promise.all(
            response.data.data.messages.map(async (msg: any) => {
              let localFileUrl = msg.fileUrl;
              
              // Automatically download and save all media types (audio, video, image, file)
              if ((msg.type === 'audio' || msg.type === 'video' || msg.type === 'image' || msg.type === 'file') && msg.fileUrl) {
                const savedPath = await downloadAndSaveMedia(msg.id, msg.fileUrl, msg.type, msg.fileName);
                if (savedPath) {
                  localFileUrl = savedPath; // Use local file path for display/playback
                }
              }

              return {
                id: msg.id,
                senderId: msg.senderId,
                receiverId: msg.receiverId,
                content: msg.content,
                timestamp: msg.timestamp,
                type: msg.type,
                fileUrl: localFileUrl,
                fileName: msg.fileName,
                fileSize: msg.fileSize,
                duration: msg.duration,
                isRead: msg.isRead,
                status:
                  msg.senderId === currentUserId
                    ? (msg.isRead ? 'read' : 'sent')
                    : undefined,
              };
            })
          );
          setMessages(formattedMessages);
          // Mark incoming messages as read when opening the chat
          markConversationAsRead();
        }
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setLoading(false);
      }
    };

    if (currentUserId && targetUserId) {
      loadMessages();
    }
  }, [currentUserId, targetUserId]);

  // Setup socket connection and real-time messaging
  useEffect(() => {
    if (!currentUserId || !targetUserId) return;

    const setupSocket = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const user = JSON.parse(userData);
          const username = user.username || 'User';
          
          // Connect socket (no communityId for direct messaging)
          socketService.connect(currentUserId, username);
          
          // Set up event handlers for direct messages
          socketService.setEventHandlers({
            onNewDirectMessage: async (message) => {
              // Only process messages for this conversation
              if ((message.senderId === currentUserId && message.receiverId === targetUserId) ||
                  (message.senderId === targetUserId && message.receiverId === currentUserId)) {
                
                setMessages((prev) => {
                  // Check if message already exists (avoid duplicates)
                  const exists = prev.some((msg) => msg.id === message.id);
                  if (exists) return prev;
                  
                  // If this is a message we sent, replace the temp message
                  const tempMessageIndex = prev.findIndex((msg) => 
                    msg.senderId === currentUserId && 
                    msg.content === message.content && 
                    msg.id.length === 13 // Temp ID is timestamp string (13 digits)
                  );
                  
                  let localFileUrl = message.fileUrl;
                  
                  // Download and save media if needed (async, will update later)
                  if ((message.type === 'audio' || message.type === 'video' || message.type === 'image' || message.type === 'file') && message.fileUrl) {
                    downloadAndSaveMedia(message.id, message.fileUrl, message.type, message.fileName).then((savedPath) => {
                      if (savedPath) {
                        setMessages((prevMsgs) =>
                          prevMsgs.map((msg) =>
                            msg.id === message.id ? { ...msg, fileUrl: savedPath } : msg
                          )
                        );
                      }
                    });
                  }
                  
                  const newMessage: Message = {
                    id: message.id,
                    senderId: message.senderId,
                    receiverId: message.receiverId,
                    content: message.content,
                    timestamp: message.timestamp,
                    type: message.type,
                    fileUrl: localFileUrl,
                    fileName: message.fileName,
                    fileSize: message.fileSize,
                    duration: message.duration,
                    isRead: message.isRead,
                    status:
                      message.senderId === currentUserId
                        ? (message.isRead ? 'read' : 'sent')
                        : undefined,
                  };
                  
                  // Replace temp message or add new message
                  if (tempMessageIndex !== -1) {
                    const updated = [...prev];
                    updated[tempMessageIndex] = newMessage;
                    return updated;
                  }
                  
                  return [...prev, newMessage];
                });

                // If it's an incoming message to the current user, mark it as read
                if (message.senderId === targetUserId && message.receiverId === currentUserId) {
                  markConversationAsRead();
                }
              }
            },
            onDirectMessageDeleted: (data) => {
              const ids = data?.messageIds || [];
              if (!Array.isArray(ids) || ids.length === 0) return;
              // For "delete for me", server emits only to this user, but keep a safety check
              if (data?.scope === 'me' && data?.userId && data.userId !== currentUserId) return;
              setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
              setSelectedMessages((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                if (next.size === 0) setIsSelectionMode(false);
                return next;
              });
            },
            onDirectMessageDelivered: (data) => {
              if (!data?.messageId) return;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === data.messageId && m.senderId === currentUserId
                    ? { ...m, status: m.status === 'read' ? 'read' : 'delivered' }
                    : m
                )
              );
            },
            onDirectMessageRead: (data) => {
              const ids = data?.messageIds || [];
              if (!Array.isArray(ids) || ids.length === 0) return;
              setMessages((prev) =>
                prev.map((m) =>
                  ids.includes(m.id) && m.senderId === currentUserId
                    ? { ...m, status: 'read', isRead: true }
                    : m
                )
              );
            },
            onDirectChatCleared: (data) => {
              if (!data?.userId || !data?.targetUserId) return;
              if (data.userId === currentUserId && data.targetUserId === targetUserId) {
                setMessages([]);
                setIsSelectionMode(false);
                setSelectedMessages(new Set());
              }
            },
          });
        }
      } catch (error) {
        console.error('Error setting up socket:', error);
      }
    };

    setupSocket();

    return () => {
      // Cleanup: clear event handlers on unmount (but don't disconnect socket as it might be used elsewhere)
      socketService.clearEventHandlers();
    };
  }, [currentUserId, targetUserId]);

  const canDeleteMessage = (_msg: Message) => {
    // We always allow "Delete for me" for any message in this chat.
    return !!currentUserId;
  };

  const handleMessageLongPress = (msg: Message) => {
    if (!canDeleteMessage(msg)) return;
    setIsSelectionMode(true);
    setSelectedMessages(new Set([msg.id]));
  };

  const toggleMessageSelected = (messageId: string) => {
    setSelectedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      if (next.size === 0) setIsSelectionMode(false);
      return next;
    });
  };

  const handleMessagePress = (msg: Message) => {
    if (!isSelectionMode) return;
    if (!canDeleteMessage(msg)) return;
    toggleMessageSelected(msg.id);
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedMessages(new Set());
  };

  const handleDeleteSelectedMessages = async () => {
    if (!currentUserId) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }
    const messageIds = Array.from(selectedMessages);
    if (messageIds.length === 0) return;

    const selected = messages.filter((m) => selectedMessages.has(m.id));
    const allMine = selected.length > 0 && selected.every((m) => m.senderId === currentUserId);

    const deleteForMe = async () => {
      const resp = await api.delete('/direct/messages', {
        data: { userId: currentUserId, messageIds, scope: 'me' },
      });
      if (!resp.data.success) throw new Error(resp.data.message || 'Failed to delete messages');
      setMessages((prev) => prev.filter((m) => !selectedMessages.has(m.id)));
      handleCancelSelection();
    };

    const deleteForEveryone = async () => {
      const resp = await api.delete('/direct/messages', {
        data: { userId: currentUserId, messageIds, scope: 'everyone' },
      });
      if (!resp.data.success) throw new Error(resp.data.message || 'Failed to delete messages');
      setMessages((prev) => prev.filter((m) => !selectedMessages.has(m.id)));
      handleCancelSelection();
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
            } catch (e: any) {
              console.error('Error deleting messages:', e);
              Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to delete messages');
            }
          },
        },
        ...(allMine
          ? [{
              text: 'Delete for everyone',
              style: 'destructive' as const,
              onPress: async () => {
                try {
                  await deleteForEveryone();
                } catch (e: any) {
                  console.error('Error deleting messages:', e);
                  Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to delete messages');
                }
              },
            }]
          : []),
      ]
    );
  };

  // Responsive sizing helpers (keeps layout nice across phones/tablets)
  const getBubbleMaxWidth = () => {
    // On larger screens, keep bubbles from getting too wide
    return Math.min(SCREEN_WIDTH * 0.82, 520);
  };

  const getMediaSize = () => {
    const maxWidth = getBubbleMaxWidth();
    // account for bubble horizontal padding so media never overflows
    const availableWidth = Math.max(120, maxWidth - 32);
    const width = Math.min(availableWidth, 320);
    const height = Math.round(width * 0.75); // 4:3-ish
    return { width, height };
  };

  const getMediaMaxWidth = () => {
    // keep media from getting huge on tablets
    return Math.min(getBubbleMaxWidth(), 320);
  };

  const getStatusIcon = (message: Message) => {
    if (message.status === 'sending') {
      return <Clock size={12} color="rgba(167, 139, 250, 0.8)" />;
    }
    if (message.status === 'read') {
      return (
        <View style={{ flexDirection: 'row', marginLeft: 4 }}>
          <Check size={12} color="#06b6d4" style={{ marginRight: -4 }} />
          <Check size={12} color="#06b6d4" />
        </View>
      );
    }
    if (message.status === 'delivered') {
      return (
        <View style={{ flexDirection: 'row', marginLeft: 4 }}>
          <Check size={12} color="rgba(167, 139, 250, 0.8)" style={{ marginRight: -4 }} />
          <Check size={12} color="rgba(167, 139, 250, 0.8)" />
        </View>
      );
    }
    if (message.status === 'sent') {
      return <Check size={12} color="rgba(167, 139, 250, 0.8)" style={{ marginLeft: 4 }} />;
    }
    return null;
  };

  const markConversationAsRead = async () => {
    if (!currentUserId || !targetUserId) return;
    try {
      await api.put('/direct/messages/read', {
        userId: currentUserId,
        targetUserId,
      });
      // Optimistically mark received messages as read locally
      setMessages((prev) =>
        prev.map((m) =>
          m.senderId === targetUserId && m.receiverId === currentUserId
            ? { ...m, isRead: true }
            : m
        )
      );
    } catch (e: any) {
      // Non-fatal; ticks will still work once read receipts are emitted
      console.warn('[Direct] Failed to mark messages as read:', e?.message || e);
    }
  };

  const handleClearChatForMe = async () => {
    if (!currentUserId || !targetUserId) return;
    Alert.alert('Clear chat', 'Clear this chat for you only?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete('/direct/messages/clear', {
              data: { userId: currentUserId, targetUserId },
            });
            setMessages([]);
            setShowMoreMenu(false);
            setIsSelectionMode(false);
            setSelectedMessages(new Set());
          } catch (e: any) {
            console.error('Error clearing chat:', e);
            Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to clear chat');
          }
        },
      },
    ]);
  };

  const handleExportChat = async () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        currentUserId,
        targetUser: targetUser ? { id: targetUser.id, username: targetUser.username } : null,
        messages,
      };
      const json = JSON.stringify(payload, null, 2);
      const fileName = `direct-chat-${targetUserId}-${Date.now()}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        UTI: Platform.OS === 'ios' ? 'public.json' : undefined,
      });
    } catch (e: any) {
      console.error('Error exporting chat:', e);
      Alert.alert('Error', e.message || 'Failed to export chat');
    } finally {
      setShowMoreMenu(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync();
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Handle send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || !targetUserId || sending) {
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // Add message optimistically
      const tempId = Date.now().toString();
      const tempMessage: Message = {
        id: tempId,
        senderId: currentUserId,
        receiverId: targetUserId,
        content: messageContent,
        timestamp: new Date().toISOString(),
        type: 'text',
        status: 'sending',
      };

      setMessages((prev) => [...prev, tempMessage]);

      // Try to send via socket first (real-time)
      if (socketService.isConnected()) {
        try {
          socketService.sendDirectMessage({
            senderId: currentUserId,
            receiverId: targetUserId,
            content: messageContent,
            type: 'text',
          });
          // Message will be replaced when we receive the confirmation via socket
          setSending(false);
          return;
        } catch (socketError) {
          console.warn('[Socket] Failed to send via socket, falling back to REST API:', socketError);
          // Fall through to REST API
        }
      }

      // Fallback to REST API if socket is not connected
      const response = await api.post('/direct/messages', {
        senderId: currentUserId,
        receiverId: targetUserId,
        content: messageContent,
        type: 'text',
      });

      if (response.data.success) {
        // Replace temp message with actual message from server
        const newMsg = response.data.data.message;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempId
              ? {
                  id: newMsg.id,
                  senderId: newMsg.senderId,
                  receiverId: newMsg.receiverId,
                  content: newMsg.content,
                  timestamp: newMsg.timestamp,
                  type: newMsg.type,
                  fileUrl: newMsg.fileUrl,
                  fileName: newMsg.fileName,
                  fileSize: newMsg.fileSize,
                  duration: newMsg.duration,
                  isRead: newMsg.isRead,
                  status: newMsg.isRead ? 'read' : 'sent',
                }
              : msg
          )
        );
      } else {
        throw new Error(response.data.message || 'Failed to send message');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.response?.data?.message || error.message || 'Failed to send message. Please try again.');
      // Remove the optimistic message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== Date.now().toString()));
    } finally {
      setSending(false);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return date.toLocaleDateString();
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
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

  // Handle take photo from camera
  const handleTakePhoto = async () => {
    setShowAttachmentMenu(false);
    if (!currentUserId) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const tempId = Date.now().toString();
        const tempMessage: Message = {
          id: tempId,
          senderId: currentUserId,
          receiverId: targetUserId!,
          content: 'Photo',
          timestamp: new Date().toISOString(),
          type: 'image',
          fileUrl: asset.uri,
          status: 'sending',
        };
        setMessages((prev) => [...prev, tempMessage]);

        // Upload image to backend
        try {
          const formData = new FormData();
          formData.append('file', {
            uri: asset.uri,
            type: 'image/jpeg',
            name: asset.fileName || 'photo.jpg',
          } as any);
          formData.append('senderId', currentUserId);
          formData.append('receiverId', targetUserId!);
          formData.append('type', 'image');

          const response = await api.post('/direct/messages/media', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          if (response.data.success) {
            const newMsg = response.data.data.message;
            
            // Download and save image locally
            let localFileUrl = newMsg.fileUrl;
            if (newMsg.type === 'image' && newMsg.fileUrl) {
              const savedPath = await downloadAndSaveMedia(newMsg.id, newMsg.fileUrl, 'image', newMsg.fileName);
              if (savedPath) {
                localFileUrl = savedPath;
              }
            }
            
            // Update local message
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempId
                  ? {
                      id: newMsg.id,
                      senderId: newMsg.senderId,
                      receiverId: newMsg.receiverId,
                      content: newMsg.content,
                      timestamp: newMsg.timestamp,
                      type: newMsg.type,
                      fileUrl: localFileUrl,
                      fileName: newMsg.fileName,
                      fileSize: newMsg.fileSize,
                      isRead: newMsg.isRead,
                      status: newMsg.isRead ? 'read' : 'sent',
                    }
                  : msg
              )
            );

            // Real-time delivery is handled by the backend after upload (no need to rebroadcast)
          }
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError);
          setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
          Alert.alert('Error', uploadError.response?.data?.message || 'Failed to upload photo.');
        }
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Handle send image from gallery
  const handleSendImage = async () => {
    setShowAttachmentMenu(false);
    if (!currentUserId) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Media library permission is required to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const tempId = Date.now().toString();
        const tempMessage: Message = {
          id: tempId,
          senderId: currentUserId,
          receiverId: targetUserId!,
          content: 'Photo',
          timestamp: new Date().toISOString(),
          type: 'image',
          fileUrl: asset.uri,
          status: 'sending',
        };
        setMessages((prev) => [...prev, tempMessage]);

        // Upload image to backend
        try {
          const formData = new FormData();
          formData.append('file', {
            uri: asset.uri,
            type: 'image/jpeg',
            name: asset.fileName || 'image.jpg',
          } as any);
          formData.append('senderId', currentUserId);
          formData.append('receiverId', targetUserId!);
          formData.append('type', 'image');

          const response = await api.post('/direct/messages/media', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          if (response.data.success) {
            const newMsg = response.data.data.message;
            
            // Download and save image locally
            let localFileUrl = newMsg.fileUrl;
            if (newMsg.type === 'image' && newMsg.fileUrl) {
              const savedPath = await downloadAndSaveMedia(newMsg.id, newMsg.fileUrl, 'image', newMsg.fileName);
              if (savedPath) {
                localFileUrl = savedPath;
              }
            }
            
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempId
                  ? {
                      id: newMsg.id,
                      senderId: newMsg.senderId,
                      receiverId: newMsg.receiverId,
                      content: newMsg.content,
                      timestamp: newMsg.timestamp,
                      type: newMsg.type,
                      fileUrl: localFileUrl,
                      fileName: newMsg.fileName,
                      fileSize: newMsg.fileSize,
                      isRead: newMsg.isRead,
                      status: newMsg.isRead ? 'read' : 'sent',
                    }
                  : msg
              )
            );

            // Real-time delivery is handled by the backend after upload (no need to rebroadcast)
          }
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError);
          setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
          Alert.alert('Error', uploadError.response?.data?.message || 'Failed to upload image.');
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Handle send video
  const handleSendVideo = async () => {
    setShowAttachmentMenu(false);
    if (!currentUserId) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Media library permission is required to select videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
        videoMaxDuration: 300, // 5 minutes max
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const durationString = formatVideoDuration(asset.duration);
        const tempId = Date.now().toString();
        
        const tempMessage: Message = {
          id: tempId,
          senderId: currentUserId,
          receiverId: targetUserId!,
          content: 'Video',
          timestamp: new Date().toISOString(),
          type: 'video',
          fileUrl: asset.uri,
          duration: durationString,
          status: 'sending',
        };
        setMessages((prev) => [...prev, tempMessage]);

        // Upload video to backend
        try {
          const formData = new FormData();
          formData.append('file', {
            uri: asset.uri,
            type: 'video/mp4',
            name: asset.fileName || 'video.mp4',
          } as any);
          formData.append('senderId', currentUserId);
          formData.append('receiverId', targetUserId!);
          formData.append('type', 'video');
          formData.append('duration', durationString);

          const response = await api.post('/direct/messages/media', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          if (response.data.success) {
            const newMsg = response.data.data.message;
            
            // Download and save video locally
            let localFileUrl = newMsg.fileUrl;
            if (newMsg.type === 'video' && newMsg.fileUrl) {
              const savedPath = await downloadAndSaveMedia(newMsg.id, newMsg.fileUrl, 'video', newMsg.fileName);
              if (savedPath) {
                localFileUrl = savedPath;
              }
            }
            
            // Update local message
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempId
                  ? {
                      id: newMsg.id,
                      senderId: newMsg.senderId,
                      receiverId: newMsg.receiverId,
                      content: newMsg.content,
                      timestamp: newMsg.timestamp,
                      type: newMsg.type,
                      fileUrl: localFileUrl,
                      fileName: newMsg.fileName,
                      fileSize: newMsg.fileSize,
                      duration: newMsg.duration,
                      isRead: newMsg.isRead,
                      status: newMsg.isRead ? 'read' : 'sent',
                    }
                  : msg
              )
            );

            // Real-time delivery is handled by the backend after upload (no need to rebroadcast)
          }
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError);
          setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
          Alert.alert('Error', uploadError.response?.data?.message || 'Failed to upload video.');
        }
      }
    } catch (error) {
      console.error('Video picker error:', error);
      Alert.alert('Error', 'Failed to pick video. Please try again.');
    }
  };

  // Handle send document
  const handleSendDocument = async () => {
    setShowAttachmentMenu(false);
    if (!currentUserId || !targetUserId) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const tempId = Date.now().toString();
        const tempMessage: Message = {
          id: tempId,
          senderId: currentUserId,
          receiverId: targetUserId,
          content: asset.name || 'Document',
          timestamp: new Date().toISOString(),
          type: 'file',
          fileUrl: asset.uri,
          fileName: asset.name,
          status: 'sending',
        };
        setMessages((prev) => [...prev, tempMessage]);

        // Upload file to backend and send message
        try {
          const formData = new FormData();
          formData.append('file', {
            uri: asset.uri,
            type: asset.mimeType || 'application/octet-stream',
            name: asset.name || 'document',
          } as any);
          formData.append('senderId', currentUserId);
          formData.append('receiverId', targetUserId);
          formData.append('type', 'file');

          const response = await api.post('/direct/messages/media', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });

          if (response.data.success) {
            const newMsg = response.data.data.message;
            
            // Download and save document locally
            let localFileUrl = newMsg.fileUrl;
            if (newMsg.type === 'file' && newMsg.fileUrl) {
              const savedPath = await downloadAndSaveMedia(newMsg.id, newMsg.fileUrl, 'file', newMsg.fileName);
              if (savedPath) {
                localFileUrl = savedPath;
              }
            }
            
            // Update local message
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempId
                  ? {
                      id: newMsg.id,
                      senderId: newMsg.senderId,
                      receiverId: newMsg.receiverId,
                      content: newMsg.content,
                      timestamp: newMsg.timestamp,
                      type: newMsg.type,
                      fileUrl: localFileUrl,
                      fileName: newMsg.fileName,
                      fileSize: newMsg.fileSize,
                      duration: newMsg.duration,
                      isRead: newMsg.isRead,
                      status: newMsg.isRead ? 'read' : 'sent',
                    }
                  : msg
              )
            );

            // Real-time delivery is handled by the backend after upload (no need to rebroadcast)
          }
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError);
          setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
          Alert.alert('Error', uploadError.response?.data?.message || 'Failed to upload document.');
        }
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  };

  // Handle start recording voice note
  const handleStartRecording = async () => {
    if (!currentUserId || !targetUserId) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }

    try {
      // Request audio recording permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone permission is required to record voice notes.');
        return;
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  // Handle stop recording and send voice note
  const handleStopRecording = async () => {
    if (!recordingRef.current) return;

    try {
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri || recordingDuration === 0) {
        return;
      }

      const durationString = formatRecordingDuration(recordingDuration);
      const tempId = Date.now().toString();

      // Create temp message
      const tempMessage: Message = {
        id: tempId,
        senderId: currentUserId!,
        receiverId: targetUserId!,
        content: 'Voice message',
        timestamp: new Date().toISOString(),
        type: 'audio',
        fileUrl: uri,
        duration: durationString,
        status: 'sending',
      };

      setMessages((prev) => [...prev, tempMessage]);
      setRecordingDuration(0);

      // Upload audio to backend
      try {
        const formData = new FormData();
        const fileExtension = uri.split('.').pop() || 'm4a';
        const fileName = `voice-note-${Date.now()}.${fileExtension}`;
        
        formData.append('file', {
          uri: uri,
          type: 'audio/m4a',
          name: fileName,
        } as any);
        formData.append('senderId', currentUserId!);
        formData.append('receiverId', targetUserId!);
        formData.append('type', 'audio');
        formData.append('duration', durationString);

        const response = await api.post('/direct/messages/media', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (response.data.success) {
          const newMsg = response.data.data.message;
          
          // Download and save voice note locally for the sender too
          let localFileUrl = newMsg.fileUrl;
          if (newMsg.type === 'audio' && newMsg.fileUrl) {
            const savedPath = await downloadAndSaveMedia(newMsg.id, newMsg.fileUrl, 'audio', newMsg.fileName);
            if (savedPath) {
              localFileUrl = savedPath;
            }
          }
          
          // Update local message
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempId
                ? {
                    id: newMsg.id,
                    senderId: newMsg.senderId,
                    receiverId: newMsg.receiverId,
                    content: newMsg.content,
                    timestamp: newMsg.timestamp,
                    type: newMsg.type,
                    fileUrl: localFileUrl,
                    fileName: newMsg.fileName,
                    fileSize: newMsg.fileSize,
                    duration: newMsg.duration,
                    isRead: newMsg.isRead,
                    status: newMsg.isRead ? 'read' : 'sent',
                  }
                : msg
            )
          );

          // Real-time delivery is handled by the backend after upload (no need to rebroadcast)
        }
      } catch (uploadError: any) {
        console.error('Upload error:', uploadError);
        setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
        Alert.alert('Error', uploadError.response?.data?.message || 'Failed to upload voice note.');
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
    }
  };

  // Format recording duration
  const formatRecordingDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle play/pause audio
  const handlePlayAudio = async (messageId: string, audioUrl: string) => {
    try {
      if (playingAudioId === messageId) {
        // Stop playing
        if (soundRef.current) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        setPlayingAudioId(null);
        return;
      }

      // Stop any currently playing audio
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      }

      // Check if it's a local file path or needs to be downloaded
      let playUrl = audioUrl;
      
      // If it's a remote URL (not a local file path), download and save it first
      if (audioUrl.startsWith('http') || audioUrl.startsWith('/uploads/')) {
        // Download and save if not already saved
        const savedPath = await downloadAndSaveMedia(messageId, audioUrl, 'audio');
        if (savedPath) {
          playUrl = savedPath;
          // Update message with local path for future use
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === messageId ? { ...msg, fileUrl: savedPath } : msg
            )
          );
        } else {
          // Fallback to remote URL if download fails
          playUrl = audioUrl.startsWith('http') ? audioUrl : getImageUrl(audioUrl) || audioUrl;
        }
      }

      // Load and play audio
      const { sound } = await Audio.Sound.createAsync({ uri: playUrl });
      soundRef.current = sound;

      await sound.playAsync();
      setPlayingAudioId(messageId);

      // Handle playback finish
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingAudioId(null);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play voice note.');
    }
  };

  // Handle open document
  const handleOpenDocument = async (fileUrl: string, fileName?: string) => {
    try {
      let fileUri = fileUrl;

      // If it's a remote URL, download it first
      if (fileUrl.startsWith('http') || fileUrl.startsWith('/uploads/')) {
        const convertedUrl = getImageUrl(fileUrl) || fileUrl;
        const fileNameFromUrl = fileName || fileUrl.split('/').pop() || 'document';
        
        // Download the file to cache directory
        const downloadResult = await FileSystem.downloadAsync(
          convertedUrl,
          `${FileSystem.cacheDirectory}${fileNameFromUrl}`
        );
        fileUri = downloadResult.uri;
      }

      // For Expo, use Sharing API which can open files with default apps
      // On Android, Sharing will show app picker to open with default app
      // On iOS, Sharing opens with default app directly
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Error', 'File sharing is not available on this device.');
        return;
      }

      // Detect mime type from file extension - this ensures Android shows only compatible apps
      const extension = (fileName || fileUri).split('.').pop()?.toLowerCase() || '';
      let mimeType = 'application/octet-stream';
      
      // Comprehensive MIME type mapping - Android uses this to filter apps
      const mimeTypes: { [key: string]: string } = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'rtf': 'application/rtf',
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed',
        'tar': 'application/x-tar',
        'gz': 'application/gzip',
        'csv': 'text/csv',
        'json': 'application/json',
        'xml': 'application/xml',
        'html': 'text/html',
        'css': 'text/css',
        'js': 'text/javascript',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
      };
      
      if (extension && mimeTypes[extension]) {
        mimeType = mimeTypes[extension];
      }

      // Use Sharing API - when mimeType is specified, Android will show only apps that can handle this file type
      // User selects an app from the filtered list, and the file opens in that app
      await Sharing.shareAsync(fileUri, {
        mimeType: mimeType, // This filters the app list to only compatible apps on Android
        UTI: Platform.OS === 'ios' && extension ? `public.${extension}` : undefined,
      });
    } catch (error: any) {
      console.error('Error opening document:', error);
      // FileViewer throws an error if user cancels or no app available
      // Only show alert for actual errors, not user cancellation
      if (error.message && !error.message.includes('cancel')) {
        Alert.alert('Error', error.message || 'Failed to open document. Please make sure you have an app installed that can open this file type.');
      }
    }
  };

  // Render message item
  const renderMessage = ({ item }: { item: Message }) => {
    const isCurrentUser = item.senderId === currentUserId;
    const avatar = isCurrentUser ? currentUserAvatar : targetUser?.avatar || '';
    const isSelected = selectedMessages.has(item.id);
    const deletable = canDeleteMessage(item);
    const mediaMaxWidth = getMediaMaxWidth();

    return (
      <View
        style={[
          styles.messageWrapper,
          isCurrentUser ? styles.messageWrapperRight : styles.messageWrapperLeft,
          { maxWidth: getBubbleMaxWidth() },
        ]}
      >
        {isSelectionMode && deletable && (
          <TouchableOpacity
            style={styles.selectionCheckbox}
            onPress={() => handleMessagePress(item)}
          >
            {isSelected && (
              <View style={styles.selectionCheckboxSelected}>
                <Check size={16} color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>
        )}
        {!isCurrentUser && (
          <Image
            source={getAvatarImageSource(getImageUrl(avatar))}
            style={styles.messageAvatar}
          />
        )}
        <View style={styles.messageContentWrapper}>
          {!isCurrentUser && (
            <Text style={styles.messageSenderName}>{targetUser?.username || 'User'}</Text>
          )}
          <Pressable
            style={[
              styles.messageBubble,
              isCurrentUser ? styles.messageBubbleRight : styles.messageBubbleLeft,
              isSelected && styles.messageBubbleSelected,
              (item.type === 'image' || item.type === 'video') && styles.messageBubbleMedia,
            ]}
            onLongPress={() => {
              if (!isSelectionMode) handleMessageLongPress(item);
            }}
            onPress={() => {
              if (isSelectionMode) handleMessagePress(item);
            }}
          >
            {item.type === 'image' && item.fileUrl ? (
              <Pressable
                onPress={() => {
                  if (isSelectionMode) {
                    handleMessagePress(item);
                    return;
                  }
                  setSelectedMedia(item);
                  setShowMediaModal(true);
                }}
                onLongPress={() => {
                  if (!isSelectionMode) handleMessageLongPress(item);
                }}
                style={[styles.mediaThumbContainer, { maxWidth: mediaMaxWidth }]}
              >
                <Image
                  source={{ uri: getImageUrl(item.fileUrl) || item.fileUrl }}
                  style={styles.mediaThumbImage}
                  resizeMode="cover"
                />
              </Pressable>
            ) : item.type === 'video' && item.fileUrl ? (
              <Pressable
                style={[styles.mediaThumbContainer, { maxWidth: mediaMaxWidth }]}
                onPress={() => {
                  if (isSelectionMode) {
                    handleMessagePress(item);
                    return;
                  }
                  setSelectedMedia(item);
                  setShowMediaModal(true);
                }}
                onLongPress={() => {
                  if (!isSelectionMode) handleMessageLongPress(item);
                }}
              >
                <View style={styles.videoThumbFallback}>
                  <Video size={44} color="rgba(167, 139, 250, 0.9)" />
                </View>
                <View style={styles.videoPlayOverlay}>
                  <Play size={34} color="#ffffff" />
                </View>
                {!!item.duration && (
                  <View style={styles.videoDurationBadge}>
                    <Text style={styles.videoDurationText}>{item.duration}</Text>
                  </View>
                )}
              </Pressable>
            ) : item.type === 'audio' && item.fileUrl ? (
              <View style={[
                styles.messageAudioContainer,
                !isCurrentUser && styles.messageAudioContainerLeft
              ]}>
                <TouchableOpacity
                  onPress={() => {
                    if (isSelectionMode) {
                      handleMessagePress(item);
                      return;
                    }
                    handlePlayAudio(item.id, item.fileUrl!);
                  }}
                  style={[
                    styles.audioPlayButton,
                    !isCurrentUser && styles.audioPlayButtonLeft,
                    playingAudioId === item.id && styles.audioPlayButtonActive,
                    !isCurrentUser && playingAudioId === item.id && styles.audioPlayButtonActiveLeft,
                  ]}
                  activeOpacity={0.7}
                >
                  {playingAudioId === item.id ? (
                    <Pause size={16} color={isCurrentUser ? "#fff" : "#7C3AED"} />
                  ) : (
                    <Play size={16} color={isCurrentUser ? "#fff" : "#7C3AED"} style={{ marginLeft: 1 }} />
                  )}
                </TouchableOpacity>
                <View style={styles.audioWaveformContainer}>
                  <View style={styles.audioWaveform}>
                    <View style={[
                      styles.audioWave,
                      { height: 4 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                    <View style={[
                      styles.audioWave,
                      { height: 18 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                    <View style={[
                      styles.audioWave,
                      { height: 8 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                    <View style={[
                      styles.audioWave,
                      { height: 22 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                    <View style={[
                      styles.audioWave,
                      { height: 6 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                    <View style={[
                      styles.audioWave,
                      { height: 20 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                    <View style={[
                      styles.audioWave,
                      { height: 10 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                    <View style={[
                      styles.audioWave,
                      { height: 16 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                    <View style={[
                      styles.audioWave,
                      { height: 4 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                    <View style={[
                      styles.audioWave,
                      { height: 14 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                    <View style={[
                      styles.audioWave,
                      { height: 8 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                    <View style={[
                      styles.audioWave,
                      { height: 20 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                    <View style={[
                      styles.audioWave,
                      { height: 6 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                    <View style={[
                      styles.audioWave,
                      { height: 18 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                    <View style={[
                      styles.audioWave,
                      { height: 4 },
                      !isCurrentUser && styles.audioWaveLeft
                    ]} />
                  </View>
                </View>
                <View style={styles.audioDurationContainer}>
                  <Text style={[
                    styles.audioDurationText,
                    !isCurrentUser && styles.audioDurationTextLeft
                  ]}>{item.duration || '0:00'}</Text>
                </View>
              </View>
            ) : item.type === 'file' && item.fileUrl ? (
              <View style={styles.messageFileContainer}>
                <View style={styles.fileIconContainer}>
                  <FileText size={28} color="#fff" />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>{item.fileName || item.content}</Text>
                  {item.fileSize && <Text style={styles.fileSize}>{item.fileSize}</Text>}
                </View>
                <TouchableOpacity
                  onPress={() => {
                    if (isSelectionMode) {
                      handleMessagePress(item);
                      return;
                    }
                    handleOpenDocument(item.fileUrl!, item.fileName);
                  }}
                  style={styles.fileActionButton}
                >
                  <Download size={20} color="#fff" strokeWidth={2} />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.messageText}>{item.content}</Text>
            )}
            {(item.type === 'image' || item.type === 'video') ? (
              <View style={styles.mediaFooter}>
                <View style={styles.messageFooterRow}>
                  <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
                  {isCurrentUser && getStatusIcon(item)}
                </View>
              </View>
            ) : (
              <View style={styles.messageFooterRow}>
                <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
                {isCurrentUser && getStatusIcon(item)}
              </View>
            )}
          </Pressable>
        </View>
        {isCurrentUser && (
          <Image
            source={getAvatarImageSource(getImageUrl(avatar))}
            style={styles.messageAvatar}
          />
        )}
      </View>
    );
  };

  // Render media modal for viewing images/videos
  const renderMediaModal = () => (
    <Modal
      visible={showMediaModal}
      transparent
      animationType="fade"
      onRequestClose={() => {
        setShowMediaModal(false);
        setSelectedMedia(null);
      }}
    >
      <Pressable
        style={styles.mediaModalOverlay}
        onPress={() => {
          setShowMediaModal(false);
          setSelectedMedia(null);
        }}
      >
        <Pressable style={styles.mediaModalContent} onPress={(e) => e.stopPropagation()}>
          {selectedMedia?.type === 'image' && selectedMedia.fileUrl && (
            <Image
              source={{ uri: getImageUrl(selectedMedia.fileUrl) || selectedMedia.fileUrl }}
              style={styles.mediaModalImage}
              resizeMode="contain"
            />
          )}
          {selectedMedia?.type === 'video' && selectedMedia.fileUrl && (
            <DirectVideoPlayer videoUri={getImageUrl(selectedMedia.fileUrl) || selectedMedia.fileUrl} />
          )}
          <TouchableOpacity
            style={styles.mediaModalClose}
            onPress={() => {
              setShowMediaModal(false);
              setSelectedMedia(null);
            }}
          >
            <X size={22} color="#fff" />
          </TouchableOpacity>

          {selectedMedia && currentUserId && (
            <View style={styles.mediaModalActions}>
              <TouchableOpacity
                style={styles.mediaModalDeleteButton}
                onPress={() => {
                  const idToDelete = selectedMedia.id;
                  const isMine = selectedMedia.senderId === currentUserId;
                  Alert.alert('Delete', 'Choose an option', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete for me',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await api.delete('/direct/messages', {
                            data: { userId: currentUserId, messageIds: [idToDelete], scope: 'me' },
                          });
                          // Local state will update via socket event; also remove optimistically
                          setMessages((prev) => prev.filter((m) => m.id !== idToDelete));
                        } catch (e: any) {
                          console.error('Error deleting message:', e);
                          Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to delete message');
                        } finally {
                          setShowMediaModal(false);
                          setSelectedMedia(null);
                        }
                      },
                    },
                    ...(isMine
                      ? [{
                          text: 'Delete for everyone',
                          style: 'destructive' as const,
                          onPress: async () => {
                            try {
                              await api.delete('/direct/messages', {
                                data: { userId: currentUserId, messageIds: [idToDelete], scope: 'everyone' },
                              });
                              setMessages((prev) => prev.filter((m) => m.id !== idToDelete));
                            } catch (e: any) {
                              console.error('Error deleting message:', e);
                              Alert.alert('Error', e.response?.data?.message || e.message || 'Failed to delete message');
                            } finally {
                              setShowMediaModal(false);
                              setSelectedMedia(null);
                            }
                          },
                        }]
                      : []),
                  ]);
                }}
              >
                <Trash2 size={18} color="#fff" />
                <Text style={styles.mediaModalDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
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
              handleClearChatForMe();
            }}
          >
            <Trash2 size={18} color="#EF4444" />
            <Text style={[styles.moreMenuText, { color: '#EF4444' }]}>Clear chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.moreMenuItem}
            onPress={() => {
              handleExportChat();
            }}
          >
            <Text style={styles.moreMenuText}>Export chat (JSON)</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );

  // Render attachment menu
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
              <Video size={24} color="#60a5fa" />
            </View>
            <Text style={styles.attachmentText}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachmentOption} onPress={handleSendDocument}>
            <View style={[styles.attachmentIcon, { backgroundColor: '#06b6d420' }]}>
              <FileText size={24} color="#06b6d4" />
            </View>
            <Text style={styles.attachmentText}>Document</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      </SafeAreaView>
    );
  }

  if (!targetUser) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowLeft width={24} height={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>User not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          {isSelectionMode ? (
            <>
              <TouchableOpacity onPress={handleCancelSelection} style={styles.backButton}>
                <X width={24} height={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerInfo}>
                <Text style={styles.selectionCount}>
                  {selectedMessages.size} selected
                </Text>
              </View>
              {selectedMessages.size > 0 && (
                <TouchableOpacity onPress={handleDeleteSelectedMessages} style={styles.headerActionButton}>
                  <Trash2 width={22} height={22} color="#EF4444" />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <>
              <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <ArrowLeft width={24} height={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.headerInfo}>
                <Image
                  source={getAvatarImageSource(getImageUrl(targetUser.avatar))}
                  style={styles.headerAvatar}
                />
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerTitle}>{targetUser.username}</Text>
                  <Text style={styles.headerSubtitle}>Direct message</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowMoreMenu(true)} style={styles.headerActionButton}>
                <MoreVertical width={22} height={22} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          inverted={false}
          onContentSizeChange={() => {
            if (flatListRef.current && messages.length > 0) {
              flatListRef.current.scrollToEnd({ animated: true });
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No messages yet</Text>
              <Text style={styles.emptySubtext}>Start a conversation with {targetUser.username}</Text>
            </View>
          }
        />

        {/* Recording Banner */}
        {isRecording && (
          <View style={styles.recordingBanner}>
            <View style={styles.recordingIndicator} />
            <Text style={styles.recordingText}>
              Recording... {formatRecordingDuration(recordingDuration)}
            </Text>
            <TouchableOpacity style={styles.stopRecordingButton} onPress={handleStopRecording}>
              <Text style={styles.stopRecordingText}>Stop</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Input Area */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={styles.attachmentButton}
            onPress={() => setShowAttachmentMenu(true)}
          >
            <Paperclip width={24} height={24} color="#a78bfa" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#6B7280"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={styles.voiceButton}
            onPress={isRecording ? handleStopRecording : handleStartRecording}
          >
            <Mic width={20} height={20} color={isRecording ? "#EF4444" : "#a78bfa"} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send width={20} height={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      {renderAttachmentMenu()}
      {renderMediaModal()}
      {renderMoreMenu()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1020',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.3)',
    backgroundColor: '#0B1020',
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
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerActionButton: {
    padding: 8,
    marginLeft: 8,
  },
  selectionCount: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 8,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#6B7280',
    fontSize: 14,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginVertical: 4,
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
    marginHorizontal: 8,
    marginTop: 4,
  },
  messageContentWrapper: {
    flexShrink: 1,
    maxWidth: '100%',
  },
  selectionCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(167, 139, 250, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginHorizontal: 6,
  },
  selectionCheckboxSelected: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageSenderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 4,
    color: '#9CA3AF',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  messageBubbleMedia: {
    paddingHorizontal: 0,
    paddingVertical: 0,
    overflow: 'hidden',
  },
  messageBubbleSelected: {
    borderWidth: 2,
    borderColor: 'rgba(167, 139, 250, 0.9)',
  },
  messageBubbleLeft: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderTopLeftRadius: 4,
  },
  messageBubbleRight: {
    backgroundColor: '#7C3AED',
    borderTopRightRadius: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    marginTop: 4,
  },
  messageFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.3)',
    backgroundColor: '#0B1020',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  attachmentButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  messageImage: {
    borderRadius: 12,
    marginBottom: 4,
  },
  mediaThumbContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    width: '100%',
    aspectRatio: 4 / 3,
  },
  mediaThumbImage: {
    width: '100%',
    height: '100%',
  },
  videoThumbFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoDurationBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  videoDurationText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  mediaFooter: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 6,
    alignItems: 'flex-start',
  },
  moreMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingRight: 12,
  },
  moreMenuContainer: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingVertical: 8,
    width: 220,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.25)',
  },
  moreMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  moreMenuText: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  messageVideoContainer: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  attachmentMenu: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  attachmentOption: {
    alignItems: 'center',
    margin: 10,
    width: 80,
  },
  attachmentIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachmentText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
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
  messageAudioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    minWidth: 200,
    maxWidth: 280,
  },
  messageAudioContainerLeft: {
    // Additional styling for received audio messages if needed
  },
  audioPlayButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  audioPlayButtonLeft: {
    backgroundColor: 'rgba(124, 58, 237, 0.2)',
  },
  audioPlayButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  audioPlayButtonActiveLeft: {
    backgroundColor: 'rgba(124, 58, 237, 0.3)',
  },
  audioWaveformContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    height: 32,
  },
  audioWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 22,
    gap: 2.5,
  },
  audioWave: {
    width: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 1.25,
    minHeight: 4,
  },
  audioWaveLeft: {
    backgroundColor: 'rgba(124, 58, 237, 0.6)',
  },
  audioDurationContainer: {
    minWidth: 45,
    alignItems: 'center',
    justifyContent: 'center',
    height: 32,
  },
  audioDurationText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12.5,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  audioDurationTextLeft: {
    color: 'rgba(124, 58, 237, 0.9)',
  },
  messageFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingHorizontal: 0,
    minWidth: 200,
    maxWidth: 280,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  fileInfo: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  fileName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  fileSize: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  fileActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  mediaModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaModalContent: {
    width: Math.min(SCREEN_WIDTH * 0.92, 720),
    height: Math.min(SCREEN_HEIGHT * 0.78, 620),
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaModalVideoPlayer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaModalVideoPlayerView: {
    width: '100%',
    height: '100%',
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
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  mediaModalImage: {
    width: '100%',
    height: '100%',
  },
  mediaModalVideoContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaModalText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  mediaModalClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
  },
  mediaModalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PTPMessagingPage;

