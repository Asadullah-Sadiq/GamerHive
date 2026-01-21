const User = require('../models/User');
const Game = require('../models/Game');
const Tournament = require('../models/Tournament');
const Community = require('../models/Community');
const Stats = require('../models/Stats');

// Get active gamers count
exports.getActiveGamersCount = async (req, res) => {
  try {
    // Count all users in the database
    const activeGamersCount = await User.countDocuments({});
    
    res.status(200).json({
      success: true,
      data: {
        activeGamers: activeGamersCount,
      },
    });
  } catch (error) {
    console.error('Error fetching active gamers count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active gamers count',
      error: error.message,
    });
  }
};

// Get all stats
exports.getAllStats = async (req, res) => {
  try {
    const [activeGamersCount, tournamentsCount, gamesCount, communitiesCount, stats] = await Promise.all([
      User.countDocuments({}),
      Tournament.countDocuments({}),
      Game.countDocuments({}),
      Community.countDocuments({}),
      Stats.getOrCreate()
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        activeGamers: activeGamersCount,
        tournaments: tournamentsCount,
        totalTournamentsCreated: stats.totalTournamentsCreated || 0,
        gamesAvailable: gamesCount,
        communities: communitiesCount,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error.message,
    });
  }
};

// Get monthly user signups
exports.getMonthlyUserSignups = async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // MongoDB month is 1-12

    // Get current month's start and end dates
    const currentMonthStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
    const currentMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    // Get last 6 months for comparison (including current month)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Get current month signups
    const currentMonthSignups = await User.countDocuments({
      createdAt: {
        $gte: currentMonthStart,
        $lte: currentMonthEnd
      }
    });

    // Get last 6 months data for comparison
    const monthlySignups = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Generate data for last 6 months
    const monthLabels = [];
    const monthCounts = [];
    const monthData = {};

    // Initialize all 6 months with 0
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      const monthName = date.toLocaleString('default', { month: 'long' });
      
      monthLabels.push(monthName);
      monthData[key] = 0;
    }

    // Fill in actual data
    monthlySignups.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      if (monthData.hasOwnProperty(key)) {
        monthData[key] = item.count;
      }
    });

    // Convert to array in correct order
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      monthCounts.push(monthData[key] || 0);
    }

    // Get current month name
    const currentMonthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Calculate growth percentage (compare current month with previous month)
    let growthPercentage = 0;
    if (monthCounts.length >= 2) {
      const currentMonthValue = monthCounts[monthCounts.length - 1];
      const previousMonthValue = monthCounts[monthCounts.length - 2];
      if (previousMonthValue === 0) {
        growthPercentage = currentMonthValue > 0 ? 100 : 0;
      } else {
        growthPercentage = Math.round(((currentMonthValue - previousMonthValue) / previousMonthValue) * 100);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        currentMonth: currentMonthName,
        currentMonthSignups: currentMonthSignups,
        labels: monthLabels,
        values: monthCounts,
        totalUsers: await User.countDocuments({}),
        growthPercentage: growthPercentage
      },
    });
  } catch (error) {
    console.error('Error fetching monthly user signups:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly user signups',
      error: error.message,
    });
  }
};

// Get monthly game additions
exports.getMonthlyGameAdditions = async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // MongoDB month is 1-12

    // Get current month's start and end dates
    const currentMonthStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
    const currentMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    // Get last 6 months for comparison (including current month)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Get current month game additions
    const currentMonthGames = await Game.countDocuments({
      createdAt: {
        $gte: currentMonthStart,
        $lte: currentMonthEnd
      }
    });

    // Get last 6 months data for comparison
    const monthlyGames = await Game.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Generate data for last 6 months
    const monthLabels = [];
    const monthCounts = [];
    const monthData = {};

    // Initialize all 6 months with 0
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      const monthName = date.toLocaleString('default', { month: 'long' });
      
      monthLabels.push(monthName);
      monthData[key] = 0;
    }

    // Fill in actual data
    monthlyGames.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      if (monthData.hasOwnProperty(key)) {
        monthData[key] = item.count;
      }
    });

    // Convert to array in correct order
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      monthCounts.push(monthData[key] || 0);
    }

    // Get current month name
    const currentMonthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    res.status(200).json({
      success: true,
      data: {
        currentMonth: currentMonthName,
        currentMonthGames: currentMonthGames,
        labels: monthLabels,
        values: monthCounts,
        totalGames: await Game.countDocuments({})
      },
    });
  } catch (error) {
    console.error('Error fetching monthly game additions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly game additions',
      error: error.message,
    });
  }
};

// Get monthly tournament additions
exports.getMonthlyTournamentAdditions = async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // MongoDB month is 1-12

    // Get current month's start and end dates
    const currentMonthStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
    const currentMonthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    // Get last 6 months for comparison (including current month)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Get current month tournament additions
    const currentMonthTournaments = await Tournament.countDocuments({
      createdAt: {
        $gte: currentMonthStart,
        $lte: currentMonthEnd
      }
    });

    // Get last 6 months data for comparison
    const monthlyTournaments = await Tournament.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Generate data for last 6 months
    const monthLabels = [];
    const monthCounts = [];
    const monthData = {};

    // Initialize all 6 months with 0
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      const monthName = date.toLocaleString('default', { month: 'long' });
      
      monthLabels.push(monthName);
      monthData[key] = 0;
    }

    // Fill in actual data
    monthlyTournaments.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      if (monthData.hasOwnProperty(key)) {
        monthData[key] = item.count;
      }
    });

    // Convert to array in correct order
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      monthCounts.push(monthData[key] || 0);
    }

    // Get current month name
    const currentMonthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    res.status(200).json({
      success: true,
      data: {
        currentMonth: currentMonthName,
        currentMonthTournaments: currentMonthTournaments,
        labels: monthLabels,
        values: monthCounts,
        totalTournaments: await Tournament.countDocuments({})
      },
    });
  } catch (error) {
    console.error('Error fetching monthly tournament additions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch monthly tournament additions',
      error: error.message,
    });
  }
};

