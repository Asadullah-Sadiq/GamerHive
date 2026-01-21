const express = require('express');
const router = express.Router();
const uploadPost = require('../middleware/uploadPost');
const { 
  createPost,
  getUserPosts,
  deletePost,
  updatePost,
  toggleLike,
  addComment,
  deleteComment
} = require('../controllers/postController');

// Create post (with file upload) or without media
router.post('/', (req, res, next) => {
  // If media URL is provided in body (for URL selection), skip multer
  if (req.body.media && !req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }
  // Otherwise use multer for file upload
  uploadPost.single('media')(req, res, next);
}, createPost);

// Get user posts
router.get('/user/:userId', getUserPosts);

// Update post
router.put('/:postId', updatePost);

// Delete post
router.delete('/:postId', deletePost);

// Like/Unlike post
router.post('/:postId/like', toggleLike);

// Add comment
router.post('/:postId/comment', addComment);

// Delete comment
router.delete('/:postId/comment/:commentId', deleteComment);

module.exports = router;

