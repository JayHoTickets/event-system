
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const Coupon = require('../models/Coupon');
const ServiceCharge = require('../models/ServiceCharge');
const Event = require('../models/Event');
const { computeCouponDiscount } = require('../utils/discountService');

exports.createPaymentIntent = async (req, res) => {
    const { seats, couponId, eventId } = req.body;

    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error("Stripe is not configured on the server.");
        }

        // 1. Calculate Subtotal
        const subtotal = seats.reduce((acc, s) => acc + (s.price || 0), 0);
        let discount = 0;

        // 2. Apply Coupon: if couponId provided, evaluate that coupon; otherwise auto-apply best available for event/organizer
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

        // 3. Calculate Service Charges
        const charges = await ServiceCharge.find({ active: true });
        let serviceFee = 0;
        charges.forEach(charge => {
            if (charge.type === 'FIXED') {
                serviceFee += charge.value;
            } else {
                serviceFee += discountedSubtotal * (charge.value / 100);
            }
        });

        const totalAmount = discountedSubtotal + serviceFee;

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
            totalAmount: totalAmount
        });

    } catch (err) {
        console.error("Stripe Error:", err);
        res.status(500).json({ message: err.message });
    }
};
