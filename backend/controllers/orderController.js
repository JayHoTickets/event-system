
const Order = require('../models/Order');
const Event = require('../models/Event');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { sendOrderEmails } = require('../utils/emailService');
const { computeCouponDiscount } = require('../utils/discountService');
const { GLOBAL_LIMIT } = require('../config/complimentary');

const { sendCancellationEmails } = require('../utils/emailService');
const Stripe = require('stripe');
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

exports.getOrders = async (req, res) => {
    try {
        const query = req.query.eventId ? { 'tickets.eventId': req.query.eventId } : {};
        const orders = await Order.find(query);
        res.json(orders);
    } catch (err) {
        console.error('createOrder failed:', err);
        res.status(500).json({ message: err.message });
    }
};

exports.createOrder = async (req, res) => {
    const { customer, event, seats, serviceFee, appliedCharges, couponId, paymentMode, transactionId, bookedBy } = req.body;
    try {
        // 1. Compute subtotal and determine any applicable coupon (auto-apply best)
        let couponCode;
        let discount = 0;
        let appliedCoupon = null;
        const subtotal = seats.reduce((acc, s) => acc + (s.price || 0), 0);

        if (couponId) {
            // Only attempt to lookup coupon if couponId looks like a valid ObjectId
            const mongoose = require('mongoose');
            try {
                if (mongoose.Types.ObjectId.isValid(String(couponId))) {
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
                    console.warn('createOrder - couponId provided but not a valid ObjectId:', couponId);
                }
            } catch (e) {
                console.error('createOrder - coupon lookup failed', e);
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
        // Enforce complimentary limits if this is a complimentary order
        const isComplimentary = String(paymentMode || '').toUpperCase() === 'COMPLIMENTARY';
        if (isComplimentary && eventDoc) {
            try {
                // Count already-used complimentary tickets for this event
                const aggEvent = await Order.aggregate([
                    { $match: { complimentary: true } },
                    { $unwind: '$tickets' },
                    { $match: { 'tickets.eventId': event.id } },
                    { $count: 'n' }
                ]);
                const usedEvent = (aggEvent && aggEvent.length) ? aggEvent[0].n : 0;
                // Count already-used complimentary tickets for organizer (all events)
                let usedOrganizer = 0;
                if (eventDoc.organizerId) {
                    const organizerEventIds = await Event.find({ organizerId: eventDoc.organizerId }).select('_id');
                    const ids = organizerEventIds.map(e => String(e._id));
                    const aggOrg = await Order.aggregate([
                        { $match: { complimentary: true } },
                        { $unwind: '$tickets' },
                        { $match: { 'tickets.eventId': { $in: ids } } },
                        { $count: 'n' }
                    ]);
                    usedOrganizer = (aggOrg && aggOrg.length) ? aggOrg[0].n : 0;
                }

                const requested = seats.length || 0;

                // Apply limit precedence: event -> organizer -> global
                if (eventDoc.complimentaryLimit != null) {
                    if (usedEvent + requested > Number(eventDoc.complimentaryLimit)) {
                        return res.status(400).json({ message: 'Complimentary limit exceeded for this event' });
                    }
                } else if (eventDoc.organizerId) {
                    const organizerDoc = await User.findById(eventDoc.organizerId);
                    if (organizerDoc && organizerDoc.complimentaryLimit != null) {
                        if (usedOrganizer + requested > Number(organizerDoc.complimentaryLimit)) {
                            return res.status(400).json({ message: 'Complimentary limit exceeded for this organizer' });
                        }
                    } else if (GLOBAL_LIMIT != null) {
                        if (usedOrganizer + requested > Number(GLOBAL_LIMIT)) {
                            return res.status(400).json({ message: 'Complimentary global limit exceeded' });
                        }
                    }
                } else if (GLOBAL_LIMIT != null) {
                    if (usedEvent + requested > Number(GLOBAL_LIMIT)) {
                        return res.status(400).json({ message: 'Complimentary global limit exceeded' });
                    }
                }
            } catch (limitErr) {
                console.error('Failed to enforce complimentary limits', limitErr);
                return res.status(500).json({ message: 'Failed to validate complimentary limits' });
            }
        }
        if (eventDoc) {
            if (eventDoc.seatingType === 'RESERVED') {
                const soldIds = new Set(seats.map(s => s.id));

                // Pre-check: ensure all requested seats are available.
                // Reject the order if any seat is already SOLD/UNAVAILABLE or actively held by another booking.
                const now = new Date();
                const conflicts = [];
                for (const sid of soldIds) {
                    const existingSeat = eventDoc.seats.find(x => x.id === sid);
                    if (!existingSeat) {
                        conflicts.push({ id: sid, reason: 'NOT_FOUND' });
                        continue;
                    }
                    const st = existingSeat.status;
                    // Seats that are already SOLD/UNAVAILABLE cannot be purchased.
                    // A seat in BOOKING_IN_PROGRESS is a short-term hold placed by
                    // the checkout flow and should be consumable by the purchaser
                    // who holds the booking window. Without ownership metadata we
                    // can't distinguish different holders, so accept BOOKING_IN_PROGRESS
                    // here and allow it to be moved to SOLD below.
                    if (st === 'SOLD' || st === 'UNAVAILABLE') {
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

        // Normalize appliedCharges: accept array of objects or JSON/stringified forms
        let parsedAppliedCharges = appliedCharges;
        try {
            console.debug('createOrder - raw appliedCharges type:', typeof appliedCharges);
            try {
                // Attempt repeated JSON.parse to handle double/triple-serialized values
                let attempts = 0;
                let cur = appliedCharges;
                while (typeof cur === 'string' && attempts < 4) {
                    try {
                        cur = JSON.parse(cur);
                    } catch (e) {
                        // Try converting single quotes to double quotes as a last resort
                        try { cur = JSON.parse(cur.replace(/'/g, '"')); }
                        catch (e2) { break; }
                    }
                    attempts++;
                }
                parsedAppliedCharges = cur;
            } catch (parseErr) {
                console.debug('createOrder - appliedCharges parse attempt failed', parseErr);
                parsedAppliedCharges = appliedCharges;
            }
        } catch (ex) {
            console.debug('AppliedCharges normalization outer failed', ex);
            parsedAppliedCharges = appliedCharges;
        }

        if (!Array.isArray(parsedAppliedCharges)) {
            // If it's a single string that looks like an array, try a best-effort conversion
            if (typeof parsedAppliedCharges === 'string' && parsedAppliedCharges.trim().startsWith('[')) {
                try {
                    parsedAppliedCharges = JSON.parse(parsedAppliedCharges.replace(/'/g, '"'));
                } catch (e) {
                    parsedAppliedCharges = [];
                }
            } else {
                parsedAppliedCharges = [];
            }
        }

        const normalizedAppliedCharges = parsedAppliedCharges.map(c => ({
            name: c && c.name ? String(c.name) : '',
            type: c && c.type ? String(c.type) : '',
            value: c && (c.value !== undefined) ? Number(c.value) : 0,
            level: c && c.level ? String(c.level) : '',
            amount: c && (c.amount !== undefined) ? Number(c.amount) : 0
        }));
        console.debug('createOrder - normalizedAppliedCharges:', normalizedAppliedCharges);

        // Prepare final values; force zeros for complimentary bookings
        let finalTotal = totalAmount;
        let finalServiceFee = Number(serviceFee || 0);
        let finalAppliedCharges = Array.isArray(normalizedAppliedCharges) ? normalizedAppliedCharges : [];
        let finalDiscountApplied = discount;
        if (String(paymentMode || '').toUpperCase() === 'COMPLIMENTARY') {
            finalTotal = 0;
            finalServiceFee = 0;
            finalAppliedCharges = [];
            finalDiscountApplied = subtotal;
        }

        const order = await Order.create({
            userId: customer.id || `guest-${Date.now()}`,
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone || null,
            tickets: tickets,
            totalAmount: finalTotal,
            serviceFee: finalServiceFee,
            appliedCharges: finalAppliedCharges,
            discountApplied: finalDiscountApplied,
            couponCode,
            paymentMode,
            transactionId: transactionId || null, // Store Stripe ID
            // Persist bookedBy info if provided, otherwise infer from customer
            bookedBy: bookedBy || (customer && customer.id ? { id: customer.id, role: 'CUSTOMER', name: customer.name } : undefined),
            complimentary: String(paymentMode || '').toUpperCase() === 'COMPLIMENTARY'
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
                        if (seatSet.has(s.id) && (s.status === 'SOLD' || s.status === 'BOOKING_IN_PROGRESS' || s.status === 'HOLD')) {
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

/**
 * Complete payment for a payment-pending order
 * Updates order status from PAYMENT_PENDING to PAID
 * Updates seat status from HOLD to SOLD
 * Sends confirmation email with QR codes and tickets
 */
exports.completePaymentPendingOrder = async (req, res) => {
    const { orderId, paymentMode, transactionId } = req.body;
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Only allow completing PAYMENT_PENDING orders
        if (order.status !== 'PAYMENT_PENDING') {
            return res.status(400).json({ message: 'Order is not in payment pending state' });
        }

        // Check if payment is still valid (hasn't expired)
        const now = new Date();
        if (order.paymentPendingUntil && new Date(order.paymentPendingUntil) < now) {
            return res.status(400).json({ message: 'Payment hold has expired. Please contact support to rebook.' });
        }

        // 1. Fetch the event
        const eventId = order.tickets && order.tickets.length ? order.tickets[0].eventId : null;
        if (!eventId) {
            return res.status(400).json({ message: 'Order has no event context' });
        }

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // 2. Update order status to PAID
        order.status = 'PAID';
        order.paymentMode = paymentMode || 'STRIPE';
        order.transactionId = transactionId || null;
        order.paymentPendingUntil = null; // Clear the pending deadline
        order.paymentUrl = null; // Clear the payment URL

        // 3. Generate QR codes for tickets
        const seatIds = new Set(order.tickets.map(t => t.seatId));
        event.seats = event.seats.map(s => {
            if (seatIds.has(s.id) && s.status === 'HOLD') {
                return { ...s.toObject ? s.toObject() : s, status: 'SOLD', holdUntil: null };
            }
            return s;
        });

        // Update ticket QR codes (now that payment is complete)
        order.tickets = order.tickets.map(t => ({
            ...t,
            qrCodeData: t.id // Add QR code data with ticket ID
        }));

        await order.save();
        await event.save();

        // 4. Send order confirmation email with QR codes (async - don't block)
        try {
            const organizer = await User.findById(event.organizerId);
            const admin = await User.findOne({ role: 'ADMIN' });

            await sendOrderEmails({
                order,
                event,
                customerName: order.customerName,
                customerEmail: order.customerEmail,
                organizerEmail: organizer ? organizer.email : null,
                adminEmail: admin ? admin.email : 'admin@jayhoticket.com'
            });
        } catch (emailError) {
            console.error('Failed to send order confirmation email:', emailError);
            // Don't fail the payment completion if email fails
        }

        res.json({ success: true, order, message: 'Payment completed successfully. Confirmation email sent.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

/**
 * Create a payment pending order when organizer places a hold on seats
 * This creates an order with PAYMENT_PENDING status and sends a payment-pending email
 * The seats are marked as HOLD status and will auto-release after 24 hours if not paid
 */
exports.createPaymentPendingOrder = async (req, res) => {
    const { eventId, seatIds, customer, serviceFee = 0, bookedBy, paymentMode, couponId } = req.body;
    try {
        // 1. Fetch Event
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        if (event.seatingType !== 'RESERVED') {
            return res.status(400).json({ message: 'Payment pending holds only work with reserved seating' });
        }

        // 2. Verify seats exist and are available
        const seatIdSet = new Set(seatIds);
        const conflicts = [];
        const seatObjects = [];

        for (const seatId of seatIds) {
            const seat = event.seats.find(s => s.id === seatId);
            if (!seat) {
                conflicts.push({ id: seatId, reason: 'NOT_FOUND' });
                continue;
            }
            if (seat.status !== 'AVAILABLE') {
                conflicts.push({ id: seatId, reason: seat.status });
                continue;
            }
            seatObjects.push(seat);
        }

        if (conflicts.length > 0) {
            return res.status(409).json({ message: 'Some seats are not available', conflicts });
        }

        // If complimentary, enforce limits and create immediate PAID order instead of HOLD
        const isComplimentary = String(paymentMode || '').toUpperCase() === 'COMPLIMENTARY';
        if (isComplimentary) {
            try {
                // Count existing complimentary tickets for event and organizer and enforce limits
                const aggEvent = await Order.aggregate([
                    { $match: { complimentary: true } },
                    { $unwind: '$tickets' },
                    { $match: { 'tickets.eventId': eventId } },
                    { $count: 'n' }
                ]);
                const usedEvent = (aggEvent && aggEvent.length) ? aggEvent[0].n : 0;
                let usedOrganizer = 0;
                if (event.organizerId) {
                    const organizerEventIds = await Event.find({ organizerId: event.organizerId }).select('_id');
                    const ids = organizerEventIds.map(e => String(e._id));
                    const aggOrg = await Order.aggregate([
                        { $match: { complimentary: true } },
                        { $unwind: '$tickets' },
                        { $match: { 'tickets.eventId': { $in: ids } } },
                        { $count: 'n' }
                    ]);
                    usedOrganizer = (aggOrg && aggOrg.length) ? aggOrg[0].n : 0;
                }
                const requested = (seatIds && seatIds.length) ? seatIds.length : 0;
                if (event.complimentaryLimit != null) {
                    if (usedEvent + requested > Number(event.complimentaryLimit)) {
                        return res.status(400).json({ message: 'Complimentary limit exceeded for this event' });
                    }
                } else if (event.organizerId) {
                    const organizerDoc = await User.findById(event.organizerId);
                    if (organizerDoc && organizerDoc.complimentaryLimit != null) {
                        if (usedOrganizer + requested > Number(organizerDoc.complimentaryLimit)) {
                            return res.status(400).json({ message: 'Complimentary limit exceeded for this organizer' });
                        }
                    } else if (GLOBAL_LIMIT != null) {
                        if (usedOrganizer + requested > Number(GLOBAL_LIMIT)) {
                            return res.status(400).json({ message: 'Complimentary global limit exceeded' });
                        }
                    }
                } else if (GLOBAL_LIMIT != null) {
                    if (usedEvent + requested > Number(GLOBAL_LIMIT)) {
                        return res.status(400).json({ message: 'Complimentary global limit exceeded' });
                    }
                }

                // Create immediate PAID zero-valued order and mark seats SOLD
                const seatObjects = event.seats.filter(s => seatIds.includes(s.id));
                const subtotal = seatObjects.reduce((acc, s) => acc + (s.price || 0), 0);

                const crypto = require('crypto');
                const TICKET_PREFIX = process.env.TICKET_PREFIX || 'JH';
                const generateTicketId = () => {
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                    const coreLen = 8 + Math.floor(Math.random() * 3);
                    const bytes = crypto.randomBytes(coreLen);
                    let core = '';
                    for (let i = 0; i < coreLen; i++) {
                        core += chars[bytes[i] % chars.length];
                    }
                    return `${TICKET_PREFIX}${core}`;
                };

                const tickets = seatObjects.map(s => ({
                    id: generateTicketId(),
                    eventId: event.id,
                    eventTitle: event.title,
                    seatId: s.id,
                    seatLabel: `${s.rowLabel}${s.seatNumber}`,
                    price: s.price,
                    color: s.color || null,
                    ticketType: s.tier,
                    qrCodeData: null,
                    purchaseDate: new Date(),
                    checkedIn: false
                }));

                // Mark seats as SOLD in event
                const seatIdSet = new Set(seatIds);
                event.seats = event.seats.map(s => seatIdSet.has(s.id) ? { ...s, status: 'SOLD', holdUntil: null } : s);
                await event.save();

                const order = await Order.create({
                    userId: customer.id || `guest-${Date.now()}`,
                    customerName: customer.name,
                    customerEmail: customer.email,
                    customerPhone: customer.phone || null,
                    tickets,
                    totalAmount: 0,
                    serviceFee: 0,
                    discountApplied: subtotal,
                    status: 'PAID',
                    paymentPendingUntil: null,
                    paymentUrl: null,
                    bookedBy: bookedBy || (customer && customer.id ? { id: customer.id, role: 'CUSTOMER', name: customer.name } : undefined),
                    complimentary: true,
                    paymentMode: 'COMPLIMENTARY'
                });

                // Send confirmation emails asynchronously
                try {
                    const organizer = await User.findById(event.organizerId);
                    const admin = await User.findOne({ role: 'ADMIN' });
                    await sendOrderEmails({ order, event, customerName: customer.name, customerEmail: customer.email, organizerEmail: organizer ? organizer.email : null, adminEmail: admin ? admin.email : 'admin@jayhoticket.com' });
                } catch (emailErr) {
                    console.error('Failed to send complimentary order emails', emailErr);
                }

                return res.json(order);
            } catch (e) {
                console.error('createPaymentPendingOrder complimentary branch failed', e);
                return res.status(500).json({ message: 'Failed to create complimentary order' });
            }
        }

        // 3. Mark seats as HOLD with 24-hour expiry
        const holdExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        event.seats = event.seats.map(s => {
            if (seatIdSet.has(s.id)) {
                return { ...s, status: 'HOLD', holdUntil: holdExpiry };
            }
            return s;
        });
        await event.save();

        // 4. Calculate subtotal from seats
        const subtotal = seatObjects.reduce((acc, s) => acc + (s.price || 0), 0);
        // Apply coupon (if provided) to adjust totalAmount for PAYMENT_PENDING orders
        let discount = 0;
        let appliedCouponCode = null;
        if (couponId) {
            try {
                const mongoose = require('mongoose');
                if (mongoose.Types.ObjectId.isValid(String(couponId))) {
                    const coupon = await Coupon.findById(couponId);
                    if (coupon) {
                        const resCompute = computeCouponDiscount(coupon, { subtotal, seats: seatObjects, seatsCount: seatObjects.length, requestedCode: coupon.code, eventId });
                        if (resCompute && resCompute.discount > 0) {
                            discount = resCompute.discount;
                            appliedCouponCode = coupon.code;
                        }
                    }
                }
            } catch (e) {
                console.error('createPaymentPendingOrder - coupon validation failed', e);
            }
        }

        const totalAmount = Math.max(0, subtotal - (discount || 0)) + serviceFee;

        // 5. Generate Ticket Objects (without QR codes, as payment hasn't been made yet)
        const crypto = require('crypto');
        const TICKET_PREFIX = process.env.TICKET_PREFIX || 'JH';
        const generateTicketId = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            const coreLen = 8 + Math.floor(Math.random() * 3);
            const bytes = crypto.randomBytes(coreLen);
            let core = '';
            for (let i = 0; i < coreLen; i++) {
                core += chars[bytes[i] % chars.length];
            }
            return `${TICKET_PREFIX}${core}`;
        };

        const tickets = seatObjects.map(s => {
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
                qrCodeData: null, // No QR code yet - payment pending
                purchaseDate: new Date(),
                checkedIn: false
            };
        });

        // 6. Wait for order creation to get the ID for the payment URL (done below)
        // First create the order, then generate the payment URL with the actual order ID

        // 7. Create Order with PAYMENT_PENDING status
        const paymentPendingUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        const order = await Order.create({
            userId: customer.id || `guest-${Date.now()}`,
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone || null,
            tickets: tickets,
            totalAmount,
            serviceFee,
            discountApplied: discount || 0,
            couponCode: appliedCouponCode || undefined,
            status: 'PAYMENT_PENDING',
            paymentPendingUntil,
            paymentUrl: '', // Will be set below
            bookedBy: bookedBy || (customer && customer.id ? { id: customer.id, role: 'CUSTOMER', name: customer.name } : undefined)
        });

        // 8. Now set the payment URL with the actual order ID
        const paymentUrl = `${process.env.FRONTEND_URL || 'https://jayhotickets.com'}/payment?orderId=${order._id.toString()}&eventId=${eventId}`;
        order.paymentUrl = paymentUrl;
        await order.save();

        // 9. Send Payment Pending Email (async - don't block response)
        try {
            const { sendPaymentPendingEmail } = require('../utils/emailService');
            await sendPaymentPendingEmail({
                order,
                event,
                customerName: customer.name,
                customerEmail: customer.email,
                paymentUrl,
                paymentDueAt: paymentPendingUntil
            });
        } catch (emailError) {
            console.error('Failed to send payment pending email:', emailError);
        }

        res.json(order);
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
/**
 * Get a single order by ID
 * Used for payment completion page to load order details
 */
exports.getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        
        // Validate ObjectId format
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid order ID format' });
        }
        
        const order = await Order.findById(id);
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        res.json(order);
    } catch (err) {
        console.error('Error fetching order:', err);
        res.status(500).json({ message: 'Failed to fetch order details' });
    }
};