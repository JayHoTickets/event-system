
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const Theater = require('../models/Theater');

exports.getEvents = async (req, res) => {
    try {
        let query = { deleted: false };
        
        if (req.query.organizerId) {
            query.organizerId = req.query.organizerId;
        } else if (req.query.admin) {
            // Admin sees all not deleted
        } else {
            // Public sees only published
            query.status = 'PUBLISHED';
        }

        const events = await Event.find(query);
        res.json(events);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event || event.deleted) return res.status(404).json(null);
        
        const venue = await Venue.findById(event.venueId);
        // Return event with venueName appended
        res.json({ ...event.toObject({ virtuals: true }), venueName: venue ? venue.name : 'Unknown' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Helper to hydrate seats based on ticket types mapping
const hydrateSeats = (theaterSeats, ticketTypes, seatMappings) => {
    return theaterSeats.map(seat => {
        const typeId = seatMappings[seat.id];
        const type = ticketTypes.find(tt => tt.id === typeId);
        
        if (type) {
            return {
                ...seat,
                status: 'AVAILABLE',
                price: type.price,
                tier: type.name,
                color: type.color,
                ticketTypeId: type.id
            };
        } else {
            return {
                ...seat,
                status: 'UNAVAILABLE',
                price: 0,
                tier: 'N/A'
            };
        }
    });
};

exports.createEvent = async (req, res) => {
    const { seatMappings, ...data } = req.body;
    try {
        const venue = await Venue.findById(data.venueId);
        let seats = [], stage, rows = 0, cols = 0;

        if (data.seatingType === 'RESERVED') {
            const theater = await Theater.findById(data.theaterId);
            if (theater) {
                // Generate initial seat state based on theater layout + ticket mappings
                seats = hydrateSeats(theater.seats, data.ticketTypes, seatMappings);
                stage = theater.stage;
                rows = theater.rows;
                cols = theater.cols;
            }
        }

        const event = await Event.create({
            ...data,
            seats,
            stage,
            rows,
            cols,
            location: venue ? `${venue.name}, ${venue.city}` : ''
        });
        res.json(event);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateEvent = async (req, res) => {
    const { seatMappings, ...data } = req.body;
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ message: 'Not found' });

        let updateData = { ...data };
        
        // Handle Seat Remapping if provided
        if ((data.seatingType || event.seatingType) === 'RESERVED' && seatMappings) {
            const theaterId = data.theaterId || event.theaterId;
            const theater = await Theater.findById(theaterId);
            if (theater) {
                const types = data.ticketTypes || event.ticketTypes;
                updateData.seats = hydrateSeats(theater.seats, types, seatMappings);
                updateData.stage = theater.stage;
                updateData.rows = theater.rows;
                updateData.cols = theater.cols;
            }
        }

        const updatedEvent = await Event.findByIdAndUpdate(req.params.id, updateData, { new: true });
        res.json(updatedEvent);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        await Event.findByIdAndUpdate(req.params.id, { deleted: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.updateSeats = async (req, res) => {
    const { seatIds, status } = req.body;
    try {
        const event = await Event.findById(req.params.id);
        if(!event) return res.status(404).json({});

        const seatIdSet = new Set(seatIds);
        event.seats = event.seats.map(s => seatIdSet.has(s.id) ? { ...s, status } : s);
        
        await event.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.holdSeat = async (req, res) => {
    const { eventId, seatId } = req.body;
    try {
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ success: false });
        
        if (event.seatingType === 'GENERAL_ADMISSION') return res.json({ success: true });

        const seat = event.seats.find(s => s.id === seatId);
        if (seat && seat.status === 'AVAILABLE') {
            return res.json({ success: true });
        }
        res.json({ success: false });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
