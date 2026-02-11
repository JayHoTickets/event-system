const Staff = require('../models/Staff');

exports.getStaff = async (req, res) => {
    try {
        const query = {};
        if (req.query.organizerId) query.organizerId = req.query.organizerId;
        const staff = await Staff.find(query);
        res.json(staff);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getStaffById = async (req, res) => {
    try {
        const s = await Staff.findById(req.params.id);
        if (!s) return res.status(404).json({ message: 'Not found' });
        res.json(s);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createStaff = async (req, res) => {
    try {
        const exists = await Staff.findOne({ email: req.body.email, organizerId: req.body.organizerId });
        if (exists) return res.status(400).json({ message: 'Staff with this email already exists for organizer' });

        const payload = {
            name: req.body.name,
            email: (req.body.email || '').toString().trim().toLowerCase(),
            password: req.body.password,
            organizerId: req.body.organizerId,
            permissions: Array.isArray(req.body.permissions) ? req.body.permissions : []
        };

        const staff = await Staff.create(payload);
        res.json(staff);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateStaff = async (req, res) => {
    try {
        const updates = {};
        if (req.body.name) updates.name = req.body.name;
        if (req.body.password) updates.password = req.body.password;
        if (typeof req.body.active !== 'undefined') updates.active = !!req.body.active;
        if (typeof req.body.permissions !== 'undefined') updates.permissions = Array.isArray(req.body.permissions) ? req.body.permissions : [];

        const staff = await Staff.findByIdAndUpdate(req.params.id, updates, { new: true });
        res.json(staff);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deleteStaff = async (req, res) => {
    try {
        await Staff.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
