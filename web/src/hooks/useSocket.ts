/**
 * Custom React Hook for Socket.io Integration
 * 
 * Provides a clean interface for socket operations with automatic
 * connection management, event handling, and cleanup.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  socketService,
  ConnectionStatus,
  SocketMessage,
  SocketEventHandlers,
  TypingUser,
} from '../utils/socketService';

interface UseSocketOptions {
  userId: string | null;
  username: string | null;
  communityId: string | null;
  autoConnect?: boolean;
  onMessage?: (message: SocketMessage) => void;
  onUserJoined?: (data: { userId: string; username: string; avatar?: string; communityId: string }) => void;
  onUserLeft?: (data: { userId: string; username: string; communityId: string }) => void;
  onTypingChange?: (typingUsers: Map<string, string>) => void;
  onOnlineUsersChange?: (userIds: string[]) => void;
  onError?: (error: Error) => void;
}

interface UseSocketReturn {
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  typingUsers: Map<string, string>;
  onlineUsers: Set<string>;
  sendMessage: (content: string, options?: {
    type?: 'text' | 'image' | 'video' | 'audio' | 'file';
    replyTo?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: string;
    duration?: string;
  }) => void;
  startTyping: () => void;
  stopTyping: () => void;
  markAsRead: (messageIds: string[]) => void;
  deleteMessage: (messageId: string) => void;
  editMessage: (messageId: string, newContent: string) => void;
  addReaction: (messageId: string, emoji: string) => void;
  connect: () => void;
  disconnect: () => void;
}

export const useSocket = (options: UseSocketOptions): UseSocketReturn => {
  const {
    userId,
    username,
    communityId,
    autoConnect = true,
    onMessage,
    onUserJoined,
    onUserLeft,
    onTypingChange,
    onOnlineUsersChange,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Use refs to keep callbacks stable
  const callbacksRef = useRef({
    onMessage,
    onUserJoined,
    onUserLeft,
    onTypingChange,
    onOnlineUsersChange,
    onError,
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onMessage,
      onUserJoined,
      onUserLeft,
      onTypingChange,
      onOnlineUsersChange,
      onError,
    };
  }, [onMessage, onUserJoined, onUserLeft, onTypingChange, onOnlineUsersChange, onError]);

  // Connect to socket
  const connect = useCallback(() => {
    if (!userId || !username) {
      console.warn('[useSocket] Cannot connect: missing userId or username');
      return;
    }

    socketService.connect(userId, username, communityId || undefined);

    if (communityId) {
      socketService.joinCommunity(communityId);
    }
  }, [userId, username, communityId]);

  // Disconnect from socket
  const disconnect = useCallback(() => {
    if (communityId) {
      socketService.leaveCommunity(communityId);
    }
    socketService.disconnect();
  }, [communityId]);

  // Set up event handlers
  useEffect(() => {
    const handlers: SocketEventHandlers = {
      onConnect: () => {
        setIsConnected(true);
        setConnectionStatus('connected');
      },

      onDisconnect: () => {
        setIsConnected(false);
        setConnectionStatus('disconnected');
      },

      onConnectionStatusChange: (status) => {
        setConnectionStatus(status);
        setIsConnected(status === 'connected');
      },

      onNewMessage: (message) => {
        callbacksRef.current.onMessage?.(message);
      },

      onUserJoined: (data) => {
        setOnlineUsers((prev) => {
          const newSet = new Set(prev);
          newSet.add(data.userId);
          return newSet;
        });
        callbacksRef.current.onUserJoined?.(data);
      },

      onUserLeft: (data) => {
        setOnlineUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(data.userId);
          return newSet;
        });
        setTypingUsers((prev) => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          return newMap;
        });
        callbacksRef.current.onUserLeft?.(data);
      },

      onOnlineUsers: (data) => {
        setOnlineUsers(new Set(data.users));
        callbacksRef.current.onOnlineUsersChange?.(data.users);
      },

      onUserTyping: (data: TypingUser) => {
        if (data.userId === userId) return; // Don't show own typing
        
        setTypingUsers((prev) => {
          const newMap = new Map(prev);
          newMap.set(data.userId, data.username);
          callbacksRef.current.onTypingChange?.(newMap);
          return newMap;
        });
      },

      onUserStoppedTyping: (data) => {
        setTypingUsers((prev) => {
          const newMap = new Map(prev);
          newMap.delete(data.userId);
          callbacksRef.current.onTypingChange?.(newMap);
          return newMap;
        });
      },

      onError: (error) => {
        callbacksRef.current.onError?.(error);
      },
    };

    socketService.setEventHandlers(handlers);

    return () => {
      socketService.clearEventHandlers();
    };
  }, [userId]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && userId && username) {
      connect();
    }

    return () => {
      if (communityId) {
        socketService.stopTyping(communityId);
        socketService.leaveCommunity(communityId);
      }
    };
  }, [autoConnect, userId, username, communityId, connect]);

  // Send message
  const sendMessage = useCallback(
    (
      content: string,
      options?: {
        type?: 'text' | 'image' | 'video' | 'audio' | 'file';
        replyTo?: string;
        fileUrl?: string;
        fileName?: string;
        fileSize?: string;
        duration?: string;
      }
    ) => {
      if (!communityId) {
        console.warn('[useSocket] Cannot send message: no community ID');
        return;
      }

      socketService.sendMessage({
        communityId,
        content,
        ...options,
      });
    },
    [communityId]
  );

  // Typing indicators
  const startTyping = useCallback(() => {
    if (communityId) {
      socketService.startTyping(communityId);
    }
  }, [communityId]);

  const stopTyping = useCallback(() => {
    if (communityId) {
      socketService.stopTyping(communityId);
    }
  }, [communityId]);

  // Mark messages as read
  const markAsRead = useCallback(
    (messageIds: string[]) => {
      if (communityId && messageIds.length > 0) {
        socketService.markMessagesRead(communityId, messageIds);
      }
    },
    [communityId]
  );

  // Delete message
  const deleteMessage = useCallback(
    (messageId: string) => {
      if (communityId) {
        socketService.deleteMessage(messageId, communityId);
      }
    },
    [communityId]
  );

  // Edit message
  const editMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (communityId) {
        socketService.editMessage(messageId, communityId, newContent);
      }
    },
    [communityId]
  );

  // Add reaction
  const addReaction = useCallback(
    (messageId: string, emoji: string) => {
      if (communityId) {
        socketService.addReaction(messageId, communityId, emoji);
      }
    },
    [communityId]
  );

  return {
    isConnected,
    connectionStatus,
    typingUsers,
    onlineUsers,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
    deleteMessage,
    editMessage,
    addReaction,
    connect,
    disconnect,
  };
};

export default useSocket;

