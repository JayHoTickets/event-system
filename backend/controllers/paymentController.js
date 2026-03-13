
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const Coupon = require('../models/Coupon');
const ServiceCharge = require('../models/ServiceCharge');
const Event = require('../models/Event');
const { computeCouponDiscount } = require('../utils/discountService');

const computeChargesForRequest = async (seats, couponId, eventId) => {
    const subtotal = seats.reduce((acc, s) => acc + (s.price || 0), 0);
    let discount = 0;

    if (couponId) {
        const coupon = await Coupon.findById(couponId);
        if (coupon && coupon.active && !coupon.deleted) {
            const res = computeCouponDiscount(coupon, { subtotal, seats, seatsCount: seats.length, requestedCode: coupon.code, eventId });
            discount = res.discount || 0;
        }
    } else if (eventId) {
        const eventDoc = await Event.findById(eventId);
        const organizerId = eventDoc ? eventDoc.organizerId : null;
        const coupons = await Coupon.find({ active: true, deleted: false, $or: [ { eventId }, { organizerId } ] });

        let best = { discount: 0 };
        for (const c of coupons) {
            const { discount: d } = computeCouponDiscount(c, { subtotal, seats, seatsCount: seats.length, eventId });
            if (d > best.discount) best = { discount: d };
        }
        discount = best.discount || 0;
    }

    const discountedSubtotal = Math.max(0, subtotal - discount);

    // Compute applicable charges (priority: event -> organizer -> default)
    let serviceFee = 0;
    let chargesToApply = [];

    if (eventId) {
        const q = { level: 'EVENT', active: true };
        try {
            const ObjectId = require('mongoose').Types.ObjectId;
            if (ObjectId.isValid(eventId)) {
                q.$or = [{ eventId: eventId }, { eventId: ObjectId(eventId) }];
            } else {
                q.eventId = eventId;
            }
        } catch (e) {
            q.eventId = eventId;
        }
        chargesToApply = await ServiceCharge.find(q);
    }

    if ((!chargesToApply || chargesToApply.length === 0) && eventId) {
        const eventDocForCharge = await Event.findById(eventId);
        const organizerIdForCharge = eventDocForCharge ? eventDocForCharge.organizerId : null;
        if (organizerIdForCharge) {
            const q = { level: 'ORGANIZER', active: true };
            try {
                const ObjectId = require('mongoose').Types.ObjectId;
                if (ObjectId.isValid(organizerIdForCharge)) {
                    q.$or = [{ organizerId: organizerIdForCharge }, { organizerId: ObjectId(organizerIdForCharge) }];
                } else {
                    q.organizerId = organizerIdForCharge;
                }
            } catch (e) {
                q.organizerId = organizerIdForCharge;
            }
            chargesToApply = await ServiceCharge.find(q);
        }
    }

    if (!chargesToApply || chargesToApply.length === 0) {
        chargesToApply = await ServiceCharge.find({ level: 'DEFAULT', active: true });
    }

    const appliedCharges = [];
    for (const ch of chargesToApply) {
        let amount = 0;
        if (ch.type === 'FIXED') {
            amount = ch.value;
            serviceFee += ch.value;
        } else {
            amount = discountedSubtotal * (ch.value / 100);
            serviceFee += amount;
        }
        appliedCharges.push({ name: ch.name, type: ch.type, value: ch.value, level: ch.level, amount });
    }

    const totalAmount = discountedSubtotal + serviceFee;
    return { subtotal, discount, discountedSubtotal, serviceFee, appliedCharges, totalAmount };
};

exports.quoteCharges = async (req, res) => {
    const { seats, couponId, eventId } = req.body;
    try {
        const result = await computeChargesForRequest(seats, couponId, eventId);
        res.json(result);
    } catch (err) {
        console.error('Quote Error:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.createPaymentIntent = async (req, res) => {
    const { seats, couponId, eventId } = req.body;

    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error("Stripe is not configured on the server.");
        }

        const { discountedSubtotal, serviceFee, appliedCharges, totalAmount } = await computeChargesForRequest(seats, couponId, eventId);

        // 4. Create Stripe Intent
        // Stripe expects amounts in cents (integers)
        const amountInCents = Math.round(totalAmount * 100);

        if (amountInCents < 50) {
            // Stripe minimum is usually $0.50
             return res.status(400).json({ message: 'Order amount is too low for online payment.' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            totalAmount: totalAmount,
            serviceFee,
            appliedCharges
        });

    } catch (err) {
        console.error("Stripe Error:", err);
        res.status(500).json({ message: err.message });
    }
};
