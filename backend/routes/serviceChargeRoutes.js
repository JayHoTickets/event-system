import express from 'express';
import { getCharges, createCharge, updateCharge, deleteCharge } from '../controllers/serviceChargeController.js';
import { authenticateJWT, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getCharges);
router.post('/', authenticateJWT, requireRole('ORGANIZER'), createCharge);
router.put('/:id', authenticateJWT, requireRole('ORGANIZER'), updateCharge);
router.delete('/:id', authenticateJWT, requireRole('ORGANIZER'), deleteCharge);

export default router;
