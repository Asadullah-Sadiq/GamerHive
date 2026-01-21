const express = require('express');
const router = express.Router();
const { globalSearch } = require('../controllers/searchController');

// Global search endpoint
router.get('/', globalSearch);

module.exports = router;

