
const express = require('express');
const router = express.Router();
const { getCharges, createCharge, updateCharge, deleteCharge } = require('../controllers/serviceChargeController');
const { authenticateJWT, requireRole } = require('../middleware/auth');

router.get('/', getCharges);
router.post('/', authenticateJWT, requireRole('ORGANIZER'), createCharge);
router.put('/:id', authenticateJWT, requireRole('ORGANIZER'), updateCharge);
router.delete('/:id', authenticateJWT, requireRole('ORGANIZER'), deleteCharge);

module.exports = router;
