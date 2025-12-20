
const mongoose = require('mongoose');

const ServiceChargeSchema = new mongoose.Schema({
    name: String,
    type: { type: String, enum: ['FIXED', 'PERCENTAGE'] },
    value: Number,
    active: { type: Boolean, default: true }
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

module.exports = mongoose.model('ServiceCharge', ServiceChargeSchema);
