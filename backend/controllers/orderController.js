
const Order = require('../models/Order');
const Event = require('../models/Event');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { sendOrderEmails } = require('../utils/emailService');

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
    const { customer, event, seats, serviceFee, couponId, paymentMode, transactionId } = req.body;
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
                // Only transition seats that were temporarily held (BOOKING_IN_PROGRESS)
                // or still AVAILABLE to SOLD. Do not accidentally overwrite other states.
                eventDoc.seats = eventDoc.seats.map(s => {
                    if (soldIds.has(s.id) && (s.status === 'BOOKING_IN_PROGRESS' || s.status === 'AVAILABLE')) {
                        return { ...s, status: 'SOLD' };
                    }
                    return s;
                });
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
        
        // Generate Ticket Objects with IDs
        const tickets = seats.map(s => {
            const ticketId = `tkt-${s.id}-${Date.now()}`;
            return {
                id: ticketId,
                eventId: event.id,
                eventTitle: event.title,
                seatId: s.id,
                seatLabel: `${s.rowLabel}${s.seatNumber}`,
                price: s.price,
                ticketType: s.tier,
                qrCodeData: ticketId, // QR code now contains the exact Ticket ID
                purchaseDate: new Date(),
                checkedIn: false
            };
        });

        const order = await Order.create({
            userId: customer.id || `guest-${Date.now()}`,
            customerName: customer.name,
            customerEmail: customer.email,
            tickets: tickets,
            totalAmount,
            serviceFee,
            discountApplied: discount,
            couponCode,
            paymentMode,
            transactionId: transactionId || null // Store Stripe ID
        });

        // 4. Send Emails (Async - don't block response)
        try {
            // Fetch Organizer
            const organizer = eventDoc ? await User.findById(eventDoc.organizerId) : null;
            // Fetch Admin (Assuming first admin found, or specific system admin email)
            const admin = await User.findOne({ role: 'ADMIN' });
            
            // Pass data to email service
            if (eventDoc) {
                await sendOrderEmails({
                    order,
                    event: eventDoc,
                    customerName: customer.name,
                    customerEmail: customer.email,
                    organizerEmail: organizer ? organizer.email : null,
                    adminEmail: admin ? admin.email : 'admin@eventhorizon.com'
                });
            }
        } catch (emailError) {
            console.error('Failed to trigger order emails:', emailError);
        }

        res.json(order);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.verifyTicket = async (req, res) => {
    const { qrCode } = req.body;
    try {
        // Find order containing this ticket ID
        const order = await Order.findOne({ "tickets.id": qrCode });
        if (!order) {
            return res.status(404).json({ message: 'Invalid Ticket QR Code' });
        }

        const ticket = order.tickets.find(t => t.id === qrCode);
        
        // Return ticket + full order context (for group check-in)
        res.json({
            valid: true,
            ticket,
            order // Return full order so organizer can see other seats
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.checkInTicket = async (req, res) => {
    const { ticketId, checkedIn } = req.body;
    try {
        const order = await Order.findOne({ "tickets.id": ticketId });
        if (!order) {
            return res.status(404).json({ message: 'Ticket not found' });
        }

        const ticket = order.tickets.find(t => t.id === ticketId);
        ticket.checkedIn = checkedIn;
        if (checkedIn) {
            ticket.checkInDate = new Date();
        } else {
            ticket.checkInDate = null;
        }

        await order.save();
        res.json({ success: true, ticket });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
