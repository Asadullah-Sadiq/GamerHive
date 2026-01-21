/**
 * Direct Message Controller
 * REST API endpoints for point-to-point direct messaging
 */

const DirectMessage = require('../models/DirectMessage');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `direct-${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept all file types
    cb(null, true);
  },
});

// Get messages between two users
exports.getMessages = async (req, res) => {
  try {
    const { userId, targetUserId } = req.params;
    const { page = 1, limit = 50, before } = req.query;

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and target user ID are required',
      });
    }

    // Build query - get messages where either user is sender or receiver
    const query = {
      $or: [
        { senderId: userId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: userId },
      ],
      isDeleted: { $ne: true },
      deletedFor: { $ne: userId }, // Hide messages deleted "for me"
    };

    // For infinite scroll: get messages before a certain timestamp
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await DirectMessage.find(query)
      .populate('senderId', 'username picture')
      .populate('receiverId', 'username picture')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Reverse to get chronological order
    const orderedMessages = messages.reverse();

    // Format response
    const formattedMessages = orderedMessages.map(msg => ({
      id: msg._id.toString(),
      senderId: msg.senderId._id.toString(),
      receiverId: msg.receiverId._id.toString(),
      content: msg.content,
      type: msg.type,
      fileUrl: msg.fileUrl,
      fileName: msg.fileName,
      fileSize: msg.fileSize,
      duration: msg.duration,
      timestamp: msg.createdAt,
      isRead: msg.isRead,
      readAt: msg.readAt,
    }));

    res.json({
      success: true,
      data: {
        messages: formattedMessages,
        hasMore: messages.length === parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get messages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get conversation list for a user (Instagram/Messenger-style)
exports.getConversations = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const uid = new mongoose.Types.ObjectId(userId);

    const pipeline = [
      {
        $match: {
          isDeleted: { $ne: true },
          deletedFor: { $ne: uid },
          $or: [{ senderId: uid }, { receiverId: uid }],
        },
      },
      {
        $addFields: {
          otherUser: {
            $cond: [{ $eq: ['$senderId', uid] }, '$receiverId', '$senderId'],
          },
          isIncomingUnread: {
            $cond: [
              {
                $and: [
                  { $eq: ['$receiverId', uid] },
                  { $eq: ['$isRead', false] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$otherUser',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: { $sum: '$isIncomingUnread' },
        },
      },
      { $sort: { 'lastMessage.createdAt': -1 } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          userId: { $toString: '$_id' },
          username: { $ifNull: ['$user.username', 'User'] },
          avatar: '$user.picture',
          unreadCount: 1,
          lastMessage: {
            id: { $toString: '$lastMessage._id' },
            content: '$lastMessage.content',
            type: '$lastMessage.type',
            timestamp: '$lastMessage.createdAt',
          },
        },
      },
    ];

    const conversations = await DirectMessage.aggregate(pipeline);

    res.json({
      success: true,
      data: { conversations },
    });
  } catch (error) {
    console.error('Error getting conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Send a text message
exports.sendMessage = async (req, res) => {
  try {
    const { senderId, receiverId, content, type = 'text' } = req.body;

    if (!senderId || !receiverId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Sender ID, receiver ID, and content are required',
      });
    }

    // Verify both users exist
    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId),
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({
        success: false,
        message: 'Sender or receiver not found',
      });
    }

    // Create message
    const message = new DirectMessage({
      senderId,
      receiverId,
      content,
      type,
    });

    await message.save();
    await message.populate('senderId', 'username picture');
    await message.populate('receiverId', 'username picture');

    // Notify receiver about new direct message (non-blocking)
    const { notifyDirectMessage } = require('../utils/notificationService');
    notifyDirectMessage(receiverId, senderId, message._id.toString(), content).catch((err) => {
      console.error('[DirectMessageController] Error notifying direct message:', err);
    });

    // Real-time: emit message to sender + receiver sockets (so no refresh needed)
    try {
      const io = req.app?.get('io');
      if (io) {
        const messageData = {
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

        let deliveredToReceiver = false;
        io.sockets.sockets.forEach((s) => {
          const socketUserId = s.userId || s.handshake?.auth?.userId;
          if (!socketUserId) return;
          const sid = socketUserId.toString();
          if (sid === senderId.toString()) {
            s.emit('new_direct_message', messageData);
            s.emit('direct_message_sent', { success: true, messageId: messageData.id, timestamp: messageData.timestamp });
          }
          if (sid === receiverId.toString()) {
            s.emit('new_direct_message', messageData);
            deliveredToReceiver = true;
          }
        });

        if (deliveredToReceiver) {
          io.sockets.sockets.forEach((s) => {
            const socketUserId = s.userId || s.handshake?.auth?.userId;
            if (socketUserId && socketUserId.toString() === senderId.toString()) {
              s.emit('direct_message_delivered', { messageId: messageData.id, receiverId: receiverId.toString(), timestamp: Date.now() });
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to emit direct message sockets (REST sendMessage):', e?.message || e);
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        message: {
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
        },
      },
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Upload and send media message (image, video, audio, file)
exports.sendMediaMessage = async (req, res) => {
  try {
    const { senderId, receiverId, type, duration } = req.body;

    if (!senderId || !receiverId || !type) {
      return res.status(400).json({
        success: false,
        message: 'Sender ID, receiver ID, and type are required',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'File is required',
      });
    }

    // Verify both users exist
    const [sender, receiver] = await Promise.all([
      User.findById(senderId),
      User.findById(receiverId),
    ]);

    if (!sender || !receiver) {
      return res.status(404).json({
        success: false,
        message: 'Sender or receiver not found',
      });
    }

    // Get file info - always use localhost for file URLs
    const port = process.env.PORT || 3000;
    const fileUrl = `http://localhost:${port}/uploads/${req.file.filename}`;
    const fileName = req.file.originalname;
    const fileSize = (req.file.size / 1024).toFixed(2) + ' KB';

    // Determine content based on type
    let content = '';
    switch (type) {
      case 'image':
        content = 'Photo';
        break;
      case 'video':
        content = 'Video';
        break;
      case 'audio':
        content = 'Voice message';
        break;
      case 'file':
        content = fileName;
        break;
      default:
        content = 'File';
    }

    // Create message
    const message = new DirectMessage({
      senderId,
      receiverId,
      content,
      type,
      fileUrl,
      fileName,
      fileSize,
      duration: duration || null,
    });

    await message.save();
    await message.populate('senderId', 'username picture');
    await message.populate('receiverId', 'username picture');

    // Real-time: emit message to sender + receiver sockets (so no refresh needed)
    try {
      const io = req.app?.get('io');
      if (io) {
        const messageData = {
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

        let deliveredToReceiver = false;
        io.sockets.sockets.forEach((s) => {
          const socketUserId = s.userId || s.handshake?.auth?.userId;
          if (!socketUserId) return;
          const sid = socketUserId.toString();
          if (sid === senderId.toString()) {
            s.emit('new_direct_message', messageData);
            s.emit('direct_message_sent', { success: true, messageId: messageData.id, timestamp: messageData.timestamp });
          }
          if (sid === receiverId.toString()) {
            s.emit('new_direct_message', messageData);
            deliveredToReceiver = true;
          }
        });

        if (deliveredToReceiver) {
          io.sockets.sockets.forEach((s) => {
            const socketUserId = s.userId || s.handshake?.auth?.userId;
            if (socketUserId && socketUserId.toString() === senderId.toString()) {
              s.emit('direct_message_delivered', { messageId: messageData.id, receiverId: receiverId.toString(), timestamp: Date.now() });
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to emit direct message sockets (REST sendMediaMessage):', e?.message || e);
    }

    res.status(201).json({
      success: true,
      message: 'Media message sent successfully',
      data: {
        message: {
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
        },
      },
    });
  } catch (error) {
    console.error('Error sending media message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send media message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { userId, targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and target user ID are required',
      });
    }

    // Find unread messages first so we can emit accurate read receipts
    const unread = await DirectMessage.find(
      { senderId: targetUserId, receiverId: userId, isRead: false, isDeleted: { $ne: true } },
      { _id: 1 }
    ).lean();

    const messageIds = unread.map((m) => m._id.toString());

    if (messageIds.length > 0) {
      await DirectMessage.updateMany(
        { _id: { $in: messageIds } },
        { isRead: true, readAt: new Date() }
      );

      // Emit read receipt to sender (targetUserId) if socket.io is available
      try {
        const io = req.app?.get('io');
        if (io) {
          const payload = { messageIds, readerId: userId.toString(), timestamp: Date.now() };
          io.sockets.sockets.forEach((s) => {
            const socketUserId = s.userId || s.handshake?.auth?.userId;
            if (socketUserId === targetUserId.toString()) {
              s.emit('direct_message_read', payload);
            }
          });
        }
      } catch (e) {
        console.warn('Failed to emit direct_message_read:', e?.message || e);
      }
    }

    res.json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Clear chat for me (per-user delete of the entire conversation)
exports.clearChatForMe = async (req, res) => {
  try {
    const { userId, targetUserId } = req.body || {};

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and target user ID are required',
      });
    }

    await DirectMessage.updateMany(
      {
        $or: [
          { senderId: userId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: userId },
        ],
        isDeleted: { $ne: true },
      },
      { $addToSet: { deletedFor: userId } }
    );

    // Emit to this user's sockets so other devices clear instantly
    try {
      const io = req.app?.get('io');
      if (io) {
        const payload = { userId: userId.toString(), targetUserId: targetUserId.toString(), timestamp: Date.now() };
        io.sockets.sockets.forEach((s) => {
          const socketUserId = s.userId || s.handshake?.auth?.userId;
          if (socketUserId === userId.toString()) {
            s.emit('direct_chat_cleared', payload);
          }
        });
      }
    } catch (e) {
      console.warn('Failed to emit direct_chat_cleared:', e?.message || e);
    }

    res.json({
      success: true,
      message: 'Chat cleared for you',
    });
  } catch (error) {
    console.error('Error clearing chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear chat',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete a message
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId, messageIds, userId, scope } = req.body || {};
    const ids = Array.isArray(messageIds) ? messageIds : (messageId ? [messageId] : []);

    if (!userId || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User ID and message ID(s) are required',
      });
    }

    const deleteScope = scope === 'everyone' ? 'everyone' : 'me';

    // Fetch messages to validate user participates in the chat
    const msgs = await DirectMessage.find({
      _id: { $in: ids },
      isDeleted: { $ne: true },
      $or: [{ senderId: userId }, { receiverId: userId }],
    }).select('_id senderId receiverId').lean();

    if (!msgs || msgs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Message(s) not found',
      });
    }

    const io = req.app?.get('io');

    if (deleteScope === 'me') {
      // Delete for me: any participant can hide the message for themselves only
      const msgIds = msgs.map(m => m._id);
      await DirectMessage.updateMany(
        { _id: { $in: msgIds } },
        { $addToSet: { deletedFor: userId } }
      );

      // Emit only to this user's sockets (so multi-device sync works)
      try {
        if (io) {
          const payload = { messageIds: msgIds.map(id => id.toString()), scope: 'me', userId: userId.toString() };
          io.sockets.sockets.forEach((s) => {
            const socketUserId = s.userId || s.handshake?.auth?.userId;
            if (socketUserId === userId.toString()) {
              s.emit('direct_message_deleted', payload);
            }
          });
        }
      } catch (e) {
        console.warn('Failed to emit direct_message_deleted(me):', e?.message || e);
      }
    } else {
      // Delete for everyone: only sender can delete their own messages for both sides
      const senderMsgs = msgs.filter(m => m.senderId.toString() === userId.toString());
      if (senderMsgs.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own messages for everyone',
        });
      }

      const senderMsgIds = senderMsgs.map(m => m._id);

      await DirectMessage.updateMany(
        { _id: { $in: senderMsgIds } },
        {
          isDeleted: true,
          content: 'This message was deleted',
          type: 'text',
          fileUrl: null,
          fileName: null,
          fileSize: null,
          duration: null,
        }
      );

      // Emit to sender + receiver(s)
      try {
        if (io) {
          const receiverIds = Array.from(new Set(senderMsgs.map(m => m.receiverId.toString())));
          const payload = { messageIds: senderMsgIds.map(id => id.toString()), scope: 'everyone', userId: userId.toString() };

          io.sockets.sockets.forEach((s) => {
            const socketUserId = s.userId || s.handshake?.auth?.userId;
            if (socketUserId === userId.toString()) s.emit('direct_message_deleted', payload);
            receiverIds.forEach((rid) => {
              if (socketUserId === rid) s.emit('direct_message_deleted', payload);
            });
          });
        }
      } catch (e) {
        console.warn('Failed to emit direct_message_deleted(everyone):', e?.message || e);
      }
    }

    res.json({
      success: true,
      message: 'Message(s) deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Export upload middleware
exports.upload = upload;

