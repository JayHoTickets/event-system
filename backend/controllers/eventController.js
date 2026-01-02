
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
        const seatObj = seat.toObject ? seat.toObject() : seat;
        const seatId = seat.id || (seatObj._id ? seatObj._id.toString() : seatObj.id);
        const typeId = seatMappings[seatId];
        const type = ticketTypes.find(tt => tt.id === typeId);
        
        if (type) {
            return {
                ...seatObj,
                id: seatId,
                status: 'AVAILABLE',
                price: type.price,
                tier: type.name,
                color: type.color,
                ticketTypeId: type.id
            };
        } else {
            return {
                ...seatObj,
                id: seatId,
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
        const venue= await Venue.findById(data.venueId || event.venueId);
        updateData.location = venue ? `${venue.name}, ${venue.city}` : '';
        // Handle Seat Remapping and theater/venue changes
        if ((data.seatingType || event.seatingType) === 'RESERVED') {
            const incomingTheaterId = data.theaterId || event.theaterId;
            const theaterChanged = data.theaterId && data.theaterId !== event.theaterId;
            const venueChanged = data.venueId && data.venueId !== event.venueId;
            if(venueChanged && (seatMappings!=null || seatMappings.length===0) )
            {
                const emptyTheaterEvent=event
                emptyTheaterEvent.theaterId=null;
                emptyTheaterEvent.seats=[];
                emptyTheaterEvent.stage=null;
                emptyTheaterEvent.rows=0;
                emptyTheaterEvent.cols=0;
               await Event.findByIdAndUpdate(req.params.id, emptyTheaterEvent, { new: true }); 
            }
            // If the theater or venue changed, rebuild seats from the new theater layout
            if (theaterChanged || venueChanged) {
                const theater = await Theater.findById(incomingTheaterId);
                if (theater) {
                    const types = data.ticketTypes || event.ticketTypes;
                    // Use provided seatMappings or empty mapping so new theater seats are assigned accordingly
                    const mappingsToUse = seatMappings || {};
                    updateData.seats = hydrateSeats(theater.seats, types, mappingsToUse);
                    updateData.stage = theater.stage;
                    updateData.rows = theater.rows;
                    updateData.cols = theater.cols;
                }
            } else if (seatMappings) {
                // If theater didn't change but explicit mappings were provided, remap seats accordingly
                const theaterId = data.theaterId || event.theaterId;
                const theater = await Theater.findById(theaterId);
                if (theater) {
                    const types = data.ticketTypes || event.ticketTypes;
                    
                    // Create a map of existing seats to preserve status
                    const existingSeatsMap = new Map(event.seats.map(s => [s.id, s]));

                    updateData.seats = theater.seats.map(tSeat => {
                        const seatObj = tSeat.toObject ? tSeat.toObject() : tSeat;
                        const seatId = tSeat.id || (seatObj._id ? seatObj._id.toString() : seatObj.id);
                        const existingSeat = existingSeatsMap.get(seatId);
                        const typeId = seatMappings[seatId];
                        const type = types.find(tt => tt.id === typeId);
                        
                        let status = 'UNAVAILABLE';
                        // Preserve status if it exists and is a "busy" status
                        if (existingSeat && ['SOLD', 'BOOKING_IN_PROGRESS', 'HELD'].includes(existingSeat.status)) {
                            status = existingSeat.status;
                        } else if (type) {
                            status = 'AVAILABLE';
                        }

                        if (type) {
                            return {
                                ...seatObj,
                                status,
                                price: type.price,
                                tier: type.name,
                                color: type.color,
                                ticketTypeId: type.id
                            };
                        } else {
                            return {
                                ...seatObj,
                                status: status === 'AVAILABLE' ? 'UNAVAILABLE' : status,
                                price: 0,
                                tier: 'N/A'
                            };
                        }
                    });
                    
                    updateData.stage = theater.stage;
                    updateData.rows = theater.rows;
                    updateData.cols = theater.cols;
                }
            }
        }
        else{
            updateData.seats=[];
            updateData.stage=null;
            updateData.rows=0;
            updateData.cols=0;  
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

// Atomically lock a set of seats for a short booking window. Expects body: { seatIds: [] }
exports.lockSeats = async (req, res) => {
    const { seatIds } = req.body;
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        if (event.seatingType === 'GENERAL_ADMISSION') return res.json({ success: true });

        const conflicts = [];
        const seatIdSet = new Set(seatIds);

        // First pass: detect conflicts
        event.seats.forEach(s => {
            if (seatIdSet.has(s.id) && s.status !== 'AVAILABLE') {
                conflicts.push(s.id);
            }
        });

        if (conflicts.length > 0) {
            return res.json({ success: false, conflicts });
        }

        // Second pass: update statuses to BOOKING_IN_PROGRESS
        event.seats = event.seats.map(s => seatIdSet.has(s.id) ? { ...s, status: 'BOOKING_IN_PROGRESS' } : s);
        await event.save();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Release seats previously placed in BOOKING_IN_PROGRESS back to AVAILABLE
exports.releaseSeats = async (req, res) => {
    const { seatIds } = req.body;
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        const seatIdSet = new Set(seatIds);
        event.seats = event.seats.map(s => {
            if (seatIdSet.has(s.id) && s.status === 'BOOKING_IN_PROGRESS') {
                return { ...s, status: 'AVAILABLE' };
            }
            return s;
        });

        await event.save();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Lock seats atomically for a short booking window. Only seats that are
// currently AVAILABLE will be moved to BOOKING_IN_PROGRESS. Returns
// { success: true } on full success or { success: false, conflicts: [seatIds] }
exports.lockSeats = async (req, res) => {
    const seatIds = req.body.seatIds || [];
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        if (event.seatingType === 'GENERAL_ADMISSION') return res.json({ success: true });

        const conflicts = [];
        const seatIdSet = new Set(seatIds);

        // Check availability
        event.seats.forEach(s => {
            if (seatIdSet.has(s.id)) {
                if (s.status !== 'AVAILABLE') conflicts.push(s.id);
            }
        });

        if (conflicts.length > 0) {
            return res.json({ success: false, conflicts });
        }

        // Mark as BOOKING_IN_PROGRESS
        event.seats = event.seats.map(s => seatIdSet.has(s.id) ? { ...s.toObject ? s.toObject() : s, status: 'BOOKING_IN_PROGRESS' } : s);
        await event.save();
        return res.json({ success: true });
    } catch (err) {
        console.error('lockSeats error', err);
        res.status(500).json({ message: err.message });
    }
};

// Release seats that are currently in BOOKING_IN_PROGRESS back to AVAILABLE.
exports.releaseSeats = async (req, res) => {
    const seatIds = req.body.seatIds || [];
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

        if (event.seatingType === 'GENERAL_ADMISSION') return res.json({ success: true });

        const seatIdSet = new Set(seatIds);
        event.seats = event.seats.map(s => {
            if (seatIdSet.has(s.id) && s.status === 'BOOKING_IN_PROGRESS') {
                return { ...s.toObject ? s.toObject() : s, status: 'AVAILABLE' };
            }
            return s;
        });
        await event.save();
        return res.json({ success: true });
    } catch (err) {
        console.error('releaseSeats error', err);
        res.status(500).json({ message: err.message });
    }
};
