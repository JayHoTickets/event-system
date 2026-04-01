import express from 'express';
import { login, mockLogin } from '../controllers/authController.js';

const router = express.Router();

router.post('/login', login);
router.post('/mock-login', mockLogin);

export default router;
