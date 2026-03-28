
const express = require('express');
const router = express.Router();
const { getCoupons, createCoupon, updateCoupon, deleteCoupon, validateCoupon, getBestCoupon } = require('../controllers/couponController');
const { authenticateJWT, requireRole } = require('../middleware/auth');

router.get('/', getCoupons);
router.post('/', authenticateJWT, requireRole('ORGANIZER'), createCoupon);
router.put('/:id', authenticateJWT, requireRole('ORGANIZER'), updateCoupon);
router.delete('/:id', authenticateJWT, requireRole('ORGANIZER'), deleteCoupon);
router.post('/validate', validateCoupon);
router.post('/best', getBestCoupon);

module.exports = router;
