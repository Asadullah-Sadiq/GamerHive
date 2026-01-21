/**
 * Message Controller
 * REST API endpoints for community messages (used alongside socket.io)
 */

const Message = require('../models/Message');
const Community = require('../models/Community');
const User = require('../models/User');
const mongoose = require('mongoose');

// Get messages for a community (with pagination)
exports.getCommunityMessages = async (req, res) => {
  try {
    // Route uses :id, so extract from req.params.id
    const communityId = req.params.id || req.params.communityId;
    const { page = 1, limit = 50, before } = req.query;

    console.log('[Messages] Getting messages for community:', communityId);

    // Verify community exists
    const community = await Community.findById(communityId);
    if (!community) {
      console.log('[Messages] Community not found:', communityId);
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    // Build query
    const query = { 
      communityId,
      isDeleted: { $ne: true },
    };

    // Optional per-user filter (delete-for-me)
    const viewerUserId = req.query?.userId || req.user?.id || req.user?._id;
    if (viewerUserId) {
      query.deletedFor = { $ne: viewerUserId };
    }
    
    // For infinite scroll: get messages before a certain timestamp
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .populate('userId', 'username picture')
      .populate({
        path: 'replyTo',
        select: 'content type userId',
        populate: {
          path: 'userId',
          select: 'username',
        },
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Reverse to get chronological order
    const orderedMessages = messages.reverse();

    // Get all community members (excluding sender) to calculate status
    const allMembers = await User.find({
      joinedCommunities: communityId,
    }).select('_id').lean();
    
    const memberIds = allMembers.map(m => m._id.toString());
    const totalMembers = memberIds.length;

    // Format response
    const formattedMessages = orderedMessages.map(msg => {
      const senderId = msg.userId?._id?.toString() || msg.userId?.toString();
      const readByUserIds = (msg.readBy || []).map(r => r.userId?.toString() || r.userId);
      
      // Exclude sender from total members count
      const totalRecipients = totalMembers - (memberIds.includes(senderId) ? 1 : 0);
      const readCount = readByUserIds.filter(id => id !== senderId).length;
      
      // Calculate status:
      // - 'sent': Not all members have received (when message is sent via socket, all online members receive it immediately)
      // - 'delivered': All members have received but not all have read
      // - 'read': All members have read
      let status = 'sent';
      if (readCount >= totalRecipients && totalRecipients > 0) {
        status = 'read';
      } else if (readCount > 0) {
        status = 'delivered';
      }

      return {
        id: msg._id,
        _id: msg._id,
        userId: msg.userId?._id || msg.userId,
        username: msg.userId?.username || 'Unknown',
        avatar: msg.userId?.picture || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
        content: msg.content,
        type: msg.type,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        duration: msg.duration,
        timestamp: msg.createdAt,
        createdAt: msg.createdAt,
        status: status,
        readBy: msg.readBy || [],
        readCount: readCount,
        totalRecipients: totalRecipients,
        isEdited: msg.isEdited,
        reactions: msg.reactions?.map(r => ({
          emoji: r.emoji,
          users: r.users,
          count: r.users?.length || 0,
        })) || [],
        replyTo: msg.replyTo ? {
          id: msg.replyTo._id,
          _id: msg.replyTo._id,
          content: msg.replyTo.content,
          type: msg.replyTo.type,
          username: msg.replyTo.userId?.username || 'Unknown',
        } : null,
        user: {
          _id: msg.userId?._id || msg.userId,
          username: msg.userId?.username || 'Unknown',
          picture: msg.userId?.picture,
          avatar: msg.userId?.picture,
        },
        // Include moderation fields
        moderationCategory: msg.moderationCategory || null,
        hasWarning: msg.hasWarning || false,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        messages: formattedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: messages.length === parseInt(limit),
        },
      },
    });

  } catch (error) {
    console.error('Error getting community messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get messages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Send a message (fallback REST endpoint if socket fails)
exports.sendMessage = async (req, res) => {
  try {
    // Route uses :id, so extract from req.params.id
    const communityId = req.params.id || req.params.communityId;
    const { userId, content, type = 'text', replyTo, fileUrl, fileName, fileSize, duration } = req.body;

    console.log('[Messages] Sending message to community:', communityId, 'from user:', userId, 'type:', type);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // For media messages, content might be empty (e.g., 'Photo', 'Video')
    // Check for uploaded files (from multer fields)
    const uploadedFile = req.files?.image?.[0] || req.files?.video?.[0] || req.file;
    if (!content && !uploadedFile) {
      return res.status(400).json({
        success: false,
        message: 'Content or file is required',
      });
    }

    // Verify community exists
    const community = await Community.findById(communityId);
    if (!community) {
      console.log('[Messages] Community not found for sending:', communityId);
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Handle file upload (image or video)
    let finalFileUrl = fileUrl;
    let finalFileName = fileName;
    let finalFileSize = fileSize;
    let finalType = type;
    let finalContent = content;

    // uploadedFile is already declared above (line 166), reuse it here
    if (uploadedFile) {
      // Always use localhost for file URLs
      const port = process.env.PORT || 3000;
      finalFileUrl = `http://localhost:${port}/uploads/${uploadedFile.filename}`;
      finalFileName = uploadedFile.originalname;
      finalFileSize = (uploadedFile.size / 1024).toFixed(2) + ' KB';
      
      console.log('[REST API] 📁 File uploaded:', {
        filename: uploadedFile.filename,
        originalname: uploadedFile.originalname,
        mimetype: uploadedFile.mimetype,
        size: uploadedFile.size,
        fileUrl: finalFileUrl,
      });
      
      // Determine type from file mimetype
      if (uploadedFile.mimetype.startsWith('image/')) {
        finalType = 'image';
        finalContent = finalContent || 'Photo';
      } else if (uploadedFile.mimetype.startsWith('video/')) {
        finalType = 'video';
        finalContent = finalContent || 'Video';
      }
    }

    // Create message immediately (optimistic UI - show message right away)
    const message = new Message({
      communityId,
      userId,
      content: finalContent,
      type: finalType,
      fileUrl: finalFileUrl,
      fileName: finalFileName,
      fileSize: finalFileSize,
      duration: duration || null,
      replyTo: replyTo || null,
    });

    await message.save();
    
    // Verify the message was saved with localhost URL
    console.log('[REST API] 💾 Message saved to database:', {
      id: message._id.toString(),
      type: message.type,
      fileUrl: message.fileUrl,
      content: message.content?.substring(0, 30),
    });
    
    await message.populate('userId', 'username picture');

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
    const senderId = userId.toString();
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

    // Broadcast message via socket for real-time delivery
    const io = req.app.get('io');
    if (io) {
      const messageData = {
        id: message._id.toString(),
        _id: message._id.toString(),
        communityId: communityId.toString(),
        userId: userId.toString(),
        username: message.userId?.username || user.username,
        avatar: message.userId?.picture || user.picture || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=50',
        content: message.content,
        type: message.type,
        fileUrl: message.fileUrl, // This should already be localhost URL
        fileName: message.fileName,
        fileSize: message.fileSize,
        duration: message.duration,
        timestamp: message.createdAt,
        status: status,
        readBy: message.readBy || [],
        readCount: readCount,
        totalRecipients: totalRecipients,
        replyTo: message.replyTo ? {
          id: message.replyTo._id.toString(),
          content: message.replyTo.content,
          type: message.replyTo.type,
          username: message.replyTo.userId?.username || 'Unknown',
        } : null,
      };

      // Broadcast to all users in the community room
      const communityIdStr = communityId.toString();
      
      // Get room size for logging
      const roomSize = io.sockets.adapter.rooms.get(communityIdStr)?.size || 0;
      console.log(`[REST API] 📡 Broadcasting message via socket to community ${communityIdStr} (${roomSize} users in room)`);
      console.log(`[REST API] Message data:`, {
        id: messageData.id,
        type: messageData.type,
        fileUrl: messageData.fileUrl,
        fileName: messageData.fileName,
        content: messageData.content?.substring(0, 30),
        userId: messageData.userId,
      });
      
      // Broadcast to all users in the community room (including sender)
      io.to(communityIdStr).emit('new_message', messageData);
      
      // Also emit to sender specifically to ensure they receive it
      io.sockets.sockets.forEach((socket) => {
        const socketUserId = socket.userId || socket.handshake?.auth?.userId;
        if (socketUserId && socketUserId.toString() === userId.toString()) {
          socket.emit('new_message', messageData);
        }
      });
    } else {
      console.warn('[REST API] ⚠️ Socket.io instance not available, message not broadcast');
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        message: {
          id: message._id,
          _id: message._id,
          userId: message.userId._id,
          username: message.userId.username,
          avatar: message.userId.picture,
          content: message.content,
          type: message.type,
          fileUrl: message.fileUrl,
          fileName: message.fileName,
          fileSize: message.fileSize,
          duration: message.duration,
          timestamp: message.createdAt,
          createdAt: message.createdAt,
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
        },
      },
    });

    // Check moderation asynchronously after message is sent (don't block response)
    if (finalType === 'text' && finalContent && io) {
      // Run moderation check in background
      setImmediate(async () => {
        try {
          const { classifyContent } = require('../utils/geminiModeration');
          console.log('[Content Moderation] Checking message asynchronously:', finalContent.substring(0, 50) + '...');
          
          const moderationResult = await classifyContent(finalContent);
          
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
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete messages
exports.deleteMessages = async (req, res) => {
  try {
    // Route uses :id, so extract from req.params.id
    const communityId = req.params.id || req.params.communityId;
    const { messageIds, scope } = req.body || {};
    const userId =
      (req.body && req.body.userId) ||
      req.query?.userId ||
      req.user?.id ||
      req.user?._id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const deleteScope = scope === 'everyone' ? 'everyone' : 'me';
    const io = req.app?.get('io');

    if (deleteScope === 'me') {
      // Delete for me: hide selected messages (or the whole chat if no messageIds provided) for this user only
      const filter = messageIds && Array.isArray(messageIds) && messageIds.length > 0
        ? { _id: { $in: messageIds }, communityId }
        : { communityId };

      await Message.updateMany(filter, { $addToSet: { deletedFor: userId } });

      // Emit to this user's sockets only (multi-device sync)
      try {
        if (io) {
          const idsToEmit = (messageIds && Array.isArray(messageIds) && messageIds.length > 0)
            ? messageIds.map(String)
            : [];
          io.sockets.sockets.forEach((s) => {
            const socketUserId = s.userId || s.handshake?.auth?.userId;
            if (socketUserId === userId.toString()) {
              // If no ids, client should just clear local list
              s.emit('message_deleted', { communityId, messageIds: idsToEmit, scope: 'me', userId: userId.toString() });
            }
          });
        }
      } catch (e) {
        console.warn('Failed to emit message_deleted(me):', e?.message || e);
      }

      return res.status(200).json({
        success: true,
        message: 'Messages deleted for you',
      });
    }

    // delete for everyone:
    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      // Allow owner (community creator) to delete any message in the community.
      // Non-owners can only delete their own messages.
      const Community = require('../models/Community');
      const community = await Community.findById(communityId).select('createdBy').lean();
      const isOwner =
        community?.createdBy?.toString() &&
        community.createdBy.toString() === userId.toString();

      // Compute which messages are actually deletable (for accurate socket emission)
      const deletableDocs = await Message.find({
        _id: { $in: messageIds },
        communityId,
        ...(isOwner ? {} : { userId }),
      }).select('_id').lean();
      const deletableIds = deletableDocs.map(d => d._id.toString());

      // Delete specific messages
      await Message.updateMany(
        { 
          _id: { $in: messageIds }, 
          communityId,
          ...(isOwner ? {} : { userId }), // Only allow users to delete their own messages unless owner
        },
        { 
          isDeleted: true,
          content: 'This message was deleted',
        }
      );

      // Broadcast deletion to the whole community room (real-time)
      try {
        if (io) {
          deletableIds.forEach((mid) => {
            io.to(communityId.toString()).emit('message_deleted', { messageId: mid, communityId, scope: 'everyone' });
          });
        }
      } catch (e) {
        console.warn('Failed to emit message_deleted(everyone):', e?.message || e);
      }
    } else {
      // Clear all messages in community (owner only)
      const Community = require('../models/Community');
      const community = await Community.findById(communityId).select('createdBy').lean();
      const isOwner =
        community?.createdBy?.toString() &&
        community.createdBy.toString() === userId.toString();

      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Only the community owner can clear the chat',
        });
      }

      await Message.updateMany(
        { communityId },
        { 
          isDeleted: true,
          content: 'This message was deleted',
        }
      );

      // Broadcast a clear event (client may choose to clear list)
      try {
        if (io) {
          io.to(communityId.toString()).emit('message_deleted', { communityId, scope: 'everyone', cleared: true });
        }
      } catch (e) {
        console.warn('Failed to emit message_deleted(clear):', e?.message || e);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Messages deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete messages',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Mark messages as read
exports.markMessagesRead = async (req, res) => {
  try {
    // Route uses :id, so extract from req.params.id
    const communityId = req.params.id || req.params.communityId;
    const { userId, messageIds } = req.body;

    if (!userId || !messageIds || messageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User ID and message IDs are required',
      });
    }

    await Message.updateMany(
      { _id: { $in: messageIds }, communityId },
      { 
        $addToSet: { 
          readBy: { 
            userId, 
            readAt: new Date() 
          } 
        } 
      }
    );

    res.status(200).json({
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

