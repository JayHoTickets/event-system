
const express = require('express');
const router = express.Router();
const { getEvents, createEvent, getEventById, updateEvent, deleteEvent, updateSeats, lockSeats, releaseSeats } = require('../controllers/eventController');
const { authenticateJWT, requireRole } = require('../middleware/auth');

router.get('/', getEvents);
router.post('/', authenticateJWT, requireRole('ORGANIZER'), createEvent);
router.get('/:id', getEventById);
router.put('/:id', authenticateJWT, requireRole('ORGANIZER'), updateEvent);
router.delete('/:id', authenticateJWT, requireRole('ORGANIZER'), deleteEvent);
router.put('/:id/seats', authenticateJWT, requireRole('ORGANIZER'), updateSeats);
router.post('/:id/lock-seats', authenticateJWT, requireRole('ORGANIZER'), lockSeats);
router.post('/:id/release-seats', authenticateJWT, requireRole('ORGANIZER'), releaseSeats);
router.patch('/:id/complimentary-limit', authenticateJWT, requireRole('ORGANIZER'), require('../controllers/eventController').setComplimentaryLimit);

module.exports = router;
