const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  targetGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community',
    default: null,
    index: true,
  },
  type: {
    type: String,
    required: true,
    enum: [
      'post_like',
      'post_comment',
      'community_message',
      'direct_message',
      'game_added',
      'admin_community',
      'admin_tournament',
      'admin_game',
      'friend_request',
      'friend_request_accepted',
      'tournament',
      'system',
      'achievement',
      'feedback_reply',
    ],
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound indexes for efficient queries
notificationSchema.index({ receiverId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ targetGroupId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ receiverId: 1, type: 1, createdAt: -1 });
notificationSchema.index({ senderId: 1, receiverId: 1, type: 1, 'payload.postId': 1 }, { sparse: true }); // Prevent duplicates

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;

