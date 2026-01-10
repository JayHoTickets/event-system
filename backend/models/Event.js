
const mongoose = require('mongoose');

const TicketTypeSchema = new mongoose.Schema({
    id: String,
    name: String,
    price: Number,
    color: String,
    description: String,
    totalQuantity: Number,
    sold: { type: Number, default: 0 }
}, { _id: false });

const EventSeatSchema = new mongoose.Schema({
    id: String,
    row: Number,
    col: Number,
    x: Number, // Absolute X for curves
    y: Number, // Absolute Y for curves
    rowLabel: String,
    seatNumber: String,
    status: String,
    // Timestamp until which this seat is held for a booking-in-progress.
    // When null/absent the seat is not held.
    holdUntil: Date,
    tier: String,
    price: Number,
    color: String,
    ticketTypeId: String
}, { _id: false });

const StageSchema = new mongoose.Schema({
    label: String,
    x: Number,
    y: Number,
    width: Number,
    height: Number
    // Optional visual properties to mirror Theater.stage
    , textSize: Number
    , borderRadius: Number
}, { _id: false });

const EventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    organizerId: { type: String, required: true },
    startTime: Date,
    endTime: Date,
    timezone: String,
    venueId: { type: String, required: true },
    theaterId: String,
    imageUrl: String,
    category: String,
    status: { type: String, default: 'DRAFT' },
    seatingType: { type: String, default: 'RESERVED' },
    currency: { type: String, default: 'USD' },
    terms: String,
    ticketTypes: [TicketTypeSchema],
    seats: [EventSeatSchema],
    stage: StageSchema,
    rows: Number,
    cols: Number,
    location: String,
    deleted: { type: Boolean, default: false }
}, {
    timestamps: true,
    toJSON: {
        virtuals: true,
        transform: function (doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
        }
    }
});

module.exports = mongoose.model('Event', EventSchema);
