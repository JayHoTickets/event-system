import express from 'express';
import { getTheaters, createTheater, getTheaterById, updateLayout, updateTheaterInfo, deleteTheater } from '../controllers/theaterController.js';
import { authenticateJWT, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getTheaters);
router.post('/', authenticateJWT, requireRole('ADMIN'), createTheater);
router.get('/:id', getTheaterById);
router.put('/:id', authenticateJWT, requireRole('ADMIN'), updateTheaterInfo);
router.delete('/:id', authenticateJWT, requireRole('ADMIN'), deleteTheater);
router.put('/:id/layout', authenticateJWT, requireRole('ADMIN'), updateLayout);

export default router;
