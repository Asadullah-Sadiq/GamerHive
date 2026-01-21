const Feedback = require('../models/Feedback');
const User = require('../models/User');

// Submit feedback (contact us form)
exports.submitFeedback = async (req, res) => {
  try {
    const { name, email, subject, message, userId } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // If userId is provided, verify user exists
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }
    }

    // Create feedback
    const feedback = new Feedback({
      name,
      email,
      subject,
      message,
      userId: userId || null,
      status: 'new',
    });

    await feedback.save();

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: {
        feedback: {
          id: feedback._id,
          name: feedback.name,
          email: feedback.email,
          subject: feedback.subject,
          message: feedback.message,
          status: feedback.status,
          createdAt: feedback.createdAt,
        },
      },
    });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get all feedback (admin only)
exports.getAllFeedback = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    const query = {};
    if (status && ['new', 'read', 'replied', 'resolved'].includes(status)) {
      query.status = status;
    }

    // Get feedback with pagination
    const feedback = await Feedback.find(query)
      .populate('userId', 'username email picture')
      .populate('reply.repliedBy', 'username email picture')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Feedback.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        feedback: feedback.map(f => ({
          id: f._id,
          name: f.name,
          email: f.email,
          subject: f.subject,
          message: f.message,
          status: f.status,
          reply: f.reply && f.reply.message ? {
            message: f.reply.message,
            repliedBy: f.reply.repliedBy ? {
              id: f.reply.repliedBy._id,
              username: f.reply.repliedBy.username,
              email: f.reply.repliedBy.email,
              picture: f.reply.repliedBy.picture,
            } : null,
            repliedAt: f.reply.repliedAt,
          } : null,
          userId: f.userId ? {
            id: f.userId._id,
            username: f.userId.username,
            email: f.userId.email,
            picture: f.userId.picture,
          } : null,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get all feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Update feedback status (admin only)
exports.updateFeedbackStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['new', 'read', 'replied', 'resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required (new, read, replied, resolved)',
      });
    }

    const feedback = await Feedback.findByIdAndUpdate(
      id,
      { status, updatedAt: Date.now() },
      { new: true }
    )
      .populate('userId', 'username email picture')
      .populate('reply.repliedBy', 'username email picture');

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Feedback status updated successfully',
      data: {
        feedback: {
          id: feedback._id,
          name: feedback.name,
          email: feedback.email,
          subject: feedback.subject,
          message: feedback.message,
          status: feedback.status,
          userId: feedback.userId ? {
            id: feedback.userId._id,
            username: feedback.userId.username,
            email: feedback.userId.email,
            picture: feedback.userId.picture,
          } : null,
          createdAt: feedback.createdAt,
          updatedAt: feedback.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Update feedback status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update feedback status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete feedback (admin only)
exports.deleteFeedback = async (req, res) => {
  try {
    const { id } = req.params;

    const feedback = await Feedback.findByIdAndDelete(id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Feedback deleted successfully',
    });
  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete feedback',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Reply to feedback (admin only)
exports.replyToFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { replyMessage, adminId } = req.body;

    if (!replyMessage || !replyMessage.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Reply message is required',
      });
    }

    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: 'Admin ID is required',
      });
    }

    // Verify admin exists
    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Find feedback
    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    // Update feedback with reply and set status to replied
    feedback.reply = {
      message: replyMessage.trim(),
      repliedBy: adminId,
      repliedAt: Date.now(),
    };
    feedback.status = 'replied';
    feedback.updatedAt = Date.now();

    await feedback.save();
    await feedback.populate('userId', 'username email picture');
    await feedback.populate('reply.repliedBy', 'username email picture');

    // Create notification for the user if they have an account
    if (feedback.userId) {
      const Notification = require('../models/Notification');
      const notification = new Notification({
        userId: feedback.userId._id,
        type: 'feedback_reply',
        title: 'Feedback Reply',
        message: `Admin has replied to your feedback: "${feedback.subject}"`,
        relatedUserId: adminId,
        relatedData: {
          feedbackId: feedback._id,
          feedbackSubject: feedback.subject,
          replyMessage: replyMessage.trim(),
        },
        priority: 'high',
      });
      await notification.save();
    }

    res.status(200).json({
      success: true,
      message: 'Reply sent successfully',
      data: {
        feedback: {
          id: feedback._id,
          name: feedback.name,
          email: feedback.email,
          subject: feedback.subject,
          message: feedback.message,
          status: feedback.status,
          reply: feedback.reply,
          userId: feedback.userId ? {
            id: feedback.userId._id,
            username: feedback.userId.username,
            email: feedback.userId.email,
            picture: feedback.userId.picture,
          } : null,
          createdAt: feedback.createdAt,
          updatedAt: feedback.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error('Reply to feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reply',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get feedback statistics (admin only)
exports.getFeedbackStats = async (req, res) => {
  try {
    const total = await Feedback.countDocuments();
    const newCount = await Feedback.countDocuments({ status: 'new' });
    const readCount = await Feedback.countDocuments({ status: 'read' });
    const repliedCount = await Feedback.countDocuments({ status: 'replied' });
    const resolvedCount = await Feedback.countDocuments({ status: 'resolved' });

    res.status(200).json({
      success: true,
      data: {
        total,
        new: newCount,
        read: readCount,
        replied: repliedCount,
        resolved: resolvedCount,
      },
    });
  } catch (error) {
    console.error('Get feedback stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedback statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

