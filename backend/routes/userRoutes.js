
const express = require('express');
const router = express.Router();
const { getUsers, createOrganizer } = require('../controllers/userController');

router.get('/', getUsers);
router.post('/organizer', createOrganizer);

module.exports = router;
