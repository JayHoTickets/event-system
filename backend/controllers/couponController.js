
const Coupon = require('../models/Coupon');
const Event = require('../models/Event');
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
        // Sanitize and map explicit fields to avoid unexpected payloads
        const payload = {
            code: (req.body.code || '').toString().toUpperCase(),
            discountType: req.body.discountType,
            value: Number(req.body.value) || 0,
            ruleType: req.body.ruleType || 'CODE',
            minAmount: req.body.minAmount ? Number(req.body.minAmount) : 0,
            minSeats: req.body.minSeats ? Number(req.body.minSeats) : 0,
            ruleParams: req.body.ruleParams || {},
            eventId: req.body.eventId || null,
            organizerId: req.body.organizerId,
            maxUses: req.body.maxUses ? Number(req.body.maxUses) : 0,
            expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
            active: typeof req.body.active === 'boolean' ? req.body.active : true
        };

        // Also populate legacy ruleParams with explicit values for compatibility
        payload.ruleParams = {
            ...(payload.ruleParams || {}),
            minAmount: payload.minAmount,
            minSeats: payload.minSeats,
            discountType: payload.discountType,
            value: payload.value
        };

        const coupon = await Coupon.create(payload);
        res.json(coupon);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateCoupon = async (req, res) => {
    try {
        // Load existing coupon to merge legacy ruleParams if needed
        const existing = await Coupon.findById(req.params.id);

        const updates = {
            ...(req.body.code ? { code: req.body.code.toString().toUpperCase() } : {}),
            ...(req.body.discountType ? { discountType: req.body.discountType } : {}),
            ...(typeof req.body.value !== 'undefined' ? { value: Number(req.body.value) } : {}),
            ...(req.body.ruleType ? { ruleType: req.body.ruleType } : {}),
            ...(typeof req.body.minAmount !== 'undefined' ? { minAmount: Number(req.body.minAmount) } : {}),
            ...(typeof req.body.minSeats !== 'undefined' ? { minSeats: Number(req.body.minSeats) } : {}),
            ...(typeof req.body.ruleParams !== 'undefined' ? { ruleParams: req.body.ruleParams } : {}),
            ...(typeof req.body.eventId !== 'undefined' ? { eventId: req.body.eventId } : {}),
            ...(typeof req.body.maxUses !== 'undefined' ? { maxUses: Number(req.body.maxUses) } : {}),
            ...(typeof req.body.expiryDate !== 'undefined' ? { expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null } : {}),
            ...(typeof req.body.active !== 'undefined' ? { active: !!req.body.active } : {})
        };

        // If caller did not provide explicit ruleParams, merge explicit top-level fields into legacy ruleParams
        if (typeof req.body.ruleParams === 'undefined') {
            const existingParams = (existing && existing.ruleParams) ? existing.ruleParams : {};
            const merged = {
                ...(existingParams || {}),
                ...(typeof req.body.minAmount !== 'undefined' ? { minAmount: Number(req.body.minAmount) } : {}),
                ...(typeof req.body.minSeats !== 'undefined' ? { minSeats: Number(req.body.minSeats) } : {}),
                ...(typeof req.body.discountType !== 'undefined' ? { discountType: req.body.discountType } : {}),
                ...(typeof req.body.value !== 'undefined' ? { value: Number(req.body.value) } : {})
            };
            updates.ruleParams = merged;
        }

        const coupon = await Coupon.findByIdAndUpdate(req.params.id, updates, { new: true });
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

// Returns the best applicable coupon for a given event and seats
exports.getBestCoupon = async (req, res) => {
    const { eventId, seats } = req.body;
    try {
        const eventDoc = eventId ? await Event.findById(eventId) : null;
        const organizerId = eventDoc ? eventDoc.organizerId : null;

        const coupons = await Coupon.find({ active: true, deleted: false, $or: [ { eventId }, { organizerId } ] });
        const subtotal = (seats || []).reduce((a, s) => a + (s.price || 0), 0);

        let best = { discount: 0, coupon: null };
        for (const c of coupons) {
            const { discount } = computeCouponDiscount(c, { subtotal, seats, seatsCount: (seats || []).length, eventId });
            if (discount > best.discount) best = { discount, coupon: c };
        }

        if (!best.coupon) return res.json({ coupon: null });

        const out = best.coupon.toJSON ? best.coupon.toJSON() : best.coupon;
        out.discount = best.discount;
        res.json({ coupon: out });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
