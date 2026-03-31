
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
router.post('/:id/lock-seats', lockSeats);
router.post('/:id/release-seats', releaseSeats);
router.patch('/:id/complimentary-limit', authenticateJWT, requireRole('ADMIN'), require('../controllers/eventController').setComplimentaryLimit);
router.patch('/:id/allow-free-tickets', authenticateJWT, requireRole('ADMIN'), require('../controllers/eventController').setAllowFreeTickets);

module.exports = router;
