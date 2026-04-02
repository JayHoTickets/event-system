import express from 'express';
import { getEvents, createEvent, getEventById, updateEvent, deleteEvent, updateSeats, lockSeats, releaseSeats, setComplimentaryLimit, setAllowFreeTickets } from '../controllers/eventController.js';
import { authenticateJWT, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getEvents);
router.post('/', authenticateJWT, requireRole('ORGANIZER'), createEvent);
router.get('/:id', getEventById);
router.put('/:id', authenticateJWT, requireRole('ORGANIZER'), updateEvent);
router.delete('/:id', authenticateJWT, requireRole('ORGANIZER'), deleteEvent);
router.put('/:id/seats', authenticateJWT, requireRole(['ORGANIZER', 'STAFF']), updateSeats);
router.post('/:id/lock-seats', lockSeats);
router.post('/:id/release-seats', releaseSeats);
router.patch('/:id/complimentary-limit', authenticateJWT, requireRole('ADMIN'), setComplimentaryLimit);
router.patch('/:id/allow-free-tickets', authenticateJWT, requireRole('ADMIN'), setAllowFreeTickets);

export default router;
