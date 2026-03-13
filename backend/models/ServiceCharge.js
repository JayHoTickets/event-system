
const mongoose = require('mongoose');

const ServiceChargeSchema = new mongoose.Schema({
    name: String,
    type: { type: String, enum: ['FIXED', 'PERCENTAGE'] },
    value: Number,
    // Level of service charge: DEFAULT | ORGANIZER | EVENT
    level: { type: String, enum: ['DEFAULT', 'ORGANIZER', 'EVENT'], default: 'DEFAULT' },
    organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: false },
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
