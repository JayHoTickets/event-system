
const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
    code: { type: String, required: true },
    discountType: { type: String, enum: ['FIXED', 'PERCENTAGE'] },
    value: Number,
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
