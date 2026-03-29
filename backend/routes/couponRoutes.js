
const express = require('express');
const router = express.Router();
const { getCoupons, createCoupon, updateCoupon, deleteCoupon, validateCoupon, getBestCoupon } = require('../controllers/couponController');

router.get('/', getCoupons);
router.post('/', createCoupon);
router.put('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);
router.post('/validate', validateCoupon);
router.post('/best', getBestCoupon);

module.exports = router;
