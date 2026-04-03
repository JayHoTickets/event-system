
import express from 'express';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon, validateCoupon, getBestCoupon } from '../controllers/couponController.js';
import { authenticateJWT, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getCoupons);
router.post('/', authenticateJWT, requireRole(['ORGANIZER', 'STAFF']), createCoupon);
router.put('/:id', authenticateJWT, requireRole(['ORGANIZER', 'STAFF']), updateCoupon);
router.delete('/:id', authenticateJWT, requireRole(['ORGANIZER', 'STAFF']), deleteCoupon);
router.post('/validate', validateCoupon);
router.get('/best', getBestCoupon);

export default router;
