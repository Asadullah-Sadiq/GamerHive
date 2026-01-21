const express = require('express');
const router = express.Router();
const {
  getMessages,
  getConversations,
  sendMessage,
  sendMediaMessage,
  markAsRead,
  deleteMessage,
  clearChatForMe,
  upload,
} = require('../controllers/directMessageController');

// Conversation list for a user
router.get('/conversations/:userId', getConversations);

// Get messages between two users
router.get('/messages/:userId/:targetUserId', getMessages);

// Send a text message
router.post('/messages', sendMessage);

// Upload and send media message (image, video, audio, file)
router.post('/messages/media', upload.single('file'), sendMediaMessage);

// Mark messages as read
router.put('/messages/read', markAsRead);

// Delete a message
router.delete('/messages', deleteMessage);

// Clear chat for me (delete-from-my-side only)
router.delete('/messages/clear', clearChatForMe);

module.exports = router;

