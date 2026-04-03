import express from 'express';
import { getVenues, createVenue, updateVenue, deleteVenue } from '../controllers/venueController.js';
import { authenticateJWT, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getVenues);
router.post('/', authenticateJWT, requireRole('ADMIN'), createVenue);
router.put('/:id', authenticateJWT, requireRole('ADMIN'), updateVenue);
router.delete('/:id', authenticateJWT, requireRole('ADMIN'), deleteVenue);

export default router;
