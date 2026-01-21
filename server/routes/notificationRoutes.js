const express = require('express');
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  registerToken,
} = require('../controllers/notificationController');

// Get notifications
router.get('/', getNotifications);

// Register push token
router.post('/register-token', registerToken);

// Mark notification as read
router.patch('/mark-read', markAsRead);
router.put('/read', markAsRead); // Keep for backward compatibility

// Mark all notifications as read
router.put('/read-all', markAllAsRead);

// Delete notification
router.delete('/:id', deleteNotification);

module.exports = router;

