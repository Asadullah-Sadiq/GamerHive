const User = require('../models/User');
const Rating = require('../models/Rating');
const { calculateProfileRank } = require('../utils/profileRanking');
const fs = require('fs');
const path = require('path');

const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";
function isAdminUser(user) {
  if (!user) return false;
  return (
    user.isAdmin === true ||
    (user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase())
  );
}

// Get User Profile Rank
exports.getUserProfileRank = async (req, res) => {
  try {
    const userId = req.params.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const user = await User.findById(userId).select('friends profileRank contentQuality isAdmin email');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Do not show / compute ranking for admin users
    if (isAdminUser(user)) {
      return res.status(200).json({
        success: true,
        data: null,
        message: 'Profile ranking is not shown for admin users',
      });
    }

    // Calculate followers count
    const followersCount = user.friends ? user.friends.length : 0;

    // Calculate average rating
    const ratings = await Rating.find({ ratedUserId: userId });
    let averageRating = 0;
    if (ratings.length > 0) {
      const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
      averageRating = totalRating / ratings.length;
    }

    // Get content quality score from user's contentQuality stats
    const contentQualityScore = user.contentQuality?.averageQualityScore || 50;

    // Calculate profile rank (now includes content quality)
    const rankData = calculateProfileRank(followersCount, averageRating, contentQualityScore);

    // Update user's profile rank in database (cache it)
    const shouldUpdateRank = !user.profileRank || 
      !user.profileRank.lastCalculated || 
      (Date.now() - new Date(user.profileRank.lastCalculated).getTime()) > 3600000; // Update if older than 1 hour

    if (shouldUpdateRank) {
      user.profileRank = {
        rank: rankData.rank,
        rankScore: rankData.rankScore,
        rankColor: rankData.rankColor,
        lastCalculated: new Date(),
      };
      await user.save();
    }

    res.status(200).json({
      success: true,
      data: {
        rank: user.profileRank?.rank || rankData.rank,
        rankScore: user.profileRank?.rankScore || rankData.rankScore,
        rankColor: user.profileRank?.rankColor || rankData.rankColor,
        followersCount: followersCount,
        averageRating: rankData.averageRating,
        progress: rankData.progress,
      },
    });
  } catch (error) {
    console.error('Get user profile rank error:', error);

    // Return a more helpful error message
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile rank. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Upload Profile Picture
exports.uploadProfilePicture = async (req, res) => {
  try {
    // Get user ID from request (you can get this from JWT token in production)
    const userId = req.body.userId || req.params.userId;
    
    if (!userId) {
      // If file was uploaded but no userId, delete the uploaded file and return error
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      // Delete uploaded file if user not found
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    let pictureUrl;

    // Check if picture URL is provided directly (for avatar selection)
    if (req.body.picture && !req.file) {
      pictureUrl = req.body.picture;
      
      // Delete old profile picture only if it's from uploads folder
      if (user.picture && user.picture.includes('/uploads/')) {
        try {
          // Extract filename from various URL formats
          let oldFileName = null;
          const urlParts = user.picture.split('/uploads/');
          if (urlParts.length > 1) {
            // Get the filename, removing any query parameters
            oldFileName = urlParts[1].split('?')[0].split('#')[0];
          }
          
          if (oldFileName) {
            const oldFilePath = path.join(__dirname, '..', 'uploads', oldFileName);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              console.log(`Deleted old profile picture: ${oldFileName}`);
            }
          }
        } catch (error) {
          console.error('Error deleting old profile picture:', error);
        }
      }
    } 
    // Check if file was uploaded
    else if (req.file) {
      // Delete old profile picture if exists
      if (user.picture && user.picture.includes('/uploads/')) {
        try {
          // Extract filename from various URL formats
          let oldFileName = null;
          const urlParts = user.picture.split('/uploads/');
          if (urlParts.length > 1) {
            // Get the filename, removing any query parameters
            oldFileName = urlParts[1].split('?')[0].split('#')[0];
          }
          
          if (oldFileName) {
            const oldFilePath = path.join(__dirname, '..', 'uploads', oldFileName);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              console.log(`Deleted old profile picture: ${oldFileName}`);
            }
          }
        } catch (error) {
          console.error('Error deleting old profile picture:', error);
        }
      }

      // Create picture URL for uploaded file - always use localhost
      const port = process.env.PORT || 3000;
      pictureUrl = `http://localhost:${port}/uploads/${req.file.filename}`;
    } else {
      return res.status(400).json({
        success: false,
        message: 'No image file or picture URL provided',
      });
    }

    // Update user picture
    user.picture = pictureUrl;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        picture: user.picture,
      },
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);

    // Delete uploaded file on error
    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete Profile Picture
exports.deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.body.userId || req.params.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Delete profile picture file if exists
    if (user.picture && user.picture.includes('/uploads/')) {
      try {
        // Extract filename from various URL formats
        let fileName = null;
        const urlParts = user.picture.split('/uploads/');
        if (urlParts.length > 1) {
          fileName = urlParts[1].split('?')[0].split('#')[0];
        }
        
        if (fileName) {
          const filePath = path.join(__dirname, '..', 'uploads', fileName);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      } catch (error) {
        console.error('Error deleting profile picture:', error);
      }
    }

    // Remove picture from user
    user.picture = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile picture deleted successfully',
    });
  } catch (error) {
    console.error('Delete profile picture error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete profile picture',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Upload Cover Photo
exports.uploadCoverPhoto = async (req, res) => {
  try {
    const userId = req.body.userId || req.params.userId;
    
    if (!userId) {
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      if (req.file) {
        const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    let coverPhotoUrl;

    if (req.body.coverPhoto && !req.file) {
      coverPhotoUrl = req.body.coverPhoto;
      
      if (user.coverPhoto && user.coverPhoto.includes('/uploads/')) {
        try {
          // Extract filename from various URL formats
          let oldFileName = null;
          const urlParts = user.coverPhoto.split('/uploads/');
          if (urlParts.length > 1) {
            oldFileName = urlParts[1].split('?')[0].split('#')[0];
          }
          
          if (oldFileName) {
            const oldFilePath = path.join(__dirname, '..', 'uploads', oldFileName);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              console.log(`Deleted old cover photo: ${oldFileName}`);
            }
          }
        } catch (error) {
          console.error('Error deleting old cover photo:', error);
        }
      }
    } else if (req.file) {
      if (user.coverPhoto && user.coverPhoto.includes('/uploads/')) {
        try {
          // Extract filename from various URL formats
          let oldFileName = null;
          const urlParts = user.coverPhoto.split('/uploads/');
          if (urlParts.length > 1) {
            oldFileName = urlParts[1].split('?')[0].split('#')[0];
          }
          
          if (oldFileName) {
            const oldFilePath = path.join(__dirname, '..', 'uploads', oldFileName);
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              console.log(`Deleted old cover photo: ${oldFileName}`);
            }
          }
        } catch (error) {
          console.error('Error deleting old cover photo:', error);
        }
      }

      // Always use localhost for file URLs
      const port = process.env.PORT || 3000;
      coverPhotoUrl = `http://localhost:${port}/uploads/${req.file.filename}`;
    } else {
      return res.status(400).json({
        success: false,
        message: 'No image file or cover photo URL provided',
      });
    }

    user.coverPhoto = coverPhotoUrl;
    await user.save();

    // Emit real-time update to all connected clients for this user
    try {
      const io = req.app ? req.app.get('io') : null;
      if (io) {
        io.emit('profile_updated', {
          userId: userId,
          type: 'coverPhoto',
          coverPhoto: user.coverPhoto,
        });
        console.log(`📡 Emitted profile_updated event for user ${userId} (coverPhoto)`);
      }
    } catch (socketError) {
      console.error('Error emitting profile update:', socketError);
      // Don't fail the request if socket emit fails
    }

    res.status(200).json({
      success: true,
      message: 'Cover photo uploaded successfully',
      data: {
        coverPhoto: user.coverPhoto,
      },
    });
  } catch (error) {
    console.error('Upload cover photo error:', error);

    if (req.file) {
      const filePath = path.join(__dirname, '..', 'uploads', req.file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to upload cover photo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete Cover Photo
exports.deleteCoverPhoto = async (req, res) => {
  try {
    const userId = req.body.userId || req.params.userId;

    if (!userId) {
      return res.status(400).json({
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

    if (user.coverPhoto && user.coverPhoto.includes('/uploads/')) {
      try {
        // Extract filename from various URL formats
        let fileName = null;
        const urlParts = user.coverPhoto.split('/uploads/');
        if (urlParts.length > 1) {
          fileName = urlParts[1].split('?')[0].split('#')[0];
        }
        
        if (fileName) {
          const filePath = path.join(__dirname, '..', 'uploads', fileName);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      } catch (error) {
        console.error('Error deleting cover photo:', error);
      }
    }

    user.coverPhoto = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Cover photo deleted successfully',
    });
  } catch (error) {
    console.error('Delete cover photo error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete cover photo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get User Profile
exports.getUserProfile = async (req, res) => {
  try {
    const userId = req.params.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const user = await User.findById(userId).select('-password').populate('friends', 'username picture name isActive');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Do not show / compute ranking for admin users
    if (isAdminUser(user)) {
      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            name: user.name,
            dateOfBirth: user.dateOfBirth,
            picture: user.picture,
            coverPhoto: user.coverPhoto,
            bio: user.bio || '',
            favoriteGames: user.favoriteGames || [],
            skillLevels: user.skillLevels ? Object.fromEntries(user.skillLevels) : {},
            friendsCount: user.friends ? user.friends.length : 0,
            friends: user.friends || [],
            isActive: user.isActive !== undefined ? user.isActive : true,
            createdAt: user.createdAt,
            isAdmin: true,
            profileRank: null,
          },
        },
      });
    }

    // Calculate followers count (friends array length)
    const followersCount = user.friends ? user.friends.length : 0;

    // Calculate average rating
    const ratings = await Rating.find({ ratedUserId: userId });
    let averageRating = 0;
    if (ratings.length > 0) {
      const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
      averageRating = totalRating / ratings.length;
    }

    // Get content quality score from user's contentQuality stats
    const contentQualityScore = user.contentQuality?.averageQualityScore || 50;

    // Calculate profile rank (now includes content quality)
    const rankData = calculateProfileRank(followersCount, averageRating, contentQualityScore);

    // Update user's profile rank in database (cache it)
    const shouldUpdateRank = !user.profileRank || 
      !user.profileRank.lastCalculated || 
      (Date.now() - new Date(user.profileRank.lastCalculated).getTime()) > 3600000; // Update if older than 1 hour

    if (shouldUpdateRank) {
      user.profileRank = {
        rank: rankData.rank,
        rankScore: rankData.rankScore,
        rankColor: rankData.rankColor,
        lastCalculated: new Date(),
      };
      await user.save();
    }

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          name: user.name,
          dateOfBirth: user.dateOfBirth,
          picture: user.picture,
          coverPhoto: user.coverPhoto,
          bio: user.bio || '',
          favoriteGames: user.favoriteGames || [],
          skillLevels: user.skillLevels ? Object.fromEntries(user.skillLevels) : {},
          friendsCount: followersCount,
          friends: user.friends || [],
          isActive: user.isActive !== undefined ? user.isActive : true,
          createdAt: user.createdAt,
          profileRank: {
            rank: user.profileRank?.rank || rankData.rank,
            rankScore: user.profileRank?.rankScore || rankData.rankScore,
            rankColor: user.profileRank?.rankColor || rankData.rankColor,
            averageRating: rankData.averageRating,
            progress: rankData.progress,
          },
        },
      },
    });
  } catch (error) {
    console.error('Get user profile error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get user profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Follow User (Mutual Friendship)
exports.followUser = async (req, res) => {
  try {
    const { userId, targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Target User ID are required',
      });
    }

    if (userId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself',
      });
    }

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User or Target User not found',
      });
    }

    // Check if already friends
    const isAlreadyFriend = user.friends.some(
      (friendId) => friendId.toString() === targetUserId
    );

    if (isAlreadyFriend) {
      return res.status(200).json({
        success: true,
        message: 'You are already friends with this user',
        data: {
          friendsCount: user.friends.length,
        },
      });
    }

    // Add mutual friendship - both users add each other
    user.friends.push(targetUserId);
    targetUser.friends.push(userId);

    await user.save();
    await targetUser.save();

    res.status(200).json({
      success: true,
      message: 'Successfully followed user',
      data: {
        friendsCount: user.friends.length,
        targetUserFriendsCount: targetUser.friends.length,
      },
    });
  } catch (error) {
    console.error('Follow user error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to follow user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Unfollow User
exports.unfollowUser = async (req, res) => {
  try {
    const { userId, targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Target User ID are required',
      });
    }

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User or Target User not found',
      });
    }

    // Remove from both users' friend lists
    user.friends = user.friends.filter(
      (friendId) => friendId.toString() !== targetUserId
    );
    targetUser.friends = targetUser.friends.filter(
      (friendId) => friendId.toString() !== userId
    );

    await user.save();
    await targetUser.save();

    res.status(200).json({
      success: true,
      message: 'Successfully unfollowed user',
      data: {
        friendsCount: user.friends.length,
        targetUserFriendsCount: targetUser.friends.length,
      },
    });
  } catch (error) {
    console.error('Unfollow user error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to unfollow user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get User Friends List
exports.getUserFriends = async (req, res) => {
  try {
    const userId = req.params.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const user = await User.findById(userId)
      .select('-password')
      .populate('friends', 'username picture name email');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        friends: user.friends || [],
        friendsCount: user.friends ? user.friends.length : 0,
      },
    });
  } catch (error) {
    console.error('Get user friends error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get user friends',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Check if users are friends
exports.checkFriendship = async (req, res) => {
  try {
    const { userId, targetUserId } = req.query;

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Target User ID are required',
      });
    }

    const user = await User.findById(userId).select('friends');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isFriend = user.friends.some(
      (friendId) => friendId.toString() === targetUserId
    );

    res.status(200).json({
      success: true,
      data: {
        isFriend: isFriend,
      },
    });
  } catch (error) {
    console.error('Check friendship error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to check friendship',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Send Friend Request
exports.sendFriendRequest = async (req, res) => {
  try {
    const { userId, targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Target User ID are required',
      });
    }

    if (userId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send a friend request to yourself',
      });
    }

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User or Target User not found',
      });
    }

    // Check if already friends
    const isAlreadyFriend = user.friends.some(
      (friendId) => friendId.toString() === targetUserId
    );

    if (isAlreadyFriend) {
      return res.status(200).json({
        success: true,
        message: 'You are already friends with this user',
        data: {
          status: 'friends',
        },
      });
    }

    // Check if friend request already sent
    const isRequestSent = user.sentFriendRequests.some(
      (requestId) => requestId.toString() === targetUserId
    );

    if (isRequestSent) {
      return res.status(200).json({
        success: true,
        message: 'Friend request already sent',
        data: {
          status: 'pending',
        },
      });
    }

    // Send friend request (don't auto-accept - wait for explicit acceptance)
    user.sentFriendRequests.push(targetUserId);
    targetUser.receivedFriendRequests.push(userId);

    await user.save();
    await targetUser.save();

    // Create notification for target user
    const Notification = require('../models/Notification');
    const notification = new Notification({
      userId: targetUserId,
      type: 'friend_request',
      title: 'New Friend Request',
      message: `${user.name || user.username} sent you a friend request`,
      relatedUserId: userId,
      priority: 'medium',
    });
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Friend request sent successfully',
      data: {
        status: 'pending',
      },
    });
  } catch (error) {
    console.error('Send friend request error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to send friend request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Accept Friend Request
exports.acceptFriendRequest = async (req, res) => {
  try {
    const { userId, targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Target User ID are required',
      });
    }

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User or Target User not found',
      });
    }

    // Check if request exists
    const hasReceivedRequest = user.receivedFriendRequests.some(
      (requestId) => requestId.toString() === targetUserId
    );

    if (!hasReceivedRequest) {
      return res.status(400).json({
        success: false,
        message: 'No friend request found from this user',
      });
    }

    // Add to friends list
    user.friends.push(targetUserId);
    targetUser.friends.push(userId);

    // Remove from friend requests
    user.receivedFriendRequests = user.receivedFriendRequests.filter(
      (requestId) => requestId.toString() !== targetUserId
    );
    targetUser.sentFriendRequests = targetUser.sentFriendRequests.filter(
      (requestId) => requestId.toString() !== userId
    );

    await user.save();
    await targetUser.save();

    // Create notification for target user
    const Notification = require('../models/Notification');
    const notification = new Notification({
      userId: targetUserId,
      type: 'friend_request_accepted',
      title: 'Friend Request Accepted',
      message: `${user.name || user.username} accepted your friend request`,
      relatedUserId: userId,
      priority: 'medium',
    });
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Friend request accepted successfully',
      data: {
        friendsCount: user.friends.length,
      },
    });
  } catch (error) {
    console.error('Accept friend request error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to accept friend request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Reject/Cancel Friend Request
exports.rejectFriendRequest = async (req, res) => {
  try {
    const { userId, targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Target User ID are required',
      });
    }

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User or Target User not found',
      });
    }

    // Remove from received requests (if user is rejecting)
    const hasReceivedRequest = user.receivedFriendRequests.some(
      (requestId) => requestId.toString() === targetUserId
    );

    // Remove from sent requests (if user is canceling)
    const hasSentRequest = user.sentFriendRequests.some(
      (requestId) => requestId.toString() === targetUserId
    );

    if (hasReceivedRequest) {
      user.receivedFriendRequests = user.receivedFriendRequests.filter(
        (requestId) => requestId.toString() !== targetUserId
      );
      targetUser.sentFriendRequests = targetUser.sentFriendRequests.filter(
        (requestId) => requestId.toString() !== userId
      );
    } else if (hasSentRequest) {
      user.sentFriendRequests = user.sentFriendRequests.filter(
        (requestId) => requestId.toString() !== targetUserId
      );
      targetUser.receivedFriendRequests = targetUser.receivedFriendRequests.filter(
        (requestId) => requestId.toString() !== userId
      );
    } else {
      return res.status(400).json({
        success: false,
        message: 'No friend request found',
      });
    }

    await user.save();
    await targetUser.save();

    // Create notification for target user when request is rejected
    const Notification = require('../models/Notification');
    const notification = new Notification({
      userId: targetUserId,
      type: 'system',
      title: 'Friend Request Rejected',
      message: `${user.name || user.username} ne aapki friend request reject kar di hai`,
      relatedUserId: userId,
      priority: 'medium',
    });
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'Friend request rejected/canceled successfully',
    });
  } catch (error) {
    console.error('Reject friend request error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to reject friend request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Update User Profile (Username, Email, Date of Birth, Name)
exports.updateUserProfile = async (req, res) => {
  try {
    const { userId, username, email, dateOfBirth, name } = req.body;

    if (!userId) {
      return res.status(400).json({
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

    // Update fields if provided
    if (username !== undefined && username.trim()) {
      // Check if username is already taken by another user
      const existingUser = await User.findOne({ username: username.trim(), _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken',
        });
      }
      user.username = username.trim();
    }
    if (name !== undefined && name.trim()) {
      user.name = name.trim();
    }
    if (email !== undefined && email.trim()) {
      // Check if email is already taken by another user
      const existingUser = await User.findOne({ email: email.trim().toLowerCase(), _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already taken',
        });
      }
      user.email = email.trim().toLowerCase();
    }
    if (dateOfBirth !== undefined) {
      user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    }

    await user.save();

    // Return updated user data
    const updatedUser = await User.findById(userId).select('-password');
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: updatedUser._id,
          username: updatedUser.username,
          name: updatedUser.name,
          email: updatedUser.email,
          dateOfBirth: updatedUser.dateOfBirth,
          picture: updatedUser.picture,
          coverPhoto: updatedUser.coverPhoto,
        },
      },
    });
  } catch (error) {
    console.error('Update user profile error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update user profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Update User Details (Bio, Games, Skill Levels)
exports.updateUserDetails = async (req, res) => {
  try {
    const { userId, bio, favoriteGames, skillLevels } = req.body;

    if (!userId) {
      return res.status(400).json({
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

    // Update fields if provided
    if (bio !== undefined) {
      user.bio = bio;
    }
    if (favoriteGames !== undefined) {
      user.favoriteGames = favoriteGames;
    }
    if (skillLevels !== undefined) {
      // Convert skillLevels object to Map
      user.skillLevels = new Map(Object.entries(skillLevels));
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User details updated successfully',
      data: {
        user: {
          id: user._id,
          bio: user.bio,
          favoriteGames: user.favoriteGames,
          skillLevels: Object.fromEntries(user.skillLevels || new Map()),
        },
      },
    });
  } catch (error) {
    console.error('Update user details error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update user details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Unfriend User
exports.unfriendUser = async (req, res) => {
  try {
    const { userId, targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Target User ID are required',
      });
    }

    if (userId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot unfriend yourself',
      });
    }

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User or Target User not found',
      });
    }

    // Check if they are friends
    const isFriend = user.friends.some(
      (friendId) => friendId.toString() === targetUserId
    );

    if (!isFriend) {
      return res.status(400).json({
        success: false,
        message: 'You are not friends with this user',
      });
    }

    // Remove from friends list
    user.friends = user.friends.filter(
      (friendId) => friendId.toString() !== targetUserId
    );
    targetUser.friends = targetUser.friends.filter(
      (friendId) => friendId.toString() !== userId
    );

    await user.save();
    await targetUser.save();

    // Create notification for target user
    const Notification = require('../models/Notification');
    const notification = new Notification({
      userId: targetUserId,
      type: 'system', // Using system type for unfriend notification
      title: 'Friend Removed',
      message: `${user.name || user.username} ne aapko apni friends list se remove kar diya hai`,
      relatedUserId: userId,
      priority: 'medium',
    });
    await notification.save();

    res.status(200).json({
      success: true,
      message: 'User unfriended successfully',
      data: {
        friendsCount: user.friends.length,
      },
    });
  } catch (error) {
    console.error('Unfriend user error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to unfriend user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get Received Friend Requests
exports.getReceivedFriendRequests = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const user = await User.findById(userId)
      .populate('receivedFriendRequests', 'name username picture email')
      .select('receivedFriendRequests');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        friendRequests: user.receivedFriendRequests || [],
        count: user.receivedFriendRequests?.length || 0,
      },
    });
  } catch (error) {
    console.error('Get received friend requests error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get friend requests',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Change Password
exports.changePassword = async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'User ID, old password, and new password are required',
      });
    }

    // Find user and include password
    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user has a password (Google users might not have password)
    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: 'Password change not available for this account type',
      });
    }

    // Verify old password
    const isPasswordValid = await user.comparePassword(oldPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Check if new password is different
    if (oldPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
      });
    }

    // Check password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    // Explicitly mark password as modified to ensure pre-save hook runs
    user.markModified('password');
    await user.save();

    // Verify the password was saved correctly by checking if we can login with new password
    const updatedUser = await User.findById(userId).select('+password');
    const testLogin = await updatedUser.comparePassword(newPassword);
    
    if (!testLogin) {
      console.error('Password change verification failed - new password does not match');
      return res.status(500).json({
        success: false,
        message: 'Password change failed - please try again',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Update Account Status (Active/Inactive) - Deactivate/Activate Account
exports.updateAccountStatus = async (req, res) => {
  try {
    const { userId, isActive } = req.body;

    if (!userId || isActive === undefined) {
      return res.status(400).json({
        success: false,
        message: 'User ID and isActive status are required',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update account status
    user.isActive = isActive;
    await user.save();

    const statusMessage = isActive 
      ? 'Account activated successfully. Welcome back!' 
      : 'Account deactivated successfully. You can reactivate anytime by logging in.';

    res.status(200).json({
      success: true,
      message: statusMessage,
      data: {
        isActive: user.isActive,
        userId: user._id,
      },
    });
  } catch (error) {
    console.error('Update account status error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update account status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete User Account
exports.deleteAccount = async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const user = await User.findById(userId).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify password if provided (for security)
    if (password && user.password) {
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid password. Account deletion requires password verification.',
        });
      }
    }

    // Delete user's profile picture and cover photo files if they exist
    if (user.picture && user.picture.includes('/uploads/')) {
      const picturePath = user.picture;
      const fileName = picturePath.split('/').pop();
      const filePath = path.join(__dirname, '..', 'uploads', fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    if (user.coverPhoto && user.coverPhoto.includes('/uploads/')) {
      const coverPhotoPath = user.coverPhoto;
      const fileName = coverPhotoPath.split('/').pop();
      const filePath = path.join(__dirname, '..', 'uploads', fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Remove user from all friends' friends lists
    await User.updateMany(
      { friends: userId },
      { $pull: { friends: userId } }
    );

    // Remove user from sent friend requests
    await User.updateMany(
      { receivedFriendRequests: userId },
      { $pull: { receivedFriendRequests: userId } }
    );

    // Remove user from received friend requests
    await User.updateMany(
      { sentFriendRequests: userId },
      { $pull: { sentFriendRequests: userId } }
    );

    // Delete user's notifications
    const Notification = require('../models/Notification');
    await Notification.deleteMany({ userId: userId });

    // Delete user's posts and their media files
    const Post = require('../models/Post');
    const userPosts = await Post.find({ userId: userId });
    for (const post of userPosts) {
      // Delete post media files
      if (post.media && post.media.includes('/uploads/')) {
        const mediaPath = post.media;
        const fileName = mediaPath.split('/').pop();
        const filePath = path.join(__dirname, '..', 'uploads', fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
    await Post.deleteMany({ userId: userId });

    // Delete user's games and their image files
    const Game = require('../models/Game');
    const userGames = await Game.find({ addedBy: userId });
    for (const game of userGames) {
      // Delete game image files
      if (game.image && game.image.includes('/uploads/')) {
        const imagePath = game.image;
        const fileName = imagePath.split('/').pop();
        const filePath = path.join(__dirname, '..', 'uploads', fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
    await Game.deleteMany({ addedBy: userId });

    // Delete user's messages in communities
    const Message = require('../models/Message');
    await Message.deleteMany({ userId: userId });

    // Remove user from communities' joinedCommunities arrays
    const Community = require('../models/Community');
    await Community.updateMany(
      { joinedCommunities: userId },
      { $pull: { joinedCommunities: userId }, $inc: { members: -1 } }
    );

    // Delete the user account
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Delete account error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Export User Data
exports.exportUserData = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const Post = require('../models/Post');
    const Game = require('../models/Game');
    const Community = require('../models/Community');

    // Get user profile with all populated data
    const user = await User.findById(userId)
      .select('-password')
      .populate('friends', 'username name picture email')
      .populate('joinedCommunities', 'name game description categories image color icon members activeMembers createdBy createdAt')
      .populate('games', 'title genre platform fileSize version description image status totalCopies availableCopies addedDate createdAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get user posts
    const posts = await Post.find({ userId })
      .populate('userId', 'username name picture')
      .populate('likes', 'username name picture')
      .sort({ createdAt: -1 });

    // Format posts data
    const formattedPosts = posts.map(post => ({
      id: post._id,
      description: post.description,
      media: post.media,
      mediaType: post.mediaType,
      likesCount: post.likes.length,
      commentsCount: post.comments.length,
      shares: post.shares,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      comments: post.comments.map(comment => ({
        id: comment._id,
        text: comment.text,
        userId: comment.userId?.toString() || comment.userId,
        createdAt: comment.createdAt,
        replies: comment.replies.map(reply => ({
          id: reply._id,
          text: reply.text,
          userId: reply.userId?.toString() || reply.userId,
          createdAt: reply.createdAt,
        })),
      })),
    }));

    // Format user data
    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        name: user.name,
        dateOfBirth: user.dateOfBirth,
        picture: user.picture,
        coverPhoto: user.coverPhoto,
        bio: user.bio || '',
        favoriteGames: user.favoriteGames || [],
        skillLevels: user.skillLevels ? Object.fromEntries(user.skillLevels) : {},
        isAdmin: user.isAdmin || false,
        isActive: user.isActive !== undefined ? user.isActive : true,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      friends: (user.friends || []).map(friend => ({
        id: friend._id.toString(),
        username: friend.username,
        name: friend.name,
        picture: friend.picture,
        email: friend.email,
      })),
      games: (user.games || []).map(game => ({
        id: game._id.toString(),
        title: game.title,
        genre: game.genre,
        platform: game.platform,
        fileSize: game.fileSize,
        version: game.version,
        description: game.description,
        image: game.image,
        status: game.status,
        totalCopies: game.totalCopies,
        availableCopies: game.availableCopies,
        addedDate: game.addedDate,
        createdAt: game.createdAt,
      })),
      communities: (user.joinedCommunities || []).map(community => ({
        id: community._id.toString(),
        name: community.name,
        game: community.game,
        description: community.description,
        categories: community.categories,
        image: community.image,
        color: community.color,
        icon: community.icon,
        members: community.members,
        activeMembers: community.activeMembers,
        createdBy: community.createdBy?.toString() || community.createdBy,
        createdAt: community.createdAt,
      })),
      posts: formattedPosts,
      statistics: {
        friendsCount: user.friends?.length || 0,
        gamesCount: user.games?.length || 0,
        communitiesCount: user.joinedCommunities?.length || 0,
        postsCount: formattedPosts.length,
        totalLikes: formattedPosts.reduce((sum, post) => sum + post.likesCount, 0),
        totalComments: formattedPosts.reduce((sum, post) => sum + post.commentsCount, 0),
      },
    };

    res.status(200).json({
      success: true,
      data: exportData,
    });
  } catch (error) {
    console.error('Export user data error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to export user data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Check Friend Request Status
exports.checkFriendRequestStatus = async (req, res) => {
  try {
    const { userId, targetUserId } = req.query;

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Target User ID are required',
      });
    }

    const user = await User.findById(userId).select('friends sentFriendRequests receivedFriendRequests');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if already friends
    const isFriend = user.friends.some(
      (friendId) => friendId.toString() === targetUserId
    );

    if (isFriend) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'friends',
        },
      });
    }

    // Check if request sent
    const isRequestSent = user.sentFriendRequests.some(
      (requestId) => requestId.toString() === targetUserId
    );

    if (isRequestSent) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'pending_sent',
        },
      });
    }

    // Check if request received
    const isRequestReceived = user.receivedFriendRequests.some(
      (requestId) => requestId.toString() === targetUserId
    );

    if (isRequestReceived) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'pending_received',
        },
      });
    }

    // No relationship
    return res.status(200).json({
      success: true,
      data: {
        status: 'none',
      },
    });
  } catch (error) {
    console.error('Check friend request status error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to check friend request status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get Blocked Users
exports.getBlockedUsers = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const user = await User.findById(userId)
      .select('blockedUsers')
      .populate('blockedUsers', 'username picture name isActive');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        blockedUsers: user.blockedUsers || [],
        blockedCount: user.blockedUsers ? user.blockedUsers.length : 0,
      },
    });
  } catch (error) {
    console.error('Get blocked users error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get blocked users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Block User
exports.blockUser = async (req, res) => {
  try {
    const { userId, targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Target User ID are required',
      });
    }

    if (userId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot block yourself',
      });
    }

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User or Target User not found',
      });
    }

    // Check if user is already blocked
    const isAlreadyBlocked = user.blockedUsers.some(
      (blockedId) => blockedId.toString() === targetUserId
    );

    if (isAlreadyBlocked) {
      return res.status(200).json({
        success: true,
        message: 'User is already blocked',
        data: {
          blockedUsers: user.blockedUsers,
          blockedCount: user.blockedUsers.length,
        },
      });
    }

    // Remove from friends if they are friends
    user.friends = user.friends.filter(
      (friendId) => friendId.toString() !== targetUserId
    );
    targetUser.friends = targetUser.friends.filter(
      (friendId) => friendId.toString() !== userId
    );

    // Remove from friend requests if any
    user.sentFriendRequests = user.sentFriendRequests.filter(
      (requestId) => requestId.toString() !== targetUserId
    );
    user.receivedFriendRequests = user.receivedFriendRequests.filter(
      (requestId) => requestId.toString() !== targetUserId
    );
    targetUser.sentFriendRequests = targetUser.sentFriendRequests.filter(
      (requestId) => requestId.toString() !== userId
    );
    targetUser.receivedFriendRequests = targetUser.receivedFriendRequests.filter(
      (requestId) => requestId.toString() !== userId
    );

    // Add to blocked list
    user.blockedUsers.push(targetUserId);

    await user.save();
    await targetUser.save();

    res.status(200).json({
      success: true,
      message: 'User blocked successfully',
      data: {
        blockedUsers: user.blockedUsers,
        blockedCount: user.blockedUsers.length,
      },
    });
  } catch (error) {
    console.error('Block user error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to block user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Unblock User
exports.unblockUser = async (req, res) => {
  try {
    const { userId, targetUserId } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Target User ID are required',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user is blocked
    const isBlocked = user.blockedUsers.some(
      (blockedId) => blockedId.toString() === targetUserId
    );

    if (!isBlocked) {
      return res.status(400).json({
        success: false,
        message: 'User is not blocked',
      });
    }

    // Remove from blocked list
    user.blockedUsers = user.blockedUsers.filter(
      (blockedId) => blockedId.toString() !== targetUserId
    );

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User unblocked successfully',
      data: {
        blockedUsers: user.blockedUsers,
        blockedCount: user.blockedUsers.length,
      },
    });
  } catch (error) {
    console.error('Unblock user error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to unblock user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Check if user is blocked
exports.checkIfBlocked = async (req, res) => {
  try {
    const { userId, targetUserId } = req.query;

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Target User ID are required',
      });
    }

    const user = await User.findById(userId).select('blockedUsers');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const isBlocked = user.blockedUsers.some(
      (blockedId) => blockedId.toString() === targetUserId
    );

    res.status(200).json({
      success: true,
      data: {
        isBlocked: isBlocked,
      },
    });
  } catch (error) {
    console.error('Check if blocked error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to check if user is blocked',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Report User
exports.reportUser = async (req, res) => {
  try {
    const { userId, targetUserId, reason, description } = req.body;

    if (!userId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'User ID and Target User ID are required',
      });
    }

    if (userId === targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot report yourself',
      });
    }

    const user = await User.findById(userId);
    const targetUser = await User.findById(targetUserId);

    if (!user || !targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User or Target User not found',
      });
    }

    // In a real application, you would save this to a reports collection
    // For now, we'll just log it and return success
    console.log('User Report:', {
      reportedBy: userId,
      reportedUser: targetUserId,
      reason: reason || 'Not specified',
      description: description || '',
      timestamp: new Date(),
    });

    res.status(200).json({
      success: true,
      message: 'User reported successfully. Our team will review this report.',
    });
  } catch (error) {
    console.error('Report user error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to report user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get All Users (Admin Only)
exports.getAllUsers = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Verify user is admin
    const requestingUser = await User.findById(userId);
    if (!requestingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Admin email - same as in frontend
    const ADMIN_EMAIL = "asadullahsadiq3@gmail.com";
    
    // Check if user is admin by isAdmin flag OR by email
    const isAdmin = requestingUser.isAdmin || 
                    (requestingUser.email && requestingUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.',
      });
    }

    // Get all users, excluding password and admin users
    const users = await User.find({
      $and: [
        { isAdmin: { $ne: true } }, // Exclude users with isAdmin flag
        { email: { $ne: ADMIN_EMAIL.toLowerCase() } } // Exclude admin email
      ]
    })
      .select('-password')
      .sort({ createdAt: -1 });

    // Format users data
    const formattedUsers = users.map(user => ({
      id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      dateOfBirth: user.dateOfBirth,
      picture: user.picture,
      coverPhoto: user.coverPhoto,
      bio: user.bio || '',
      isAdmin: user.isAdmin || false,
      isActive: user.isActive !== undefined ? user.isActive : true,
      createdAt: user.createdAt,
      friendsCount: user.friends ? user.friends.length : 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        users: formattedUsers,
        totalUsers: formattedUsers.length,
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to get all users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

