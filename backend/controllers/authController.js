
const User = require('../models/User');
const Staff = require('../models/Staff');
const { generateToken } = require('../middleware/auth');

exports.login = async (req, res) => {
    let { email, password } = req.body;
    try {
        if (typeof email === 'string') email = email.trim().toLowerCase();
        const user = await User.findOne({ email });
        // In a real app, use bcrypt.compare(password, user.password)
        if (user && user.password === password) {
            const safe = user.toJSON ? user.toJSON() : user;
            delete safe.password;
            const token = generateToken({ id: safe.id || safe._id, role: safe.role || 'USER' });
            return res.json({ user: safe, token });
        }

        // If not a regular user, check staff collection
        const staff = await Staff.findOne({ email });
        if (staff && staff.password === password && staff.active) {
            const out = staff.toJSON ? staff.toJSON() : staff;
            out.role = 'STAFF';
            out.organizerId = staff.organizerId;
            delete out.password;
            const token = generateToken({ id: out.id || out._id, role: out.role });
            return res.json({ user: out, token });
        }

        res.status(401).json({ message: 'Invalid credentials' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.mockLogin = async (req, res) => {
    const { role } = req.body;
    try {
        const user = await User.findOne({ role });
        if (user) {
            const safe = user.toJSON ? user.toJSON() : user;
            delete safe.password;
            const token = generateToken({ id: safe.id || safe._id, role: safe.role || role });
            return res.json({ user: safe, token });
        }
        res.status(404).json({ message: 'No demo user found for role' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
