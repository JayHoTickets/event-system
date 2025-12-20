
const Order = require('../models/Order');
const Event = require('../models/Event');
const Coupon = require('../models/Coupon');

exports.getOrders = async (req, res) => {
    try {
        const query = req.query.eventId ? { 'tickets.eventId': req.query.eventId } : {};
        const orders = await Order.find(query);
        res.json(orders);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.createOrder = async (req, res) => {
    const { customer, event, seats, serviceFee, couponId, paymentMode } = req.body;
    try {
        // 1. Process Coupon
        let couponCode;
        let discount = 0;
        
        if (couponId) {
            const coupon = await Coupon.findById(couponId);
            if(coupon) {
                coupon.usedCount += 1;
                await coupon.save();
                couponCode = coupon.code;
                
                const subtotal = seats.reduce((acc, s) => acc + (s.price || 0), 0);
                discount = coupon.discountType === 'PERCENTAGE' ? subtotal * (coupon.value / 100) : coupon.value;
            }
        }

        // 2. Update Event Seats/Inventory
        const eventDoc = await Event.findById(event.id);
        if (eventDoc) {
            if (event.seatingType === 'RESERVED') {
                const soldIds = new Set(seats.map(s => s.id));
                eventDoc.seats = eventDoc.seats.map(s => soldIds.has(s.id) ? { ...s, status: 'SOLD' } : s);
            } else {
                const counts = {};
                seats.forEach(s => counts[s.ticketTypeId] = (counts[s.ticketTypeId] || 0) + 1);
                eventDoc.ticketTypes = eventDoc.ticketTypes.map(tt => {
                    return counts[tt.id] ? { ...tt, sold: (tt.sold || 0) + counts[tt.id] } : tt;
                });
            }
            await eventDoc.save();
        }

        // 3. Create Order
        const subtotal = seats.reduce((acc, s) => acc + (s.price || 0), 0);
        const totalAmount = Math.max(0, subtotal - discount) + serviceFee;

        const order = await Order.create({
            userId: customer.id || `guest-${Date.now()}`,
            customerName: customer.name,
            customerEmail: customer.email,
            tickets: seats.map(s => ({
                id: `tkt-${s.id}-${Date.now()}`,
                eventId: event.id,
                eventTitle: event.title,
                seatId: s.id,
                seatLabel: `${s.rowLabel}${s.seatNumber}`,
                price: s.price,
                ticketType: s.tier,
                qrCodeData: `mock-qr-${Date.now()}`,
                purchaseDate: new Date()
            })),
            totalAmount,
            serviceFee,
            discountApplied: discount,
            couponCode,
            paymentMode
        });

        res.json(order);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
