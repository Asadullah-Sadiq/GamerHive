const express = require('express');
const router = express.Router();
const {
  submitFeedback,
  getAllFeedback,
  updateFeedbackStatus,
  deleteFeedback,
  getFeedbackStats,
  replyToFeedback,
} = require('../controllers/feedbackController');

// Submit feedback (public - anyone can submit)
router.post('/', submitFeedback);

// Get all feedback (admin only - should be protected by admin middleware)
router.get('/', getAllFeedback);

// Get feedback statistics (admin only)
router.get('/stats', getFeedbackStats);

// Update feedback status (admin only)
router.put('/:id/status', updateFeedbackStatus);

// Reply to feedback (admin only)
router.post('/:id/reply', replyToFeedback);

// Delete feedback (admin only)
router.delete('/:id', deleteFeedback);

module.exports = router;

