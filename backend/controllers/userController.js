
const User = require('../models/User');

exports.getUsers = async (req, res) => {
    try {
        const query = req.query.role ? { role: req.query.role } : {};
        const users = await User.find(query);
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createOrganizer = async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ message: 'Email exists' });

        const user = await User.create({
            name, email, password, role: 'ORGANIZER'
        });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Set organizer-level complimentary limit
exports.setComplimentaryLimit = async (req, res) => {
    try {
        const { id } = req.params;
        const { complimentaryLimit } = req.body;
        // Authorization: allow ADMIN to set any organizer limit; allow ORGANIZER to set only their own user record
        const caller = req.user;
        if (!caller) return res.status(401).json({ message: 'Not authenticated' });
        if (caller.role !== 'ADMIN' && caller.role !== 'ORGANIZER') return res.status(403).json({ message: 'Forbidden' });
        if (caller.role === 'ORGANIZER' && String(caller.id) !== String(id)) return res.status(403).json({ message: 'Organizers may only modify their own settings' });
        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        // Only organizers or admins should have this, but allow setting when present
        user.complimentaryLimit = (complimentaryLimit === null || complimentaryLimit === undefined) ? null : Number(complimentaryLimit);
        await user.save();
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
