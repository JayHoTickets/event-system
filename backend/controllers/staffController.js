import Staff from '../models/Staff.js';

export const getStaff = async (req, res) => {
    try {
        const query = {};
        // Organizers can only view their own staff
        if (req.user && req.user.role === 'ORGANIZER') {
            query.organizerId = req.user.id;
        } else if (req.query.organizerId) {
            query.organizerId = req.query.organizerId;
        }
        const staff = await Staff.find(query);
        res.json(staff);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const getStaffById = async (req, res) => {
    try {
        const s = await Staff.findById(req.params.id);
        if (!s) return res.status(404).json({ message: 'Not found' });
        if (req.user && req.user.role === 'ORGANIZER') {
            if (String(s.organizerId) !== String(req.user.id)) return res.status(403).json({ message: 'Forbidden: insufficient role' });
        }
        res.json(s);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const createStaff = async (req, res) => {
    try {
        // If organizer, force organizerId to the authenticated user's id
        const organizerId = (req.user && req.user.role === 'ORGANIZER') ? req.user.id : req.body.organizerId;

        const exists = await Staff.findOne({ email: req.body.email, organizerId });
        if (exists) return res.status(400).json({ message: 'Staff with this email already exists for organizer' });

        const payload = {
            name: req.body.name,
            email: (req.body.email || '').toString().trim().toLowerCase(),
            password: req.body.password,
            organizerId,
            permissions: Array.isArray(req.body.permissions) ? req.body.permissions : []
        };

        const staff = await Staff.create(payload);
        res.json(staff);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

export const updateStaff = async (req, res) => {
    try {
        const staffRecord = await Staff.findById(req.params.id);
        if (!staffRecord) return res.status(404).json({ message: 'Not found' });
        if (req.user && req.user.role === 'ORGANIZER') {
            if (String(staffRecord.organizerId) !== String(req.user.id)) return res.status(403).json({ message: 'Forbidden: insufficient role' });
        }

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

export const deleteStaff = async (req, res) => {
    try {
        const staffRecord = await Staff.findById(req.params.id);
        if (!staffRecord) return res.status(404).json({ message: 'Not found' });
        if (req.user && req.user.role === 'ORGANIZER') {
            if (String(staffRecord.organizerId) !== String(req.user.id)) return res.status(403).json({ message: 'Forbidden: insufficient role' });
        }
        await Staff.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
