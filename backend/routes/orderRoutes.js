
const express = require('express');
const router = express.Router();
const { getOrders, createOrder, verifyTicket, checkInTicket } = require('../controllers/orderController');

router.get('/', getOrders);
router.post('/', createOrder);
router.post('/verify', verifyTicket);
router.post('/check-in', checkInTicket);

module.exports = router;
