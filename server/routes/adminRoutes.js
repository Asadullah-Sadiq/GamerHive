const express = require('express');
const router = express.Router();
const User = require('../models/User');
const {
  getModerationAnalytics,
  getRankingAnalytics,
  getAnalyticsDashboard,
} = require('../controllers/adminAnalyticsController');

// Middleware to check if user is admin
const checkAdmin = async (req, res, next) => {
  try {
    const userId = req.query.userId || req.body.userId || req.params.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";
    const isAdmin = user.isAdmin || (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    req.user = { id: user._id, _id: user._id };
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying admin access',
    });
  }
};

// Admin Analytics Routes
router.get('/analytics/moderation', checkAdmin, getModerationAnalytics);
router.get('/analytics/ranking', checkAdmin, getRankingAnalytics);
router.get('/analytics/dashboard', checkAdmin, getAnalyticsDashboard);

module.exports = router;
