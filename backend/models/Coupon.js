
const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
    code: { type: String, required: true },
    // For backward compatibility simple coupons can still use discountType/value
    discountType: { type: String, enum: ['FIXED', 'PERCENTAGE'] },
    value: Number,
    // Rule-driven discount: THRESHOLD, SEAT_COUNT, CODE
    ruleType: { type: String, enum: ['THRESHOLD', 'SEAT_COUNT', 'CODE'], default: 'CODE' },
    // Explicit rule fields preferred for business users
    minAmount: { type: Number, default: 0 }, // for THRESHOLD
    minSeats: { type: Number, default: 0 }, // for SEAT_COUNT
    // Flexible legacy params for migration
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
