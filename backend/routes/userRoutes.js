
const express = require('express');
const router = express.Router();
const { getUsers, createOrganizer } = require('../controllers/userController');
const { authenticateJWT, requireRole } = require('../middleware/auth');

router.get('/', authenticateJWT, requireRole(['ADMIN','ORGANIZER']), getUsers);
router.post('/organizer', authenticateJWT, requireRole('ADMIN'), createOrganizer);
router.patch('/:id/complimentary-limit', authenticateJWT, requireRole(['ADMIN']), require('../controllers/userController').setComplimentaryLimit);

module.exports = router;
