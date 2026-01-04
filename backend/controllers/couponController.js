
const Coupon = require('../models/Coupon');
const { computeCouponDiscount } = require('../utils/discountService');

exports.getCoupons = async (req, res) => {
    try {
        const query = { deleted: false };
        if (req.query.organizerId) query.organizerId = req.query.organizerId;
        const coupons = await Coupon.find(query);
        res.json(coupons);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createCoupon = async (req, res) => {
    try {
        const exists = await Coupon.findOne({ code: req.body.code, active: true, deleted: false });
        if (exists) return res.status(400).json({ message: 'Code exists' });
        
        const coupon = await Coupon.create(req.body);
        res.json(coupon);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(coupon);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deleteCoupon = async (req, res) => {
    try {
        await Coupon.findByIdAndUpdate(req.params.id, { deleted: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.validateCoupon = async (req, res) => {
    const { code, eventId, seats } = req.body;
    try {
        const coupon = await Coupon.findOne({ code, active: true, deleted: false });
        if (!coupon) return res.status(400).json({ message: 'Invalid coupon' });
        if (coupon.eventId && coupon.eventId !== eventId) return res.status(400).json({ message: 'Not valid for this event' });
        if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) return res.status(400).json({ message: 'Expired' });
        if (coupon.maxUses && (coupon.usedCount || 0) >= coupon.maxUses) return res.status(400).json({ message: 'Limit reached' });

        const subtotal = (seats || []).reduce((a, s) => a + (s.price || 0), 0);
        const { discount } = computeCouponDiscount(coupon, { subtotal, seats, seatsCount: (seats || []).length, requestedCode: code, eventId });
        if (!discount || discount <= 0) return res.status(400).json({ message: 'Not applicable' });

        // Merge discount into returned coupon payload for frontend compatibility
        const out = coupon.toJSON ? coupon.toJSON() : coupon;
        out.discount = discount;
        res.json(out);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
