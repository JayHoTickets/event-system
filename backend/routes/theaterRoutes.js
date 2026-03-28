
const express = require('express');
const router = express.Router();
const { getTheaters, createTheater, getTheaterById, updateLayout, updateTheaterInfo, deleteTheater } = require('../controllers/theaterController');
const { authenticateJWT, requireRole } = require('../middleware/auth');

router.get('/', getTheaters);
router.post('/', authenticateJWT, requireRole('ADMIN'), createTheater);
router.get('/:id', getTheaterById);
router.put('/:id', authenticateJWT, requireRole('ADMIN'), updateTheaterInfo);
router.delete('/:id', authenticateJWT, requireRole('ADMIN'), deleteTheater);
router.put('/:id/layout', authenticateJWT, requireRole('ADMIN'), updateLayout);

module.exports = router;
