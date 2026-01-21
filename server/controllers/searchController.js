const User = require('../models/User');
const Community = require('../models/Community');

// Global Search - Search across users and communities
exports.globalSearch = async (req, res) => {
  try {
    const { query, type, userId } = req.query; // userId is optional - current logged in user ID

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const searchQuery = query.trim();
    const searchType = type || 'all'; // 'all', 'users', 'communities'

    const results = {
      users: [],
      communities: [],
    };

    // Get all admin emails and usernames to exclude from search results
    const adminUsers = await User.find({ isAdmin: true }).select('email username');
    const adminEmails = adminUsers.map(admin => admin.email.toLowerCase());
    const adminUsernames = adminUsers.map(admin => admin.username?.toLowerCase()).filter(Boolean);

    // Search Users (exclude admin users and users with admin email/username)
    if (searchType === 'all' || searchType === 'users') {
      const searchQueryLower = searchQuery.toLowerCase();
      
      // Build query conditions
      const orConditions = [
        { username: { $regex: searchQuery, $options: 'i' } },
        { name: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
      ];

      // Build exclusion conditions
      const exclusionConditions = [
        { isAdmin: { $ne: true } }, // Exclude admin users
      ];

      // Exclude current logged in user from search results
      if (userId) {
        exclusionConditions.push({ _id: { $ne: userId } });
      }

      // Exclude admin emails
      if (adminEmails.length > 0) {
        exclusionConditions.push({ email: { $nin: adminEmails } });
      }

      // Exclude admin usernames
      if (adminUsernames.length > 0) {
        exclusionConditions.push({ username: { $nin: adminUsernames } });
      }

      // Combine conditions with $and
      const userQuery = {
        $and: [
          { $or: orConditions },
          ...exclusionConditions
        ]
      };

      const users = await User.find(userQuery)
        .select('username name email picture isAdmin')
        .limit(20); // Get more results to filter

      // Filter out any users that match admin email or username (additional safety check)
      const filteredUsers = users.filter(user => {
        // Double check: exclude if isAdmin is true
        if (user.isAdmin === true) {
          return false;
        }
        const userEmail = user.email?.toLowerCase();
        const userUsername = user.username?.toLowerCase();
        return !adminEmails.includes(userEmail) && !adminUsernames.includes(userUsername);
      }).slice(0, 10); // Limit to 10 after filtering

      results.users = filteredUsers.map(user => ({
        id: user._id,
        username: user.username,
        name: user.name || user.username,
        email: user.email,
        picture: user.picture,
        type: 'user',
      }));
    }

    // Search Communities
    if (searchType === 'all' || searchType === 'communities') {
      const communities = await Community.find({
        $or: [
          { name: { $regex: searchQuery, $options: 'i' } },
          { game: { $regex: searchQuery, $options: 'i' } },
          { description: { $regex: searchQuery, $options: 'i' } },
        ],
      })
        .select('name game description image members')
        .limit(10);

      results.communities = communities.map(community => ({
        id: community._id,
        name: community.name,
        game: community.game,
        description: community.description,
        image: community.image,
        members: community.members || 0,
        type: 'community',
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        query: searchQuery,
        results,
        totalResults: results.users.length + results.communities.length,
      },
    });
  } catch (error) {
    console.error('Global search error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to perform search',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

