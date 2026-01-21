import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  Camera,
  Mic,
  Paperclip,
  MoreVertical,
  Users,
  Image as ImageIcon,
  Play,
  Pause,
  Reply,
  Trash2,
  Crown,
  Shield,
  Clock,
  Check,
  X,
  Video as VideoIcon,
  MessageSquare,
  Settings,
  Bell,
  Share2,
  Wifi,
  AlertTriangle,
} from 'lucide-react';
import { apiRequest, getImageUrl, getStoredUser } from '../utils/api';
import { getAvatarImageSource } from '../utils/avatarUtils';
import { socketService, ConnectionStatus, SocketMessage, TypingUser } from '../utils/socketService';

// Mock ImagePicker for web
const ImagePicker = {
  requestCameraPermissionsAsync: async () => ({ status: 'granted' }),
  requestMediaLibraryPermissionsAsync: async () => ({ status: 'granted' }),
  launchCameraAsync: async (_options: any) => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        resolve({
          canceled: false,
          assets: [{
            uri: URL.createObjectURL(file),
            fileName: file.name,
            width: 800,
            height: 600,
            fileSize: file.size,
          }],
        });
      };
      
      input.click();
    });
  },
  launchImageLibraryAsync: async (options: any) => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options.mediaTypes === ImagePicker.MediaTypeOptions.Videos 
        ? 'video/*' 
        : 'image/*';
      input.multiple = options.allowsMultipleSelection || false;
      
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        
        if (options.mediaTypes === ImagePicker.MediaTypeOptions.Videos) {
          const video = document.createElement('video');
          video.preload = 'metadata';
          
          video.onloadedmetadata = () => {
            resolve({
              canceled: false,
              assets: [{
                uri: URL.createObjectURL(file),
                fileName: file.name,
                duration: video.duration * 1000,
                width: video.videoWidth,
                height: video.videoHeight,
                fileSize: file.size,
              }],
            });
          };
          
          video.src = URL.createObjectURL(file);
        } else {
          resolve({
            canceled: false,
            assets: [{
              uri: URL.createObjectURL(file),
              fileName: file.name,
              width: 800,
              height: 600,
              fileSize: file.size,
            }],
          });
        }
      };
      
      input.click();
    });
  },
  MediaTypeOptions: {
    Images: 'Images',
    Videos: 'Videos',
    All: 'All',
  },
};

// Lightweight video player wrapper for web
const CommunityVideoPlayer: React.FC<{ videoUri: string }> = ({ videoUri }) => {
  return (
    <div className="w-full h-full bg-black rounded-xl overflow-hidden">
      <video
        controls
        className="w-full h-full object-contain"
        src={videoUri}
      />
    </div>
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
  categories?: string[];
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Pro';
  image: string;
  color: string;
  icon?: React.ComponentType<any>;
  isMember?: boolean;
}

interface Message {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image' | 'video' | 'audio';
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
  
  // Debug: Log community data changes
  useEffect(() => {
    console.log('[JoinCommunityPage] communityData updated:', communityData);
  }, [communityData]);

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
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  
  // Chunked streaming state
  const receivingChunks = useRef<Map<string, { chunks: string[]; totalChunks: number; receivedChunks: number; fileName: string; fileType: string }>>(new Map());
  // Chunked streaming constants (for future use)
  // const CHUNK_SIZE = 64 * 1024; // 64KB chunks

  // Load current user from localStorage
  useEffect(() => {
    const loadCurrentUser = () => {
      try {
        const user = getStoredUser();
        if (user) {
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

    // Set up socket event handlers FIRST (before connecting)
    socketService.setEventHandlers({
      onConnect: () => {
        console.log('[JoinCommunityPage] Socket connected');
        setSocketConnected(true);
        setConnectionStatus('connected');
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
        console.log('[Socket] 📦 Chunked media start received:', data);
        receivingChunks.current.set(data.messageId, {
          chunks: new Array(data.totalChunks),
          totalChunks: data.totalChunks,
          receivedChunks: 0,
          fileName: data.fileName,
          fileType: data.fileType,
        });
        setMessages(prev =>
          prev.map(msg => {
            if (msg.id === data.messageId || msg.fileName === data.fileName) {
              return { ...msg, status: 'sending' as const };
            }
            return msg;
          })
        );
      },

      onChunkedMediaChunk: async (data) => {
        let chunkData = receivingChunks.current.get(data.messageId);
        if (!chunkData) {
          chunkData = {
            chunks: [],
            totalChunks: 0,
            receivedChunks: 0,
            fileName: `file_${data.messageId}`,
            fileType: 'image',
          };
          receivingChunks.current.set(data.messageId, chunkData);
        }

        if (!chunkData.chunks || chunkData.chunks.length === 0) {
          chunkData.chunks = new Array(chunkData.totalChunks || 1000);
        }

        chunkData.chunks[data.chunkIndex] = data.chunk;
        chunkData.receivedChunks++;

        const progress = chunkData.totalChunks > 0 
          ? ((chunkData.receivedChunks / chunkData.totalChunks) * 100).toFixed(1)
          : '0';
        console.log(`[Socket] 📦 Chunk ${data.chunkIndex + 1}/${chunkData.totalChunks} received (${progress}%)`);

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

        if (data.isLastChunk && chunkData.receivedChunks === chunkData.totalChunks) {
          try {
            const validChunks = chunkData.chunks.filter(chunk => chunk !== undefined && chunk !== null);
            const base64Data = validChunks.join('');
            const blob = await fetch(`data:${chunkData.fileType === 'image' ? 'image/jpeg' : 'video/mp4'};base64,${base64Data}`).then(r => r.blob());
            const fileUrl = URL.createObjectURL(blob);

            setMessages(prev =>
              prev.map(msg => {
                if (msg.id === data.messageId || msg.fileName === chunkData.fileName) {
                  return {
                    ...msg,
                    fileUrl: fileUrl,
                    fileName: chunkData.fileName,
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
        console.log('[Socket] 📨 New message received:', socketMessage.username);
        const newMsg: Message = {
          id: socketMessage.id || socketMessage._id || '',
          userId: socketMessage.userId,
          username: socketMessage.username,
          avatar: socketMessage.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
          content: socketMessage.content,
          timestamp: socketMessage.timestamp,
          type: socketMessage.type === 'file' ? 'text' : socketMessage.type as 'text' | 'image' | 'video' | 'audio',
          fileUrl: socketMessage.fileUrl,
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
          const existingIndex = prev.findIndex(m => {
            const msgId = m.id?.toString();
            const newMsgId = newMsg.id?.toString();
            const socketId = socketMessage._id?.toString();
            return msgId === newMsgId || msgId === socketId || (msgId && newMsgId && msgId === newMsgId);
          });
          
          if (existingIndex !== -1) {
            const updated = [...prev];
            updated[existingIndex] = { 
              ...updated[existingIndex], 
              ...newMsg,
              status: newMsg.status || updated[existingIndex].status,
              fileUrl: newMsg.fileUrl || updated[existingIndex].fileUrl,
            };
            return updated;
          }
          
          return [...prev, newMsg];
        });

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },

      onUserJoined: (data) => {
        setOnlineUserIds(prev => {
          const newSet = new Set(prev);
          newSet.add(data.userId);
          return newSet;
        });
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
        setMembers(prev => prev.map(m => 
          m.userId === data.userId ? { ...m, status: 'offline' as const } : m
        ));
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });
      },

      onOnlineUsers: (data) => {
        console.log('[Socket] 👥 Online users update:', data.users);
        setOnlineUserIds(new Set(data.users));
        setMembers(prev => prev.map(m => {
          const userId = m.userId || m.id;
          const isOnline = data.users.includes(userId);
          return {
            ...m,
            status: isOnline ? 'online' as const : 'offline' as const,
          };
        }));
        setCommunityData(prev => ({
          ...prev,
          activeMembers: data.users.length,
        }));
      },

      onUserTyping: (data: TypingUser) => {
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
        if (data?.scope === 'me' && data?.userId && currentUserId && data.userId !== currentUserId) return;

        if (data?.cleared) {
          setMessages([]);
          return;
        }

        if (Array.isArray(data?.messageIds)) {
          if (data.messageIds.length === 0 && data?.scope === 'me') {
            setMessages([]);
            return;
          }
          const ids = new Set(data.messageIds.map(String));
          setMessages(prev => prev.filter(m => !ids.has(String(m.id))));
          return;
        }

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
        console.log('[Socket] 📬 Read receipt received:', data);
        if (data.statusUpdates && Array.isArray(data.statusUpdates)) {
          setMessages(prev => prev.map(msg => {
            const update = data.statusUpdates.find((u: any) => u.messageId === msg.id);
            if (update) {
              return {
                ...msg,
                status: update.status,
                readBy: update.readBy,
                readCount: update.readCount,
                totalRecipients: update.totalRecipients,
              };
            }
            return msg;
          }));
        }
      },

      onMessageStatusUpdate: (data: any) => {
        console.log('[Socket] 📊 Status update received:', data);
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.messageId) {
            return {
              ...msg,
              status: data.status,
              readBy: data.readBy,
              readCount: data.readCount,
              totalRecipients: data.totalRecipients,
            };
          }
          return msg;
        }));
      },

      onError: (error) => {
        const errorMessage = error?.message || (error as any)?.message || 'An error occurred';
        if (errorMessage.includes('Inappropriate message') || errorMessage === 'Inappropriate message') {
          // Show popup for inappropriate message (not an error)
          alert('Your message contains inappropriate content and cannot be sent.');
          setSendingMessage(false);
          return;
        }
        // Only log actual errors (not inappropriate messages)
        console.error('[JoinCommunityPage] Socket error:', error);
      },
    });

    // Initialize socket connection AFTER handlers are set
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
    if (!isConnectedNow) {
      let attempts = 0;
      const maxAttempts = 10;
      const checkInterval = setInterval(() => {
        attempts++;
        const connected = checkConnection();
        if (connected || attempts >= maxAttempts) {
          clearInterval(checkInterval);
        }
      }, 500);
      
      // Store interval reference for cleanup
      const intervalRef = checkInterval;
      
      // Cleanup on unmount
      return () => {
        clearInterval(intervalRef);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        socketService.stopTyping(communityData.id);
        socketService.leaveCommunity(communityData.id);
        socketService.clearEventHandlers();
      };
    } else {
      // Cleanup on unmount (if already connected, no interval to clean)
      return () => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        socketService.stopTyping(communityData.id);
        socketService.leaveCommunity(communityData.id);
        socketService.clearEventHandlers();
      };
    }
  }, [currentUser, communityData.id]);

  // Update community data when prop changes
  useEffect(() => {
    console.log('[JoinCommunityPage] Community prop changed:', community);
    if (community && community.id) {
      setCommunityData(community);
    }
  }, [community]);

  // Load messages and members on mount
  useEffect(() => {
    console.log('[JoinCommunityPage] communityData.id:', communityData.id, 'currentUser:', currentUser);
    if (communityData.id) {
      console.log('[JoinCommunityPage] Calling fetchMessages and fetchMembers');
      fetchMessages();
      fetchMembers();
    } else {
      console.warn('[JoinCommunityPage] No communityData.id, skipping fetch');
    }
  }, [communityData.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Recording timer
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

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string): string => {
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

  const formatMessageTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const shouldShowDateSeparator = (currentMessage: Message, previousMessage: Message | null): boolean => {
    if (!previousMessage) return true;
    const currentDate = new Date(currentMessage.timestamp).toDateString();
    const previousDate = new Date(previousMessage.timestamp).toDateString();
    return currentDate !== previousDate;
  };

  const handleTextChange = useCallback((text: string) => {
    setNewMessage(text);
    
    if (!communityData.id) return;

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
      console.log('[JoinCommunityPage] Fetching messages for community:', communityData.id, 'userId:', currentUserId);
      const response = await apiRequest<{ messages: any[] }>(`/community/${communityData.id}/messages${currentUserId ? `?userId=${currentUserId}` : ''}`);
      console.log('[JoinCommunityPage] Messages response:', response);
      if (response.success && response.data && response.data.messages) {
        console.log('[JoinCommunityPage] Processing', response.data.messages.length, 'messages');
        const fetchedMessages = response.data.messages.map((msg: any) => ({
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
        console.log('[JoinCommunityPage] Setting', fetchedMessages.length, 'messages');
        setMessages(fetchedMessages);
      } else {
        console.warn('[JoinCommunityPage] Invalid response structure:', response);
        setMessages([]);
      }
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      // If endpoint doesn't exist yet, just set empty array
      if (error.response?.status !== 404) {
        alert('Failed to load messages. Please try again.');
      }
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Fetch members from API
  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      console.log('[JoinCommunityPage] Fetching members for community:', communityData.id);
      const response = await apiRequest<{ members: any[] }>(`/community/${communityData.id}/members`);
      console.log('[JoinCommunityPage] Members response:', response);
      if (response.success && response.data && response.data.members) {
        console.log('[JoinCommunityPage] Processing', response.data.members.length, 'members');
        const fetchedMembers = response.data.members.map((member: any) => ({
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
        console.log('[JoinCommunityPage] Setting', fetchedMembers.length, 'members');
      } else {
        console.warn('[JoinCommunityPage] Invalid members response structure:', response);
        setMembers([]);
      }
    } catch (error: any) {
      console.error('Error fetching members:', error);
      // If endpoint doesn't exist yet, just set empty array
      if (error.response?.status !== 404) {
        alert('Failed to load members. Please try again.');
      }
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !replyingTo) return;
    if (!currentUser) {
      alert('User not found. Please login again.');
      return;
    }

    const messageContent = newMessage.trim();
    const userId = currentUser.id || currentUser._id;

    setNewMessage('');
    setReplyingTo(null);
    setSendingMessage(true);

    if (socketConnected && socketService.isConnected()) {
      try {
        socketService.sendMessage({
          communityId: communityData.id,
          content: messageContent,
          type: 'text',
          replyTo: replyingTo?.id,
        });
        // Set up a timeout to handle errors that come via socket error event
        // If error occurs, it will be handled by onError handler
        setSendingMessage(false);
        // Message will be broadcast back via 'new_message' socket event
        return;
      } catch (error: any) {
        const errorMessage = error?.message || 'Failed to send message';
        if (errorMessage.includes('Inappropriate message') || errorMessage === 'Inappropriate message') {
          // Show popup for inappropriate message (not an error)
          alert('Your message contains inappropriate content and cannot be sent.');
          setSendingMessage(false);
          return;
        }
        // Only log actual errors (not inappropriate messages)
        console.warn('[Socket] Failed to send via socket, falling back to REST API:', error);
        // Fall through to REST API
      }
    } else {
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
              content: replyingTo.content?.substring(0, 50),
              type: replyingTo.type,
            }
          : undefined,
      };

      setMessages(prev => [...prev, tempMessage]);

      try {
        const response = await apiRequest<{ message: any }>(`/community/${communityData.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({
            userId: userId,
            content: messageContent,
            type: 'text',
            replyTo: replyingTo?.id,
          }),
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.success && response.data) {
          const newMsg = response.data.message;
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
                    type: (newMsg.type || 'text') as 'text' | 'image' | 'video' | 'audio',
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
        }
      } catch (error: any) {
        setMessages(prev => prev.filter(msg => msg.id !== tempId));
        const errorMessage = error?.response?.data?.message || error?.message || 'Failed to send message. Please try again.';
        if (errorMessage.includes('Inappropriate message') || errorMessage === 'Inappropriate message') {
          // Show popup for inappropriate message (not an error)
          alert('Your message contains inappropriate content and cannot be sent.');
        } else {
          // Only log actual errors
          console.error('Error sending message:', error);
          alert(errorMessage);
        }
      } finally {
        setSendingMessage(false);
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatVideoDuration = (durationMsOrSec?: number | null): string => {
    if (!durationMsOrSec || durationMsOrSec <= 0) return '0:00';
    const secondsTotal = Math.round(durationMsOrSec > 1000 ? durationMsOrSec / 1000 : durationMsOrSec);
    const hours = Math.floor(secondsTotal / 3600);
    const minutes = Math.floor((secondsTotal % 3600) / 60);
    const seconds = secondsTotal % 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSendImageFromAsset = async (asset: any, mediaType: 'image' | 'video') => {
    if (!currentUser) {
      alert('User not found. Please login again.');
      return;
    }

    const fileSize = asset.fileSize || 0;
    const tempId = Date.now().toString();
    
    const tempMessage: Message = {
      id: tempId,
      userId: currentUser.id || currentUser._id,
      username: currentUser.username || 'You',
      avatar: currentUser.picture || currentUser.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
      content: mediaType === 'image' ? 'Photo' : 'Video',
      timestamp: new Date().toISOString(),
      type: mediaType,
      fileUrl: asset.uri,
      fileName: asset.fileName || (mediaType === 'image' ? 'photo.jpg' : 'video.mp4'),
      fileSize: formatFileSize(fileSize),
      duration: mediaType === 'video' && asset.duration ? formatVideoDuration(asset.duration) : undefined,
      status: 'sending',
    };
    setMessages(prev => [...prev, tempMessage]);
    
    try {
      if (socketConnected && socketService.isConnected()) {
        // First create message placeholder via socket (matching mobile flow)
        socketService.sendMessage({
          communityId: communityData.id,
          content: mediaType === 'image' ? 'Photo' : 'Video',
          type: mediaType,
          fileName: asset.fileName || (mediaType === 'image' ? 'photo.jpg' : 'video.mp4'),
          fileSize: formatFileSize(fileSize),
          duration: mediaType === 'video' && asset.duration ? formatVideoDuration(asset.duration) : undefined,
          replyTo: replyingTo?.id,
        });
        
        // Wait for message_sent confirmation to get message ID (matching mobile flow)
        const messageIdPromise = new Promise<string>((resolve) => {
          // The message will come back via onNewMessage socket event
          // We'll use the tempId for now and reconcile when we get the actual ID
          setTimeout(() => {
            resolve(tempId); // Fallback to tempId after 2 seconds
          }, 2000);
        });
        
        const messageId = await messageIdPromise;
        
        // Upload file via REST API (web uses FormData instead of chunked streaming)
        const formData = new FormData();
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        // Backend expects 'image' or 'video' field name based on mediaType
        formData.append(mediaType, blob, asset.fileName || (mediaType === 'image' ? 'photo.jpg' : 'video.mp4'));
        formData.append('userId', currentUser.id || currentUser._id);
        formData.append('type', mediaType);
        if (mediaType === 'video' && asset.duration) {
          formData.append('duration', formatVideoDuration(asset.duration));
        }
        if (replyingTo?.id) {
          formData.append('replyTo', replyingTo.id);
        }

        const uploadResponse = await apiRequest<{ message: any }>(`/community/${communityData.id}/messages`, {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.success && uploadResponse.data) {
          const newMsg = uploadResponse.data.message;
          const actualMessageId = newMsg._id || newMsg.id;
          // Reconcile temp message ID with actual message ID from server
          if (actualMessageId && actualMessageId !== messageId) {
            reconcileTempMessageId(messageId, actualMessageId);
          }
          setMessages(prev =>
            prev.map(msg =>
              msg.id === (actualMessageId || messageId)
                ? {
                    id: actualMessageId || messageId,
                    userId: newMsg.userId,
                    username: currentUser.username || 'You',
                    avatar: currentUser.picture || currentUser.avatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
                    content: newMsg.content,
                    timestamp: newMsg.createdAt || newMsg.timestamp,
                    type: newMsg.type as 'text' | 'image' | 'video' | 'audio',
                    fileUrl: getImageUrl(newMsg.fileUrl) || newMsg.fileUrl,
                    fileName: newMsg.fileName,
                    fileSize: newMsg.fileSize,
                    duration: newMsg.duration,
                    status: 'sent',
                  }
                : msg
            )
          );
        }
        
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
      alert(error.message || 'Failed to send image. Please try again.');
    }
  };

  const handleTakePhoto = async () => {
    setShowAttachmentMenu(false);
    if (!currentUser) {
      alert('User not found. Please login again.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!(result as any).canceled && (result as any).assets && (result as any).assets.length > 0) {
        const asset = (result as any).assets[0];
        await handleSendImageFromAsset(asset, 'image');
      }
    } catch (error) {
      alert('Failed to take photo. Please try again.');
      console.error('Camera error:', error);
    }
  };

  const handleSendImage = async () => {
    setShowAttachmentMenu(false);
    if (!currentUser) {
      alert('User not found. Please login again.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!(result as any).canceled && (result as any).assets && (result as any).assets.length > 0) {
        const asset = (result as any).assets[0];
        await handleSendImageFromAsset(asset, 'image');
      }
    } catch (error) {
      alert('Failed to pick image. Please try again.');
      console.error('Image picker error:', error);
    }
  };


  const handleSendVideo = async () => {
    setShowAttachmentMenu(false);
    if (!currentUser) {
      alert('User not found. Please login again.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
        videoMaxDuration: 300,
      });

      if (!(result as any).canceled && (result as any).assets && (result as any).assets.length > 0) {
        const asset = (result as any).assets[0];
        await handleSendImageFromAsset(asset, 'video');
      }
    } catch (error) {
      alert('Failed to pick video. Please try again.');
      console.error('Video picker error:', error);
    }
  };

  const handleStartRecording = () => {
    setIsRecording(true);
    setShowAttachmentMenu(false);
    alert('Audio recording requires device access and Web Audio API');
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
      
      setTimeout(() => {
        setMessages(prev =>
          prev.map(msg => (msg.id === tempId ? { ...msg, status: 'read' } : msg))
        );
      }, 1000);
    }
  };

  const handlePlayAudio = (messageId: string) => {
    setPlayingAudio(playingAudio === messageId ? null : messageId);
  };

  const handleMoreMenu = () => {
    setShowMoreMenu(true);
  };

  const deleteCommunityMessages = async (messageIds: string[], scope: 'me' | 'everyone') => {
    const currentUserId = currentUser?.id || currentUser?._id;
    if (!currentUserId) {
      alert('User not found. Please login again.');
      return false;
    }
    const resp = await apiRequest(`/community/${communityData.id}/messages`, {
      method: 'DELETE',
      body: JSON.stringify({ userId: currentUserId, messageIds, scope }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!resp.success) {
      throw new Error((resp as any).message || 'Failed to delete messages');
    }
    return true;
  };

  const handleClearChat = async () => {
    const currentUserId = currentUser?.id || currentUser?._id;
    if (!currentUserId) {
      alert('User not found. Please login again.');
      return;
    }

    const clearForMe = async () => {
      await deleteCommunityMessages([], 'me');
      setMessages([]);
      setIsSelectionMode(false);
      setSelectedMessages(new Set());
    };

    const clearForEveryone = async () => {
      await deleteCommunityMessages([], 'everyone');
      setMessages([]);
      setIsSelectionMode(false);
      setSelectedMessages(new Set());
    };

    const canClearEveryone = isCommunityOwner();

    if (window.confirm('Clear all messages? This action cannot be undone.')) {
      if (canClearEveryone && window.confirm('Clear for everyone? (Cancel for "Clear for me only")')) {
        try {
          await clearForEveryone();
        } catch (error: any) {
          console.error('Error clearing chat:', error);
          alert(error.message || 'Failed to clear chat. Please try again.');
        }
      } else {
        try {
          await clearForMe();
        } catch (error: any) {
          console.error('Error clearing chat:', error);
          alert(error.message || 'Failed to clear chat. Please try again.');
        }
      }
    }
  };

  const handleExportChat = async () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        community: {
          id: communityData.id,
          name: communityData.name,
        },
        currentUser: currentUser ? { id: currentUser.id, username: currentUser.username } : null,
        messages,
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `community-chat-${communityData.id}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting chat:', error);
      alert('Failed to export chat');
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
    setReplyingTo(null);
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

  const isCommunityOwner = () => {
    const currentUserId = currentUser?.id || currentUser?._id;
    if (!currentUserId) return false;
    const me = members.find(m => (m.userId || m.id) === currentUserId);
    return me?.role === 'owner';
  };

  const handleDeleteSingleMessage = async (messageId: string) => {
    try {
      const currentUserId = currentUser?.id || currentUser?._id;
      if (!currentUserId) {
        alert('User not found. Please login again.');
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

      if (window.confirm('Delete this message?')) {
        if (canDeleteForEveryone && window.confirm('Delete for everyone? (Cancel for "Delete for me only")')) {
          try {
            await doDelete('everyone');
          } catch (error: any) {
            console.error('Error deleting message:', error);
            alert(error.message || 'Failed to delete. Please try again.');
          }
        } else {
          try {
            await doDelete('me');
          } catch (error: any) {
            console.error('Error deleting message:', error);
            alert(error.message || 'Failed to delete. Please try again.');
          }
        }
      }
    } catch (error: any) {
      console.error('Error deleting message:', error);
      alert(error.message || 'Failed to delete. Please try again.');
    }
  };

  const handleDeleteSelectedMessages = async () => {
    if (selectedMessages.size === 0) return;
    const messageIds = Array.from(selectedMessages);
    const currentUserId = currentUser?.id || currentUser?._id;
    if (!currentUserId) {
      alert('User not found. Please login again.');
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

    if (window.confirm(`Delete ${messageIds.length} message${messageIds.length > 1 ? 's' : ''}?`)) {
      if (canDeleteForEveryone && window.confirm('Delete for everyone? (Cancel for "Delete for me only")')) {
        try {
          await deleteForEveryone();
        } catch (error: any) {
          console.error('Error deleting messages:', error);
          alert(error.message || 'Failed to delete messages. Please try again.');
        }
      } else {
        try {
          await deleteForMe();
        } catch (error: any) {
          console.error('Error deleting messages:', error);
          alert(error.message || 'Failed to delete messages. Please try again.');
        }
      }
    }
  };

  const handleCancelSelection = () => {
    setSelectedMessages(new Set());
    setIsSelectionMode(false);
  };

  const reconcileTempMessageId = (tempId: string, messageId: string) => {
    if (!messageId || tempId === messageId) return;

    setMessages(prev => {
      const tempIndex = prev.findIndex(m => m.id === tempId);
      if (tempIndex === -1) return prev;

      const existingIndex = prev.findIndex(m => m.id === messageId);

      if (existingIndex !== -1 && existingIndex !== tempIndex) {
        const tempMsg = prev[tempIndex];
        const existingMsg = prev[existingIndex];

        const merged: Message = {
          ...existingMsg,
          ...tempMsg,
          id: messageId,
          fileUrl: existingMsg.fileUrl || tempMsg.fileUrl,
          fileName: existingMsg.fileName || tempMsg.fileName,
          fileSize: existingMsg.fileSize || tempMsg.fileSize,
          duration: existingMsg.duration || tempMsg.duration,
          status: existingMsg.status || tempMsg.status,
        };

        const withoutTemp = prev.filter((_, idx) => idx !== tempIndex);
        const idxInWithout = withoutTemp.findIndex(m => m.id === messageId);
        if (idxInWithout === -1) {
          return [...withoutTemp, merged];
        }

        const next = [...withoutTemp];
        next[idxInWithout] = merged;
        return next;
      }

      return prev.map(m => (m.id === tempId ? { ...m, id: messageId } : m));
    });
  };

  const getStatusIcon = (message: Message) => {
    if (message.status === 'sending') {
      return <Clock size={12} color="#a78bfa80" />;
    }

    const isCurrentUser = currentUser && (message.userId === (currentUser.id || currentUser._id));
    
    if (!isCurrentUser) {
      return null;
    }

    const totalRecipients = message.totalRecipients ?? (members.length - 1);
    const readCount = message.readCount ?? (message.readBy?.length || 0);
    
    if (message.status === 'sent' || (readCount === 0 && totalRecipients > 0)) {
      return <Check size={12} color="#a78bfa80" />;
    }
    
    if (message.status === 'delivered' || (readCount > 0 && readCount < totalRecipients)) {
      return (
        <div style={{ display: 'flex', marginLeft: -2 }}>
          <Check size={12} color="#a78bfa80" style={{ marginRight: -4 }} />
          <Check size={12} color="#a78bfa80" />
        </div>
      );
    }
    
    if (message.status === 'read' || (readCount >= totalRecipients && totalRecipients > 0)) {
      return (
        <div style={{ display: 'flex', marginLeft: -2 }}>
          <Check size={12} color="#06b6d4" style={{ marginRight: -4 }} />
          <Check size={12} color="#06b6d4" />
        </div>
      );
    }

    return <Check size={12} color="#a78bfa80" />;
  };

  const renderDateSeparator = (date: string) => (
    <div className="date-separator">
      <div className="date-separator-line" />
      <span className="date-separator-text">{formatDate(date)}</span>
      <div className="date-separator-line" />
    </div>
  );

  const getUsernameColor = (username: string) => {
    const colors = [
      '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399',
      '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#c084fc'
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
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

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isCurrentUser = currentUser && (item.userId === (currentUser.id || currentUser._id));
    const previousMessage = index > 0 ? messages[index - 1] : null;
    const showDateSeparator = shouldShowDateSeparator(item, previousMessage);
    
    const isFirstMessageFromUser = !previousMessage || 
      previousMessage.userId !== item.userId || 
      showDateSeparator;
    
    const showUserInfo = !isCurrentUser && isFirstMessageFromUser;

    const onContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      if (!isSelectionMode) {
        handleMessageLongPress(item.id);
      }
    };

    return (
      <div key={item.id}>
        {showDateSeparator && renderDateSeparator(item.timestamp)}
        <div className={`message-wrapper ${isCurrentUser ? 'message-wrapper-right' : 'message-wrapper-left'}`}>
          {!isCurrentUser && showUserInfo && (
            <div 
              className="message-avatar-container"
              onClick={() => onViewProfile?.(item.userId)}
            >
              <img 
                src={getAvatarImageSource(getImageUrl(item.avatar))?.uri || getImageUrl(item.avatar) || item.avatar} 
                className="message-avatar"
                alt={item.username}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50';
                }}
              />
            </div>
          )}
          {!isCurrentUser && !showUserInfo && <div className="message-avatar-placeholder" />}
          
          {isSelectionMode && (
            <div
              className="selection-checkbox"
              onClick={() => handleMessagePress(item.id)}
            >
              {selectedMessages.has(item.id) && (
                <div className="selection-checkbox-selected">
                  <Check size={16} color="#ffffff" />
                </div>
              )}
            </div>
          )}
          
          <div className="message-content-wrapper">
            {showUserInfo && (
              <div 
                className="message-sender-name"
                style={{ color: getUsernameColor(item.username) }}
                onClick={() => onViewProfile?.(item.userId)}
              >
                {item.username}
              </div>
            )}
            
            <div
              className={`message-bubble ${
                isCurrentUser ? 'message-bubble-sent' : 'message-bubble-received'
              } ${isSelectionMode && selectedMessages.has(item.id) ? 'message-bubble-selected' : ''} ${
                !isCurrentUser && showUserInfo ? 'message-bubble-with-username' : ''
              }`}
              onContextMenu={onContextMenu}
              onClick={() => {
                if (isSelectionMode) {
                  handleMessagePress(item.id);
                }
              }}
            >
              {item.replyTo && (
                <div className="reply-container">
                  <div className="reply-indicator" />
                  <div className="reply-content">
                    <div className="reply-username">{item.replyTo.username}</div>
                    <div className="reply-text">
                      {item.replyTo.type === 'text'
                        ? item.replyTo.content
                        : `${item.replyTo.type.charAt(0).toUpperCase() + item.replyTo.type.slice(1)} message`}
                    </div>
                  </div>
                </div>
              )}

              {item.type === 'text' && (
                <div className={`message-text ${isCurrentUser ? 'message-text-sent' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {item.hasWarning && (
                    <span title="This message contains mild inappropriate content" style={{ flexShrink: 0, display: 'inline-flex' }}>
                      <AlertTriangle size={16} color="#f59e0b" />
                    </span>
                  )}
                  <span>{item.content}</span>
                </div>
              )}

              {item.type === 'image' && (
                <div
                  className="message-image-container"
                  onClick={() => {
                    if (!isSelectionMode) {
                      setSelectedMedia(item);
                      setShowMediaModal(true);
                    }
                  }}
                >
                  <img src={getImageUrl(item.fileUrl || item.content) || item.fileUrl || item.content} className="message-image" alt="Shared" />
                </div>
              )}

              {item.type === 'video' && (
                <div
                  className="message-video-container"
                  onClick={() => {
                    if (!isSelectionMode) {
                      setSelectedMedia(item);
                      setShowMediaModal(true);
                    }
                  }}
                >
                  <div className="message-video-thumbnail-fallback">
                    <VideoIcon size={42} color="#ffffff" />
                    <div className="message-video-label">Video</div>
                  </div>
                  <div className="message-video-overlay">
                    <Play size={32} color="#ffffff" fill="#ffffff" />
                  </div>
                  {item.duration && (
                    <div className="video-duration">
                      <span className="video-duration-text">{item.duration}</span>
                    </div>
                  )}
                </div>
              )}

              {item.type === 'audio' && (
                <div className="audio-container">
                  <div
                    className="audio-play-button"
                    onClick={() => handlePlayAudio(item.id)}
                  >
                    {playingAudio === item.id ? (
                      <Pause size={20} color="#ffffff" />
                    ) : (
                      <Play size={20} color="#ffffff" />
                    )}
                  </div>
                  <div className="audio-waveform">
                    <div className="audio-wave" style={{ height: 20 }} />
                    <div className="audio-wave" style={{ height: 30 }} />
                    <div className="audio-wave" style={{ height: 25 }} />
                    <div className="audio-wave" style={{ height: 35 }} />
                    <div className="audio-wave" style={{ height: 20 }} />
                    <div className="audio-wave" style={{ height: 28 }} />
                    <div className="audio-wave" style={{ height: 22 }} />
                  </div>
                  <div className="audio-duration">{item.duration || '0:00'}</div>
                </div>
              )}

              <div className="message-footer">
                <span className={`message-time ${isCurrentUser ? 'message-time-sent' : ''}`}>
                  {formatMessageTime(item.timestamp)}
                </span>
                {isCurrentUser && (
                  <div className="message-status">{getStatusIcon(item)}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAttachmentMenu = () => (
    showAttachmentMenu && (
      <div className="modal-overlay" onClick={() => setShowAttachmentMenu(false)}>
        <div className="attachment-menu" onClick={(e) => e.stopPropagation()}>
          <div className="attachment-option" onClick={handleTakePhoto}>
            <div className="attachment-icon" style={{ backgroundColor: '#7c3aed20' }}>
              <Camera size={24} color="#a78bfa" />
            </div>
            <div className="attachment-text">Camera</div>
          </div>
          <div className="attachment-option" onClick={handleSendImage}>
            <div className="attachment-icon" style={{ backgroundColor: '#7c3aed20' }}>
              <ImageIcon size={24} color="#a78bfa" />
            </div>
            <div className="attachment-text">Photo</div>
          </div>
          <div className="attachment-option" onClick={handleSendVideo}>
            <div className="attachment-icon" style={{ backgroundColor: '#2563eb20' }}>
              <VideoIcon size={24} color="#60a5fa" />
            </div>
            <div className="attachment-text">Video</div>
          </div>
          <div className="attachment-option" onClick={handleStartRecording}>
            <div className="attachment-icon" style={{ backgroundColor: '#ef444420' }}>
              <Mic size={24} color="#f87171" />
            </div>
            <div className="attachment-text">Voice Message</div>
          </div>
        </div>
      </div>
    )
  );

  const renderMediaModal = () => (
    showMediaModal && (
      <div className="media-modal-overlay">
        <div className="media-modal-close" onClick={() => setShowMediaModal(false)}>
          <X size={24} color="#ffffff" />
        </div>
        {selectedMedia && (
          <div className="media-modal-content">
            {selectedMedia.type === 'image' && (
              <img
                src={getImageUrl(selectedMedia.fileUrl || selectedMedia.content) || selectedMedia.fileUrl || selectedMedia.content}
                className="media-modal-image"
                alt="Shared media"
              />
            )}
            {selectedMedia.type === 'video' && (
              <CommunityVideoPlayer
                videoUri={getImageUrl(selectedMedia.fileUrl || selectedMedia.content) || selectedMedia.fileUrl || selectedMedia.content}
              />
            )}

            <div className="media-modal-actions">
              {!!(currentUser?.id || currentUser?._id) && (
                <div
                  className="media-modal-delete-button"
                  onClick={() => {
                    const idToDelete = selectedMedia.id;
                    setShowMediaModal(false);
                    setSelectedMedia(null);
                    handleDeleteSingleMessage(idToDelete);
                  }}
                >
                  <Trash2 size={18} color="#ffffff" />
                  <span className="media-modal-delete-text">Delete</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  );

  const renderCommunityInfoModal = () => {
    const mediaMessages = messages.filter(m => m.type === 'image' || m.type === 'video');

    return (
      showCommunityInfo && (
        <div className="community-info-modal">
          <div className="info-header">
            <div className="back-button" onClick={() => setShowCommunityInfo(false)}>
              <ArrowLeft size={24} color="#c4b5fd" />
            </div>
            <div className="info-header-content">
              <img src={getImageUrl(communityData.image) || communityData.image} className="info-community-avatar" alt={communityData.name} />
              <div className="info-community-name">{communityData.name}</div>
              <div className="info-community-sub">
                {loadingMembers ? communityData.members : (members.length || communityData.members)} members • {loadingMembers ? communityData.activeMembers : members.filter(m => m.status === 'online').length} online
              </div>
            </div>
          </div>

          <div className="info-tabs">
            <div
              className={`info-tab-button ${infoTab === 'members' ? 'active-info-tab-button' : ''}`}
              onClick={() => setInfoTab('members')}
            >
              <Users size={20} color={infoTab === 'members' ? '#c4b5fd' : '#a78bfa80'} />
              <div className={`info-tab-text ${infoTab === 'members' ? 'active-info-tab-text' : ''}`}>
                Members ({members.length})
              </div>
            </div>
            <div
              className={`info-tab-button ${infoTab === 'media' ? 'active-info-tab-button' : ''}`}
              onClick={() => setInfoTab('media')}
            >
              <ImageIcon size={20} color={infoTab === 'media' ? '#c4b5fd' : '#a78bfa80'} />
              <div className={`info-tab-text ${infoTab === 'media' ? 'active-info-tab-text' : ''}`}>
                Media ({mediaMessages.length})
              </div>
            </div>
          </div>

          {infoTab === 'members' && (
            <div className="info-content">
              {loadingMembers ? (
                <div className="loading-container">
                  <div className="spinner" />
                  <div className="loading-text">Loading members...</div>
                </div>
              ) : members.length === 0 ? (
                <div className="empty-container">
                  <Users size={48} color="#a78bfa80" />
                  <div className="empty-text">No members found</div>
                </div>
              ) : (
                members.map(member => (
                  <div
                    key={member.id}
                    className="member-item"
                    onClick={() => {
                      if (onViewProfile && member.userId) {
                        onViewProfile(member.userId);
                      }
                    }}
                  >
                    <div className="member-avatar-container">
                      <img 
                        src={getAvatarImageSource(getImageUrl(member.avatar))?.uri || getImageUrl(member.avatar) || member.avatar} 
                        className="member-avatar"
                        alt={member.username}
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50';
                        }}
                      />
                      <div
                        className="member-status"
                        style={{
                          backgroundColor:
                            member.status === 'online'
                              ? '#10b981'
                              : member.status === 'away'
                              ? '#f59e0b'
                              : '#6b7280',
                        }}
                      />
                    </div>
                    <div className="member-info">
                      <div className="member-name-row">
                        <div className="member-name">{member.username}</div>
                        {member.role === 'owner' && <Crown size={16} color="#fbbf24" />}
                        {member.role === 'admin' && <Shield size={16} color="#a78bfa" />}
                      </div>
                      <div className="member-role">
                        {member.role.charAt(0).toUpperCase() + member.role.slice(1)} • {member.status}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {infoTab === 'media' && (
            <div className="info-content media-grid-content">
              {mediaMessages.length === 0 ? (
                <div className="empty-state">
                  <ImageIcon size={48} color="#a78bfa80" />
                  <div className="empty-state-text">No media shared yet</div>
                </div>
              ) : (
                <div className="media-grid">
                  {mediaMessages.map(media => (
                    <div
                      key={media.id}
                      className="media-grid-item"
                      onClick={() => {
                        if (isSelectionMode) {
                          handleMessagePress(media.id);
                          return;
                        }
                        setSelectedMedia(media);
                        setShowMediaModal(true);
                        setShowCommunityInfo(false);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (!isSelectionMode) handleMessageLongPress(media.id);
                      }}
                    >
                      {isSelectionMode && (
                        <div
                          className={`media-grid-selection-overlay ${
                            selectedMessages.has(media.id) ? 'media-grid-selection-overlay-selected' : ''
                          }`}
                        >
                          {selectedMessages.has(media.id) && (
                            <div className="media-grid-check">
                              <Check size={16} color="#ffffff" />
                            </div>
                          )}
                        </div>
                      )}
                      {media.type === 'image' ? (
                        <img
                          src={getImageUrl(media.fileUrl || media.content) || media.fileUrl || media.content}
                          className="media-grid-image"
                          alt="Shared media"
                        />
                      ) : (
                        <div className="media-grid-video">
                          <VideoIcon size={24} color="#ffffff" />
                          {media.duration && (
                            <div className="media-grid-duration">{media.duration}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )
    );
  };

  const renderEmojiPicker = () => (
    showEmojiPicker && (
      <div className="emoji-picker-overlay" onClick={() => setShowEmojiPicker(false)}>
        <div className="emoji-picker-container" onClick={(e) => e.stopPropagation()}>
          <div className="emoji-picker-header">
            <div className="emoji-picker-title">Emoji</div>
            <div className="emoji-picker-close" onClick={() => setShowEmojiPicker(false)}>
              <X size={24} color="#c4b5fd" />
            </div>
          </div>
          <div className="emoji-grid">
            {commonEmojis.map((emoji: string, index: number) => (
              <div
                key={index}
                className="emoji-item"
                onClick={() => handleEmojiSelect(emoji)}
              >
                <span className="emoji-text">{emoji}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  );

  const renderMoreMenu = () => (
    showMoreMenu && (
      <div className="more-menu-overlay" onClick={() => setShowMoreMenu(false)}>
        <div className="more-menu-container" onClick={(e) => e.stopPropagation()}>
          <div
            className="more-menu-item"
            onClick={() => {
              setShowMoreMenu(false);
              handleClearChat();
            }}
          >
            <Trash2 size={20} color="#ef4444" />
            <div className="more-menu-text" style={{ color: '#ef4444', marginLeft: 12 }}>Clear Chat</div>
          </div>
          <div
            className="more-menu-item"
            onClick={() => {
              setShowMoreMenu(false);
              handleExportChat();
            }}
          >
            <Share2 size={20} color="#c4b5fd" />
            <div className="more-menu-text" style={{ marginLeft: 12 }}>Export Chat</div>
          </div>
          <div
            className="more-menu-item"
            onClick={() => {
              setShowMoreMenu(false);
              alert('Notifications muted');
            }}
          >
            <Bell size={20} color="#c4b5fd" />
            <div className="more-menu-text" style={{ marginLeft: 12 }}>Mute Notifications</div>
          </div>
          <div
            className="more-menu-item"
            onClick={() => {
              setShowMoreMenu(false);
              setShowCommunityInfo(true);
            }}
          >
            <Settings size={20} color="#c4b5fd" />
            <div className="more-menu-text" style={{ marginLeft: 12 }}>Group Settings</div>
          </div>
        </div>
      </div>
    )
  );

  return (
    <div className="container">
      <div className="keyboard-view">
        {/* Header */}
        <div className="header">
          {isSelectionMode ? (
            <>
              <div className="back-button" onClick={handleCancelSelection}>
                <X size={24} color="#c4b5fd" />
              </div>
              <div className="header-info">
                <div className="selection-count">
                  {selectedMessages.size} {selectedMessages.size === 1 ? 'message' : 'messages'} selected
                </div>
              </div>
              {selectedMessages.size > 0 && (
                <div className="header-button" onClick={handleDeleteSelectedMessages}>
                  <Trash2 size={24} color="#ef4444" />
                </div>
              )}
              <div className="header-button" onClick={handleMoreMenu}>
                <MoreVertical size={24} color="#c4b5fd" />
              </div>
            </>
          ) : (
            <>
              <div className="back-button" onClick={onBack}>
                <ArrowLeft size={24} color="#c4b5fd" />
              </div>
              <div
                className="header-info"
                onClick={() => setShowCommunityInfo(true)}
              >
                <div className="avatar-container">
                  <img src={getImageUrl(communityData.image) || communityData.image} className="community-avatar" alt={communityData.name} />
                  <div className={`header-connection-dot ${socketConnected ? 'header-connection-online' : 'header-connection-offline'}`} />
                </div>
                <div className="header-text-container">
                  <div className="header-title-row">
                    <div className="community-name">{communityData.name}</div>
                    {socketConnected && (
                      <Wifi size={12} color="#10b981" style={{ marginLeft: 6 }} />
                    )}
                  </div>
                  <div className="community-sub">
                    {onlineUserIds.size > 0 ? onlineUserIds.size : (loadingMembers ? communityData.activeMembers : members.filter(m => m.status === 'online').length)} online • {loadingMembers ? communityData.members : (members.length || communityData.members)} members
                  </div>
                </div>
              </div>
              <div className="header-button" onClick={handleMoreMenu}>
                <MoreVertical size={24} color="#c4b5fd" />
              </div>
            </>
          )}
        </div>

        {/* Chat Messages */}
        {loadingMessages ? (
          <div className="loading-container">
            <div className="spinner" />
            <div className="loading-text">Loading messages...</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-container">
            <MessageSquare size={48} color="#a78bfa80" />
            <div className="empty-text">No messages yet</div>
            <div className="empty-subtext">Start the conversation!</div>
          </div>
        ) : (
          <div className="messages-list">
            {messages.map((item, index) => renderMessage({ item, index }))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {replyingTo && !isSelectionMode && (
          <div className="reply-banner">
            <div className="reply-banner-content">
              <Reply size={16} color="#a78bfa" />
              <div className="reply-banner-text">
                <div className="reply-banner-username">Replying to {replyingTo?.username}</div>
                <div className="reply-banner-message">
                  {replyingTo?.type === 'text' 
                    ? replyingTo?.content 
                    : replyingTo?.type === 'image' 
                    ? '📷 Photo'
                    : replyingTo?.type === 'video'
                    ? '🎥 Video'
                    : replyingTo?.type === 'audio'
                    ? '🎤 Audio'
                    : 'Media'}
                </div>
              </div>
            </div>
            <div className="reply-banner-close" onClick={() => setReplyingTo(null)}>
              <X size={20} color="#c4b5fd" />
            </div>
          </div>
        )}

        {isRecording && !isSelectionMode && (
          <div className="recording-banner">
            <div className="recording-indicator" />
            <div className="recording-text">Recording... {formatTime(recordingDuration)}</div>
            <div className="stop-recording-button" onClick={handleStopRecording}>
              <div className="stop-recording-text">Stop</div>
            </div>
          </div>
        )}

        {/* Typing Indicator */}
        {typingUsers.size > 0 && !isSelectionMode && (
          <div className="typing-indicator-container">
            <div className="typing-dots">
              <div className="typing-dot typing-dot1" />
              <div className="typing-dot typing-dot2" />
              <div className="typing-dot typing-dot3" />
            </div>
            <div className="typing-text">
              {typingUsers.size === 1
                ? `${Array.from(typingUsers.values())[0]} is typing...`
                : typingUsers.size === 2
                ? `${Array.from(typingUsers.values()).join(' and ')} are typing...`
                : `${typingUsers.size} people are typing...`}
            </div>
          </div>
        )}

        {/* Message Input */}
        {!isSelectionMode && (
          <div className="input-container">
            {connectionStatus !== 'connected' && (
              <div className={`connection-indicator ${
                connectionStatus === 'connecting' || connectionStatus === 'reconnecting'
                  ? 'connection-indicator-connecting'
                  : 'connection-indicator-disconnected'
              }`}>
                {(connectionStatus === 'connecting' || connectionStatus === 'reconnecting') ? (
                  <div className="spinner-small" />
                ) : (
                  <div className="connection-dot" />
                )}
              </div>
            )}
            <div
              className="input-icon-button"
              onClick={() => setShowAttachmentMenu(true)}
            >
              <Paperclip size={24} color="#a78bfa" />
            </div>
            <textarea
              className="input"
              value={newMessage}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={socketConnected ? "Type a message..." : "Connecting..."}
              rows={1}
              maxLength={1000}
            />
            <div className="input-right-buttons">
              {newMessage.trim() ? (
                <div 
                  className="send-button" 
                  onClick={handleSendMessage}
                  style={{ opacity: sendingMessage ? 0.5 : 1, pointerEvents: sendingMessage ? 'none' : 'auto' }}
                >
                  <div className="send-button-gradient">
                    {sendingMessage ? (
                      <div className="spinner-small" />
                    ) : (
                      <Send size={20} color="#ffffff" />
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div
                    className="emoji-button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    <div className="emoji-button-gradient">
                      <span className="emoji-icon">😊</span>
                    </div>
                  </div>
                  <div
                    className="voice-button"
                    onClick={handleStartRecording}
                  >
                    <div className="voice-button-gradient">
                      <Mic size={20} color="#ffffff" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {renderAttachmentMenu()}
      {renderMediaModal()}
      {renderCommunityInfoModal()}
      {renderEmojiPicker()}
      {renderMoreMenu()}
      
      <style>{`
        * {
          box-sizing: border-box;
        }
        
        .container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100%;
          min-width: 0;
          max-width: 100%;
          background: linear-gradient(135deg, #0f172a 0%, #4c1d95 50%, #1e3a8a 100%);
          color: #ffffff;
          box-sizing: border-box;
          overflow: hidden;
        }
        
        .keyboard-view {
          display: flex;
          flex-direction: column;
          flex: 1;
          width: 100%;
          min-width: 0;
          overflow: hidden;
        }
        
        .header {
          display: flex;
          flex-direction: row;
          align-items: center;
          width: 100%;
          min-width: 0;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(139, 92, 246, 0.3);
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(76, 29, 149, 0.95) 100%);
          flex-shrink: 0;
        }
        
        .back-button {
          padding: 8px;
          margin-right: 8px;
          cursor: pointer;
        }
        
        .header-info {
          flex: 1;
          display: flex;
          flex-direction: row;
          align-items: center;
          cursor: pointer;
        }
        
        .avatar-container {
          position: relative;
          margin-right: 12px;
        }
        
        .community-avatar {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          border: 2px solid rgba(139, 92, 246, 0.5);
        }
        
        .header-connection-dot {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 12px;
          height: 12px;
          border-radius: 6px;
          border: 2px solid rgba(15, 23, 42, 1);
        }
        
        .header-connection-online {
          background-color: #10b981;
        }
        
        .header-connection-offline {
          background-color: #6b7280;
        }
        
        .header-text-container {
          flex: 1;
        }
        
        .header-title-row {
          display: flex;
          flex-direction: row;
          align-items: center;
        }
        
        .community-name {
          color: #c4b5fd;
          font-weight: 600;
          font-size: 16px;
        }
        
        .community-sub {
          color: rgba(167, 139, 250, 0.5);
          font-size: 12px;
          margin-top: 2px;
        }
        
        .header-button {
          padding: 8px;
          cursor: pointer;
        }
        
        .selection-count {
          color: #c4b5fd;
          font-size: 16px;
          font-weight: 600;
        }
        
        .loading-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 0;
        }
        
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(167, 139, 250, 0.3);
          border-top-color: #a78bfa;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(251, 191, 36, 0.3);
          border-top-color: #fbbf24;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        .loading-text {
          color: rgba(167, 139, 250, 0.5);
          font-size: 14px;
          margin-top: 12px;
        }
        
        .empty-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 0;
        }
        
        .empty-text {
          color: rgba(167, 139, 250, 0.5);
          font-size: 16px;
          font-weight: 500;
          margin-top: 12px;
        }
        
        .empty-subtext {
          color: rgba(167, 139, 250, 0.4);
          font-size: 14px;
          margin-top: 4px;
        }
        
        .messages-list {
          flex: 1;
          width: 100%;
          min-width: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 16px;
          padding-bottom: 8px;
        }
        
        .message-wrapper {
          display: flex;
          flex-direction: row;
          margin: 2px 0;
          max-width: 80%;
        }
        
        .message-wrapper-left {
          align-self: flex-start;
          align-items: flex-end;
        }
        
        .message-wrapper-right {
          align-self: flex-end;
          flex-direction: row-reverse;
          align-items: flex-end;
        }
        
        .message-avatar-container {
          cursor: pointer;
        }
        
        .message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          margin-right: 8px;
          margin-top: 4px;
        }
        
        .message-avatar-placeholder {
          width: 32px;
          margin-right: 8px;
        }
        
        .message-content-wrapper {
          flex-shrink: 1;
          max-width: 100%;
        }
        
        .message-sender-name {
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 2px;
          margin-left: 4px;
          cursor: pointer;
        }
        
        .message-bubble {
          padding: 8px 12px;
          border-radius: 16px;
          align-self: flex-start;
        }
        
        .message-bubble-with-username {
          border-top-left-radius: 4px;
        }
        
        .message-bubble-sent {
          background-color: #7c3aed;
          border-bottom-right-radius: 4px;
          align-self: flex-end;
        }
        
        .message-bubble-received {
          background-color: rgba(30, 41, 59, 0.8);
          border-bottom-left-radius: 4px;
          border: 1px solid rgba(139, 92, 246, 0.3);
          align-self: flex-start;
        }
        
        .message-bubble-selected {
          opacity: 0.7;
          border: 2px solid #a78bfa;
        }
        
        .message-text {
          color: #ffffff;
          font-size: 15px;
          line-height: 20px;
        }
        
        .message-text-sent {
          color: #ffffff;
        }
        
        .message-footer {
          display: flex;
          flex-direction: row;
          align-items: center;
          margin-top: 4px;
          align-self: flex-end;
        }
        
        .message-time {
          color: rgba(167, 139, 250, 0.5);
          font-size: 11px;
          margin-right: 4px;
        }
        
        .message-time-sent {
          color: rgba(255, 255, 255, 0.5);
        }
        
        .message-status {
          margin-left: 2px;
        }
        
        .reply-container {
          display: flex;
          flex-direction: row;
          margin-bottom: 8px;
          padding-left: 8px;
          border-left: 3px solid #a78bfa;
        }
        
        .reply-indicator {
          width: 3px;
          background-color: #a78bfa;
          margin-right: 8px;
        }
        
        .reply-content {
          flex: 1;
        }
        
        .reply-username {
          color: #a78bfa;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 2px;
        }
        
        .reply-text {
          color: rgba(196, 181, 253, 0.5);
          font-size: 12px;
        }
        
        .message-image-container {
          cursor: pointer;
        }
        
        .message-image {
          width: 250px;
          height: 200px;
          border-radius: 8px;
          margin-bottom: 4px;
          object-fit: cover;
        }
        
        .message-video-container {
          width: 250px;
          height: 200px;
          border-radius: 8px;
          margin-bottom: 4px;
          position: relative;
          cursor: pointer;
        }
        
        .message-video-thumbnail-fallback {
          width: 100%;
          height: 100%;
          border-radius: 8px;
          background-color: rgba(30, 41, 59, 0.85);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        
        .message-video-label {
          margin-top: 6px;
          color: #ffffff;
          font-size: 13px;
          font-weight: 600;
          opacity: 0.9;
        }
        
        .message-video-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .video-duration {
          position: absolute;
          bottom: 8px;
          right: 8px;
          background-color: rgba(0, 0, 0, 0.7);
          padding: 2px 6px;
          border-radius: 4px;
        }
        
        .video-duration-text {
          color: #ffffff;
          font-size: 11px;
          font-weight: 600;
        }
        
        .audio-container {
          display: flex;
          flex-direction: row;
          align-items: center;
          min-width: 200px;
          padding: 4px 0;
        }
        
        .audio-play-button {
          width: 36px;
          height: 36px;
          border-radius: 18px;
          background-color: #a78bfa;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
          cursor: pointer;
        }
        
        .audio-waveform {
          flex: 1;
          display: flex;
          flex-direction: row;
          align-items: center;
          height: 30px;
          margin-right: 8px;
        }
        
        .audio-wave {
          width: 3px;
          background-color: #a78bfa;
          margin: 0 2px;
          border-radius: 2px;
        }
        
        .audio-duration {
          color: #ffffff;
          font-size: 12px;
          min-width: 35px;
        }
        
        .date-separator {
          display: flex;
          flex-direction: row;
          align-items: center;
          margin: 16px 0;
        }
        
        .date-separator-line {
          flex: 1;
          height: 1px;
          background-color: rgba(139, 92, 246, 0.3);
        }
        
        .date-separator-text {
          color: rgba(167, 139, 250, 0.5);
          font-size: 12px;
          margin: 0 12px;
          font-weight: 500;
        }
        
        .reply-banner {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          background-color: rgba(30, 41, 59, 0.8);
          border-top: 1px solid rgba(139, 92, 246, 0.3);
          padding: 12px 16px;
        }
        
        .reply-banner-content {
          display: flex;
          flex-direction: row;
          align-items: center;
          flex: 1;
        }
        
        .reply-banner-text {
          margin-left: 8px;
          flex: 1;
        }
        
        .reply-banner-username {
          color: #a78bfa;
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 2px;
        }
        
        .reply-banner-message {
          color: rgba(196, 181, 253, 0.5);
          font-size: 12px;
        }
        
        .reply-banner-close {
          cursor: pointer;
        }
        
        .recording-banner {
          display: flex;
          flex-direction: row;
          align-items: center;
          background-color: rgba(239, 68, 68, 0.2);
          border-top: 1px solid rgba(248, 113, 113, 0.3);
          padding: 12px 16px;
        }
        
        .recording-indicator {
          width: 12px;
          height: 12px;
          border-radius: 6px;
          background-color: #ef4444;
          margin-right: 8px;
          animation: pulse 1s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .recording-text {
          flex: 1;
          color: #ffffff;
          font-size: 14px;
          font-weight: 500;
        }
        
        .stop-recording-button {
          padding: 6px 16px;
          background-color: #ef4444;
          border-radius: 8px;
          cursor: pointer;
        }
        
        .stop-recording-text {
          color: #ffffff;
          font-size: 12px;
          font-weight: 600;
        }
        
        .input-container {
          display: flex;
          flex-direction: row;
          align-items: flex-end;
          width: 100%;
          min-width: 0;
          background-color: rgba(15, 23, 42, 0.8);
          border-top: 1px solid rgba(139, 92, 246, 0.3);
          padding: 12px;
          flex-shrink: 0;
        }
        
        .connection-indicator {
          width: 20px;
          height: 20px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 4px;
        }
        
        .connection-indicator-connecting {
          background-color: rgba(251, 191, 36, 0.2);
        }
        
        .connection-indicator-disconnected {
          background-color: rgba(239, 68, 68, 0.2);
        }
        
        .connection-dot {
          width: 8px;
          height: 8px;
          border-radius: 4px;
          background-color: #ef4444;
        }
        
        .input-icon-button {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 8px;
          cursor: pointer;
        }
        
        .input {
          flex: 1;
          min-width: 0;
          background-color: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 20px;
          padding: 10px 16px;
          color: #ffffff;
          font-size: 15px;
          max-height: 100px;
          resize: none;
          font-family: inherit;
          box-sizing: border-box;
        }
        
        .input:focus {
          outline: none;
          border-color: rgba(139, 92, 246, 0.6);
        }
        
        .input-right-buttons {
          display: flex;
          flex-direction: row;
          align-items: center;
        }
        
        .send-button {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          margin-left: 8px;
          overflow: hidden;
          cursor: pointer;
        }
        
        .send-button-gradient {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #06b6d4 100%);
        }
        
        .emoji-button {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          overflow: hidden;
          margin-right: 8px;
          cursor: pointer;
        }
        
        .emoji-button-gradient {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%);
        }
        
        .emoji-icon {
          font-size: 20px;
        }
        
        .voice-button {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          overflow: hidden;
          cursor: pointer;
        }
        
        .voice-button-gradient {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%);
        }
        
        .typing-indicator-container {
          display: flex;
          flex-direction: row;
          align-items: center;
          padding: 8px 16px;
          background-color: rgba(15, 23, 42, 0.6);
          border-top: 1px solid rgba(139, 92, 246, 0.2);
        }
        
        .typing-dots {
          display: flex;
          flex-direction: row;
          align-items: center;
          margin-right: 8px;
        }
        
        .typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 3px;
          background-color: #a78bfa;
          margin: 0 2px;
        }
        
        .typing-dot1 {
          opacity: 1;
          animation: typing1 1.4s ease-in-out infinite;
        }
        
        .typing-dot2 {
          opacity: 0.7;
          animation: typing2 1.4s ease-in-out infinite;
        }
        
        .typing-dot3 {
          opacity: 0.4;
          animation: typing3 1.4s ease-in-out infinite;
        }
        
        @keyframes typing1 {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
        }
        
        @keyframes typing2 {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
          animation-delay: 0.2s;
        }
        
        @keyframes typing3 {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
          animation-delay: 0.4s;
        }
        
        .typing-text {
          color: rgba(167, 139, 250, 0.5);
          font-size: 12px;
          font-style: italic;
        }
        
        .selection-checkbox {
          width: 24px;
          height: 24px;
          border-radius: 12px;
          border: 2px solid #a78bfa;
          margin-right: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        
        .selection-checkbox-selected {
          width: 100%;
          height: 100%;
          border-radius: 12px;
          background-color: #a78bfa;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: flex-end;
          align-items: flex-end;
          z-index: 1000;
        }
        
        .attachment-menu {
          background-color: rgba(15, 23, 42, 0.95);
          border-top-left-radius: 20px;
          border-top-right-radius: 20px;
          padding: 20px;
          padding-bottom: 40px;
          display: flex;
          flex-direction: row;
          justify-content: space-around;
          border-top: 1px solid rgba(139, 92, 246, 0.3);
          width: 100%;
        }
        
        .attachment-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 80px;
          cursor: pointer;
        }
        
        .attachment-icon {
          width: 56px;
          height: 56px;
          border-radius: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }
        
        .attachment-text {
          color: #c4b5fd;
          font-size: 12px;
          font-weight: 500;
        }
        
        .media-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.95);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
        }
        
        .media-modal-close {
          position: absolute;
          top: 20px;
          right: 20px;
          z-index: 10;
          width: 40px;
          height: 40px;
          border-radius: 20px;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        
        .media-modal-content {
          width: 90%;
          max-width: 720px;
          height: 80%;
          max-height: 620px;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
        }
        
        .media-modal-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        
        .media-modal-actions {
          position: absolute;
          bottom: 18px;
          left: 18px;
          right: 18px;
          display: flex;
          justify-content: center;
        }
        
        .media-modal-delete-button {
          display: flex;
          flex-direction: row;
          align-items: center;
          background-color: rgba(239, 68, 68, 0.9);
          padding: 10px 14px;
          border-radius: 12px;
          cursor: pointer;
        }
        
        .media-modal-delete-text {
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
          margin-left: 8px;
        }
        
        .info-header {
          display: flex;
          flex-direction: row;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(139, 92, 246, 0.3);
          background: linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(76, 29, 149, 0.95) 100%);
        }
        
        .info-header-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-left: 8px;
        }
        
        .info-community-avatar {
          width: 80px;
          height: 80px;
          border-radius: 40px;
          margin-bottom: 12px;
          border: 3px solid rgba(139, 92, 246, 0.5);
        }
        
        .info-community-name {
          color: #c4b5fd;
          font-weight: 700;
          font-size: 22px;
          margin-bottom: 4px;
        }
        
        .info-community-sub {
          color: rgba(167, 139, 250, 0.5);
          font-size: 14px;
        }
        
        .info-tabs {
          display: flex;
          flex-direction: row;
          background-color: rgba(15, 23, 42, 0.6);
          border-bottom: 1px solid rgba(139, 92, 246, 0.3);
        }
        
        .info-tab-button {
          flex: 1;
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          padding: 16px 0;
          border-bottom: 2px solid transparent;
        }
        
        .active-info-tab-button {
          border-bottom-color: #a78bfa;
        }
        
        .info-tab-text {
          color: rgba(167, 139, 250, 0.5);
          font-weight: 500;
          font-size: 14px;
        }
        
        .active-info-tab-text {
          color: #c4b5fd;
          font-weight: 600;
        }
        
        .info-content {
          flex: 1;
          background-color: rgba(15, 23, 42, 0.5);
          overflow-y: auto;
        }
        
        .member-item {
          display: flex;
          flex-direction: row;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid rgba(139, 92, 246, 0.1);
          cursor: pointer;
        }
        
        .member-avatar-container {
          position: relative;
          margin-right: 12px;
        }
        
        .member-avatar {
          width: 50px;
          height: 50px;
          border-radius: 25px;
          border: 2px solid rgba(139, 92, 246, 0.3);
        }
        
        .member-status {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 14px;
          height: 14px;
          border-radius: 7px;
          border: 2px solid rgba(15, 23, 42, 1);
        }
        
        .member-info {
          flex: 1;
        }
        
        .member-name-row {
          display: flex;
          flex-direction: row;
          align-items: center;
          margin-bottom: 4px;
        }
        
        .member-name {
          color: #c4b5fd;
          font-size: 16px;
          font-weight: 600;
          margin-right: 6px;
        }
        
        .member-role {
          color: rgba(167, 139, 250, 0.5);
          font-size: 13px;
        }
        
        .media-tab-container {
          flex: 1;
          background-color: rgba(15, 23, 42, 0.5);
        }
        
        .media-grid {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          padding: 8px;
        }
        
        .media-grid-item {
          width: calc(33.333% - 8px);
          aspect-ratio: 1;
          margin: 4px;
          border-radius: 8px;
          overflow: hidden;
          position: relative;
          cursor: pointer;
        }
        
        .media-grid-selection-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0);
          display: flex;
          align-items: flex-start;
          justify-content: flex-end;
          padding: 6px;
          z-index: 2;
        }
        
        .media-grid-selection-overlay-selected {
          background-color: rgba(124, 58, 237, 0.25);
        }
        
        .media-grid-check {
          width: 22px;
          height: 22px;
          border-radius: 11px;
          background-color: #7C3AED;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .media-grid-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .media-grid-video {
          width: 100%;
          height: 100%;
          background-color: rgba(30, 41, 59, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        
        .media-grid-duration {
          position: absolute;
          bottom: 4px;
          right: 4px;
          color: #ffffff;
          font-size: 10px;
          background-color: rgba(0, 0, 0, 0.7);
          padding: 2px 4px;
          border-radius: 4px;
        }
        
        .emoji-picker-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: flex-end;
          align-items: flex-end;
          z-index: 1000;
        }
        
        .emoji-picker-container {
          background-color: rgba(15, 23, 42, 0.98);
          border-top-left-radius: 20px;
          border-top-right-radius: 20px;
          max-height: 50%;
          padding-bottom: 40px;
          width: 100%;
        }
        
        .emoji-picker-header {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid rgba(139, 92, 246, 0.3);
        }
        
        .emoji-picker-title {
          color: #c4b5fd;
          font-size: 18px;
          font-weight: 600;
        }
        
        .emoji-grid {
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          padding: 12px;
          max-height: 300px;
          overflow-y: auto;
        }
        
        .emoji-item {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          cursor: pointer;
        }
        
        .emoji-item:hover {
          background-color: rgba(139, 92, 246, 0.2);
        }
        
        .emoji-text {
          font-size: 28px;
        }
        
        .more-menu-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: flex-end;
          align-items: flex-end;
          z-index: 1000;
        }
        
        .more-menu-container {
          background-color: rgba(15, 23, 42, 0.98);
          border-top-left-radius: 20px;
          border-top-right-radius: 20px;
          padding: 16px;
          padding-bottom: 40px;
          width: 100%;
        }
        
        .more-menu-item {
          display: flex;
          flex-direction: row;
          align-items: center;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 8px;
          background-color: rgba(30, 41, 59, 0.6);
          cursor: pointer;
        }
        
        .more-menu-item:hover {
          background-color: rgba(30, 41, 59, 0.8);
        }
        
        .more-menu-text {
          color: #c4b5fd;
          font-size: 16px;
          font-weight: 500;
        }
        
        .community-info-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, #0f172a 0%, #4c1d95 50%, #1e3a8a 100%);
          z-index: 1000;
          display: flex;
          flex-direction: column;
        }
        
        .media-grid-content {
          overflow-y: auto;
        }
        
        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 0;
        }
        
        .empty-state-text {
          color: rgba(167, 139, 250, 0.5);
          font-size: 16px;
          margin-top: 12px;
        }
      `}</style>
    </div>
  );
};

export default JoinCommunityPage;