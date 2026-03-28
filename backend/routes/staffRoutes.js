const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { authenticateJWT, requireRole } = require('../middleware/auth');

router.get('/', authenticateJWT, requireRole('ADMIN'), staffController.getStaff);
router.get('/:id', authenticateJWT, requireRole('ADMIN'), staffController.getStaffById);
router.post('/', authenticateJWT, requireRole('ADMIN'), staffController.createStaff);
router.put('/:id', authenticateJWT, requireRole('ADMIN'), staffController.updateStaff);
router.delete('/:id', authenticateJWT, requireRole('ADMIN'), staffController.deleteStaff);

module.exports = router;
