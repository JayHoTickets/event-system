import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';

export const generateToken = (payload, expiresIn = '7d') => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

export const authenticateJWT = (req, res, next) => {
    const auth = req.headers.authorization || req.headers.Authorization;
    if (!auth || !String(auth).startsWith('Bearer ')) return res.status(401).json({ message: 'Missing or invalid Authorization header' });
    const token = String(auth).split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Attach minimal user info
        req.user = { id: decoded.id, role: decoded.role };
        return next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

// roles: string or array of strings
export const requireRole = (roles) => {
    const allowed = Array.isArray(roles) ? roles : [roles];
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
        const userRole = req.user.role;
        // Admin may access any organizer endpoints
        if (userRole === 'ADMIN') return next();
        if (allowed.includes(userRole)) return next();
        return res.status(403).json({ message: 'Forbidden: insufficient role' });
    };
};
