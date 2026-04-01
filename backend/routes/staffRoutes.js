import express from 'express';
import * as staffController from '../controllers/staffController.js';
import { authenticateJWT, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateJWT, requireRole(['ADMIN','ORGANIZER']), staffController.getStaff);
router.get('/:id', authenticateJWT, requireRole(['ADMIN','ORGANIZER']), staffController.getStaffById);
router.post('/', authenticateJWT, requireRole(['ADMIN','ORGANIZER']), staffController.createStaff);
router.put('/:id', authenticateJWT, requireRole(['ADMIN','ORGANIZER']), staffController.updateStaff);
router.delete('/:id', authenticateJWT, requireRole(['ADMIN','ORGANIZER']), staffController.deleteStaff);

export default router;
