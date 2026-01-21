const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const uploadMedia = require('../middleware/uploadMedia');
const { 
  createCommunity,
  getAllCommunities,
  getCommunity,
  joinCommunity,
  getCommunityMembers,
  updateCommunity,
  deleteCommunity,
  deleteMultipleCommunities
} = require('../controllers/communityController');
const {
  getCommunityMessages,
  sendMessage,
  deleteMessages,
  markMessagesRead
} = require('../controllers/messageController');

// Create community (with file upload) or set image URL
router.post('/', (req, res, next) => {
  // If image URL is provided in body (for URL selection), skip multer
  if (req.body.image && !req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }
  // Otherwise use multer for file upload
  upload.single('image')(req, res, next);
}, createCommunity);

// Get all communities
router.get('/', getAllCommunities);

// Join community
router.post('/join', joinCommunity);

// Get community members
router.get('/:id/members', getCommunityMembers);

// Update community (with file upload) or set image URL
// Put this before GET /:id to avoid route conflicts
router.put('/:id', (req, res, next) => {
  // If image URL is provided in body (for URL selection), skip multer
  if (req.body.image && !req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }
  // Otherwise use multer for file upload
  upload.single('image')(req, res, next);
}, updateCommunity);

// Get single community
router.get('/:id', getCommunity);

// Delete single community
router.delete('/:id', deleteCommunity);

// Delete multiple communities
router.delete('/', deleteMultipleCommunities);

// ============================================
// MESSAGE ROUTES (for fallback REST API)
// Real-time messaging uses Socket.io
// ============================================

// Get messages for a community (with pagination)
router.get('/:id/messages', getCommunityMessages);

// Send a message (fallback if socket fails) - supports file uploads
router.post('/:id/messages', (req, res, next) => {
  // If it's multipart/form-data (file upload), use multer
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    // Use uploadMedia middleware that accepts both images and videos
    // Try 'image' field first, then 'video' field
    uploadMedia.fields([
      { name: 'image', maxCount: 1 },
      { name: 'video', maxCount: 1 }
    ])(req, res, next);
  } else {
    next();
  }
}, sendMessage);

// Delete messages
router.delete('/:id/messages', deleteMessages);

// Mark messages as read
router.patch('/:id/messages/read', markMessagesRead);

module.exports = router;

