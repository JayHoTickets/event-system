
const express = require('express');
const router = express.Router();
const { login, mockLogin } = require('../controllers/authController');

router.post('/login', login);
router.post('/mock-login', mockLogin);

module.exports = router;
