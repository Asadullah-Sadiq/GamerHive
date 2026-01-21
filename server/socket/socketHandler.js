/**
 * Socket.io Handler for Community Chat
 * Professional practices implementation including:
 * - Room management for communities
 * - Real-time messaging
 * - Typing indicators
 * - Online status tracking
 * - Message read receipts
 * - Error handling and reconnection support
 */

const Message = require('../models/Message');
const DirectMessage = require('../models/DirectMessage');
const User = require('../models/User');
const Community = require('../models/Community');
const {
  registerUserSocket,
  unregisterUserSocket,
  syncNotificationsOnReconnect,
} = require('../utils/notificationService');

// In-memory store for online users (use Redis in production for scalability)
const onlineUsers = new Map(); // Map<communityId, Set<userId>>
const userSockets = new Map(); // Map<socketId, { userId, communityId }>
const typingUsers = new Map(); // Map<communityId, Map<userId, timeout>>

/**
 * Initialize socket handlers
 * @param {Server} io - Socket.io server instance
 */
const initializeSocketHandlers = (io) => {
  // Middleware for socket authentication
  io.use(async (socket, next) => {
    try {
      const { userId, username, communityId } = socket.handshake.auth;
      
      if (!userId) {
        return next(new Error('Authentication required: userId missing'));
      }
      
      // Verify user exists
      const user = await User.findById(userId).select('username picture');
      if (!user) {
        return next(new Error('User not found'));
      }
      
      // Attach user info to socket
      socket.userId = userId;
      socket.username = user.username || username;
      socket.userAvatar = user.picture;
      socket.communityId = communityId;
      
      // Register user socket for notifications
      registerUserSocket(userId.toString(), socket.id);
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

    io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} | User: ${socket.username} (${socket.userId})`);

    // Sync notifications on connect
    if (socket.userId) {
      syncNotificationsOnReconnect(socket.userId.toString(), socket.id);
    }

    // Handle joining a community room
    socket.on('join_community', async (data) => {
      try {
        const { communityId } = data;
        
        if (!communityId) {
          socket.emit('error', { message: 'Community ID is required' });
          return;
        }

        // Verify community exists
        const community = await Community.findById(communityId);
        if (!community) {
          socket.emit('error', { message: 'Community not found' });
          return;
        }

        // Leave previous community room if any
        if (socket.currentCommunity) {
          socket.leave(socket.currentCommunity);
          removeUserFromCommunity(socket.currentCommunity, socket.userId);
          io.to(socket.currentCommunity).emit('user_left', {
            userId: socket.userId,
            username: socket.username,
            communityId: socket.currentCommunity,
          });
        }

        // Join new community room
        socket.join(communityId);
        socket.join(`community:${communityId}`); // For notifications
        socket.currentCommunity = communityId;
        
        // Track user in community
        addUserToCommunity(communityId, socket.userId);
        userSockets.set(socket.id, { userId: socket.userId, communityId });

        // Get updated online users list (including the newly joined user)
        const onlineInCommunity = getOnlineUsersInCommunity(communityId);

        // Notify room about new user (broadcast to all users in the community)
        io.to(communityId).emit('user_joined', {
          userId: socket.userId,
          username: socket.username,
          avatar: socket.userAvatar,
          communityId,
        });

        // Broadcast updated online users list to ALL users in the community (including the joining user)
        io.to(communityId).emit('online_users', {
          communityId,
          users: onlineInCommunity,
        });

        // Update active members count
        await updateActiveMembersCount(communityId);

        console.log(`👥 User ${socket.username} joined community ${communityId}`);
        
        socket.emit('joined_community', {
          success: true,
          communityId,
          message: `Joined community successfully`,
        });

      } catch (error) {
        console.error('Error joining community:', error);
        socket.emit('error', { message: 'Failed to join community' });
      }
    });

    // Handle leaving a community room
    socket.on('leave_community', async (data) => {
      try {
        const { communityId } = data;
        
        if (socket.currentCommunity === communityId) {
          socket.leave(communityId);
          removeUserFromCommunity(communityId, socket.userId);
          
          // Get updated online users list (after removing the user)
          const onlineInCommunity = getOnlineUsersInCommunity(communityId);
          
          // Broadcast user left event to all users in the community
          io.to(communityId).emit('user_left', {
            userId: socket.userId,
            username: socket.username,
            communityId,
          });

          // Broadcast updated online users list to ALL users in the community
          io.to(communityId).emit('online_users', {
            communityId,
            users: onlineInCommunity,
          });

          await updateActiveMembersCount(communityId);
          
          socket.currentCommunity = null;
          console.log(`👋 User ${socket.username} left community ${communityId}`);
        }
      } catch (error) {
        console.error('Error leaving community:', error);
      }
    });

    // Handle new message
    socket.on('send_message', async (data) => {
      try {
        const { communityId, content, type = 'text', replyTo, fileUrl, fileName, fileSize, duration } = data;

        if (!communityId || !content) {
          socket.emit('error', { message: 'Community ID and content are required' });
          return;
        }

        // Create message in database immediately (optimistic UI - show message right away)
        const message = new Message({
          communityId,
          userId: socket.userId,
          content,
          type,
          fileUrl,
          fileName,
          fileSize,
          duration,
          replyTo: replyTo || null,
        });

        await message.save();

        // Populate user details
        await message.populate('userId', 'username picture');
        
        // Populate reply message if exists
        if (replyTo) {
          await message.populate({
            path: 'replyTo',
            select: 'content type userId',
            populate: {
              path: 'userId',
              select: 'username',
            },
          });
        }

        // Get all community members to calculate status
        const allMembers = await User.find({
          joinedCommunities: communityId,
        }).select('_id').lean();
        
        const memberIds = allMembers.map(m => m._id.toString());
        const senderId = socket.userId.toString();
        const totalRecipients = memberIds.length - (memberIds.includes(senderId) ? 1 : 0);
        const readByUserIds = (message.readBy || []).map(r => r.userId?.toString() || r.userId);
        const readCount = readByUserIds.filter(id => id !== senderId).length;
        
        // Calculate status
        let status = 'sent';
        if (readCount >= totalRecipients && totalRecipients > 0) {
          status = 'read';
        } else if (readCount > 0) {
          status = 'delivered';
        }

        const messageData = {
          id: message._id.toString(),
          _id: message._id.toString(),
          communityId,
          userId: socket.userId,
          username: message.userId?.username || socket.username,
          avatar: message.userId?.picture || socket.userAvatar || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
          content: message.content,
          type: message.type,
          fileUrl: message.fileUrl,
          fileName: message.fileName,
          fileSize: message.fileSize,
          duration: message.duration,
          timestamp: message.createdAt,
          status: status,
          readBy: message.readBy || [],
          readCount: readCount,
          totalRecipients: totalRecipients,
          replyTo: message.replyTo ? {
            id: message.replyTo._id,
            content: message.replyTo.content,
            type: message.replyTo.type,
            username: message.replyTo.userId?.username || 'Unknown',
          } : null,
        };

        // Broadcast message to ALL users in the community room (including sender)
        // This enables real-time messaging - all connected users receive the message instantly
        const roomSize = io.sockets.adapter.rooms.get(communityId)?.size || 0;
        console.log(`📡 Broadcasting new_message to ${roomSize} users in room ${communityId}`);
        
        // Emit to all users in the room (including sender for consistency)
        io.to(communityId).emit('new_message', messageData);
        
        // Also emit status update to sender so they see the initial status
        socket.emit('message_status_update', {
          messageId: messageData.id,
          status: messageData.status,
          readBy: messageData.readBy,
          readCount: messageData.readCount,
          totalRecipients: messageData.totalRecipients,
        });

        // Also send confirmation back to sender (with message ID for chunked streaming)
        socket.emit('message_sent', {
          success: true,
          messageId: messageData.id,
          timestamp: messageData.timestamp,
          type: messageData.type,
        });

        // Clear typing indicator for this user
        clearTypingIndicator(communityId, socket.userId, io);

        // Notify community members about new message (via notification service)
        const { notifyCommunityMessage } = require('../utils/notificationService');
        notifyCommunityMessage(communityId, socket.userId, messageData.id, messageData.content).catch((err) => {
          console.error('[Socket] Error notifying community message:', err);
        });

        console.log(`✅ Message broadcast complete: "${messageData.content?.substring(0, 30)}..." by ${socket.username} to ${roomSize} users`);

        // Check moderation asynchronously after message is sent (don't block response)
        if (type === 'text' && content) {
          // Run moderation check in background
          setImmediate(async () => {
            try {
              const { classifyContent } = require('../utils/geminiModeration');
              console.log('[Content Moderation] Checking message asynchronously:', content.substring(0, 50) + '...');
              
              const moderationResult = await classifyContent(content);
              
              console.log('[Content Moderation] Result:', {
                messageId: message._id.toString(),
                category: moderationResult.category,
                isHarmful: moderationResult.isHarmful,
                isMildInsult: moderationResult.isMildInsult,
              });
              
              // Update message with moderation status
              let updatedContent = message.content;
              let moderationCategory = moderationResult.category;
              let hasWarning = moderationResult.isMildInsult;
              
              // If HARMFUL, replace content
              if (moderationResult.isHarmful) {
                updatedContent = 'This message is harmful';
                moderationCategory = 'HARMFUL';
                hasWarning = false;
                console.log('[Content Moderation] ❌ Message marked as HARMFUL - content replaced');
              }
              
              // Update message in database
              message.content = updatedContent;
              message.moderationCategory = moderationCategory;
              message.hasWarning = hasWarning;
              await message.save();
              
              // Emit moderation update to all users in community
              const updateData = {
                messageId: message._id.toString(),
                communityId: communityId.toString(),
                content: updatedContent,
                moderationCategory: moderationCategory,
                hasWarning: hasWarning,
              };
              
              io.to(communityId.toString()).emit('message_moderation_update', updateData);
              console.log('[Content Moderation] ✅ Moderation update broadcasted:', updateData);
              
            } catch (error) {
              console.error('[Content Moderation] ❌ Error during async moderation check:', error);
            }
          });
        }

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicator
    socket.on('typing_start', (data) => {
      const { communityId } = data;
      
      if (!communityId) return;

      // Set typing indicator with auto-clear timeout
      setTypingIndicator(communityId, socket.userId, socket.username, io);
      
      socket.to(communityId).emit('user_typing', {
        userId: socket.userId,
        username: socket.username,
        communityId,
      });
    });

    socket.on('typing_stop', (data) => {
      const { communityId } = data;
      
      if (!communityId) return;

      clearTypingIndicator(communityId, socket.userId, io);
      
      socket.to(communityId).emit('user_stopped_typing', {
        userId: socket.userId,
        communityId,
      });
    });

    // Handle message read receipts
    socket.on('messages_read', async (data) => {
      try {
        const { communityId, messageIds } = data;
        
        if (!communityId || !messageIds || messageIds.length === 0) return;

        // Update read status in database
        const updateResult = await Message.updateMany(
          { _id: { $in: messageIds }, communityId },
          { 
            $addToSet: { 
              readBy: { 
                userId: socket.userId, 
                readAt: new Date() 
              } 
            } 
          }
        );

        // Get updated messages with readBy info
        const updatedMessages = await Message.find({
          _id: { $in: messageIds },
          communityId,
        }).lean();

        // Get all community members to calculate status
        const allMembers = await User.find({
          joinedCommunities: communityId,
        }).select('_id').lean();
        
        const memberIds = allMembers.map(m => m._id.toString());

        // Calculate and emit updated status for each message
        const statusUpdates = updatedMessages.map(msg => {
          const senderId = msg.userId?.toString();
          const totalRecipients = memberIds.length - (memberIds.includes(senderId) ? 1 : 0);
          const readByUserIds = (msg.readBy || []).map(r => r.userId?.toString() || r.userId);
          const readCount = readByUserIds.filter(id => id !== senderId).length;
          
          let status = 'sent';
          if (readCount >= totalRecipients && totalRecipients > 0) {
            status = 'read';
          } else if (readCount > 0) {
            status = 'delivered';
          }

          return {
            messageId: msg._id.toString(),
            status: status,
            readBy: msg.readBy || [],
            readCount: readCount,
            totalRecipients: totalRecipients,
          };
        });

        // Broadcast status updates to ALL users in the community (including the reader)
        // This ensures real-time status updates for all users
        io.to(communityId).emit('messages_read_receipt', {
          userId: socket.userId,
          messageIds,
          communityId,
          statusUpdates,
        });

      } catch (error) {
        console.error('Error updating read receipts:', error);
      }
    });

    // Handle message deletion
    socket.on('delete_message', async (data) => {
      try {
        const { messageId, communityId } = data;
        
        if (!messageId || !communityId) {
          socket.emit('error', { message: 'Message ID and Community ID are required' });
          return;
        }

        const message = await Message.findOne({ 
          _id: messageId, 
          userId: socket.userId,
          communityId 
        });

        if (!message) {
          socket.emit('error', { message: 'Message not found or unauthorized' });
          return;
        }

        message.isDeleted = true;
        message.content = 'This message was deleted';
        await message.save();

        io.to(communityId).emit('message_deleted', {
          messageId,
          communityId,
        });

      } catch (error) {
        console.error('Error deleting message:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // Handle message editing
    socket.on('edit_message', async (data) => {
      try {
        const { messageId, communityId, newContent } = data;
        
        if (!messageId || !communityId || !newContent) {
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }

        const message = await Message.findOne({ 
          _id: messageId, 
          userId: socket.userId,
          communityId 
        });

        if (!message) {
          socket.emit('error', { message: 'Message not found or unauthorized' });
          return;
        }

        message.content = newContent;
        message.isEdited = true;
        await message.save();

        io.to(communityId).emit('message_edited', {
          messageId,
          communityId,
          newContent,
          isEdited: true,
        });

      } catch (error) {
        console.error('Error editing message:', error);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    // Handle reactions
    socket.on('add_reaction', async (data) => {
      try {
        const { messageId, communityId, emoji } = data;
        
        if (!messageId || !communityId || !emoji) return;

        const message = await Message.findById(messageId);
        if (!message) return;

        // Find existing reaction with this emoji
        const existingReaction = message.reactions.find(r => r.emoji === emoji);
        
        if (existingReaction) {
          // Toggle user's reaction
          const userIndex = existingReaction.users.indexOf(socket.userId);
          if (userIndex > -1) {
            existingReaction.users.splice(userIndex, 1);
          } else {
            existingReaction.users.push(socket.userId);
          }
        } else {
          // Add new reaction
          message.reactions.push({
            emoji,
            users: [socket.userId],
          });
        }

        await message.save();

        io.to(communityId).emit('reaction_updated', {
          messageId,
          communityId,
          reactions: message.reactions.map(r => ({
            emoji: r.emoji,
            users: r.users,
            count: r.users.length,
          })),
        });

      } catch (error) {
        console.error('Error adding reaction:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', async (reason) => {
      try {
        const userData = userSockets.get(socket.id);
        
        // Unregister from notification service
        if (socket.userId) {
          unregisterUserSocket(socket.userId.toString(), socket.id);
        }
        
        if (userData) {
          const { communityId } = userData;
          
          if (communityId) {
            removeUserFromCommunity(communityId, socket.userId);
            clearTypingIndicator(communityId, socket.userId, io);
            
            // Get updated online users list (after removing the disconnected user)
            const onlineInCommunity = getOnlineUsersInCommunity(communityId);
            
            // Broadcast user left event to all users in the community
            io.to(communityId).emit('user_left', {
              userId: socket.userId,
              username: socket.username,
              communityId,
            });

            // Broadcast updated online users list to ALL users in the community
            io.to(communityId).emit('online_users', {
              communityId,
              users: onlineInCommunity,
            });

            await updateActiveMembersCount(communityId);
          }
          
          userSockets.delete(socket.id);
        }

        console.log(`🔌 Socket disconnected: ${socket.id} | User: ${socket.username} | Reason: ${reason}`);
      } catch (error) {
        console.error('Error handling disconnect:', error);
      }
    });

    // ============================================
    // DIRECT MESSAGING HANDLERS
    // ============================================

    // Handle direct message (point-to-point)
    socket.on('send_direct_message', async (data) => {
      try {
        const { senderId, receiverId, content, type = 'text', fileUrl, fileName, fileSize, duration, messageId } = data;

        if (!senderId || !receiverId || !content) {
          socket.emit('error', { message: 'Sender ID, receiver ID, and content are required' });
          return;
        }

        // Verify both users exist
        const [sender, receiver] = await Promise.all([
          User.findById(senderId),
          User.findById(receiverId),
        ]);

        if (!sender || !receiver) {
          socket.emit('error', { message: 'Sender or receiver not found' });
          return;
        }

        let message;
        let messageData;

        // If messageId is provided, message was already saved via REST API (for media uploads)
        // Just fetch and broadcast it
        if (messageId) {
          message = await DirectMessage.findById(messageId)
            .populate('senderId', 'username picture')
            .populate('receiverId', 'username picture');
          
          if (!message) {
            socket.emit('error', { message: 'Message not found' });
            return;
          }

          messageData = {
            id: message._id.toString(),
            senderId: message.senderId._id.toString(),
            receiverId: message.receiverId._id.toString(),
            content: message.content,
            type: message.type,
            fileUrl: message.fileUrl,
            fileName: message.fileName,
            fileSize: message.fileSize,
            duration: message.duration,
            timestamp: message.createdAt,
            isRead: message.isRead,
          };
        } else {
          // Create new direct message in database (for text messages)
          message = new DirectMessage({
            senderId,
            receiverId,
            content,
            type,
            fileUrl,
            fileName,
            fileSize,
            duration,
          });

          await message.save();
          await message.populate('senderId', 'username picture');
          await message.populate('receiverId', 'username picture');

          messageData = {
            id: message._id.toString(),
            senderId: message.senderId._id.toString(),
            receiverId: message.receiverId._id.toString(),
            content: message.content,
            type: message.type,
            fileUrl: message.fileUrl,
            fileName: message.fileName,
            fileSize: message.fileSize,
            duration: message.duration,
            timestamp: message.createdAt,
            isRead: message.isRead,
          };
        }

        // Emit to sender
        socket.emit('new_direct_message', messageData);

        // Emit to receiver if they're connected
        // Find receiver's socket by userId (check both socket.userId and socket.handshake.auth.userId)
        let deliveredToReceiver = false;
        io.sockets.sockets.forEach((receiverSocket) => {
          const socketUserId = receiverSocket.userId || receiverSocket.handshake?.auth?.userId;
          if (socketUserId && socketUserId.toString() === receiverId.toString()) {
            receiverSocket.emit('new_direct_message', messageData);
            deliveredToReceiver = true;
          }
        });

        // If receiver was connected and we emitted to them, consider it "delivered"
        if (deliveredToReceiver) {
          socket.emit('direct_message_delivered', {
            messageId: messageData.id,
            receiverId,
            timestamp: Date.now(),
          });
        }

        // Send confirmation to sender
        socket.emit('direct_message_sent', {
          success: true,
          messageId: messageData.id,
          timestamp: messageData.timestamp,
        });

        // Notify receiver about new direct message (via notification service)
        const { notifyDirectMessage } = require('../utils/notificationService');
        notifyDirectMessage(receiverId, senderId, messageData.id, messageData.content).catch((err) => {
          console.error('[Socket] Error notifying direct message:', err);
        });

        console.log(`✅ Direct message sent: "${messageData.content?.substring(0, 30)}..." from ${sender.username} to ${receiver.username}`);
      } catch (error) {
        console.error('Error sending direct message:', error);
        socket.emit('error', { message: 'Failed to send direct message' });
      }
    });

    // Ping/Pong for connection health check
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // ============================================
    // CHUNKED MEDIA HANDLERS
    // ============================================

    // Store for receiving chunks (shared across all sockets)
    // Map<messageId, { chunks, totalChunks, fileName, fileType, communityId, fileSize }>
    if (!global.chunkedMediaStore) {
      global.chunkedMediaStore = new Map();
    }
    const chunkedMediaStore = global.chunkedMediaStore;

    // Handle chunked media start
    socket.on('chunked_media_start', (data) => {
      try {
        const { messageId, fileName, fileType, totalChunks, fileSize, communityId } = data;
        console.log(`[Chunked] 📦 Starting chunked media receive: ${messageId}, ${totalChunks} chunks, ${fileSize} bytes`);
        
        chunkedMediaStore.set(messageId, {
          chunks: new Array(totalChunks),
          totalChunks,
          receivedChunks: 0,
          fileName,
          fileType,
          communityId: communityId.toString(),
          fileSize,
        });

        // Broadcast start to all users in community
        io.to(communityId.toString()).emit('chunked_media_start', {
          messageId,
          fileName,
          fileType,
          totalChunks,
          fileSize,
        });
      } catch (error) {
        console.error('[Chunked] Error handling chunked_media_start:', error);
      }
    });

    // Handle chunked media chunk
    socket.on('chunked_media_chunk', async (data) => {
      try {
        const { messageId, chunkIndex, chunk, isLastChunk } = data;
        const chunkData = chunkedMediaStore.get(messageId);
        
        if (!chunkData) {
          console.warn(`[Chunked] Received chunk for unknown message: ${messageId}`);
          return;
        }

        // Store chunk
        chunkData.chunks[chunkIndex] = chunk;
        chunkData.receivedChunks++;

        console.log(`[Chunked] 📦 Chunk ${chunkIndex + 1}/${chunkData.totalChunks} received for ${messageId}`);

        // Broadcast chunk to all users in community (real-time streaming)
        io.to(chunkData.communityId.toString()).emit('chunked_media_chunk', {
          messageId,
          chunkIndex,
          chunk,
          isLastChunk,
        });

        // If all chunks received, reassemble and save
        if (isLastChunk && chunkData.receivedChunks === chunkData.totalChunks) {
          try {
            const fs = require('fs');
            const path = require('path');
            
            // Reassemble base64 data
            const base64Data = chunkData.chunks.join('');
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Generate filename
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(chunkData.fileName) || (chunkData.fileType === 'image' ? '.jpg' : '.mp4');
            const fileName = `${chunkData.fileType}-${uniqueSuffix}${ext}`;
            const filePath = path.join(__dirname, '..', 'uploads', fileName);
            
            // Ensure uploads directory exists
            const uploadsDir = path.join(__dirname, '..', 'uploads');
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }
            
            // Save file
            fs.writeFileSync(filePath, buffer);
            
            // Generate localhost URL
            const port = process.env.PORT || 3000;
            const fileUrl = `http://localhost:${port}/uploads/${fileName}`;
            
            console.log(`[Chunked] ✅ File reassembled and saved: ${fileUrl}`);

            // Update message in database with file URL
            const Message = require('../models/Message');
            const updatedMessage = await Message.findByIdAndUpdate(messageId, {
              fileUrl,
              fileName: chunkData.fileName,
              fileSize: (chunkData.fileSize / 1024).toFixed(2) + ' KB',
            }, { new: true });

            if (updatedMessage) {
              await updatedMessage.populate('userId', 'username picture');
              
              // Get all community members to calculate status
              const allMembers = await User.find({
                joinedCommunities: chunkData.communityId,
              }).select('_id').lean();
              
              const memberIds = allMembers.map(m => m._id.toString());
              const senderId = updatedMessage.userId._id.toString();
              const totalRecipients = memberIds.length - (memberIds.includes(senderId) ? 1 : 0);
              const readByUserIds = (updatedMessage.readBy || []).map(r => r.userId?.toString() || r.userId);
              const readCount = readByUserIds.filter(id => id !== senderId).length;
              
              let status = 'sent';
              if (readCount >= totalRecipients && totalRecipients > 0) {
                status = 'read';
              } else if (readCount > 0) {
                status = 'delivered';
              }

              // Broadcast updated message with file URL to all users
              const messageData = {
                id: updatedMessage._id.toString(),
                _id: updatedMessage._id.toString(),
                communityId: chunkData.communityId,
                userId: updatedMessage.userId._id.toString(),
                username: updatedMessage.userId.username,
                avatar: updatedMessage.userId.picture || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
                content: updatedMessage.content,
                type: updatedMessage.type,
                fileUrl: fileUrl,
                fileName: chunkData.fileName,
                fileSize: (chunkData.fileSize / 1024).toFixed(2) + ' KB',
                duration: updatedMessage.duration,
                timestamp: updatedMessage.createdAt,
                status: status,
                readBy: updatedMessage.readBy || [],
                readCount: readCount,
                totalRecipients: totalRecipients,
              };

              io.to(chunkData.communityId.toString()).emit('new_message', messageData);
            }

            // Broadcast completion to all users
            io.to(chunkData.communityId.toString()).emit('chunked_media_complete', {
              messageId,
              fileUrl,
              fileName: chunkData.fileName,
            });

            // Clean up
            chunkedMediaStore.delete(messageId);
          } catch (error) {
            console.error('[Chunked] ❌ Error reassembling file:', error);
            socket.emit('error', { message: 'Failed to reassemble file' });
          }
        }
      } catch (error) {
        console.error('[Chunked] Error handling chunked_media_chunk:', error);
      }
    });
  });

  return io;
};

// Helper functions
function addUserToCommunity(communityId, userId) {
  if (!onlineUsers.has(communityId)) {
    onlineUsers.set(communityId, new Set());
  }
  onlineUsers.get(communityId).add(userId);
}

function removeUserFromCommunity(communityId, userId) {
  const users = onlineUsers.get(communityId);
  if (users) {
    users.delete(userId);
    if (users.size === 0) {
      onlineUsers.delete(communityId);
    }
  }
}

function getOnlineUsersInCommunity(communityId) {
  const users = onlineUsers.get(communityId);
  return users ? Array.from(users) : [];
}

async function updateActiveMembersCount(communityId) {
  try {
    const count = onlineUsers.has(communityId) ? onlineUsers.get(communityId).size : 0;
    await Community.findByIdAndUpdate(communityId, { activeMembers: count });
  } catch (error) {
    console.error('Error updating active members count:', error);
  }
}

function setTypingIndicator(communityId, userId, username, io) {
  if (!typingUsers.has(communityId)) {
    typingUsers.set(communityId, new Map());
  }
  
  const communityTyping = typingUsers.get(communityId);
  
  // Clear existing timeout
  const existingTimeout = communityTyping.get(userId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }
  
  // Set new timeout (auto-clear after 3 seconds)
  const timeout = setTimeout(() => {
    communityTyping.delete(userId);
    io.to(communityId).emit('user_stopped_typing', { userId, communityId });
  }, 3000);
  
  communityTyping.set(userId, timeout);
}

function clearTypingIndicator(communityId, userId, io) {
  const communityTyping = typingUsers.get(communityId);
  if (communityTyping) {
    const timeout = communityTyping.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      communityTyping.delete(userId);
    }
  }
}

module.exports = { initializeSocketHandlers };

