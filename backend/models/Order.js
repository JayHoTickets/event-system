
const mongoose = require('mongoose');

const OrderTicketSchema = new mongoose.Schema({
    id: String,
    eventId: String,
    eventTitle: String,
    seatId: String,
    seatLabel: String,
    price: Number,
    color: String,
    ticketType: String,
    qrCodeData: String,
    purchaseDate: Date,
    checkedIn: { type: Boolean, default: false },
    checkInDate: Date
}, { _id: false });

const OrderSchema = new mongoose.Schema({
    userId: String,
    customerName: String,
    customerPhone: String,
    customerEmail: String,
    tickets: [OrderTicketSchema],
    totalAmount: Number,
    serviceFee: Number,
    discountApplied: Number,
    couponCode: String,
    status: { type: String, default: 'PAID' },
    // Cancellation & refund fields
    refundAmount: { type: Number, default: 0 },
    refundStatus: { type: String, default: 'PENDING' }, // PENDING, PROCESSED, FAILED
    cancellationNotes: String,
    cancelledBy: String, // organizerId who performed cancellation
    cancelledAt: Date,
    // Audit trail of cancellation actions
    cancellationHistory: [{ organizerId: String, timestamp: Date, refundAmount: Number, notes: String }],
    paymentMode: String,
    transactionId: String, // Stripe Payment Intent ID
    refundTransactionId: String, // Stripe Refund ID
    date: { type: Date, default: Date.now }
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

module.exports = mongoose.model('Order', OrderSchema);
