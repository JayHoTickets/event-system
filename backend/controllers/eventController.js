
const { DateTime } = require('luxon');
const Event = require('../models/Event');
const Venue = require('../models/Venue');
const Theater = require('../models/Theater');

// Parse incoming date/time values from the client. The frontend sends
// the wall-clock value (e.g. "2026-01-26T18:00") together with an
// IANA timezone (e.g. "America/New_York"). Use Luxon to interpret that
// wall-clock time in the provided zone and produce a JS Date (UTC
// instant) suitable for storing in MongoDB.
const parseEventDate = (value, timezone) => {
    if (!value) return undefined;
    try {
        // Recognize a plain datetime-local (no offset) like 2026-01-26T18:00
        const localMatch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value);
        if (localMatch && timezone) {
            const dt = DateTime.fromFormat(value, "yyyy-MM-dd'T'HH:mm", { zone: timezone });
            if (dt.isValid) return dt.toJSDate();
        }
        // Otherwise, try ISO parsing — this will handle strings with offsets
        const dtIso = DateTime.fromISO(value, { zone: timezone || 'utc' });
        if (dtIso.isValid) return dtIso.toJSDate();
    } catch (err) {
        console.warn('parseEventDate failed for', value, timezone, err && err.message);
    }
    // Fallback: let JS parse it (may be interpreted as local timezone)
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
};

const formatVenueLocation = (v) => {
    if (!v) return '';
    const parts = [];
    if (v.name) parts.push(v.name);
    if (v.address) parts.push(v.address);
    const cityState = [v.city, v.state].filter(Boolean).join(', ');
    if (cityState) parts.push(cityState + (v.zipCode ? ` ${v.zipCode}` : ''));
    if (v.country) parts.push(v.country);
    return parts.join(', ');
};

// Cleanup job: find seats where holdUntil has expired and revert them to AVAILABLE
exports.cleanupExpiredHolds = async () => {
    try {
        const now = new Date();
        // Find events that have at least one seat with holdUntil < now
        const events = await Event.find({ 'seats.holdUntil': { $lt: now } });
        for (const ev of events) {
            let changed = false;
            ev.seats = ev.seats.map(s => {
                if (s.status === 'BOOKING_IN_PROGRESS' && s.holdUntil && new Date(s.holdUntil) < now) {
                    changed = true;
                    return { ...s.toObject ? s.toObject() : s, status: 'AVAILABLE', holdUntil: null };
                }
                return s;
            });
            if (changed) {
                await ev.save();
            }
        }
    } catch (err) {
        console.error('cleanupExpiredHolds error', err);
    }
};

exports.getEvents = async (req, res) => {
    try {
        // Default query
        let query = {};

        // If organizerId provided, scope to that organizer
        if (req.query.organizerId) {
            query.organizerId = req.query.organizerId;
        }

        // Deleted filtering: by default hide deleted events. If admin or
        // includeDeleted=true is passed, allow deleted events to be shown.
        if (!req.query.admin && !req.query.includeDeleted) {
            query.deleted = false;
        }

        // Public (no organizerId, no admin) should only see published events
        if (!req.query.organizerId && !req.query.admin) {
            query.status = 'PUBLISHED';
        }

        const events = await Event.find(query);

        // Attach formatted location for each event (handles older events without stored location)
        const venueIds = Array.from(new Set(events.map(e => String(e.venueId)).filter(Boolean)));
        const venues = await Venue.find({ _id: { $in: venueIds } });
        const venueMap = new Map(venues.map(v => [String(v._id), v]));

        const out = events.map(ev => {
            const evObj = ev.toObject ? ev.toObject({ virtuals: true }) : { ...ev };
            const v = venueMap.get(String(evObj.venueId));
            evObj.location = evObj.location || formatVenueLocation(v);

            // Hydrate stage from theater when missing so list endpoints also
            // provide stage visuals for older events that didn't store them.
            if ((!evObj.stage || Object.keys(evObj.stage).length === 0) && evObj.theaterId) {
                // We won't await here; instead we'll mark it for later population.
                // To keep this synchronous we attach a placeholder and let
                // individual getEventById handle full hydration. However, if
                // theater data is available in-memory it's preferable to fetch
                // it — but to avoid multiple DB calls here we leave as-is.
            }
            return evObj;
        });

        res.json(out);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.getEventById = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event || event.deleted) return res.status(404).json(null);
        const venue = await Venue.findById(event.venueId);
        const evObj = { ...event.toObject({ virtuals: true }) };
        evObj.location = evObj.location || formatVenueLocation(venue);
        evObj.venueName = venue ? venue.name : 'Unknown';
        // If the event doesn't have a stage saved (older events), try to
        // populate it from the referenced theater so the frontend (booking/
        // analytics) can render stage visuals like size, textSize and curve.
        if ((!evObj.stage || Object.keys(evObj.stage).length === 0) && evObj.theaterId) {
            try {
                const theater = await Theater.findById(evObj.theaterId);
                if (theater && theater.stage) {
                    evObj.stage = theater.stage;
                    // Also surface rows/cols if missing so SeatGrid can auto-fit
                    if (!evObj.rows && theater.rows) evObj.rows = theater.rows;
                    if (!evObj.cols && theater.cols) evObj.cols = theater.cols;
                }
            } catch (thErr) {
                // Non-fatal: if theater lookup fails, just continue without stage
                console.warn('Failed to hydrate theater stage for event', evObj.id, thErr && thErr.message);
            }
        }
        res.json(evObj);
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
                // Merge any incoming stage overrides (e.g., textSize/borderRadius)
                stage = { ...(theater.stage || {}), ...(data.stage || {}) };
                rows = theater.rows;
                cols = theater.cols;
            }
        }

        const formatVenueLocation = (v) => {
            if (!v) return '';
            const parts = [];
            if (v.name) parts.push(v.name);
            if (v.address) parts.push(v.address);
            const cityState = [v.city, v.state].filter(Boolean).join(', ');
            if (cityState) parts.push(cityState + (v.zipCode ? ` ${v.zipCode}` : ''));
            if (v.country) parts.push(v.country);
            return parts.join(', ');
        };

        // Parse provided start/end times using the provided timezone (if any)
        const parsedStart = parseEventDate(data.startTime, data.timezone);
        const parsedEnd = parseEventDate(data.endTime, data.timezone);

        const event = await Event.create({
            ...data,
            startTime: parsedStart || data.startTime,
            endTime: parsedEnd || data.endTime,
            seats,
            stage,
            rows,
            cols,
            location: formatVenueLocation(venue)
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
        // If the caller provided start/end times (as wall-clock strings),
        // parse them with the supplied timezone or fallback to the
        // existing event.timezone so we preserve the correct instant.
        if (data.startTime) {
            updateData.startTime = parseEventDate(data.startTime, data.timezone || event.timezone);
        }
        if (data.endTime) {
            updateData.endTime = parseEventDate(data.endTime, data.timezone || event.timezone);
        }
        const formatVenueLocation = (v) => {
            if (!v) return '';
            const parts = [];
            if (v.name) parts.push(v.name);
            if (v.address) parts.push(v.address);
            const cityState = [v.city, v.state].filter(Boolean).join(', ');
            if (cityState) parts.push(cityState + (v.zipCode ? ` ${v.zipCode}` : ''));
            if (v.country) parts.push(v.country);
            return parts.join(', ');
        };

        const venue= await Venue.findById(data.venueId || event.venueId);
        updateData.location = formatVenueLocation(venue);
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
                    updateData.stage = { ...(theater.stage || {}), ...(data.stage || {}) };
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
                    
                    updateData.stage = { ...(theater.stage || {}), ...(data.stage || {}) };
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

        // Second pass: update statuses to BOOKING_IN_PROGRESS and set expiry
        const holdExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        event.seats = event.seats.map(s => seatIdSet.has(s.id) ? { ...s, status: 'BOOKING_IN_PROGRESS', holdUntil: holdExpiry } : s);
        await event.save();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Release seats previously placed in BOOKING_IN_PROGRESS back to AVAILABLE
exports.releaseSeats = async (req, res) => {
    // Accept seatIds either from the JSON body or as a query parameter
    // (some keepalive/beacon requests may send data via query). The
    // query form is expected to be a JSON-encoded array string.
    let seatIds = req.body && req.body.seatIds;
    if ((!seatIds || seatIds.length === 0) && req.query && req.query.seatIds) {
        try {
            seatIds = JSON.parse(req.query.seatIds);
        } catch (parseErr) {
            // If parsing fails, try splitting comma separated
            seatIds = String(req.query.seatIds).split(',').map(s => s.trim()).filter(Boolean);
        }
    }
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        const seatIdSet = new Set(seatIds || []);
        event.seats = event.seats.map(s => {
            if (seatIdSet.has(s.id) && s.status === 'BOOKING_IN_PROGRESS') {
                return { ...s, status: 'AVAILABLE', holdUntil: null };
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

        // Mark as BOOKING_IN_PROGRESS and add expiry timestamp
        const holdExpiry2 = new Date(Date.now() + 5 * 60 * 1000);
        event.seats = event.seats.map(s => seatIdSet.has(s.id) ? { ...s.toObject ? s.toObject() : s, status: 'BOOKING_IN_PROGRESS', holdUntil: holdExpiry2 } : s);
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
                return { ...s.toObject ? s.toObject() : s, status: 'AVAILABLE', holdUntil: null };
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
