const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { 
  createTournament,
  getAllTournaments,
  updateTournament,
  deleteTournament,
  deleteMultipleTournaments
} = require('../controllers/tournamentController');

// Create tournament (with file upload) or set image URL
router.post('/', (req, res, next) => {
  // If image URL is provided in body (for URL selection), skip multer
  if (req.body.image && !req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }
  // Otherwise use multer for file upload
  upload.single('image')(req, res, next);
}, createTournament);

// Get all tournaments
router.get('/', getAllTournaments);

// Update tournament (with file upload) or set image URL
router.put('/:id', (req, res, next) => {
  // If image URL is provided in body (for URL selection), skip multer
  if (req.body.image && !req.headers['content-type']?.includes('multipart/form-data')) {
    return next();
  }
  // Otherwise use multer for file upload
  upload.single('image')(req, res, next);
}, updateTournament);

// Delete single tournament
router.delete('/:id', deleteTournament);

// Delete multiple tournaments
router.delete('/', deleteMultipleTournaments);

module.exports = router;

