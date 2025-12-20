
const Venue = require('../models/Venue');

exports.getVenues = async (req, res) => {
    try {
        const venues = await Venue.find();
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
