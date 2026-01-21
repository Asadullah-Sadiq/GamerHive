const Notification = require('../models/Notification');
const User = require('../models/User');

/*  
==========================================================
  GET NOTIFICATIONS
==========================================================
*/
exports.getNotifications = async (req, res) => {
  try {
    const { userId, all } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Build query - notifications where user is receiver OR targetGroupId matches user's communities
    const User = require('../models/User');
    const user = await User.findById(userId).select('joinedCommunities');
    const userCommunities = user?.joinedCommunities || [];

    const query = {
      $or: [
        { receiverId: userId },
        { 
          targetGroupId: { $in: userCommunities },
          senderId: { $ne: userId }, // Exclude notifications where user is the sender
        },
      ],
    };

    // If 'all' parameter is not true, return only unread notifications
    if (all !== 'true') {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .populate('senderId', 'name username picture')
      .populate('receiverId', 'name username picture')
      .populate('targetGroupId', 'name')
      .sort({ createdAt: -1 })
      .limit(100); // Limit to 100 most recent

    // Count unread (excluding notifications where user is sender)
    const unreadCount = await Notification.countDocuments({
      $or: [
        { receiverId: userId, isRead: false },
        { 
          targetGroupId: { $in: userCommunities }, 
          isRead: false,
          senderId: { $ne: userId }, // Exclude notifications where user is the sender
        },
      ],
    });

    res.status(200).json({
      success: true,
      data: {
        notifications: notifications.map((n) => ({
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
          readAt: n.readAt,
          createdAt: n.createdAt,
        })),
        unreadCount,
      },
    });

  } catch (error) {
    console.error('Get notifications error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get notifications',
    });
  }
};



/*  
==========================================================
   MARK SINGLE NOTIFICATION AS READ
==========================================================
*/
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.body;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: 'Notification ID is required',
      });
    }

    const notification = await Notification.findByIdAndUpdate(
      notificationId,
      {
        isRead: true,
        readAt: new Date(),
      },
      { new: true }
    )
      .populate('senderId', 'name username picture');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: {
        notification: {
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
          readAt: notification.readAt,
          createdAt: notification.createdAt,
        },
      },
    });

  } catch (error) {
    console.error('Mark as read error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
    });
  }
};



/*  
==========================================================
   MARK ALL AS READ
==========================================================
*/
exports.markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Get user's communities
    const User = require('../models/User');
    const user = await User.findById(userId).select('joinedCommunities');
    const userCommunities = user?.joinedCommunities || [];

    await Notification.updateMany(
      {
        $or: [
          { receiverId: userId, isRead: false },
          { 
            targetGroupId: { $in: userCommunities }, 
            isRead: false,
            senderId: { $ne: userId }, // Exclude notifications where user is the sender
          },
        ],
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });

  } catch (error) {
    console.error('Mark all as read error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
    });
  }
};



/*  
==========================================================
   DELETE NOTIFICATION
==========================================================
*/
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notificationId = id || req.body.notificationId;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: 'Notification ID is required',
      });
    }

    const notification = await Notification.findByIdAndDelete(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
    });

  } catch (error) {
    console.error('Delete notification error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
    });
  }
};



/*  
==========================================================
   REGISTER PUSH TOKEN
==========================================================
*/
exports.registerToken = async (req, res) => {
  try {
    const { userId, pushToken, platform } = req.body;

    if (!userId || !pushToken) {
      return res.status(400).json({
        success: false,
        message: 'User ID and push token are required',
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        pushToken,
        pushTokenPlatform: platform || null,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Push token registered successfully',
      data: {
        userId: user._id,
        hasPushToken: !!user.pushToken,
      },
    });

  } catch (error) {
    console.error('Register push token error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to register push token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
