
const express = require('express');
const router = express.Router();
const { createPaymentIntent, quoteCharges } = require('../controllers/paymentController');

router.post('/create-intent', createPaymentIntent);
router.post('/quote', quoteCharges);

module.exports = router;
