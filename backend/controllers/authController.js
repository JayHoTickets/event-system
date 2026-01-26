
const User = require('../models/User');

exports.login = async (req, res) => {
    let { email, password } = req.body;
    try {
        if (typeof email === 'string') email = email.trim().toLowerCase();
        const user = await User.findOne({ email });
        // In a real app, use bcrypt.compare(password, user.password)
        if (user && user.password === password) {
            return res.json(user);
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
            return res.json(user);
        }
        res.status(404).json({ message: 'No demo user found for role' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
