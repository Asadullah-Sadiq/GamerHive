import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft,
  Send,
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
} from 'lucide-react';
import { apiRequest, getImageUrl, getStoredUser } from '../utils/api';
import { getAvatarImageSource } from '../utils/avatarUtils';
import { socketService } from '../utils/socketService';

// FileSystem and Sharing APIs not needed for web - using direct browser APIs

// Audio API - using native HTML5 Audio for web
// Note: window.Audio is used for creating audio elements

// Mock DocumentPicker for web
const DocumentPicker = {
  getDocumentAsync: async (options: any) => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = options.type || '*/*';
      input.multiple = options.multiple || false;
      
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        resolve({
          canceled: false,
          assets: [{
            uri: URL.createObjectURL(file),
            name: file.name,
            mimeType: file.type,
            size: file.size,
          }],
        });
      };
      
      input.click();
    });
  },
};

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
          // Get video duration for web
          const video = document.createElement('video');
          video.preload = 'metadata';
          
          video.onloadedmetadata = () => {
            resolve({
              canceled: false,
              assets: [{
                uri: URL.createObjectURL(file),
                fileName: file.name,
                duration: video.duration * 1000, // Convert to milliseconds
                width: video.videoWidth,
                height: video.videoHeight,
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

// Mock Video components for web
const DirectVideoPlayer: React.FC<{ videoUri: string }> = ({ videoUri }) => {
  return (
    <div className="media-modal-video-player">
      <video
        src={videoUri}
        controls
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
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
  // const [playingVideoId, setPlayingVideoId] = useState<string | null>(null); // Not used in web version
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const flatListRef = useRef<HTMLDivElement>(null);
  const recordingRef = useRef<any>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const soundRef = useRef<HTMLAudioElement | null>(null);

  // Load current user data
  useEffect(() => {
    const loadCurrentUser = () => {
      try {
        const user = getStoredUser();
        if (user) {
          setCurrentUserId(user.id);
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
          const response = await apiRequest<{ user: any }>(`/user/profile/${targetUserId}`);
          if (response.success && response.data) {
            const user = response.data.user;
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
        alert('Error: Failed to load user information');
      } finally {
        setLoading(false);
      }
    };

    loadTargetUser();
  }, [targetUserId, targetUsername, targetUserAvatar]);

  // Download and save media file to device (not used in web, but kept for compatibility)
  // @ts-ignore - intentionally unused
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _downloadAndSaveMedia = async (
    messageId: string,
    fileUrl: string,
    mediaType: 'audio' | 'video' | 'image' | 'file',
    fileName?: string
  ): Promise<string | null> => {
    try {
      // Convert URL if needed
      let fullUrl: string;
      const convertedUrl = getImageUrl(fileUrl);
      fullUrl = convertedUrl || fileUrl;
      
      // For web, we'll create a download link
      const link = document.createElement('a');
      link.href = fullUrl;
      
      // Generate filename
      let fileExtension = fileName?.split('.').pop();
      if (!fileExtension) {
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
      link.download = savedFileName;
      
      // For now, return the original URL since we can't save to filesystem
      return fullUrl;
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
        const response = await apiRequest<{ messages: any[] }>(`/direct/messages/${currentUserId}/${targetUserId}`);
        if (response.success && response.data) {
          const formattedMessages = await Promise.all(
            response.data.messages.map(async (msg: any) => {
              let localFileUrl = msg.fileUrl;
              
              // For web, we don't need to download and save locally
              // Just use the URL directly
              if ((msg.type === 'audio' || msg.type === 'video' || msg.type === 'image' || msg.type === 'file') && msg.fileUrl) {
                localFileUrl = getImageUrl(msg.fileUrl) || msg.fileUrl;
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
                status: (
                  msg.senderId === currentUserId
                    ? (msg.isRead ? 'read' as const : 'sent' as const)
                    : undefined
                ) as 'sending' | 'sent' | 'delivered' | 'read' | undefined,
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
        const user = getStoredUser();
        if (user) {
          const username = user.username || user.name || 'User';
          
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
                  
                  // For web, convert URL if needed
                  if ((message.type === 'audio' || message.type === 'video' || message.type === 'image' || message.type === 'file') && message.fileUrl) {
                    localFileUrl = getImageUrl(message.fileUrl) || message.fileUrl;
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
      // Cleanup: clear event handlers on unmount
      socketService.clearEventHandlers();
    };
  }, [currentUserId, targetUserId]);

  const canDeleteMessage = (_msg: Message) => {
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
      alert('Error: User not found. Please login again.');
      return;
    }
    const messageIds = Array.from(selectedMessages);
    if (messageIds.length === 0) return;

    const selected = messages.filter((m) => selectedMessages.has(m.id));
    const allMine = selected.length > 0 && selected.every((m) => m.senderId === currentUserId);

    const deleteForMe = async () => {
      const resp = await apiRequest('/direct/messages', {
        method: 'DELETE',
        body: JSON.stringify({ userId: currentUserId, messageIds, scope: 'me' }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.success) throw new Error((resp as any).message || 'Failed to delete messages');
      setMessages((prev) => prev.filter((m) => !selectedMessages.has(m.id)));
      handleCancelSelection();
    };

    const deleteForEveryone = async () => {
      const resp = await apiRequest('/direct/messages', {
        method: 'DELETE',
        body: JSON.stringify({ userId: currentUserId, messageIds, scope: 'everyone' }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!resp.success) throw new Error((resp as any).message || 'Failed to delete messages');
      setMessages((prev) => prev.filter((m) => !selectedMessages.has(m.id)));
      handleCancelSelection();
    };

    const confirmDelete = window.confirm(
      `Delete ${messageIds.length} message${messageIds.length > 1 ? 's' : ''}?`
    );
    
    if (confirmDelete) {
      try {
        if (allMine) {
          const deleteForAll = window.confirm('Delete for everyone? (Cancel for "Delete for me only")');
          if (deleteForAll) {
            await deleteForEveryone();
          } else {
            await deleteForMe();
          }
        } else {
          await deleteForMe();
        }
      } catch (e: any) {
        console.error('Error deleting messages:', e);
        alert('Error: ' + (e.response?.data?.message || e.message || 'Failed to delete messages'));
      }
    }
  };

  const getStatusIcon = (message: Message) => {
    if (message.status === 'sending') {
      return <Clock size={12} color="rgba(167, 139, 250, 0.8)" />;
    }
    if (message.status === 'read') {
      return (
        <div style={{ display: 'flex', flexDirection: 'row', marginLeft: 4 }}>
          <Check size={12} color="#06b6d4" style={{ marginRight: -4 }} />
          <Check size={12} color="#06b6d4" />
        </div>
      );
    }
    if (message.status === 'delivered') {
      return (
        <div style={{ display: 'flex', flexDirection: 'row', marginLeft: 4 }}>
          <Check size={12} color="rgba(167, 139, 250, 0.8)" style={{ marginRight: -4 }} />
          <Check size={12} color="rgba(167, 139, 250, 0.8)" />
        </div>
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
      await apiRequest('/direct/messages/read', {
        method: 'PUT',
        body: JSON.stringify({ userId: currentUserId, targetUserId }),
        headers: { 'Content-Type': 'application/json' },
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
      console.warn('[Direct] Failed to mark messages as read:', e?.message || e);
    }
  };

  const handleClearChatForMe = async () => {
    if (!currentUserId || !targetUserId) return;
    const confirmClear = window.confirm('Clear this chat for you only?');
    if (confirmClear) {
      try {
            await apiRequest('/direct/messages/clear', {
              method: 'DELETE',
              body: JSON.stringify({ userId: currentUserId, targetUserId }),
              headers: { 'Content-Type': 'application/json' },
            });
        setMessages([]);
        setShowMoreMenu(false);
        setIsSelectionMode(false);
        setSelectedMessages(new Set());
      } catch (e: any) {
        console.error('Error clearing chat:', e);
        alert('Error: ' + (e.response?.data?.message || e.message || 'Failed to clear chat'));
      }
    }
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
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const fileName = `direct-chat-${targetUserId}-${Date.now()}.json`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error('Error exporting chat:', e);
      alert('Error: ' + (e.message || 'Failed to export chat'));
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
        soundRef.current.pause();
        soundRef.current = null;
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
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
      const response = await apiRequest<{ message: any }>('/direct/messages', {
        method: 'POST',
        body: JSON.stringify({
          senderId: currentUserId,
          receiverId: targetUserId,
          content: messageContent,
          type: 'text',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.success && response.data) {
        // Replace temp message with actual message from server
        const newMsg = response.data.message;
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
        throw new Error((response as any).message || 'Failed to send message');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert('Error: ' + (error.response?.data?.message || error.message || 'Failed to send message. Please try again.'));
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

  // Format file size (not used in web, but kept for compatibility)
  // @ts-ignore - intentionally unused
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
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

  // Handle take photo from camera
  const handleTakePhoto = async () => {
    setShowAttachmentMenu(false);
    if (!currentUserId) {
      alert('Error: User not found. Please login again.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission Required: Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!(result as any).canceled && (result as any).assets && (result as any).assets.length > 0) {
        const asset = (result as any).assets[0];
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
          // Fetch the file from the blob URL
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          
          formData.append('file', blob, asset.fileName || 'photo.jpg');
          formData.append('senderId', currentUserId);
          formData.append('receiverId', targetUserId!);
          formData.append('type', 'image');

          const uploadResponse = await apiRequest<{ message: any }>('/direct/messages/media', {
            method: 'POST',
            body: formData,
          });

          if (uploadResponse.success && uploadResponse.data) {
            const newMsg = uploadResponse.data.message;
            
            // For web, use the URL directly
            let localFileUrl = getImageUrl(newMsg.fileUrl) || newMsg.fileUrl;
            
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

            // Send via socket for real-time delivery to receiver
            if (socketService.isConnected()) {
              try {
                socketService.sendDirectMessage({
                  senderId: newMsg.senderId,
                  receiverId: newMsg.receiverId,
                  content: newMsg.content,
                  type: newMsg.type,
                  fileUrl: newMsg.fileUrl,
                  fileName: newMsg.fileName,
                  fileSize: newMsg.fileSize,
                  messageId: newMsg.id, // Message already saved, just broadcast
                });
              } catch (socketError) {
                console.warn('[Socket] Failed to send media message via socket:', socketError);
              }
            }
          }
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError);
          setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
          alert('Error: ' + (uploadError.response?.data?.message || 'Failed to upload photo.'));
        }
      }
    } catch (error) {
      console.error('Camera error:', error);
      alert('Error: Failed to take photo. Please try again.');
    }
  };

  // Handle send image from gallery
  const handleSendImage = async () => {
    setShowAttachmentMenu(false);
    if (!currentUserId) {
      alert('Error: User not found. Please login again.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission Required: Media library permission is required to select photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!(result as any).canceled && (result as any).assets && (result as any).assets.length > 0) {
        const asset = (result as any).assets[0];
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
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          
          formData.append('file', blob, asset.fileName || 'image.jpg');
          formData.append('senderId', currentUserId);
          formData.append('receiverId', targetUserId!);
          formData.append('type', 'image');

          const uploadResponse = await apiRequest<{ message: any }>('/direct/messages/media', {
            method: 'POST',
            body: formData,
          });

          if (uploadResponse.success && uploadResponse.data) {
            const newMsg = uploadResponse.data.message;
            
            // For web, use the URL directly
            let localFileUrl = getImageUrl(newMsg.fileUrl) || newMsg.fileUrl;
            
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

            // Send via socket for real-time delivery to receiver
            if (socketService.isConnected()) {
              try {
                socketService.sendDirectMessage({
                  senderId: newMsg.senderId,
                  receiverId: newMsg.receiverId,
                  content: newMsg.content,
                  type: newMsg.type,
                  fileUrl: newMsg.fileUrl,
                  fileName: newMsg.fileName,
                  fileSize: newMsg.fileSize,
                  duration: newMsg.duration,
                  messageId: newMsg.id, // Message already saved, just broadcast
                });
              } catch (socketError) {
                console.warn('[Socket] Failed to send media message via socket:', socketError);
              }
            }
          }
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError);
          setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
          alert('Error: ' + (uploadError.response?.data?.message || 'Failed to upload image.'));
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      alert('Error: Failed to pick image. Please try again.');
    }
  };

  // Handle send video
  const handleSendVideo = async () => {
    setShowAttachmentMenu(false);
    if (!currentUserId) {
      alert('Error: User not found. Please login again.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission Required: Media library permission is required to select videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
        videoMaxDuration: 300, // 5 minutes max
      });

      if (!(result as any).canceled && (result as any).assets && (result as any).assets.length > 0) {
        const asset = (result as any).assets[0];
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
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          
          formData.append('file', blob, asset.fileName || 'video.mp4');
          formData.append('senderId', currentUserId);
          formData.append('receiverId', targetUserId!);
          formData.append('type', 'video');
          formData.append('duration', durationString);

          const uploadResponse = await apiRequest<{ message: any }>('/direct/messages/media', {
            method: 'POST',
            body: formData,
          });

          if (uploadResponse.success && uploadResponse.data) {
            const newMsg = uploadResponse.data.message;
            
            // For web, use the URL directly
            let localFileUrl = getImageUrl(newMsg.fileUrl) || newMsg.fileUrl;
            
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

            // Send via socket for real-time delivery to receiver
            if (socketService.isConnected()) {
              try {
                socketService.sendDirectMessage({
                  senderId: newMsg.senderId,
                  receiverId: newMsg.receiverId,
                  content: newMsg.content,
                  type: newMsg.type,
                  fileUrl: newMsg.fileUrl,
                  fileName: newMsg.fileName,
                  fileSize: newMsg.fileSize,
                  duration: newMsg.duration,
                  messageId: newMsg.id, // Message already saved, just broadcast
                });
              } catch (socketError) {
                console.warn('[Socket] Failed to send media message via socket:', socketError);
              }
            }
          }
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError);
          setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
          alert('Error: ' + (uploadError?.message || 'Failed to upload video.'));
        }
      }
    } catch (error) {
      console.error('Video picker error:', error);
      alert('Error: Failed to pick video. Please try again.');
    }
  };

  // Handle send document
  const handleSendDocument = async () => {
    setShowAttachmentMenu(false);
    if (!currentUserId || !targetUserId) {
      alert('Error: User not found. Please login again.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!(result as any).canceled && (result as any).assets && (result as any).assets.length > 0) {
        const asset = (result as any).assets[0];
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
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          
          formData.append('file', blob, asset.name || 'document');
          formData.append('senderId', currentUserId);
          formData.append('receiverId', targetUserId);
          formData.append('type', 'file');

          const uploadResponse = await apiRequest<{ message: any }>('/direct/messages/media', {
            method: 'POST',
            body: formData,
          });

          if (uploadResponse.success && uploadResponse.data) {
            const newMsg = uploadResponse.data.message;
            
            // For web, use the URL directly
            let localFileUrl = getImageUrl(newMsg.fileUrl) || newMsg.fileUrl;
            
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

            // Send via socket for real-time delivery to receiver
            if (socketService.isConnected()) {
              try {
                socketService.sendDirectMessage({
                  senderId: newMsg.senderId,
                  receiverId: newMsg.receiverId,
                  content: newMsg.content,
                  type: newMsg.type,
                  fileUrl: newMsg.fileUrl,
                  fileName: newMsg.fileName,
                  fileSize: newMsg.fileSize,
                  duration: newMsg.duration,
                  messageId: newMsg.id, // Message already saved, just broadcast
                });
              } catch (socketError) {
                console.warn('[Socket] Failed to send media message via socket:', socketError);
              }
            }
          }
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError);
          setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
          alert('Error: ' + (uploadError.response?.data?.message || 'Failed to upload document.'));
        }
      }
    } catch (error) {
      console.error('Document picker error:', error);
      alert('Error: Failed to pick document. Please try again.');
    }
  };

  // Handle start recording voice note
  const handleStartRecording = async () => {
    if (!currentUserId || !targetUserId) {
      alert('Error: User not found. Please login again.');
      return;
    }

    try {
      // For web, we'll use the MediaRecorder API (getUserMedia handles permissions)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
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
          fileUrl: audioUrl,
          duration: durationString,
          status: 'sending',
        };

        setMessages((prev) => [...prev, tempMessage]);
        setRecordingDuration(0);

        // Upload audio to backend
        try {
          const formData = new FormData();
          const fileName = `voice-note-${Date.now()}.webm`;
          
          formData.append('file', audioBlob, fileName);
          formData.append('senderId', currentUserId!);
          formData.append('receiverId', targetUserId!);
          formData.append('type', 'audio');
          formData.append('duration', durationString);

          const response = await apiRequest<{ message: any }>('/direct/messages/media', {
            method: 'POST',
            body: formData,
          });

          if (response.success && response.data) {
            const newMsg = response.data.message;
            
            // For web, use the URL directly
            let localFileUrl = getImageUrl(newMsg.fileUrl) || newMsg.fileUrl;
            
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

            // Send via socket for real-time delivery to receiver
            if (socketService.isConnected()) {
              try {
                socketService.sendDirectMessage({
                  senderId: newMsg.senderId,
                  receiverId: newMsg.receiverId,
                  content: newMsg.content,
                  type: newMsg.type,
                  fileUrl: newMsg.fileUrl,
                  fileName: newMsg.fileName,
                  fileSize: newMsg.fileSize,
                  duration: newMsg.duration,
                  messageId: newMsg.id,
                });
              } catch (socketError) {
                console.warn('[Socket] Failed to send media message via socket:', socketError);
              }
            }
          }
        } catch (uploadError: any) {
          console.error('Upload error:', uploadError);
          setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
          alert('Error: ' + (uploadError.response?.data?.message || 'Failed to upload voice note.'));
        }

        stream.getTracks().forEach(track => track.stop());
      };

      recordingRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Error: Failed to start recording. Please try again.');
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

      (recordingRef.current as MediaRecorder).stop();
      recordingRef.current = null;
    } catch (error) {
      console.error('Error stopping recording:', error);
      alert('Error: Failed to stop recording. Please try again.');
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
      if (playingAudioId === messageId && soundRef.current) {
        // Stop playing
        soundRef.current.pause();
        soundRef.current = null;
        setPlayingAudioId(null);
        return;
      }

      // Stop any currently playing audio
      if (soundRef.current) {
        soundRef.current.pause();
        soundRef.current = null;
      }

      // Create new audio element (use HTMLAudioElement to avoid conflict with mock)
      const audio = new window.Audio(audioUrl);
      soundRef.current = audio;

      await audio.play();
      setPlayingAudioId(messageId);

      // Handle playback finish
      audio.onended = () => {
        setPlayingAudioId(null);
        soundRef.current = null;
      };
    } catch (error) {
      console.error('Error playing audio:', error);
      alert('Error: Failed to play voice note.');
    }
  };

  // Handle open document
  const handleOpenDocument = async (fileUrl: string, fileName?: string) => {
    try {
      // For web, just open in new tab or download
      const link = document.createElement('a');
      link.href = fileUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      if (fileName) {
        link.download = fileName;
      }
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      console.error('Error opening document:', error);
      alert('Error: ' + (error.message || 'Failed to open document.'));
    }
  };

  // Render message item
  const renderMessage = (item: Message) => {
    const isCurrentUser = item.senderId === currentUserId;
    const avatar = isCurrentUser ? currentUserAvatar : targetUser?.avatar || '';
    const isSelected = selectedMessages.has(item.id);
    const deletable = canDeleteMessage(item);

  return (
      <div
        key={item.id}
        className={`message-wrapper ${isCurrentUser ? 'message-wrapper-right' : 'message-wrapper-left'}`}
      >
        {isSelectionMode && deletable && (
          <button
            className="selection-checkbox"
            onClick={() => handleMessagePress(item)}
          >
            {isSelected && (
              <div className="selection-checkbox-selected">
                <Check size={16} color="#ffffff" />
          </div>
            )}
          </button>
        )}
        {!isCurrentUser && (
          <img
            src={getAvatarImageSource(getImageUrl(avatar))?.uri || getImageUrl(avatar) || ''}
            className="message-avatar"
            alt="User avatar"
          />
        )}
        <div className="message-content-wrapper">
          {!isCurrentUser && (
            <div className="message-sender-name">{targetUser?.username || 'User'}</div>
          )}
          <div
            className={`message-bubble ${isCurrentUser ? 'message-bubble-right' : 'message-bubble-left'} ${isSelected ? 'message-bubble-selected' : ''} ${(item.type === 'image' || item.type === 'video') ? 'message-bubble-media' : ''}`}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!isSelectionMode) handleMessageLongPress(item);
            }}
            onClick={() => {
              if (isSelectionMode) handleMessagePress(item);
            }}
          >
            {item.type === 'image' && item.fileUrl ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSelectionMode) {
                    handleMessagePress(item);
                    return;
                  }
                  setSelectedMedia(item);
                  setShowMediaModal(true);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isSelectionMode) handleMessageLongPress(item);
                }}
                className="media-thumb-container"
              >
                <img
                  src={getImageUrl(item.fileUrl) || item.fileUrl}
                  className="media-thumb-image"
                  alt="Message image"
                />
              </button>
            ) : item.type === 'video' && item.fileUrl ? (
              <button
                className="media-thumb-container"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSelectionMode) {
                    handleMessagePress(item);
                    return;
                  }
                  setSelectedMedia(item);
                  setShowMediaModal(true);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isSelectionMode) handleMessageLongPress(item);
                }}
              >
                <div className="video-thumb-fallback">
                  <Video size={44} color="rgba(167, 139, 250, 0.9)" />
              </div>
                <div className="video-play-overlay">
                  <Play size={34} color="#ffffff" />
            </div>
                {!!item.duration && (
                  <div className="video-duration-badge">
                    <div className="video-duration-text">{item.duration}</div>
              </div>
                )}
              </button>
            ) : item.type === 'audio' && item.fileUrl ? (
              <div className={`message-audio-container ${!isCurrentUser ? 'message-audio-container-left' : ''}`}>
                <button
                  onClick={() => {
                    if (isSelectionMode) {
                      handleMessagePress(item);
                      return;
                    }
                    handlePlayAudio(item.id, item.fileUrl!);
                  }}
                  className={`audio-play-button ${!isCurrentUser ? 'audio-play-button-left' : ''} ${playingAudioId === item.id ? 'audio-play-button-active' : ''} ${!isCurrentUser && playingAudioId === item.id ? 'audio-play-button-active-left' : ''}`}
                >
                  {playingAudioId === item.id ? (
                    <Pause size={16} color={isCurrentUser ? "#fff" : "#7C3AED"} />
                  ) : (
                    <Play size={16} color={isCurrentUser ? "#fff" : "#7C3AED"} style={{ marginLeft: 1 }} />
                  )}
                </button>
                <div className="audio-waveform-container">
                  <div className="audio-waveform">
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 4 }} />
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 18 }} />
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 8 }} />
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 22 }} />
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 6 }} />
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 20 }} />
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 10 }} />
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 16 }} />
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 4 }} />
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 14 }} />
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 8 }} />
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 20 }} />
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 6 }} />
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 18 }} />
                    <div className={`audio-wave ${!isCurrentUser ? 'audio-wave-left' : ''}`} style={{ height: 4 }} />
            </div>
              </div>
                <div className="audio-duration-container">
                  <div className={`audio-duration-text ${!isCurrentUser ? 'audio-duration-text-left' : ''}`}>
                    {item.duration || '0:00'}
            </div>
          </div>
        </div>
            ) : item.type === 'file' && item.fileUrl ? (
              <div className="message-file-container">
                <div className="file-icon-container">
                  <FileText size={28} color="#fff" />
      </div>
                <div className="file-info">
                  <div className="file-name">{item.fileName || item.content}</div>
                  {item.fileSize && <div className="file-size">{item.fileSize}</div>}
            </div>
                <button
                  onClick={() => {
                    if (isSelectionMode) {
                      handleMessagePress(item);
                      return;
                    }
                    handleOpenDocument(item.fileUrl!, item.fileName);
                  }}
                  className="file-action-button"
                >
                  <Download size={20} color="#fff" strokeWidth={2} />
                </button>
            </div>
            ) : (
              <div className="message-text">{item.content}</div>
            )}
            {(item.type === 'image' || item.type === 'video') ? (
              <div className="media-footer">
                <div className="message-footer-row">
                  <div className="message-time">{formatTime(item.timestamp)}</div>
                  {isCurrentUser && getStatusIcon(item)}
          </div>
              </div>
            ) : (
              <div className="message-footer-row">
                <div className="message-time">{formatTime(item.timestamp)}</div>
                {isCurrentUser && getStatusIcon(item)}
              </div>
            )}
          </div>
        </div>
        {isCurrentUser && (
          <img
            src={getAvatarImageSource(getImageUrl(avatar))?.uri || getImageUrl(avatar) || ''}
            className="message-avatar"
            alt="Your avatar"
          />
        )}
      </div>
    );
  };

  // Render media modal for viewing images/videos
  const renderMediaModal = () => (
    showMediaModal && (
      <div className="modal-overlay" onClick={() => {
        setShowMediaModal(false);
        setSelectedMedia(null);
      }}>
        <div className="media-modal-content" onClick={(e) => e.stopPropagation()}>
          {selectedMedia?.type === 'image' && selectedMedia.fileUrl && (
            <img
              src={getImageUrl(selectedMedia.fileUrl) || selectedMedia.fileUrl}
              className="media-modal-image"
              alt="Full size media"
            />
          )}
          {selectedMedia?.type === 'video' && selectedMedia.fileUrl && (
            <DirectVideoPlayer videoUri={getImageUrl(selectedMedia.fileUrl) || selectedMedia.fileUrl} />
          )}
                  <button
            className="media-modal-close"
            onClick={() => {
              setShowMediaModal(false);
              setSelectedMedia(null);
            }}
          >
            <X size={22} color="#fff" />
                  </button>

          {selectedMedia && currentUserId && (
            <div className="media-modal-actions">
                  <button
                className="media-modal-delete-button"
                onClick={() => {
                  const idToDelete = selectedMedia.id;
                  const isMine = selectedMedia.senderId === currentUserId;
                  
                  if (window.confirm('Delete this message?')) {
                    const deleteForEveryone = isMine && window.confirm('Delete for everyone? (Cancel for "Delete for me only")');
                    
                    const deleteMessage = async () => {
                      try {
                        await apiRequest('/direct/messages', {
                          method: 'DELETE',
                          body: JSON.stringify({ 
                            userId: currentUserId, 
                            messageIds: [idToDelete], 
                            scope: deleteForEveryone ? 'everyone' : 'me' 
                          }),
                          headers: { 'Content-Type': 'application/json' },
                        });
                        setMessages((prev) => prev.filter((m) => m.id !== idToDelete));
                      } catch (e: any) {
                        console.error('Error deleting message:', e);
                        alert('Error: ' + (e.response?.data?.message || e.message || 'Failed to delete message'));
                      } finally {
                        setShowMediaModal(false);
                        setSelectedMedia(null);
                      }
                    };
                    
                    deleteMessage();
                  }
                }}
              >
                <Trash2 size={18} color="#fff" />
                <div className="media-modal-delete-text">Delete</div>
                  </button>
            </div>
              )}
            </div>
      </div>
    )
  );

  const renderMoreMenu = () => (
    showMoreMenu && (
      <div className="modal-overlay" onClick={() => setShowMoreMenu(false)}>
        <div className="more-menu-container" onClick={(e) => e.stopPropagation()}>
                <button
            className="more-menu-item"
            onClick={() => {
              setShowMoreMenu(false);
              handleClearChatForMe();
            }}
          >
            <Trash2 size={18} color="#EF4444" />
            <div className="more-menu-text" style={{ color: '#EF4444' }}>Clear chat</div>
                </button>
          <button
            className="more-menu-item"
            onClick={() => {
              handleExportChat();
            }}
          >
            <div className="more-menu-text">Export chat (JSON)</div>
          </button>
            </div>
          </div>
    )
  );

  // Render attachment menu
  const renderAttachmentMenu = () => (
    showAttachmentMenu && (
      <div className="modal-overlay" onClick={() => setShowAttachmentMenu(false)}>
        <div className="attachment-menu" onClick={(e) => e.stopPropagation()}>
          <button className="attachment-option" onClick={handleTakePhoto}>
            <div className="attachment-icon" style={{ backgroundColor: '#7c3aed20' }}>
              <Camera size={24} color="#a78bfa" />
        </div>
            <div className="attachment-text">Camera</div>
          </button>
          <button className="attachment-option" onClick={handleSendImage}>
            <div className="attachment-icon" style={{ backgroundColor: '#7c3aed20' }}>
              <ImageIcon size={24} color="#a78bfa" />
      </div>
            <div className="attachment-text">Photo</div>
          </button>
          <button className="attachment-option" onClick={handleSendVideo}>
            <div className="attachment-icon" style={{ backgroundColor: '#2563eb20' }}>
              <Video size={24} color="#60a5fa" />
            </div>
            <div className="attachment-text">Video</div>
          </button>
          <button className="attachment-option" onClick={handleSendDocument}>
            <div className="attachment-icon" style={{ backgroundColor: '#06b6d420' }}>
              <FileText size={24} color="#06b6d4" />
            </div>
            <div className="attachment-text">Document</div>
          </button>
        </div>
      </div>
    )
  );

  if (loading) {
    return (
      <div className="container">
        <div className="loading-container">
          <div className="spinner"></div>
              </div>
            </div>
    );
  }

  if (!targetUser) {
                return (
      <div className="container">
        <div className="header">
          <button onClick={onBack} className="back-button">
            <ArrowLeft width={24} height={24} color="#fff" />
                      </button>
          <div className="header-title">Messages</div>
        </div>
        <div className="error-container">
          <div className="error-text">User not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="keyboard-avoiding-view">
        {/* Header */}
        <div className="header">
          {isSelectionMode ? (
            <>
              <button onClick={handleCancelSelection} className="back-button">
                <X width={24} height={24} color="#fff" />
              </button>
              <div className="header-info">
                <div className="selection-count">
                  {selectedMessages.size} selected
                </div>
              </div>
              {selectedMessages.size > 0 && (
                <button onClick={handleDeleteSelectedMessages} className="header-action-button">
                  <Trash2 width={22} height={22} color="#EF4444" />
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={onBack} className="back-button">
                <ArrowLeft width={24} height={24} color="#fff" />
              </button>
              <div className="header-info">
                <img
                  src={getAvatarImageSource(getImageUrl(targetUser.avatar))?.uri || getImageUrl(targetUser.avatar) || ''}
                  className="header-avatar"
                  alt={targetUser.username}
                />
                <div className="header-text-container">
                  <div className="header-title">{targetUser.username}</div>
                  <div className="header-subtitle">Direct message</div>
                          </div>
              </div>
              <button onClick={() => setShowMoreMenu(true)} className="header-action-button">
                <MoreVertical width={22} height={22} color="#fff" />
              </button>
            </>
                        )}
                      </div>

        {/* Messages List */}
        <div className="messages-list" ref={flatListRef}>
          {messages.length === 0 ? (
            <div className="empty-container">
              <div className="empty-text">No messages yet</div>
              <div className="empty-subtext">Start a conversation with {targetUser.username}</div>
            </div>
          ) : (
            messages.map(renderMessage)
          )}
          <div ref={messagesEndRef} />
                            </div>

        {/* Recording Banner */}
        {isRecording && (
          <div className="recording-banner">
            <div className="recording-indicator" />
            <div className="recording-text">
              Recording... {formatRecordingDuration(recordingDuration)}
                          </div>
            <button className="stop-recording-button" onClick={handleStopRecording}>
              <div className="stop-recording-text">Stop</div>
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="input-container">
                              <button
            className="attachment-button"
            onClick={() => setShowAttachmentMenu(true)}
                              >
            <Paperclip width={24} height={24} color="#a78bfa" />
                              </button>
          <textarea
            className="input"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            maxLength={1000}
            rows={1}
          />
                            <button
            className="voice-button"
            onClick={isRecording ? handleStopRecording : handleStartRecording}
          >
            <Mic width={20} height={20} color={isRecording ? "#EF4444" : "#a78bfa"} />
          </button>
          <button
            className={`send-button ${(!newMessage.trim() || sending) ? 'send-button-disabled' : ''}`}
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <div className="spinner-small"></div>
            ) : (
              <Send width={20} height={20} color="#fff" />
            )}
                            </button>
                          </div>
                        </div>
      {renderAttachmentMenu()}
      {renderMediaModal()}
      {renderMoreMenu()}
      
      <style>{`
        * {
          box-sizing: border-box;
        }
        
        .container {
          flex: 1;
          width: 100%;
          min-width: 0;
          max-width: 100%;
          background-color: #0B1020;
          height: 100vh;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          overflow: hidden;
        }
        
        .keyboard-avoiding-view {
          flex: 1;
          width: 100%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .loading-container {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(124, 58, 237, 0.3);
          border-radius: 50%;
          border-top-color: #7C3AED;
          animation: spin 1s linear infinite;
        }
        
        .spinner-small {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top-color: #ffffff;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .error-container {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        
        .error-text {
          color: #EF4444;
          font-size: 16px;
        }
        
        .header {
          display: flex;
          align-items: center;
          width: 100%;
          min-width: 0;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(139, 92, 246, 0.3);
          background-color: #0B1020;
          flex-shrink: 0;
        }
        
        .back-button {
          padding: 8px;
          margin-right: 8px;
          background: none;
          border: none;
          cursor: pointer;
        }
        
        .header-info {
          flex: 1;
          display: flex;
          align-items: center;
        }
        
        .header-avatar {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          margin-right: 12px;
          object-fit: cover;
        }
        
        .header-text-container {
          flex: 1;
        }
        
        .header-action-button {
          padding: 8px;
          margin-left: 8px;
          background: none;
          border: none;
          cursor: pointer;
        }
        
        .selection-count {
          color: #fff;
          font-size: 16px;
          font-weight: 600;
        }
        
        .header-title {
          color: #fff;
          font-size: 18px;
          font-weight: 600;
        }
        
        .header-subtitle {
          color: #9CA3AF;
          font-size: 12px;
          margin-top: 2px;
        }
        
        .messages-list {
          flex: 1;
          width: 100%;
          min-width: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 12px;
          padding-bottom: 8px;
          display: flex;
          flex-direction: column;
        }
        
        .empty-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 60px 0;
        }
        
        .empty-text {
          color: #9CA3AF;
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        
        .empty-subtext {
          color: #6B7280;
          font-size: 14px;
        }
        
        .message-wrapper {
          display: flex;
          margin: 4px 0;
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
        
        .message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          margin: 0 8px;
          margin-top: 4px;
          object-fit: cover;
        }
        
        .message-content-wrapper {
          flex-shrink: 1;
          max-width: 100%;
        }
        
        .selection-checkbox {
          width: 28px;
          height: 28px;
          border-radius: 14px;
          border: 2px solid rgba(167, 139, 250, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 10px;
          margin: 0 6px;
          background: none;
          cursor: pointer;
        }
        
        .selection-checkbox-selected {
          width: 22px;
          height: 22px;
          border-radius: 11px;
          background-color: #7C3AED;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .message-sender-name {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 4px;
          margin-left: 4px;
          color: #9CA3AF;
        }
        
        .message-bubble {
          padding: 10px 16px;
          border-radius: 18px;
        }
        
        .message-bubble-media {
          padding: 0;
          overflow: hidden;
        }
        
        .message-bubble-selected {
          border: 2px solid rgba(167, 139, 250, 0.9);
        }
        
        .message-bubble-left {
          background-color: rgba(139, 92, 246, 0.2);
          border-top-left-radius: 4px;
        }
        
        .message-bubble-right {
          background-color: #7C3AED;
          border-top-right-radius: 4px;
        }
        
        .message-text {
          color: #fff;
          font-size: 15px;
          line-height: 20px;
        }
        
        .message-time {
          color: rgba(255, 255, 255, 0.6);
          font-size: 11px;
          margin-top: 4px;
        }
        
        .message-footer-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 6px;
        }
        
        .input-container {
          display: flex;
          align-items: flex-end;
          width: 100%;
          min-width: 0;
          padding: 12px 16px;
          border-top: 1px solid rgba(139, 92, 246, 0.3);
          background-color: #0B1020;
          flex-shrink: 0;
        }
        
        .input {
          flex: 1;
          background-color: rgba(139, 92, 246, 0.1);
          border-radius: 20px;
          padding: 10px 16px;
          color: #fff;
          font-size: 15px;
          max-height: 100px;
          margin-right: 8px;
          border: none;
          resize: none;
          font-family: inherit;
          outline: none;
        }
        
        .send-button {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          background-color: #7C3AED;
          display: flex;
          justify-content: center;
          align-items: center;
          border: none;
          cursor: pointer;
        }
        
        .send-button-disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .attachment-button {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-right: 8px;
          background: none;
          border: none;
          cursor: pointer;
        }
        
        .media-thumb-container {
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 4px;
          background-color: rgba(255, 255, 255, 0.06);
          width: 100%;
          aspect-ratio: 4 / 3;
          border: none;
          padding: 0;
          cursor: pointer;
          position: relative;
        }
        
        .media-thumb-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .video-thumb-fallback {
          width: 100%;
          height: 100%;
          background-color: rgba(139, 92, 246, 0.12);
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .video-play-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .video-duration-badge {
          position: absolute;
          right: 8px;
          bottom: 8px;
          padding: 4px 8px;
          border-radius: 10px;
          background-color: rgba(0, 0, 0, 0.55);
        }
        
        .video-duration-text {
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
        }
        
        .media-footer {
          padding: 6px 12px 10px;
          align-items: flex-start;
        }
        
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.35);
          display: flex;
          justify-content: flex-start;
          align-items: flex-end;
          padding-top: 60px;
          padding-right: 12px;
          z-index: 1000;
        }
        
        .more-menu-container {
          background-color: #111827;
          border-radius: 12px;
          padding: 8px 0;
          width: 220px;
          border: 1px solid rgba(167, 139, 250, 0.25);
        }
        
        .more-menu-item {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          gap: 10px;
          width: 100%;
          background: none;
          border: none;
          cursor: pointer;
          color: inherit;
          font: inherit;
        }
        
        .more-menu-text {
          color: #E5E7EB;
          font-size: 14px;
          font-weight: 600;
        }
        
        .attachment-menu {
          background-color: #1E293B;
          border-top-left-radius: 20px;
          border-top-right-radius: 20px;
          padding: 20px;
          padding-bottom: 40px;
          display: flex;
          justify-content: space-around;
          flex-wrap: wrap;
          width: 100%;
        }
        
        .attachment-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 10px;
          width: 80px;
          background: none;
          border: none;
          cursor: pointer;
          color: inherit;
          font: inherit;
        }
        
        .attachment-icon {
          width: 60px;
          height: 60px;
          border-radius: 30px;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 8px;
        }
        
        .attachment-text {
          color: #fff;
          font-size: 12px;
          font-weight: 500;
          text-align: center;
        }
        
        .voice-button {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          margin-right: 8px;
          background: none;
          border: none;
          cursor: pointer;
        }
        
        .recording-banner {
          display: flex;
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
          animation: pulse 1s infinite;
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
          border: none;
          cursor: pointer;
        }
        
        .stop-recording-text {
          color: #ffffff;
          font-size: 12px;
          font-weight: 600;
        }
        
        .message-audio-container {
          display: flex;
          align-items: center;
          padding: 0;
          min-width: 200px;
          max-width: 280px;
        }
        
        .audio-play-button {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background-color: rgba(255, 255, 255, 0.25);
          display: flex;
          justify-content: center;
          align-items: center;
          margin-right: 12px;
          border: none;
          cursor: pointer;
        }
        
        .audio-play-button-left {
          background-color: rgba(124, 58, 237, 0.2);
        }
        
        .audio-play-button-active {
          background-color: rgba(255, 255, 255, 0.35);
        }
        
        .audio-play-button-active-left {
          background-color: rgba(124, 58, 237, 0.3);
        }
        
        .audio-waveform-container {
          flex: 1;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
          height: 32px;
        }
        
        .audio-waveform {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 22px;
          gap: 2.5px;
        }
        
        .audio-wave {
          width: 2.5px;
          background-color: rgba(255, 255, 255, 0.7);
          border-radius: 1.25px;
          min-height: 4px;
        }
        
        .audio-wave-left {
          background-color: rgba(124, 58, 237, 0.6);
        }
        
        .audio-duration-container {
          min-width: 45px;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 32px;
        }
        
        .audio-duration-text {
          color: rgba(255, 255, 255, 0.85);
          font-size: 12.5px;
          font-weight: 500;
          font-variant-numeric: tabular-nums;
          text-align: right;
        }
        
        .audio-duration-text-left {
          color: rgba(124, 58, 237, 0.9);
        }
        
        .message-file-container {
          display: flex;
          align-items: center;
          padding: 0;
          min-width: 200px;
          max-width: 280px;
        }
        
        .file-icon-container {
          width: 48px;
          height: 48px;
          border-radius: 8px;
          background-color: rgba(255, 255, 255, 0.15);
          display: flex;
          justify-content: center;
          align-items: center;
          margin-right: 12px;
          flex-shrink: 0;
        }
        
        .file-info {
          flex: 1;
          justify-content: center;
          min-width: 0;
        }
        
        .file-name {
          color: #fff;
          font-size: 15px;
          font-weight: 500;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .file-size {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
        }
        
        .file-action-button {
          width: 40px;
          height: 40px;
          border-radius: 20px;
          background-color: rgba(255, 255, 255, 0.15);
          display: flex;
          justify-content: center;
          align-items: center;
          margin-left: 8px;
          flex-shrink: 0;
          border: none;
          cursor: pointer;
        }
        
        .media-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.9);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
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
        
        .media-modal-video-player {
          width: 100%;
          height: 100%;
          background-color: #000;
          border-radius: 12px;
          overflow: hidden;
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
          align-items: center;
          background-color: rgba(239, 68, 68, 0.9);
          padding: 10px 14px;
          border-radius: 12px;
          border: none;
          cursor: pointer;
        }
        
        .media-modal-delete-text {
          color: #fff;
          font-size: 14px;
          font-weight: 700;
          margin-left: 8px;
        }
        
        .media-modal-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        
        .media-modal-close {
          position: absolute;
          top: 20px;
          right: 20px;
          padding: 12px;
          background-color: rgba(0, 0, 0, 0.7);
          border-radius: 8px;
          border: none;
          cursor: pointer;
        }
        
        .media-modal-close-text {
          color: #fff;
          font-size: 16px;
          font-weight: 600;
        }
      `}</style>
                  </div>
  );
};

export default PTPMessagingPage;