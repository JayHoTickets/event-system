
const Order = require('../models/Order');
const Event = require('../models/Event');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { sendOrderEmails } = require('../utils/emailService');
const { computeCouponDiscount } = require('../utils/discountService');

const { sendCancellationEmails } = require('../utils/emailService');
const Stripe = require('stripe');
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

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
                    // Seats that are already SOLD/HELD/UNAVAILABLE cannot be purchased.
                    // A seat in BOOKING_IN_PROGRESS is a short-term hold placed by
                    // the checkout flow and should be consumable by the purchaser
                    // who holds the booking window. Without ownership metadata we
                    // can't distinguish different holders, so accept BOOKING_IN_PROGRESS
                    // here and allow it to be moved to SOLD below.
                    if (st === 'SOLD' || st === 'HELD' || st === 'UNAVAILABLE') {
                        conflicts.push({ id: sid, reason: st });
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

        // Block tickets belonging to cancelled orders
        if (order.status === 'CANCELLED') {
            return res.status(400).json({ message: 'This ticket has been cancelled' });
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
        if (order.status === 'CANCELLED') {
            return res.status(400).json({ message: 'This ticket has been cancelled' });
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

// Organizer cancels an order for their event
exports.cancelOrder = async (req, res) => {
    const { id } = req.params; // order id
    const { organizerId, refundAmount = 0, notes = '', refundStatus = 'PENDING' } = req.body;
    try {
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Determine eventId from first ticket
        const eventId = order.tickets && order.tickets.length ? order.tickets[0].eventId : null;
        if (!eventId) return res.status(400).json({ message: 'Order has no event context' });

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        // Only organizer of the event can cancel
        if (!organizerId || String(event.organizerId) !== String(organizerId)) {
            return res.status(403).json({ message: 'Only the event organizer can cancel this order' });
        }

        // If already cancelled, allow updating refund fields/notes/status.
        const allowed = ['PENDING', 'PROCESSED', 'FAILED'];
        const normalizedRefundStatus = allowed.includes(String(refundStatus).toUpperCase()) ? String(refundStatus).toUpperCase() : 'PENDING';

        const wasAlreadyCancelled = order.status === 'CANCELLED';

        // Cap refund to the total ticket price only (do not refund service fees or extra charges)
        const ticketTotal = (order.tickets || []).reduce((acc, t) => acc + (Number(t.price) || 0), 0);
        const requestedRefund = Number(refundAmount) || 0;
        const allowedRefund = Math.max(0, Math.min(requestedRefund, ticketTotal));

        if (wasAlreadyCancelled) {
            // Update refund fields and notes (cap refund to ticket total)
            order.refundAmount = allowedRefund;
            order.refundStatus = normalizedRefundStatus;
            order.cancellationNotes = notes || order.cancellationNotes;
            // Record update in history
            const now = new Date();
            order.cancellationHistory = order.cancellationHistory || [];
            order.cancellationHistory.push({ organizerId, timestamp: now, refundAmount: order.refundAmount, notes });
            order.cancelledBy = organizerId; // maintain/overwrite who performed latest action
            order.cancelledAt = order.cancelledAt || now;
        } else {
            // Mark order cancelled and record refund, notes and refund status
            order.status = 'CANCELLED';
            order.refundAmount = allowedRefund;
            order.refundStatus = normalizedRefundStatus;
            order.cancellationNotes = notes;
            order.cancelledBy = organizerId;
            order.cancelledAt = new Date();
            order.cancellationHistory = order.cancellationHistory || [];
            order.cancellationHistory.push({ organizerId, timestamp: order.cancelledAt, refundAmount: order.refundAmount, notes });
        }

        // If this is the first time we're cancelling the order, release seats
        // or decrement sold counts on the related Event so those tickets become available again.
        if (!wasAlreadyCancelled) {
            try {
                if (event.seatingType === 'RESERVED') {
                    // Release individual seats back to AVAILABLE
                    const seatIdsToRelease = order.tickets.map(t => t.seatId).filter(Boolean);
                    const seatSet = new Set(seatIdsToRelease);
                    event.seats = event.seats.map(s => {
                        if (seatSet.has(s.id) && (s.status === 'SOLD' || s.status === 'BOOKING_IN_PROGRESS')) {
                            return { ...s.toObject ? s.toObject() : s, status: 'AVAILABLE', holdUntil: null };
                        }
                        return s;
                    });
                    await event.save();
                } else {
                    // General admission: decrement sold counts by ticket type name
                    const countsByTypeName = {};
                    order.tickets.forEach(t => {
                        const typeName = t.ticketType || t.ticketTypeName || null;
                        if (typeName) countsByTypeName[typeName] = (countsByTypeName[typeName] || 0) + 1;
                    });
                    if (Object.keys(countsByTypeName).length > 0) {
                        event.ticketTypes = event.ticketTypes.map(tt => {
                            const dec = countsByTypeName[tt.name] || 0;
                            if (dec > 0) {
                                return { ...tt, sold: Math.max(0, (tt.sold || 0) - dec) };
                            }
                            return tt;
                        });
                        await event.save();
                    }
                }
            } catch (relErr) {
                console.error('Failed to release seats/update ticket counts on cancellation', relErr);
            }
        }

        await order.save();

        // If a refund amount is specified, attempt to create a Stripe refund now
        if (order.refundAmount && order.refundAmount > 0) {
            const amountInCents = Math.round(Number(order.refundAmount) * 100);
            try {
                if (!stripe) throw new Error('Stripe not configured (STRIPE_SECRET_KEY missing)');

                // Create refund against the PaymentIntent (Stripe will resolve the charge)
                const refund = await stripe.refunds.create({ payment_intent: order.transactionId, amount: amountInCents });

                order.refundStatus = 'PROCESSED';
                order.refundTransactionId = refund.id || (refund && refund.charge) || null;
                order.cancellationHistory = order.cancellationHistory || [];
                order.cancellationHistory.push({ organizerId, timestamp: new Date(), refundAmount: order.refundAmount, notes: `Refund issued: ${order.refundTransactionId}` });
                await order.save();
                console.log(`Stripe refund created for order ${order.id} refund=${order.refundAmount} id=${order.refundTransactionId}`);
            } catch (refundErr) {
                console.error('Stripe refund failed for order', order.id, refundErr);
                // Mark refund as FAILED but keep the record so admin can retry
                order.refundStatus = 'FAILED';
                order.cancellationHistory = order.cancellationHistory || [];
                order.cancellationHistory.push({ organizerId, timestamp: new Date(), refundAmount: order.refundAmount, notes: `Refund failed: ${refundErr.message || refundErr}` });
                await order.save();
            }
        }

        // Send notification emails (async)
        try {
            const organizer = await User.findById(event.organizerId);
            const admin = await User.findOne({ role: 'ADMIN' });
            await sendCancellationEmails({ order, event, organizerEmail: organizer ? organizer.email : null, adminEmail: admin ? admin.email : 'admin@jayhoticket.com' });
        } catch (emailErr) {
            console.error('Failed to send cancellation emails', emailErr);
        }

        res.json({ success: true, order });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Update only the refund status of a cancelled order
exports.updateRefundStatus = async (req, res) => {
    const { id } = req.params;
    const { organizerId, refundStatus } = req.body;
    try {
        const order = await Order.findById(id);
        if (!order) return res.status(404).json({ message: 'Order not found' });

        // Determine eventId from first ticket
        const eventId = order.tickets && order.tickets.length ? order.tickets[0].eventId : null;
        if (!eventId) return res.status(400).json({ message: 'Order has no event context' });

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        // Only organizer of the event can update refund status
        if (!organizerId || String(event.organizerId) !== String(organizerId)) {
            return res.status(403).json({ message: 'Only the event organizer can update refund status' });
        }

        const allowed = ['PENDING', 'PROCESSED', 'FAILED'];
        const normalized = allowed.includes(String(refundStatus).toUpperCase()) ? String(refundStatus).toUpperCase() : null;
        if (!normalized) return res.status(400).json({ message: 'Invalid refundStatus' });

        // Only allow updating refund status if order is cancelled (business rule)
        if (order.status !== 'CANCELLED') {
            return res.status(400).json({ message: 'Order must be cancelled to update refund status' });
        }

        order.refundStatus = normalized;
        // append to history
        order.cancellationHistory = order.cancellationHistory || [];
        order.cancellationHistory.push({ organizerId, timestamp: new Date(), refundAmount: order.refundAmount || 0, notes: `Refund status set to ${normalized}` });
        await order.save();

        res.json({ success: true, order });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
