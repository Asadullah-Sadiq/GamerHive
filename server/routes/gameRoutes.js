const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { 
  addGame,
  getUserGames,
  getAllGames,
  deleteGame,
  updateGame,
  requestBorrowGame
} = require('../controllers/gameController');

// Add Game (with file upload)
router.post('/add', upload.single('image'), addGame);

// Get User Games
router.get('/user', getUserGames);

// Get All Games
router.get('/all', getAllGames);

// Update Game
router.put('/:id', upload.single('image'), updateGame);

// Delete Game
router.delete('/:id', deleteGame);

// Request to Borrow Game
router.post('/borrow', requestBorrowGame);

module.exports = router;

