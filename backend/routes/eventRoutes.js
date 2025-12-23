
const express = require('express');
const router = express.Router();
const { getEvents, createEvent, getEventById, updateEvent, deleteEvent, updateSeats, lockSeats, releaseSeats } = require('../controllers/eventController');

router.get('/', getEvents);
router.post('/', createEvent);
router.get('/:id', getEventById);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);
router.put('/:id/seats', updateSeats);
router.post('/:id/lock-seats', lockSeats);
router.post('/:id/release-seats', releaseSeats);

module.exports = router;
