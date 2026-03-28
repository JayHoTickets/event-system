const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { authenticateJWT, requireRole } = require('../middleware/auth');

router.get('/', authenticateJWT, requireRole(['ADMIN','ORGANIZER']), staffController.getStaff);
router.get('/:id', authenticateJWT, requireRole(['ADMIN','ORGANIZER']), staffController.getStaffById);
router.post('/', authenticateJWT, requireRole(['ADMIN','ORGANIZER']), staffController.createStaff);
router.put('/:id', authenticateJWT, requireRole(['ADMIN','ORGANIZER']), staffController.updateStaff);
router.delete('/:id', authenticateJWT, requireRole(['ADMIN','ORGANIZER']), staffController.deleteStaff);

module.exports = router;
