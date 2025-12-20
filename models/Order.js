
const mongoose = require('mongoose');

const OrderTicketSchema = new mongoose.Schema({
    id: String,
    eventId: String,
    eventTitle: String,
    seatId: String,
    seatLabel: String,
    price: Number,
    ticketType: String,
    qrCodeData: String,
    purchaseDate: Date
}, { _id: false });

const OrderSchema = new mongoose.Schema({
    userId: String,
    customerName: String,
    customerEmail: String,
    tickets: [OrderTicketSchema],
    totalAmount: Number,
    serviceFee: Number,
    discountApplied: Number,
    couponCode: String,
    status: { type: String, default: 'PAID' },
    paymentMode: String,
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
