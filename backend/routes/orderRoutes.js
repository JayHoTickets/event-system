import { authenticateJWT } from '../middleware/auth';

const express = require('express');
const router = express.Router();
const { getOrders, getOrderById, createOrder, verifyTicket, checkInTicket, cancelOrder, updateRefundStatus, createPaymentPendingOrder, completePaymentPendingOrder } = require('../controllers/orderController');

// Specific routes first (before /:id pattern)
router.post('/verify', verifyTicket);
router.post('/check-in', checkInTicket);
router.post('/payment-pending', createPaymentPendingOrder);

// Generic routes after
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);
router.post('/:id/complete-payment', completePaymentPendingOrder);
router.post('/:id/cancel', authenticateJWT, requireRole('ORGANIZER'), cancelOrder);
router.post('/:id/refund-status', authenticateJWT, requireRole('ORGANIZER'), updateRefundStatus);

module.exports = router;
