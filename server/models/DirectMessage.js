const mongoose = require('mongoose');

const directMessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'file'],
    default: 'text',
  },
  fileUrl: {
    type: String,
    default: null,
  },
  fileName: {
    type: String,
    default: null,
  },
  fileSize: {
    type: String,
    default: null,
  },
  duration: {
    type: String,
    default: null,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: {
    type: Date,
    default: null,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  // Per-user delete (WhatsApp-style "Delete for me"):
  // If a user's id is in this array, that user should not see the message anymore.
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  }],
}, {
  timestamps: true,
});

// Compound indexes for efficient queries
directMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
directMessageSchema.index({ receiverId: 1, senderId: 1, createdAt: -1 });
directMessageSchema.index({ senderId: 1, createdAt: -1 });
directMessageSchema.index({ receiverId: 1, isRead: 1 });

module.exports = mongoose.model('DirectMessage', directMessageSchema);

