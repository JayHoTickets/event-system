
const express = require('express');
const router = express.Router();
const { getVenues, createVenue } = require('../controllers/venueController');

router.get('/', getVenues);
router.post('/', createVenue);

module.exports = router;
