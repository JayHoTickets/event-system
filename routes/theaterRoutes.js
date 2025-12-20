
const express = require('express');
const router = express.Router();
const { getTheaters, createTheater, getTheaterById, updateLayout } = require('../controllers/theaterController');

router.get('/', getTheaters);
router.post('/', createTheater);
router.get('/:id', getTheaterById);
router.put('/:id/layout', updateLayout);

module.exports = router;
