import express from 'express';
import { createPaymentIntent, quoteCharges } from '../controllers/paymentController.js';

const router = express.Router();

router.post('/create-intent', createPaymentIntent);
router.post('/quote', quoteCharges);

export default router;
