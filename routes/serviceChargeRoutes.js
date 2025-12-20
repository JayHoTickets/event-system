
const express = require('express');
const router = express.Router();
const { getCharges, createCharge, updateCharge, deleteCharge } = require('../controllers/serviceChargeController');

router.get('/', getCharges);
router.post('/', createCharge);
router.put('/:id', updateCharge);
router.delete('/:id', deleteCharge);

module.exports = router;
