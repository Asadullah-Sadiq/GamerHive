const express = require('express');
const router = express.Router();
const { 
  getActiveGamersCount,
  getAllStats,
  getMonthlyUserSignups,
  getMonthlyGameAdditions,
  getMonthlyTournamentAdditions
} = require('../controllers/statsController');

// Get active gamers count
router.get('/active-gamers', getActiveGamersCount);

// Get all stats
router.get('/all', getAllStats);

// Get monthly user signups
router.get('/monthly-signups', getMonthlyUserSignups);

// Get monthly game additions
router.get('/monthly-games', getMonthlyGameAdditions);

// Get monthly tournament additions
router.get('/monthly-tournaments', getMonthlyTournamentAdditions);

module.exports = router;

