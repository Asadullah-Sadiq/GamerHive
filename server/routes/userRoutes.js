const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { 
  uploadProfilePicture,
  deleteProfilePicture,
  uploadCoverPhoto,
  deleteCoverPhoto,
  getUserProfile,
  getUserProfileRank,
  followUser,
  unfollowUser,
  getUserFriends,
  checkFriendship,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  checkFriendRequestStatus,
  getReceivedFriendRequests,
  updateUserDetails,
  updateUserProfile,
  unfriendUser,
  changePassword,
  updateAccountStatus,
  deleteAccount,
  getBlockedUsers,
  blockUser,
  unblockUser,
  checkIfBlocked,
  reportUser,
  exportUserData,
  getAllUsers
} = require('../controllers/userController');
const { submitRating, getRating } = require('../controllers/ratingController');

// Get user profile
router.get('/profile/:userId', getUserProfile);

// Get user profile rank
router.get('/profile/:userId/rank', getUserProfileRank);

// Upload profile picture (with file upload) or set avatar URL
router.put('/profile/picture', (req, res, next) => {
  // If picture URL is provided in body (for avatar selection), skip multer
  if (req.body.picture && !req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }
  // Otherwise use multer for file upload
  upload.single('picture')(req, res, next);
}, uploadProfilePicture);

router.post('/profile/picture', upload.single('picture'), uploadProfilePicture);

// Delete profile picture
router.delete('/profile/picture', deleteProfilePicture);

// Upload cover photo (with file upload) or set cover photo URL
router.put('/profile/cover-photo', (req, res, next) => {
  if (req.body.coverPhoto && !req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }
  upload.single('coverPhoto')(req, res, next);
}, uploadCoverPhoto);

router.post('/profile/cover-photo', upload.single('coverPhoto'), uploadCoverPhoto);

// Delete cover photo
router.delete('/profile/cover-photo', deleteCoverPhoto);

// Update User Profile (Username, Email, Date of Birth, Name)
router.put('/profile/update', updateUserProfile);

// Update User Details (Bio, Games, Skill Levels)
router.put('/profile/details', updateUserDetails);

// Change Password
router.put('/change-password', changePassword);

// Update Account Status
router.put('/account-status', updateAccountStatus);

// Delete Account
router.delete('/account', deleteAccount);

// Follow/Unfollow User
router.post('/follow', followUser);
router.post('/unfollow', unfollowUser);

// Get User Friends
router.get('/friends/:userId', getUserFriends);
router.get('/friends', getUserFriends);

// Check Friendship Status
router.get('/friendship/check', checkFriendship);

// Friend Request Routes
router.post('/friend-request/send', sendFriendRequest);
router.post('/friend-request/accept', acceptFriendRequest);
router.post('/friend-request/reject', rejectFriendRequest);
router.get('/friend-request/status', checkFriendRequestStatus);
router.get('/friend-request/received', getReceivedFriendRequests);

// Unfriend User
router.post('/unfriend', unfriendUser);

// Get Blocked Users
router.get('/blocked', getBlockedUsers);

// Block User
router.post('/block', blockUser);

// Unblock User
router.post('/unblock', unblockUser);

// Check if user is blocked
router.get('/check-blocked', checkIfBlocked);

// Report User
router.post('/report', reportUser);

// Export User Data
router.get('/export/:userId', exportUserData);

// Rating Routes
router.post('/rating', submitRating);
router.get('/rating/:userId', getRating);

// Get All Users (Admin Only)
router.get('/all', getAllUsers);

module.exports = router;

