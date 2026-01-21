/**
 * Socket.io Service for Real-time Communication
 * 
 * Professional practices implementation:
 * - Singleton pattern for connection management
 * - Automatic reconnection with exponential backoff
 * - Event listeners cleanup
 * - Connection state management
 * - Type-safe event handling
 * - Error handling and logging
 */

import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { API_CONFIG } from './api';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface SocketUser {
  userId: string;
  username: string;
  avatar?: string;
}

export interface SocketMessage {
  id: string;
  _id?: string; // MongoDB ObjectId
  communityId: string;
  userId: string;
  username: string;
  avatar: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  duration?: string;
  timestamp: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  replyTo?: {
    id: string;
    content: string;
    type: string;
    username: string;
  } | null;
  reactions?: {
    emoji: string;
    users: string[];
    count: number;
  }[];
}

export interface DirectSocketMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: string;
  duration?: string;
  timestamp: string;
  isRead?: boolean;
}

export interface TypingUser {
  userId: string;
  username: string;
  communityId: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface NotificationData {
  id: string;
  senderId: string;
  sender: {
    id: string;
    username: string;
    name: string;
    picture?: string;
  };
  receiverId: string | null;
  targetGroupId: string | null;
  type: string;
  title: string;
  message: string;
  payload: any;
  isRead: boolean;
  createdAt: string;
}

export interface SocketEventHandlers {
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onReconnect?: (attemptNumber: number) => void;
  onError?: (error: Error) => void;
  onNewMessage?: (message: SocketMessage) => void;
  onNewDirectMessage?: (message: DirectSocketMessage) => void;
  onNotification?: (notification: NotificationData) => void;
  onNotificationSync?: (data: { notifications: NotificationData[] }) => void;
  onDirectMessageDeleted?: (data: { messageIds: string[]; scope?: 'me' | 'everyone'; userId?: string }) => void;
  onDirectMessageDelivered?: (data: { messageId: string; receiverId: string; timestamp?: number }) => void;
  onDirectMessageRead?: (data: { messageIds: string[]; readerId: string; timestamp?: number }) => void;
  onDirectChatCleared?: (data: { userId: string; targetUserId: string; timestamp?: number }) => void;
  onUserJoined?: (user: SocketUser & { communityId: string }) => void;
  onUserLeft?: (user: SocketUser & { communityId: string }) => void;
  onUserTyping?: (data: TypingUser) => void;
  onUserStoppedTyping?: (data: { userId: string; communityId: string }) => void;
  onOnlineUsers?: (data: { communityId: string; users: string[] }) => void;
  onMessageDeleted?: (data: {
    communityId: string;
    messageId?: string;
    messageIds?: string[];
    scope?: 'me' | 'everyone';
    userId?: string;
    cleared?: boolean;
  }) => void;
  onMessageEdited?: (data: { messageId: string; communityId: string; newContent: string; isEdited: boolean }) => void;
  onMessagesReadReceipt?: (data: { userId: string; messageIds: string[]; communityId: string; statusUpdates?: any[] }) => void;
  onMessageStatusUpdate?: (data: { messageId: string; status: string; readBy: any[]; readCount: number; totalRecipients: number }) => void;
  onReactionUpdated?: (data: { messageId: string; communityId: string; reactions: any[] }) => void;
  onConnectionStatusChange?: (status: ConnectionStatus) => void;
  onChunkedMediaStart?: (data: { messageId: string; fileName: string; fileType: string; totalChunks: number; fileSize: number }) => void;
  onChunkedMediaChunk?: (data: { messageId: string; chunkIndex: number; chunk: string; isLastChunk: boolean }) => void;
  onChunkedMediaComplete?: (data: { messageId: string; fileUrl: string }) => void;
  onMessageModerationUpdate?: (data: { messageId: string; communityId: string; content: string; moderationCategory: string; hasWarning: boolean }) => void;
}

// ============================================
// SOCKET SERVICE CLASS
// ============================================

class SocketService {
  private static instance: SocketService;
  private socket: Socket | null = null;
  private eventHandlers: SocketEventHandlers = {};
  private currentUserId: string | null = null;
  private currentUsername: string | null = null;
  private currentCommunityId: string | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private typingTimeout: NodeJS.Timeout | null = null;
  private isTyping: boolean = false;

  private constructor() {}

  // Singleton pattern
  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  // Get socket URL based on environment
  private getSocketUrl(): string {
    const { COMPUTER_IP, SERVER_PORT, IS_PHYSICAL_DEVICE } = API_CONFIG;
    
    if (__DEV__) {
      if (IS_PHYSICAL_DEVICE) {
        return `http://${COMPUTER_IP}:${SERVER_PORT}`;
      } else {
        if (Platform.OS === 'android') {
          return `http://10.0.2.2:${SERVER_PORT}`;
        } else {
          return `http://localhost:${SERVER_PORT}`;
        }
      }
    }
    return 'https://your-production-api.com'; // Production URL
  }

  // Initialize socket connection
  public connect(userId: string, username: string, communityId?: string): void {
    if (this.socket?.connected && this.currentUserId === userId) {
      console.log('[Socket] Already connected');
      if (communityId && this.currentCommunityId !== communityId) {
        this.joinCommunity(communityId);
      }
      return;
    }

    this.currentUserId = userId;
    this.currentUsername = username;
    this.updateConnectionStatus('connecting');

    const socketUrl = this.getSocketUrl();
    console.log('[Socket] Connecting to:', socketUrl);

    this.socket = io(socketUrl, {
      auth: {
        userId,
        username,
        communityId,
      },
      transports: ['polling', 'websocket'], // Try polling first, then websocket
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
      autoConnect: true,
      forceNew: true, // Force new connection
      upgrade: true, // Allow upgrade from polling to websocket
    });

    this.setupEventListeners();
  }

  // Setup socket event listeners
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('[Socket] ✅ Connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.updateConnectionStatus('connected');
      this.eventHandlers.onConnect?.();
      
      // Rejoin community if was connected before
      if (this.currentCommunityId) {
        this.joinCommunity(this.currentCommunityId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] ❌ Disconnected:', reason);
      this.updateConnectionStatus('disconnected');
      this.eventHandlers.onDisconnect?.(reason);
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('[Socket] Connection error:', error.message);
      console.error('[Socket] Error details:', {
        type: error.type,
        description: error.description,
        context: error.context,
        transport: error.transport,
      });
      
      // Log more details if available
      if (error.data) {
        console.error('[Socket] Error data:', error.data);
      }
      
      this.updateConnectionStatus('error');
      this.eventHandlers.onError?.(error);
    });
    
    // Listen for transport errors
    this.socket.io.on('error', (error: any) => {
      console.error('[Socket] IO error:', error);
    });
    
    // Listen for transport upgrade
    (this.socket.io as any).on('upgrade', (transport: any) => {
      console.log('[Socket] Transport upgraded to:', transport.name);
    });
    
    // Listen for transport upgrade errors (will continue with polling)
    (this.socket.io as any).on('upgradeError', (error: any) => {
      console.warn('[Socket] Upgrade error (will continue with polling):', error.message || error);
    });

    this.socket.io.on('reconnect_attempt', (attemptNumber) => {
      console.log('[Socket] Reconnecting... Attempt:', attemptNumber);
      this.reconnectAttempts = attemptNumber;
      this.updateConnectionStatus('reconnecting');
    });

    this.socket.io.on('reconnect', (attemptNumber) => {
      console.log('[Socket] ✅ Reconnected after', attemptNumber, 'attempts');
      this.reconnectAttempts = 0;
      this.updateConnectionStatus('connected');
      this.eventHandlers.onReconnect?.(attemptNumber);
    });

    this.socket.io.on('reconnect_failed', () => {
      console.error('[Socket] ❌ Reconnection failed after', this.maxReconnectAttempts, 'attempts');
      this.updateConnectionStatus('error');
    });

    // Community events
    this.socket.on('joined_community', (data) => {
      console.log('[Socket] Joined community:', data);
      this.currentCommunityId = data.communityId;
    });

    this.socket.on('user_joined', (data) => {
      console.log('[Socket] User joined:', data.username);
      this.eventHandlers.onUserJoined?.(data);
    });

    this.socket.on('user_left', (data) => {
      console.log('[Socket] User left:', data.username);
      this.eventHandlers.onUserLeft?.(data);
    });

    this.socket.on('online_users', (data) => {
      console.log('[Socket] Online users:', data.users?.length);
      this.eventHandlers.onOnlineUsers?.(data);
    });

    // Message events - Real-time broadcast from server
    this.socket.on('new_message', (message: SocketMessage) => {
      console.log('[Socket] 📨 Received broadcast new_message from:', message.username);
      console.log('[Socket] Message ID:', message.id, '| Content:', message.content?.substring(0, 30));
      this.eventHandlers.onNewMessage?.(message);
    });

    // Direct message events - Real-time direct messaging
    this.socket.on('new_direct_message', (message: DirectSocketMessage) => {
      console.log('[Socket] 💬 Received new_direct_message:', message.id);
      console.log('[Socket] From:', message.senderId, '| To:', message.receiverId, '| Content:', message.content?.substring(0, 30));
      this.eventHandlers.onNewDirectMessage?.(message);
    });

    // Direct message deletion events
    this.socket.on('direct_message_deleted', (data) => {
      console.log('[Socket] 🗑️ Received direct_message_deleted:', data?.messageIds?.length || 0);
      this.eventHandlers.onDirectMessageDeleted?.(data);
    });

    this.socket.on('direct_message_delivered', (data) => {
      this.eventHandlers.onDirectMessageDelivered?.(data);
    });

    this.socket.on('direct_message_read', (data) => {
      this.eventHandlers.onDirectMessageRead?.(data);
    });

    this.socket.on('direct_chat_cleared', (data) => {
      this.eventHandlers.onDirectChatCleared?.(data);
    });

    // Confirmation that message was sent successfully
    this.socket.on('message_sent', (data) => {
      console.log('[Socket] ✅ Message sent confirmation:', data.messageId);
    });

    // Confirmation that direct message was sent successfully
    this.socket.on('direct_message_sent', (data) => {
      console.log('[Socket] ✅ Direct message sent confirmation:', data.messageId);
    });

    this.socket.on('message_deleted', (data) => {
      console.log('[Socket] Message deleted:', data?.messageId || (data?.messageIds?.length ? `${data.messageIds.length} ids` : 'unknown'));
      this.eventHandlers.onMessageDeleted?.(data);
    });

    this.socket.on('message_edited', (data) => {
      console.log('[Socket] Message edited:', data.messageId);
      this.eventHandlers.onMessageEdited?.(data);
    });

    this.socket.on('messages_read_receipt', (data) => {
      this.eventHandlers.onMessagesReadReceipt?.(data);
    });

    this.socket.on('message_status_update', (data) => {
      this.eventHandlers.onMessageStatusUpdate?.(data);
    });

    // Typing events
    this.socket.on('user_typing', (data: TypingUser) => {
      this.eventHandlers.onUserTyping?.(data);
    });

    this.socket.on('user_stopped_typing', (data) => {
      this.eventHandlers.onUserStoppedTyping?.(data);
    });

    // Reaction events
    this.socket.on('reaction_updated', (data) => {
      this.eventHandlers.onReactionUpdated?.(data);
    });

    // Error event
    this.socket.on('error', (error) => {
      const errorMessage = error?.message || (error as any)?.message || 'Socket error';
      // Don't log inappropriate messages as errors - they're handled by the UI
      if (errorMessage.includes('Inappropriate message') || errorMessage === 'Inappropriate message') {
        // Just pass to handler without logging
        this.eventHandlers.onError?.(new Error(errorMessage));
        return;
      }
      // Only log actual errors
      console.error('[Socket] Error:', error);
      this.eventHandlers.onError?.(new Error(errorMessage));
    });

    // Pong response (connection health)
    this.socket.on('pong', (data) => {
      const latency = Date.now() - data.timestamp;
      console.log('[Socket] Pong received, latency:', latency, 'ms');
    });

    // Chunked media events
    this.socket.on('chunked_media_start', (data) => {
      console.log('[Socket] 📦 Chunked media start:', data.messageId);
      this.eventHandlers.onChunkedMediaStart?.(data);
    });

    this.socket.on('chunked_media_chunk', (data) => {
      this.eventHandlers.onChunkedMediaChunk?.(data);
    });

    this.socket.on('chunked_media_complete', (data) => {
      console.log('[Socket] ✅ Chunked media complete:', data.messageId);
      this.eventHandlers.onChunkedMediaComplete?.(data);
    });

    this.socket.on('message_moderation_update', (data) => {
      console.log('[Socket] 🛡️ Message moderation update:', data.messageId, data.moderationCategory);
      this.eventHandlers.onMessageModerationUpdate?.(data);
    });

    // Notification events
    this.socket.on('notification:new', (notification: NotificationData) => {
      console.log('[Socket] 🔔 New notification:', notification.type, notification.title);
      this.eventHandlers.onNotification?.(notification);
    });

    this.socket.on('notification:sync', (data: { notifications: NotificationData[] }) => {
      console.log('[Socket] 🔔 Synced notifications:', data.notifications.length);
      this.eventHandlers.onNotificationSync?.(data);
    });
  }

  // Update connection status
  private updateConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.eventHandlers.onConnectionStatusChange?.(status);
  }

  // Set event handlers
  public setEventHandlers(handlers: SocketEventHandlers): void {
    this.eventHandlers = { ...this.eventHandlers, ...handlers };
  }

  // Remove specific event handler
  public removeEventHandler(event: keyof SocketEventHandlers): void {
    delete this.eventHandlers[event];
  }

  // Clear all event handlers
  public clearEventHandlers(): void {
    this.eventHandlers = {};
  }

  // Join a community room
  public joinCommunity(communityId: string): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Cannot join community - not connected');
      return;
    }

    console.log('[Socket] Joining community:', communityId);
    this.socket.emit('join_community', { communityId });
    this.currentCommunityId = communityId;
  }

  // Leave a community room
  public leaveCommunity(communityId?: string): void {
    const targetCommunityId = communityId || this.currentCommunityId;
    if (!this.socket?.connected || !targetCommunityId) return;

    console.log('[Socket] Leaving community:', targetCommunityId);
    this.socket.emit('leave_community', { communityId: targetCommunityId });
    
    if (this.currentCommunityId === targetCommunityId) {
      this.currentCommunityId = null;
    }
  }

  // Send a message via socket emit (server will broadcast to all)
  public sendMessage(data: {
    communityId: string;
    content: string;
    type?: 'text' | 'image' | 'video' | 'audio' | 'file';
    replyTo?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: string;
    duration?: string;
  }): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Cannot send message - not connected');
      throw new Error('Socket not connected');
    }

    // Stop typing indicator when sending
    this.stopTyping(data.communityId);

    const messagePayload = {
      ...data,
      type: data.type || 'text',
    };

    console.log('[Socket] 📤 Emitting send_message:', {
      communityId: data.communityId,
      content: data.content?.substring(0, 30) + '...',
      type: messagePayload.type,
    });

    // Emit to server - server will save to DB and broadcast to all users in room
    this.socket.emit('send_message', messagePayload);
  }

  // Send a direct message via socket emit (server will send to specific receiver)
  public sendDirectMessage(data: {
    senderId: string;
    receiverId: string;
    content: string;
    type?: 'text' | 'image' | 'video' | 'audio' | 'file';
    fileUrl?: string;
    fileName?: string;
    fileSize?: string;
    duration?: string;
    messageId?: string; // For messages already saved via REST API (media uploads)
  }): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Cannot send direct message - not connected');
      throw new Error('Socket not connected');
    }

    const messagePayload = {
      ...data,
      type: data.type || 'text',
    };

    console.log('[Socket] 💬 Emitting send_direct_message:', {
      senderId: data.senderId,
      receiverId: data.receiverId,
      content: data.content?.substring(0, 30) + '...',
      type: messagePayload.type,
      messageId: data.messageId,
    });

    // Emit to server - server will save to DB (if not messageId) and emit to receiver
    this.socket.emit('send_direct_message', messagePayload);
  }

  // ============================================
  // CHUNKED MEDIA EMIT HELPERS (COMMUNITY CHAT)
  // ============================================

  public sendChunkedMediaStart(data: {
    messageId: string;
    communityId: string;
    fileName: string;
    fileType: 'image' | 'video';
    totalChunks: number;
    fileSize: number;
  }): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Cannot send chunked_media_start - not connected');
      throw new Error('Socket not connected');
    }

    this.socket.emit('chunked_media_start', data);
  }

  public sendChunkedMediaChunk(data: {
    messageId: string;
    communityId: string;
    chunkIndex: number;
    chunk: string;
    isLastChunk: boolean;
  }): void {
    if (!this.socket?.connected) {
      console.warn('[Socket] Cannot send chunked_media_chunk - not connected');
      throw new Error('Socket not connected');
    }

    // Server currently ignores communityId here, but we include it for clarity/future-proofing.
    this.socket.emit('chunked_media_chunk', data);
  }

  // Start typing indicator
  public startTyping(communityId: string): void {
    if (!this.socket?.connected || this.isTyping) return;

    this.isTyping = true;
    this.socket.emit('typing_start', { communityId });

    // Auto-stop typing after 3 seconds of no input
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    this.typingTimeout = setTimeout(() => {
      this.stopTyping(communityId);
    }, 3000);
  }

  // Stop typing indicator
  public stopTyping(communityId: string): void {
    if (!this.socket?.connected || !this.isTyping) return;

    this.isTyping = false;
    this.socket.emit('typing_stop', { communityId });

    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
  }

  // Mark messages as read
  public markMessagesRead(communityId: string, messageIds: string[]): void {
    if (!this.socket?.connected || messageIds.length === 0) return;

    this.socket.emit('messages_read', { communityId, messageIds });
  }

  // Delete a message
  public deleteMessage(messageId: string, communityId: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit('delete_message', { messageId, communityId });
  }

  // Edit a message
  public editMessage(messageId: string, communityId: string, newContent: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit('edit_message', { messageId, communityId, newContent });
  }

  // Add reaction to a message
  public addReaction(messageId: string, communityId: string, emoji: string): void {
    if (!this.socket?.connected) return;

    this.socket.emit('add_reaction', { messageId, communityId, emoji });
  }

  // Ping server (connection health check)
  public ping(): void {
    if (!this.socket?.connected) return;

    this.socket.emit('ping');
  }

  // Get connection status
  public getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  // Check if connected
  public isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  // Get current community ID
  public getCurrentCommunityId(): string | null {
    return this.currentCommunityId;
  }

  // Public methods for socket event listeners (for one-time listeners)
  public on(event: string, listener: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.on(event, listener);
    }
  }

  public off(event: string, listener?: (...args: any[]) => void): void {
    if (this.socket) {
      if (listener) {
        this.socket.off(event, listener);
      } else {
        this.socket.off(event);
      }
    }
  }

  // Disconnect socket
  public disconnect(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    if (this.currentCommunityId) {
      this.leaveCommunity(this.currentCommunityId);
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.currentUserId = null;
    this.currentUsername = null;
    this.currentCommunityId = null;
    this.isTyping = false;
    this.updateConnectionStatus('disconnected');

    console.log('[Socket] Disconnected and cleaned up');
  }
}

// Export singleton instance
export const socketService = SocketService.getInstance();

// Export class for testing purposes
export default SocketService;

