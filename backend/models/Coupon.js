
const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
    code: { type: String, required: true },
    // For backward compatibility simple coupons can still use discountType/value
    discountType: { type: String, enum: ['FIXED', 'PERCENTAGE'] },
    value: Number,
    // Rule-driven discount: THRESHOLD, EARLY_BIRD, SEAT_COUNT, CODE
    ruleType: { type: String, enum: ['THRESHOLD', 'EARLY_BIRD', 'SEAT_COUNT', 'CODE'], default: 'CODE' },
    // Flexible params for the rule (minAmount, maxQuantityEligible, minSeats, etc.)
    ruleParams: { type: mongoose.Schema.Types.Mixed },
    eventId: String, // Optional, null means global
    organizerId: { type: String, required: true },
    maxUses: Number,
    usedCount: { type: Number, default: 0 },
    expiryDate: Date,
    active: { type: Boolean, default: true },
    deleted: { type: Boolean, default: false }
}, {
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
        }
    }
});

module.exports = mongoose.model('Coupon', CouponSchema);
