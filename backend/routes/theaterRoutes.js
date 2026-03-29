
const express = require('express');
const router = express.Router();
const { getTheaters, createTheater, getTheaterById, updateLayout, updateTheaterInfo, deleteTheater } = require('../controllers/theaterController');

router.get('/', getTheaters);
router.post('/', createTheater);
router.get('/:id', getTheaterById);
router.put('/:id', updateTheaterInfo);
router.delete('/:id', deleteTheater);
router.put('/:id/layout', updateLayout);

module.exports = router;
