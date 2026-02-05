
const Order = require('../models/Order');
const Event = require('../models/Event');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { sendOrderEmails } = require('../utils/emailService');
const { computeCouponDiscount } = require('../utils/discountService');

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
        // 1. Compute subtotal and determine any applicable coupon (auto-apply best)
        let couponCode;
        let discount = 0;
        let appliedCoupon = null;
        const subtotal = seats.reduce((acc, s) => acc + (s.price || 0), 0);

        if (couponId) {
            const coupon = await Coupon.findById(couponId);
            if (coupon) {
                // Validate and compute discount for this explicit coupon
                const resCompute = computeCouponDiscount(coupon, { subtotal, seats, seatsCount: seats.length, requestedCode: coupon.code, eventId: event.id });
                if (resCompute.discount > 0) {
                    discount = resCompute.discount;
                    appliedCoupon = { doc: coupon, usedInc: resCompute.usedCountIncrement };
                    couponCode = coupon.code;
                }
            }
        } else {
            // auto-apply best coupon for this event/organizer
            const eventDoc = await Event.findById(event.id);
            const organizerId = eventDoc ? eventDoc.organizerId : null;
            const coupons = await Coupon.find({ active: true, deleted: false, $or: [ { eventId: event.id }, { organizerId } ] });

            let best = { discount: 0, coupon: null, usedInc: 0 };
            for (const c of coupons) {
                const { discount: d, usedCountIncrement } = computeCouponDiscount(c, { subtotal, seats, seatsCount: seats.length, eventId: event.id });
                if (d > best.discount) {
                    best = { discount: d, coupon: c, usedInc: usedCountIncrement };
                }
            }
            if (best.coupon && best.discount > 0) {
                discount = best.discount;
                appliedCoupon = { doc: best.coupon, usedInc: best.usedInc };
                couponCode = best.coupon.code;
            }
        }

        // 2. Update Event Seats/Inventory
        const eventDoc = await Event.findById(event.id);
        if (eventDoc) {
            if (event.seatingType === 'RESERVED') {
                const soldIds = new Set(seats.map(s => s.id));

                // Pre-check: ensure all requested seats are available (or held but expired).
                // Reject the order if any seat is already SOLD/HELD/UNAVAILABLE or actively held by another booking.
                const now = new Date();
                const conflicts = [];
                for (const sid of soldIds) {
                    const existingSeat = eventDoc.seats.find(x => x.id === sid);
                    if (!existingSeat) {
                        conflicts.push({ id: sid, reason: 'NOT_FOUND' });
                        continue;
                    }
                    const st = existingSeat.status;
                    if (st === 'SOLD' || st === 'HELD' || st === 'UNAVAILABLE') {
                        conflicts.push({ id: sid, reason: st });
                        continue;
                    }
                    // If seat is BOOKING_IN_PROGRESS and holdUntil is in the future, consider it held
                    if (st === 'BOOKING_IN_PROGRESS' && existingSeat.holdUntil && new Date(existingSeat.holdUntil) > now) {
                        conflicts.push({ id: sid, reason: 'HELD' });
                        continue;
                    }
                }

                if (conflicts.length > 0) {
                    return res.status(409).json({ message: 'Some seats are not available', conflicts });
                }

                // All seats passed pre-check: mark them as SOLD (or clear expired holds)
                eventDoc.seats = eventDoc.seats.map(s => {
                    if (soldIds.has(s.id) && (s.status === 'BOOKING_IN_PROGRESS' || s.status === 'AVAILABLE' || (s.status === 'BOOKING_IN_PROGRESS' && (!s.holdUntil || new Date(s.holdUntil) < now)))) {
                        return { ...s, status: 'SOLD', holdUntil: null };
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

        // If a coupon was applied, increment used count (respecting maxUses and increments)
        if (appliedCoupon && appliedCoupon.doc) {
            try {
                const cdoc = appliedCoupon.doc;
                const inc = appliedCoupon.usedInc || 1;
                if (cdoc.maxUses) {
                    const remaining = Math.max(0, cdoc.maxUses - (cdoc.usedCount || 0));
                    const toAdd = Math.min(inc, remaining);
                    cdoc.usedCount = (cdoc.usedCount || 0) + toAdd;
                } else {
                    cdoc.usedCount = (cdoc.usedCount || 0) + inc;
                }
                await cdoc.save();
            } catch (e) {
                console.error('Failed to update coupon usage count', e);
            }
        }

        // 3. Create Order
        const totalAmount = Math.max(0, subtotal - discount) + serviceFee;
        
        // Generate Ticket Objects with compact alphanumeric IDs (10-12 chars)
        const crypto = require('crypto');
        const TICKET_PREFIX = process.env.TICKET_PREFIX || 'JH';
        const generateTicketId = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            const coreLen = 8 + Math.floor(Math.random() * 3); // 8,9,10 core chars
            const bytes = crypto.randomBytes(coreLen);
            let core = '';
            for (let i = 0; i < coreLen; i++) {
                core += chars[bytes[i] % chars.length];
            }
            return `${TICKET_PREFIX}${core}`;
        };

        const tickets = seats.map(s => {
            const ticketId = generateTicketId();
            return {
                id: ticketId,
                eventId: event.id,
                eventTitle: event.title,
                seatId: s.id,
                seatLabel: `${s.rowLabel}${s.seatNumber}`,
                price: s.price,
                color: s.color || null,
                ticketType: s.tier,
                qrCodeData: ticketId, // QR code now contains the compact Ticket ID
                purchaseDate: new Date(),
                checkedIn: false
            };
        });

        const order = await Order.create({
            userId: customer.id || `guest-${Date.now()}`,
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone || null,
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
                    adminEmail: admin ? admin.email : 'admin@jayhoticket.com'
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
