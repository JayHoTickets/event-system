
import { Event, Seat, SeatStatus, User, UserRole, Coupon, Order, Venue, Theater, Stage, ServiceCharge, PaymentMode, Ticket } from '../types';

const API_URL = 'http://localhost:5000/api';

const fetchJson = async (url: string, options?: RequestInit) => {
    try {
        const res = await fetch(`${API_URL}${url}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || `API Error: ${res.statusText}`);
        }
        return res.json();
    } catch (error: any) {
        console.error(`Fetch error for ${url}:`, error);
        throw error;
    }
};

// --- AUTH & USERS ---
export const authenticateUser = (email: string, password: string): Promise<User> => {
    return fetchJson('/auth/login', { 
        method: 'POST', 
        body: JSON.stringify({ email, password }) 
    });
};

export const mockLogin = (role: UserRole): Promise<User> => {
    return fetchJson('/auth/mock-login', { 
        method: 'POST', 
        body: JSON.stringify({ role }) 
    });
};

export const fetchUsersByRole = (role: UserRole): Promise<User[]> => {
    return fetchJson(`/users?role=${role}`);
};

export const createOrganizerUser = (name: string, email: string, password: string): Promise<User> => {
    return fetchJson('/users/organizer', { 
        method: 'POST', 
        body: JSON.stringify({ name, email, password }) 
    });
};

// --- SERVICE CHARGES ---
export const fetchServiceCharges = (): Promise<ServiceCharge[]> => fetchJson('/service-charges');

export const createServiceCharge = (data: Omit<ServiceCharge, 'id'>): Promise<ServiceCharge> => {
    return fetchJson('/service-charges', { 
        method: 'POST', 
        body: JSON.stringify(data) 
    });
};

export const updateServiceCharge = (id: string, data: Partial<ServiceCharge>): Promise<ServiceCharge> => {
    return fetchJson(`/service-charges/${id}`, { 
        method: 'PUT', 
        body: JSON.stringify(data) 
    });
};

export const deleteServiceCharge = (id: string): Promise<void> => {
    return fetchJson(`/service-charges/${id}`, { method: 'DELETE' });
};

// --- VENUES ---
export const fetchVenues = (): Promise<Venue[]> => fetchJson('/venues');

export const createVenue = (venue: Omit<Venue, 'id'>): Promise<Venue> => {
    return fetchJson('/venues', { 
        method: 'POST', 
        body: JSON.stringify(venue) 
    });
};

export const updateVenue = (id: string, venue: Partial<Venue>): Promise<Venue> => {
    return fetchJson(`/venues/${id}`, { 
        method: 'PUT', 
        body: JSON.stringify(venue) 
    });
};

export const deleteVenue = (id: string): Promise<void> => {
    return fetchJson(`/venues/${id}`, { method: 'DELETE' });
};

// --- THEATERS ---
export const fetchTheaters = (): Promise<Theater[]> => fetchJson('/theaters');
export const fetchTheatersByVenue = (venueId: string): Promise<Theater[]> => fetchJson(`/theaters?venueId=${venueId}`);
export const fetchTheaterById = (id: string): Promise<Theater | undefined> => fetchJson(`/theaters/${id}`);
export const createTheater = (theater: Omit<Theater, 'id' | 'seats' | 'stage'>): Promise<Theater> => {
    return fetchJson('/theaters', { 
        method: 'POST', 
        body: JSON.stringify(theater) 
    });
};

export const updateTheaterInfo = (id: string, data: Partial<Theater>): Promise<Theater> => {
    return fetchJson(`/theaters/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
};

export const deleteTheater = (id: string): Promise<void> => {
    return fetchJson(`/theaters/${id}`, { method: 'DELETE' });
};

export const saveTheaterLayout = (id: string, seats: Seat[], stage: Stage, rows: number, cols: number): Promise<void> => {
    return fetchJson(`/theaters/${id}/layout`, { 
        method: 'PUT', 
        body: JSON.stringify({ seats, stage, rows, cols }) 
    });
};

// --- EVENTS ---
export const fetchEvents = (): Promise<Event[]> => fetchJson('/events');
export const fetchAllEventsForAdmin = (): Promise<Event[]> => fetchJson('/events?admin=true');
export const fetchEventsByOrganizer = (organizerId: string): Promise<Event[]> => fetchJson(`/events?organizerId=${organizerId}`);
export const fetchEventById = (id: string): Promise<Event & { venueName: string } | undefined> => fetchJson(`/events/${id}`);

export const createEvent = (eventData: any): Promise<Event> => {
    return fetchJson('/events', { 
        method: 'POST', 
        body: JSON.stringify(eventData) 
    });
};

export const updateEvent = (id: string, eventData: any): Promise<Event> => {
    return fetchJson(`/events/${id}`, { 
        method: 'PUT', 
        body: JSON.stringify(eventData) 
    });
};

export const deleteEvent = (id: string): Promise<void> => {
    return fetchJson(`/events/${id}`, { method: 'DELETE' });
};

export const holdSeat = (eventId: string, seatId: string): Promise<boolean> => {
    return fetchJson('/seats/hold', { 
        method: 'POST', 
        body: JSON.stringify({ eventId, seatId }) 
    }).then(res => res.success);
};

export const lockSeats = (eventId: string, seatIds: string[]): Promise<void> => {
    // Returns the parsed response from the API. Backend should return
    // { success: boolean, conflicts?: string[] } when seats couldn't be locked.
    return fetchJson(`/events/${eventId}/lock-seats`, {
        method: 'POST',
        body: JSON.stringify({ seatIds })
    });
};

export const releaseSeats = (eventId: string, seatIds: string[]): Promise<void> => {
    return fetchJson(`/events/${eventId}/release-seats`, {
        method: 'POST',
        body: JSON.stringify({ seatIds })
    });
};

// Used for page unloads where we need a best-effort release that doesn't
// rely on the app being alive to await a JSON response. Uses `keepalive`.
export const releaseSeatsKeepAlive = (eventId: string, seatIds: string[]) => {
    try {
        const url = `${API_URL}/events/${eventId}/release-seats`;
        const payload = JSON.stringify({ seatIds });

        // Prefer navigator.sendBeacon when available (more reliable on unload)
        if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
            try {
                const blob = new Blob([payload], { type: 'application/json' });
                (navigator as any).sendBeacon(url, blob);
                return;
            } catch (beaconErr) {
                console.warn('sendBeacon failed, falling back to fetch keepalive', beaconErr);
            }
        }

        // Fallback to fetch with keepalive
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            keepalive: true
        }).catch(e => {
            // Best-effort - ignore errors
            console.error('Keepalive release failed', e);
        });
    } catch (e) {
        console.error('Keepalive release failed', e);
    }
};

export const updateSeatStatus = (eventId: string, seatIds: string[], status: SeatStatus): Promise<void> => {
    return fetchJson(`/events/${eventId}/seats`, { 
        method: 'PUT', 
        body: JSON.stringify({ seatIds, status }) 
    });
};

// --- COUPONS ---
export const fetchCouponsByOrganizer = (organizerId: string): Promise<Coupon[]> => fetchJson(`/coupons?organizerId=${organizerId}`);
export const createCoupon = (data: any): Promise<Coupon> => {
    return fetchJson('/coupons', { 
        method: 'POST', 
        body: JSON.stringify(data) 
    });
};

export const updateCoupon = (id: string, updates: Partial<Coupon>): Promise<Coupon> => {
    return fetchJson(`/coupons/${id}`, { 
        method: 'PUT', 
        body: JSON.stringify(updates) 
    });
};

export const deleteCoupon = (id: string): Promise<void> => {
    return fetchJson(`/coupons/${id}`, { method: 'DELETE' });
};

export const validateCoupon = (code: string, eventId: string): Promise<Coupon> => {
    return fetchJson('/coupons/validate', { 
        method: 'POST', 
        body: JSON.stringify({ code, eventId }) 
    });
};

// --- ORDERS & TICKETS & PAYMENTS ---
export const createPaymentIntent = (seats: Seat[], couponId?: string): Promise<{ clientSecret: string, totalAmount: number }> => {
    return fetchJson('/payments/create-intent', {
        method: 'POST',
        body: JSON.stringify({ seats, couponId })
    });
};

export const fetchAllOrders = (): Promise<Order[]> => fetchJson('/orders');
export const fetchEventOrders = (eventId: string): Promise<Order[]> => fetchJson(`/orders?eventId=${eventId}`);

export const processPayment = (
    customer: { name: string, email: string, id?: string }, 
    event: Event, 
    seats: Seat[], 
    serviceFee: number, 
    couponId?: string,
    paymentMode: PaymentMode = PaymentMode.ONLINE,
    transactionId?: string
): Promise<Order> => {
    return fetchJson('/orders', { 
        method: 'POST', 
        body: JSON.stringify({ customer, event, seats, serviceFee, couponId, paymentMode, transactionId }) 
    });
};

export const verifyTicket = (qrCode: string): Promise<{ valid: boolean, ticket: Ticket, order: Order }> => {
    return fetchJson('/orders/verify', { 
        method: 'POST', 
        body: JSON.stringify({ qrCode }) 
    });
};

export const checkInTicket = (ticketId: string, checkedIn: boolean): Promise<{ success: boolean, ticket: Ticket }> => {
    return fetchJson('/orders/check-in', { 
        method: 'POST', 
        body: JSON.stringify({ ticketId, checkedIn }) 
    });
};
