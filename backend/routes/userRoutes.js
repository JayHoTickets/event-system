import express from 'express';
import { getUsers, createOrganizer, setComplimentaryLimit } from '../controllers/userController.js';
import { authenticateJWT, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateJWT, requireRole(['ADMIN','ORGANIZER']), getUsers);
router.post('/organizer', authenticateJWT, requireRole('ADMIN'), createOrganizer);
router.patch('/:id/complimentary-limit', authenticateJWT, requireRole(['ADMIN']), setComplimentaryLimit);

export default router;
