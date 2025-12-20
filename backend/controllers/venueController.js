
const Venue = require('../models/Venue');

exports.getVenues = async (req, res) => {
    try {
        const venues = await Venue.find({ deleted: false });
        res.json(venues);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createVenue = async (req, res) => {
    try {
        const venue = await Venue.create(req.body);
        res.json(venue);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateVenue = async (req, res) => {
    try {
        const venue = await Venue.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(venue);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deleteVenue = async (req, res) => {
    try {
        await Venue.findByIdAndUpdate(req.params.id, { deleted: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
