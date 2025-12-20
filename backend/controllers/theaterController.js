
const Theater = require('../models/Theater');

exports.getTheaters = async (req, res) => {
    try {
        const query = { deleted: false };
        if (req.query.venueId) query.venueId = req.query.venueId;
        const theaters = await Theater.find(query);
        res.json(theaters);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getTheaterById = async (req, res) => {
    try {
        const theater = await Theater.findById(req.params.id);
        if (theater && theater.deleted) return res.status(404).json(null);
        res.json(theater || null);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createTheater = async (req, res) => {
    try {
        // Default stage if not provided
        const theaterData = {
            ...req.body,
            seats: [],
            stage: { label: 'Stage', x: 2, y: 0, width: 10, height: 3 }
        };
        const theater = await Theater.create(theaterData);
        res.json(theater);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateTheaterInfo = async (req, res) => {
    try {
        const { name, venueId } = req.body;
        // Only allow updating basic info, not layout
        const theater = await Theater.findByIdAndUpdate(
            req.params.id, 
            { name, venueId }, 
            { new: true }
        );
        res.json(theater);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateLayout = async (req, res) => {
    try {
        const { seats, stage, rows, cols } = req.body;
        const theater = await Theater.findByIdAndUpdate(
            req.params.id, 
            { seats, stage, rows, cols }, 
            { new: true }
        );
        res.json(theater);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deleteTheater = async (req, res) => {
    try {
        await Theater.findByIdAndUpdate(req.params.id, { deleted: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
