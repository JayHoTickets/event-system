
const ServiceCharge = require('../models/ServiceCharge');

exports.getCharges = async (req, res) => {
    try {
        const charges = await ServiceCharge.find();
        res.json(charges);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createCharge = async (req, res) => {
    try {
        const charge = await ServiceCharge.create(req.body);
        res.json(charge);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateCharge = async (req, res) => {
    try {
        const charge = await ServiceCharge.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(charge);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deleteCharge = async (req, res) => {
    try {
        await ServiceCharge.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
