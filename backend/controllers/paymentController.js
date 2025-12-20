
const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const Coupon = require('../models/Coupon');
const ServiceCharge = require('../models/ServiceCharge');

exports.createPaymentIntent = async (req, res) => {
    const { seats, couponId } = req.body;

    try {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error("Stripe is not configured on the server.");
        }

        // 1. Calculate Subtotal
        const subtotal = seats.reduce((acc, s) => acc + (s.price || 0), 0);
        let discount = 0;

        // 2. Apply Coupon
        if (couponId) {
            const coupon = await Coupon.findById(couponId);
            if (coupon && coupon.active && !coupon.deleted) {
                if (coupon.discountType === 'PERCENTAGE') {
                    discount = subtotal * (coupon.value / 100);
                } else {
                    discount = coupon.value;
                }
            }
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
