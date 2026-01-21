const Rating = require('../models/Rating');
const User = require('../models/User');

// Submit or update a rating
exports.submitRating = async (req, res) => {
  try {
    const { ratedUserId, raterUserId, rating } = req.body;

    // Validation
    if (!ratedUserId || !raterUserId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Rated user ID, rater user ID, and rating are required',
      });
    }

    // Validate rating value
    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be a number between 1 and 5',
      });
    }

    // Prevent users from rating themselves
    if (ratedUserId === raterUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot rate yourself',
      });
    }

    // Verify both users exist
    const ratedUser = await User.findById(ratedUserId);
    const raterUser = await User.findById(raterUserId);

    if (!ratedUser) {
      return res.status(404).json({
        success: false,
        message: 'Rated user not found',
      });
    }

    if (!raterUser) {
      return res.status(404).json({
        success: false,
        message: 'Rater user not found',
      });
    }

    // Find existing rating or create new one
    let existingRating = await Rating.findOne({
      ratedUserId,
      raterUserId,
    });

    if (existingRating) {
      // Update existing rating
      existingRating.rating = ratingNum;
      existingRating.updatedAt = Date.now();
      await existingRating.save();
    } else {
      // Create new rating
      existingRating = new Rating({
        ratedUserId,
        raterUserId,
        rating: ratingNum,
      });
      await existingRating.save();
    }

    // Calculate average rating for the rated user
    const allRatings = await Rating.find({ ratedUserId });
    const averageRating =
      allRatings.length > 0
        ? allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length
        : 0;

    res.status(200).json({
      success: true,
      message: existingRating.updatedAt.getTime() === existingRating.createdAt.getTime() 
        ? 'Rating submitted successfully' 
        : 'Rating updated successfully',
      data: {
        rating: {
          id: existingRating._id,
          ratedUserId: existingRating.ratedUserId,
          raterUserId: existingRating.raterUserId,
          rating: existingRating.rating,
          createdAt: existingRating.createdAt,
          updatedAt: existingRating.updatedAt,
        },
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
        totalRatings: allRatings.length,
      },
    });
  } catch (error) {
    console.error('Submit rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit rating',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get rating for a user (average rating and current user's rating if provided)
exports.getRating = async (req, res) => {
  try {
    const { userId } = req.params;
    const { raterUserId } = req.query; // Optional: to get current user's rating

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get all ratings for this user
    const allRatings = await Rating.find({ ratedUserId: userId });

    // Calculate average rating
    const averageRating =
      allRatings.length > 0
        ? allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length
        : 0;

    // Get current user's rating if raterUserId is provided
    let userRating = null;
    if (raterUserId) {
      const rating = await Rating.findOne({
        ratedUserId: userId,
        raterUserId: raterUserId,
      });
      if (rating) {
        userRating = {
          id: rating._id,
          rating: rating.rating,
          createdAt: rating.createdAt,
          updatedAt: rating.updatedAt,
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal place
        totalRatings: allRatings.length,
        userRating: userRating,
      },
    });
  } catch (error) {
    console.error('Get rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rating',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

