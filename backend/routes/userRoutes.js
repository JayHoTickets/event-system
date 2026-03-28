
const express = require('express');
const router = express.Router();
const { getUsers, createOrganizer } = require('../controllers/userController');

router.get('/', getUsers);
router.post('/organizer', createOrganizer);
router.patch('/:id/complimentary-limit', require('../controllers/userController').setComplimentaryLimit);

module.exports = router;
