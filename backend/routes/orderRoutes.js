import express from 'express';
import { authenticateJWT, requireRole } from '../middleware/auth.js';
import * as orderController from '../controllers/orderController.js';

const router = express.Router();
const { getOrders, getOrderById, createOrder, verifyTicket, checkInTicket, cancelOrder, updateRefundStatus, createPaymentPendingOrder, createPaymentIntentForPendingOrder, completePaymentPendingOrder } = orderController;

// Specific routes first (before /:id pattern)
router.post('/verify', verifyTicket);
router.post('/check-in', checkInTicket);
router.post('/payment-pending', createPaymentPendingOrder);

// Generic routes after
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);
router.post('/:id/create-payment-intent', createPaymentIntentForPendingOrder);
router.post('/:id/complete-payment', completePaymentPendingOrder);
router.post('/:id/cancel', authenticateJWT, requireRole('ORGANIZER'), cancelOrder);
router.post('/:id/refund-status', authenticateJWT, requireRole('ORGANIZER'), updateRefundStatus);

export default router;
