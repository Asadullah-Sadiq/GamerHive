/**
 * Centralized Notification Service
 * Single source of truth for all notification operations
 * Handles creation, delivery, and real-time emission
 */

const Notification = require('../models/Notification');
const User = require('../models/User');
const Community = require('../models/Community');
const { io } = require('../index');

// User to socket mapping (userId -> Set of socketIds)
const userSocketMap = new Map();

/**
 * Register user socket connection
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 */
function registerUserSocket(userId, socketId) {
  if (!userSocketMap.has(userId)) {
    userSocketMap.set(userId, new Set());
  }
  userSocketMap.get(userId).add(socketId);
}

/**
 * Unregister user socket connection
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 */
function unregisterUserSocket(userId, socketId) {
  if (userSocketMap.has(userId)) {
    userSocketMap.get(userId).delete(socketId);
    if (userSocketMap.get(userId).size === 0) {
      userSocketMap.delete(userId);
    }
  }
}

/**
 * Check if user is online
 * @param {string} userId - User ID
 * @returns {boolean}
 */
function isUserOnline(userId) {
  return userSocketMap.has(userId) && userSocketMap.get(userId).size > 0;
}

/**
 * Get all socket IDs for a user
 * @param {string} userId - User ID
 * @returns {Set<string>}
 */
function getUserSockets(userId) {
  return userSocketMap.get(userId) || new Set();
}

/**
 * Create and deliver notification
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} Created notification
 */
async function createNotification(notificationData) {
  try {
    const {
      senderId,
      receiverId,
      targetGroupId,
      type,
      title,
      message,
      payload = {},
    } = notificationData;

    // Validate required fields
    if (!senderId || !type || !title || !message) {
      throw new Error('Missing required notification fields');
    }

    // For group notifications, receiverId should be null
    const finalReceiverId = targetGroupId ? null : receiverId;

    // Check for duplicate notifications (for post likes/comments)
    if (type === 'post_like' || type === 'post_comment') {
      const existing = await Notification.findOne({
        senderId,
        receiverId: finalReceiverId,
        type,
        'payload.postId': payload.postId,
        isRead: false,
        createdAt: { $gte: new Date(Date.now() - 60000) }, // Within last minute
      });

      if (existing) {
        // Update existing notification instead of creating duplicate
        existing.message = message;
        existing.title = title;
        existing.payload = payload;
        existing.createdAt = new Date();
        await existing.save();
        await deliverNotification(existing);
        return existing;
      }
    }

    // Create notification
    const notification = new Notification({
      senderId,
      receiverId: finalReceiverId,
      targetGroupId,
      type,
      title,
      message,
      payload,
      isRead: false,
    });

    await notification.save();

    // Populate sender info
    await notification.populate('senderId', 'username name picture');

    // Deliver notification
    await deliverNotification(notification);

    return notification;
  } catch (error) {
    console.error('[NotificationService] Error creating notification:', error);
    throw error;
  }
}

/**
 * Deliver notification via Socket.IO
 * @param {Object} notification - Notification document
 */
async function deliverNotification(notification) {
  try {
    const notificationData = {
      id: notification._id.toString(),
      senderId: notification.senderId._id?.toString() || notification.senderId.toString(),
      sender: {
        id: notification.senderId._id?.toString() || notification.senderId.toString(),
        username: notification.senderId.username,
        name: notification.senderId.name,
        picture: notification.senderId.picture,
      },
      receiverId: notification.receiverId?.toString() || null,
      targetGroupId: notification.targetGroupId?.toString() || null,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      payload: notification.payload,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    };

    // Deliver to specific receiver
    if (notification.receiverId) {
      const receiverSockets = getUserSockets(notification.receiverId.toString());
      if (receiverSockets.size > 0) {
        receiverSockets.forEach((socketId) => {
          if (io.sockets.sockets.has(socketId)) {
            io.to(socketId).emit('notification:new', notificationData);
          }
        });
        console.log(`[NotificationService] ✅ Delivered to user ${notification.receiverId} via ${receiverSockets.size} socket(s)`);
      } else {
        console.log(`[NotificationService] ⏳ User ${notification.receiverId} offline - saved to DB`);
      }
    }

    // Deliver to community room (all members except sender)
    if (notification.targetGroupId) {
      const communityId = notification.targetGroupId.toString();
      const senderId = notification.senderId._id?.toString() || notification.senderId.toString();
      
      // Get all sockets in the community room
      const room = io.sockets.adapter.rooms.get(`community:${communityId}`);
      if (room) {
        let deliveredCount = 0;
        
        // Emit to each socket in the room, excluding the sender
        room.forEach((socketId) => {
          const socket = io.sockets.sockets.get(socketId);
          if (socket) {
            const socketUserId = socket.userId?.toString() || socket.handshake?.auth?.userId?.toString();
            
            // Only emit to sockets that don't belong to the sender
            if (socketUserId && socketUserId !== senderId) {
              socket.emit('notification:new', notificationData);
              deliveredCount++;
            }
          }
        });
        
        console.log(`[NotificationService] ✅ Broadcasted to ${deliveredCount} users in community ${communityId} (excluded sender ${senderId})`);
      } else {
        console.log(`[NotificationService] ⏳ No users in community room ${communityId} - saved to DB`);
      }
    }
  } catch (error) {
    console.error('[NotificationService] Error delivering notification:', error);
  }
}

/**
 * Notify post owner about like
 * @param {string} postOwnerId - Post owner ID
 * @param {string} likerId - User who liked
 * @param {string} postId - Post ID
 */
async function notifyPostLike(postOwnerId, likerId, postId) {
  if (postOwnerId.toString() === likerId.toString()) return; // Don't notify self

  try {
    const [postOwner, liker] = await Promise.all([
      User.findById(postOwnerId).select('username name'),
      User.findById(likerId).select('username name'),
    ]);

    if (!postOwner || !liker) return;

    await createNotification({
      senderId: likerId,
      receiverId: postOwnerId,
      type: 'post_like',
      title: 'New Like',
      message: `${liker.username || liker.name} liked your post`,
      payload: { postId },
    });
  } catch (error) {
    console.error('[NotificationService] Error notifying post like:', error);
  }
}

/**
 * Notify post owner about comment
 * @param {string} postOwnerId - Post owner ID
 * @param {string} commenterId - User who commented
 * @param {string} postId - Post ID
 * @param {string} commentText - Comment text
 */
async function notifyPostComment(postOwnerId, commenterId, postId, commentText) {
  if (postOwnerId.toString() === commenterId.toString()) return; // Don't notify self

  try {
    const [postOwner, commenter] = await Promise.all([
      User.findById(postOwnerId).select('username name'),
      User.findById(commenterId).select('username name'),
    ]);

    if (!postOwner || !commenter) return;

    const truncatedComment = commentText.length > 50 ? commentText.substring(0, 50) + '...' : commentText;

    await createNotification({
      senderId: commenterId,
      receiverId: postOwnerId,
      type: 'post_comment',
      title: 'New Comment',
      message: `${commenter.username || commenter.name} commented: "${truncatedComment}"`,
      payload: { postId, commentText },
    });
  } catch (error) {
    console.error('[NotificationService] Error notifying post comment:', error);
  }
}

/**
 * Notify all community members about new message (except sender)
 * @param {string} communityId - Community ID
 * @param {string} senderId - Message sender ID
 * @param {string} messageId - Message ID
 * @param {string} messageContent - Message content
 */
async function notifyCommunityMessage(communityId, senderId, messageId, messageContent) {
  try {
    const [community, sender] = await Promise.all([
      Community.findById(communityId).select('name'),
      User.findById(senderId).select('username name'),
    ]);

    if (!community || !sender) return;

    const truncatedMessage = messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent;

    await createNotification({
      senderId,
      targetGroupId: communityId,
      type: 'community_message',
      title: `New message in ${community.name}`,
      message: `${sender.username || sender.name}: ${truncatedMessage}`,
      payload: { communityId, messageId, messageContent },
    });
  } catch (error) {
    console.error('[NotificationService] Error notifying community message:', error);
  }
}

/**
 * Notify receiver about direct message
 * @param {string} receiverId - Receiver ID
 * @param {string} senderId - Sender ID
 * @param {string} messageId - Message ID
 * @param {string} messageContent - Message content
 */
async function notifyDirectMessage(receiverId, senderId, messageId, messageContent) {
  if (receiverId.toString() === senderId.toString()) return; // Don't notify self

  try {
    const sender = await User.findById(senderId).select('username name');
    if (!sender) return;

    const truncatedMessage = messageContent.length > 50 ? messageContent.substring(0, 50) + '...' : messageContent;

    await createNotification({
      senderId,
      receiverId,
      type: 'direct_message',
      title: 'New Message',
      message: `${sender.username || sender.name}: ${truncatedMessage}`,
      payload: { messageId, messageContent },
    });
  } catch (error) {
    console.error('[NotificationService] Error notifying direct message:', error);
  }
}

/**
 * Notify friends and other users about new game
 * @param {string} gameOwnerId - Game owner ID
 * @param {string} gameId - Game ID
 * @param {string} gameTitle - Game title
 */
async function notifyGameAdded(gameOwnerId, gameId, gameTitle) {
  try {
    const owner = await User.findById(gameOwnerId).select('username name friends');
    if (!owner) return;

    const friends = owner.friends || [];
    const allUsers = await User.find({ _id: { $ne: gameOwnerId } }).select('_id').lean();
    const otherUserIds = allUsers.map((u) => u._id.toString()).filter((id) => !friends.includes(id));

    // Notify friends
    for (const friendId of friends) {
      await createNotification({
        senderId: gameOwnerId,
        receiverId: friendId,
        type: 'game_added',
        title: 'New Game Available',
        message: `${owner.username || owner.name} added a new game: ${gameTitle}`,
        payload: { gameId, gameTitle },
      });
    }

    // Notify other users (batch to prevent duplicates)
    const uniqueOtherUsers = [...new Set(otherUserIds)];
    for (const userId of uniqueOtherUsers) {
      // Check for duplicate
      const existing = await Notification.findOne({
        senderId: gameOwnerId,
        receiverId: userId,
        type: 'game_added',
        'payload.gameId': gameId,
        isRead: false,
        createdAt: { $gte: new Date(Date.now() - 60000) },
      });

      if (!existing) {
        await createNotification({
          senderId: gameOwnerId,
          receiverId: userId,
          type: 'game_added',
          title: 'New Game Available',
          message: `${owner.username || owner.name} added a new game: ${gameTitle}`,
          payload: { gameId, gameTitle },
        });
      }
    }
  } catch (error) {
    console.error('[NotificationService] Error notifying game added:', error);
  }
}

/**
 * Notify all users about admin broadcast
 * @param {string} adminId - Admin ID
 * @param {string} type - Broadcast type (admin_community, admin_tournament, admin_game)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {Object} payload - Additional payload
 */
async function notifyAdminBroadcast(adminId, type, title, message, payload = {}) {
  try {
    const allUsers = await User.find({ isActive: true }).select('_id').lean();

    // Create notifications for all users (non-blocking)
    const notificationPromises = allUsers.map((user) =>
      createNotification({
        senderId: adminId,
        receiverId: user._id,
        type,
        title,
        message,
        payload,
      }).catch((err) => {
        console.error(`[NotificationService] Error creating notification for user ${user._id}:`, err);
      })
    );

    await Promise.allSettled(notificationPromises);
    console.log(`[NotificationService] ✅ Admin broadcast sent to ${allUsers.length} users`);
  } catch (error) {
    console.error('[NotificationService] Error notifying admin broadcast:', error);
  }
}

/**
 * Sync notifications for user on reconnect
 * @param {string} userId - User ID
 * @param {string} socketId - Socket ID
 */
async function syncNotificationsOnReconnect(userId, socketId) {
  try {
    // Get user's communities
    const User = require('../models/User');
    const user = await User.findById(userId).select('joinedCommunities');
    const userCommunities = user?.joinedCommunities || [];

    // Get unread notifications where user is receiver OR in community (but not sender)
    const unreadNotifications = await Notification.find({
      $or: [
        { receiverId: userId, isRead: false },
        { 
          targetGroupId: { $in: userCommunities }, 
          isRead: false,
          senderId: { $ne: userId }, // Exclude notifications where user is the sender
        },
      ],
    })
      .populate('senderId', 'username name picture')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    if (unreadNotifications.length > 0) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('notification:sync', {
          notifications: unreadNotifications.map((n) => ({
            id: n._id.toString(),
            senderId: n.senderId._id?.toString() || n.senderId.toString(),
            sender: {
              id: n.senderId._id?.toString() || n.senderId.toString(),
              username: n.senderId.username,
              name: n.senderId.name,
              picture: n.senderId.picture,
            },
            receiverId: n.receiverId?.toString() || null,
            targetGroupId: n.targetGroupId?.toString() || null,
            type: n.type,
            title: n.title,
            message: n.message,
            payload: n.payload,
            isRead: n.isRead,
            createdAt: n.createdAt,
          })),
        });
        console.log(`[NotificationService] ✅ Synced ${unreadNotifications.length} notifications to user ${userId}`);
      }
    }
  } catch (error) {
    console.error('[NotificationService] Error syncing notifications:', error);
  }
}

module.exports = {
  registerUserSocket,
  unregisterUserSocket,
  isUserOnline,
  getUserSockets,
  createNotification,
  deliverNotification,
  notifyPostLike,
  notifyPostComment,
  notifyCommunityMessage,
  notifyDirectMessage,
  notifyGameAdded,
  notifyAdminBroadcast,
  syncNotificationsOnReconnect,
};