
const express = require('express');
const router = express.Router();
const { getOrders, createOrder, verifyTicket, checkInTicket, cancelOrder, updateRefundStatus } = require('../controllers/orderController');

router.get('/', getOrders);
router.post('/', createOrder);
router.post('/verify', verifyTicket);
router.post('/check-in', checkInTicket);
router.post('/:id/cancel', cancelOrder);
router.post('/:id/refund-status', updateRefundStatus);

module.exports = router;
