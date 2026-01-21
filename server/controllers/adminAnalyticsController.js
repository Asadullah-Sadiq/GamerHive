/**
 * Admin Analytics Controller
 * Provides content moderation and profile ranking analytics
 */

const User = require('../models/User');
const Post = require('../models/Post');
const Message = require('../models/Message');
const mongoose = require('mongoose');

function isAdminUser(user) {
  if (!user) return false;
  const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";
  return (
    user.isAdmin === true ||
    (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase())
  );
}

/**
 * Get content moderation analytics
 */
exports.getModerationAnalytics = async (req, res) => {
  try {
    // checkAdmin middleware should already enforce this; keep a defensive check
    const currentUser = await User.findById(req.user?.id || req.user?._id);
    if (!isAdminUser(currentUser)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    // Get moderation stats for messages
    const messageStats = await Message.aggregate([
      {
        $match: {
          moderationCategory: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$moderationCategory',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get moderation stats for posts
    const postStats = await Post.aggregate([
      {
        $match: {
          'descriptionModeration.category': { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$descriptionModeration.category',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get moderation stats for comments
    const commentStats = await Post.aggregate([
      { $unwind: '$comments' },
      {
        $match: {
          'comments.moderation.category': { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$comments.moderation.category',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get moderation stats for replies
    const replyStats = await Post.aggregate([
      { $unwind: '$comments' },
      { $unwind: '$comments.replies' },
      {
        $match: {
          'comments.replies.moderation.category': { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$comments.replies.moderation.category',
          count: { $sum: 1 },
        },
      },
    ]);

    // Combine all stats
    const allStats = {
      SAFE: { messages: 0, posts: 0, comments: 0, replies: 0, total: 0 },
      MILD_INSULT: { messages: 0, posts: 0, comments: 0, replies: 0, total: 0 },
      HARMFUL: { messages: 0, posts: 0, comments: 0, replies: 0, total: 0 },
    };

    messageStats.forEach(stat => {
      if (allStats[stat._id]) {
        allStats[stat._id].messages = stat.count;
        allStats[stat._id].total += stat.count;
      }
    });

    postStats.forEach(stat => {
      if (allStats[stat._id]) {
        allStats[stat._id].posts = stat.count;
        allStats[stat._id].total += stat.count;
      }
    });

    commentStats.forEach(stat => {
      if (allStats[stat._id]) {
        allStats[stat._id].comments = stat.count;
        allStats[stat._id].total += stat.count;
      }
    });

    replyStats.forEach(stat => {
      if (allStats[stat._id]) {
        allStats[stat._id].replies = stat.count;
        allStats[stat._id].total += stat.count;
      }
    });

    // Get total content counts
    const totalMessages = await Message.countDocuments({ moderationCategory: { $exists: true, $ne: null } });
    const totalPosts = await Post.countDocuments({ 'descriptionModeration.category': { $exists: true, $ne: null } });
    const totalComments = await Post.aggregate([
      { $unwind: '$comments' },
      { $match: { 'comments.moderation.category': { $exists: true, $ne: null } } },
      { $count: 'total' },
    ]);
    const totalReplies = await Post.aggregate([
      { $unwind: '$comments' },
      { $unwind: '$comments.replies' },
      { $match: { 'comments.replies.moderation.category': { $exists: true, $ne: null } } },
      { $count: 'total' },
    ]);

    const totalModeratedContent = totalMessages + totalPosts + (totalComments[0]?.total || 0) + (totalReplies[0]?.total || 0);

    // Calculate percentages
    const safePercentage = totalModeratedContent > 0 
      ? Math.round((allStats.SAFE.total / totalModeratedContent) * 100) 
      : 0;
    const mildInsultPercentage = totalModeratedContent > 0 
      ? Math.round((allStats.MILD_INSULT.total / totalModeratedContent) * 100) 
      : 0;
    const harmfulPercentage = totalModeratedContent > 0 
      ? Math.round((allStats.HARMFUL.total / totalModeratedContent) * 100) 
      : 0;

    res.status(200).json({
      success: true,
      data: {
        stats: allStats,
        totals: {
          messages: totalMessages,
          posts: totalPosts,
          comments: totalComments[0]?.total || 0,
          replies: totalReplies[0]?.total || 0,
          total: totalModeratedContent,
        },
        percentages: {
          safe: safePercentage,
          mildInsult: mildInsultPercentage,
          harmful: harmfulPercentage,
        },
      },
    });
  } catch (error) {
    console.error('Error getting moderation analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get moderation analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get profile ranking analytics
 */
exports.getRankingAnalytics = async (req, res) => {
  try {
    // checkAdmin middleware should already enforce this; keep a defensive check
    const currentUser = await User.findById(req.user?.id || req.user?._id);
    if (!isAdminUser(currentUser)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    // Get users with content quality data
    const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";
    const usersWithQuality = await User.find({
      'contentQuality.totalContent': { $gt: 0 },
      isAdmin: { $ne: true },
      email: { $ne: ADMIN_EMAIL.toLowerCase() },
    }).select('contentQuality profileRank username email friends');

    // Calculate statistics
    const totalUsers = usersWithQuality.length;
    const avgQualityScore = totalUsers > 0
      ? usersWithQuality.reduce((sum, user) => sum + (user.contentQuality?.averageQualityScore || 50), 0) / totalUsers
      : 0;

    // Rank distribution
    const rankDistribution = {
      Bronze: 0,
      Silver: 0,
      Gold: 0,
      Platinum: 0,
      Diamond: 0,
      Master: 0,
      Grandmaster: 0,
      Legend: 0,
    };

    usersWithQuality.forEach(user => {
      const rank = user.profileRank?.rank || 'Bronze';
      if (rankDistribution.hasOwnProperty(rank)) {
        rankDistribution[rank]++;
      }
    });

    // Quality score distribution
    const qualityDistribution = {
      excellent: 0, // 90-100
      good: 0,    // 70-89
      average: 0,  // 50-69
      poor: 0,    // 30-49
      veryPoor: 0, // 0-29
    };

    usersWithQuality.forEach(user => {
      const score = user.contentQuality?.averageQualityScore || 50;
      if (score >= 90) qualityDistribution.excellent++;
      else if (score >= 70) qualityDistribution.good++;
      else if (score >= 50) qualityDistribution.average++;
      else if (score >= 30) qualityDistribution.poor++;
      else qualityDistribution.veryPoor++;
    });

    // Top users by quality score
    const topUsersByQuality = usersWithQuality
      .sort((a, b) => (b.contentQuality?.averageQualityScore || 0) - (a.contentQuality?.averageQualityScore || 0))
      .slice(0, 10)
      .map(user => ({
        userId: user._id,
        username: user.username,
        email: user.email,
        qualityScore: user.contentQuality?.averageQualityScore || 0,
        totalContent: user.contentQuality?.totalContent || 0,
        rank: user.profileRank?.rank || 'Bronze',
        rankScore: user.profileRank?.rankScore || 0,
      }));

    // Top users by rank score
    const topUsersByRank = usersWithQuality
      .sort((a, b) => (b.profileRank?.rankScore || 0) - (a.profileRank?.rankScore || 0))
      .slice(0, 10)
      .map(user => ({
        userId: user._id,
        username: user.username,
        email: user.email,
        rank: user.profileRank?.rank || 'Bronze',
        rankScore: user.profileRank?.rankScore || 0,
        qualityScore: user.contentQuality?.averageQualityScore || 0,
        followers: user.friends?.length || 0,
      }));

    // Content type distribution
    const contentTypeStats = {
      totalPosts: usersWithQuality.reduce((sum, user) => sum + (user.contentQuality?.totalPosts || 0), 0),
      totalComments: usersWithQuality.reduce((sum, user) => sum + (user.contentQuality?.totalComments || 0), 0),
      totalReplies: usersWithQuality.reduce((sum, user) => sum + (user.contentQuality?.totalReplies || 0), 0),
    };

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          avgQualityScore: Math.round(avgQualityScore * 10) / 10,
        },
        rankDistribution,
        qualityDistribution,
        topUsersByQuality,
        topUsersByRank,
        contentTypeStats,
      },
    });
  } catch (error) {
    console.error('Error getting ranking analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ranking analytics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * Get combined analytics dashboard data
 */
exports.getAnalyticsDashboard = async (req, res) => {
  try {
    // checkAdmin middleware should already enforce this; keep a defensive check
    const currentUser = await User.findById(req.user?.id || req.user?._id);
    if (!isAdminUser(currentUser)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }

    // Get moderation stats
    const messageStats = await Message.aggregate([
      { $match: { moderationCategory: { $exists: true, $ne: null } } },
      { $group: { _id: '$moderationCategory', count: { $sum: 1 } } },
    ]);

    const postStats = await Post.aggregate([
      { $match: { 'descriptionModeration.category': { $exists: true, $ne: null } } },
      { $group: { _id: '$descriptionModeration.category', count: { $sum: 1 } } },
    ]);

    const commentStats = await Post.aggregate([
      { $unwind: '$comments' },
      { $match: { 'comments.moderation.category': { $exists: true, $ne: null } } },
      { $group: { _id: '$comments.moderation.category', count: { $sum: 1 } } },
    ]);

    const replyStats = await Post.aggregate([
      { $unwind: '$comments' },
      { $unwind: '$comments.replies' },
      { $match: { 'comments.replies.moderation.category': { $exists: true, $ne: null } } },
      { $group: { _id: '$comments.replies.moderation.category', count: { $sum: 1 } } },
    ]);

    const allStats = {
      SAFE: { messages: 0, posts: 0, comments: 0, replies: 0, total: 0 },
      MILD_INSULT: { messages: 0, posts: 0, comments: 0, replies: 0, total: 0 },
      HARMFUL: { messages: 0, posts: 0, comments: 0, replies: 0, total: 0 },
    };

    messageStats.forEach(stat => {
      if (allStats[stat._id]) {
        allStats[stat._id].messages = stat.count;
        allStats[stat._id].total += stat.count;
      }
    });
    postStats.forEach(stat => {
      if (allStats[stat._id]) {
        allStats[stat._id].posts = stat.count;
        allStats[stat._id].total += stat.count;
      }
    });
    commentStats.forEach(stat => {
      if (allStats[stat._id]) {
        allStats[stat._id].comments = stat.count;
        allStats[stat._id].total += stat.count;
      }
    });
    replyStats.forEach(stat => {
      if (allStats[stat._id]) {
        allStats[stat._id].replies = stat.count;
        allStats[stat._id].total += stat.count;
      }
    });

    const totalModeratedContent = allStats.SAFE.total + allStats.MILD_INSULT.total + allStats.HARMFUL.total;

    // Get ranking analytics
    const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";
    const usersWithQuality = await User.find({
      'contentQuality.totalContent': { $gt: 0 },
      isAdmin: { $ne: true },
      email: { $ne: ADMIN_EMAIL.toLowerCase() },
    }).select('contentQuality profileRank username email friends');

    const totalUsers = usersWithQuality.length;
    const avgQualityScore = totalUsers > 0
      ? usersWithQuality.reduce((sum, user) => sum + (user.contentQuality?.averageQualityScore || 50), 0) / totalUsers
      : 0;

    const rankDistribution = {
      Bronze: 0, Silver: 0, Gold: 0, Platinum: 0,
      Diamond: 0, Master: 0, Grandmaster: 0, Legend: 0,
    };

    usersWithQuality.forEach(user => {
      const rank = user.profileRank?.rank || 'Bronze';
      if (rankDistribution.hasOwnProperty(rank)) {
        rankDistribution[rank]++;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        moderation: {
          stats: allStats,
          totals: {
            total: totalModeratedContent,
          },
        },
        ranking: {
          overview: {
            totalUsers,
            avgQualityScore: Math.round(avgQualityScore * 10) / 10,
          },
          rankDistribution,
        },
      },
    });
  } catch (error) {
    console.error('Error getting analytics dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get analytics dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
