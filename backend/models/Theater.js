
const mongoose = require('mongoose');

const SeatSchema = new mongoose.Schema({
    id: String, // Client-side ID (e.g., '0-1')
    row: Number,
    col: Number,
    x: Number, // Absolute X for curves
    y: Number, // Absolute Y for curves
    rowLabel: String,
    seatNumber: String,
    status: { type: String, default: 'AVAILABLE' }
}, { _id: false });

const StageSchema = new mongoose.Schema({
    label: String,
    x: Number,
    y: Number,
    width: Number,
    height: Number
}, { _id: false });

const TheaterSchema = new mongoose.Schema({
    name: { type: String, required: true },
    venueId: { type: String, required: true },
    rows: Number,
    cols: Number,
    stage: StageSchema,
    seats: [SeatSchema],
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

module.exports = mongoose.model('Theater', TheaterSchema);
