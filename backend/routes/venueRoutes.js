
const express = require('express');
const router = express.Router();
const { getVenues, createVenue, updateVenue, deleteVenue } = require('../controllers/venueController');
const { authenticateJWT, requireRole } = require('../middleware/auth');

router.get('/', getVenues);
router.post('/', authenticateJWT, requireRole('ADMIN'), createVenue);
router.put('/:id', authenticateJWT, requireRole('ADMIN'), updateVenue);
router.delete('/:id', authenticateJWT, requireRole('ADMIN'), deleteVenue);

module.exports = router;
