# "Pay Later" Feature Implementation Guide

## Feature Overview
The "Pay Later" feature allows event organizers to place temporary holds on seats for customers, deferring payment for up to 24 hours. Once payment is received, QR codes and tickets are generated. Held seats automatically release if payment isn't completed within 24 hours.

---

## Files Modified

### 1. **Frontend - Type Definitions**
**File:** `types.ts`
- **Change:** Added `HOLD = 'HOLD'` to `SeatStatus` enum
- **Purpose:** New seat status for organizer-placed holds awaiting customer payment (distinct from `BOOKING_IN_PROGRESS` which is for checkout flow)
- **Status Hierarchy:** 
  - `AVAILABLE` → `HOLD` (organizer action)
  - `HOLD` → `SOLD` (customer pays within 24hrs)
  - `HOLD` → `AVAILABLE` (24hrs expire, no payment)

### 2. **Frontend - Seat Grid Visualization**
**File:** `components/SeatGrid.tsx`
- **Change:** Updated `defaultGetSeatColor()` function to distinguish HOLD status
- **Visual Styling:**
  ```
  HOLD → Yellow (bg-yellow-400, text-yellow-900, font-semibold)
  BOOKING_IN_PROGRESS → Amber with pulse (bg-amber-200)
  SOLD → Light Grey (bg-slate-200)
  AVAILABLE → White or ticket color
  ```
- **User Experience:** Organizers and customers can now see clearly differentiated seat statuses

### 3. **Backend - Order Model Enhancement**
**File:** `backend/models/Order.js`
- **New Fields:**
  ```javascript
  paymentPendingUntil: Date        // Timestamp when hold expires
  paymentUrl: String               // URL for customer to complete payment
  ```
- **Status Values:**
  - `'PAID'` - Order fully paid, tickets issued
  - `'PAYMENT_PENDING'` - Order placed, awaiting payment
  - `'CANCELLED'` - Order cancelled or hold expired

### 4. **Backend - Email Service**
**File:** `backend/utils/emailService.js`
- **New Function:** `sendPaymentPendingEmail()`
  - Sends email when organizer places a hold
  - Includes:
    - ✅ Event details (date, time, location)
    - ✅ Seat information
    - ✅ Price breakdown with subtotal, fees, total
    - ✅ **Pay Now Button/URL** with countdown to 24-hour deadline
    - ❌ NO QR codes (payment not yet received)
    - ❌ NO tickets (payment not yet received)
  - Professional HTML template with:
    - Purple gradient header
    - Clear CTA button for payment
    - Warning about hold expiration
    - Support contact information

### 5. **Backend - Order Controller**
**File:** `backend/controllers/orderController.js`

#### New Endpoint 1: `createPaymentPendingOrder()`
When organizer clicks "Hold" on the Live Seat Map:
1. **Validates** - Confirms all seats are AVAILABLE
2. **Marks Seats** - Changes status to `HOLD` with 24-hour expiry
3. **Creates Order** - With `PAYMENT_PENDING` status
4. **Generates Tickets** - Without QR codes yet
5. **Sends Email** - Payment-pending email to customer
6. **Returns** - Order object with payment URL

**Request:**
```json
{
  "eventId": "event-id",
  "seatIds": ["seat-1", "seat-2"],
  "customer": {
    "id": "customer-id",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  },
  "serviceFee": 5.00
}
```

#### New Endpoint 2: `completePaymentPendingOrder()`
When customer completes payment:
1. **Validates** - Confirms order is PAYMENT_PENDING and hasn't expired
2. **Updates Order** - Changes status from `PAYMENT_PENDING` to `PAID`
3. **Updates Seats** - Changes status from `HOLD` to `SOLD`
4. **Generates QR Codes** - Adds QR code data to each ticket
5. **Sends Email** - Full order confirmation with QR codes and tickets
6. **Real-time Update** - Seat status reflected on organizer and public views

**Request:**
```json
{
  "orderId": "order-id",
  "paymentMode": "STRIPE",
  "transactionId": "stripe-payment-intent-id"
}
```

#### Updated Function: `cancelOrder()`
- Now handles release of `HOLD` status seats in addition to `SOLD` and `BOOKING_IN_PROGRESS`

### 6. **Backend - Event Controller**
**File:** `backend/controllers/eventController.js`

#### Enhanced: `cleanupExpiredHolds()`
Runs every 60 seconds to:
1. **Release Expired HOLD Seats** - Reverts `HOLD` status to `AVAILABLE` after 24 hours
2. **Release Expired BOOKING_IN_PROGRESS** - Clears checkout-flow holds (5 minutes)
3. **Cancel Expired Orders** - Converts PAYMENT_PENDING orders to CANCELLED when deadline passes
4. **Auto-Release Seats** - Automatically releases seats from cancelled orders back to AVAILABLE status

**Logic:**
```
For each Event:
  - Find seats with status=HOLD and holdUntil < now
  - Set status back to AVAILABLE
  
For each Order:
  - If status=PAYMENT_PENDING and paymentPendingUntil < now:
    - Change status to CANCELLED
    - Release held seats for that event
```

### 7. **Backend - Routes**
**File:** `backend/routes/orderRoutes.js`

**New Routes:**
- `POST /api/orders/payment-pending` - Create payment pending order (organizer hold)
- `POST /api/orders/:id/complete-payment` - Complete payment for held order

---

## Seat Status Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    SEAT STATUS LIFECYCLE                         │
└──────────────────────────────────────────────────────────────────┘

AVAILABLE
    │
    ├─→ [Organizer clicks Hold] → HOLD (24-hour timer starts)
    │        │
    │        ├─→ [Customer pays] → SOLD (tickets issued)
    │        │
    │        └─→ [24 hours expire] → AVAILABLE (auto-released)
    │
    └─→ [Customer selects in checkout] → BOOKING_IN_PROGRESS (5-minute timer)
             │
             └─→ [Payment completed] → SOLD (tickets issued)

Legend:
• AVAILABLE = Can be selected for purchase
• HOLD = Organizer placed hold, awaiting payment
• BOOKING_IN_PROGRESS = Customer in checkout, temporary lock
• SOLD = Order completed, tickets issued
• UNAVAILABLE = Not assigned to a ticket type
```

---

## Order Status Flow

```
┌──────────────────────────────────────────────────────────────┐
│              PAYMENT PENDING ORDER LIFECYCLE                 │
└──────────────────────────────────────────────────────────────┘

1. Organizer places HOLD
   ↓
2. Order created with status = PAYMENT_PENDING
   - Email sent to customer (no QR codes)
   - Payment URL included in email
   - 24-hour countdown starts
   ↓
3a. [HAPPY PATH] Customer clicks "Pay Now"
   ↓
   Order status = PAID
   - Seats change: HOLD → SOLD
   - QR codes generated for tickets
   - Confirmation email sent (with tickets & QR codes)
   ✓ Transaction complete

3b. [TIMEOUT] 24 hours pass without payment
   ↓
   Order status = CANCELLED (auto-cleanup)
   - Seats change: HOLD → AVAILABLE
   - Seats become available to other customers
   ✗ Booking expired
```

---

## Email Templates

### 1. Payment Pending Email (New)
**Sent:** When organizer places a hold
**Contains:**
- ✅ Event name, date, time, location
- ✅ Seat details and prices
- ✅ Itemized breakdown (subtotal, discount, service fee, total)
- ✅ **"💳 Complete Payment Now" button** with payment URL
- ✅ 24-hour countdown deadline with expiration timestamp
- ✅ Important notes about hold functionality
- ❌ No QR codes
- ❌ No ticket information

**Template:** Professional gradient header, clear CTA, warning box with expiration time

### 2. Order Confirmation Email (Existing, Enhanced)
**Sent:** When payment is completed for a hold order
**Contains:**
- ✅ Full order details
- ✅ QR codes for each ticket
- ✅ Ticket information ready for check-in
- ✅ Venue rules and policies
- ✅ Support contact information

---

## Real-Time Updates

### Seat Status Visibility
Both organizer and customer views reflect changes:

**Organizer Live Seat Map:**
- Sees all seat statuses: AVAILABLE, HOLD, BOOKING_IN_PROGRESS, SOLD, UNAVAILABLE
- Color-coded for quick identification
- Auto-refreshes when customers pay or holds expire

**Public Event Booking Page:**
- Sees AVAILABLE and SOLD seats
- Sees HOLD seats (marked as unavailable but shows "Pay Later Hold")
- Auto-refreshes to show released seats

### Backend Workflow
1. Organizer clicks "Hold" → Seats marked HOLD + Email sent
2. Customer pays → Endpoint called → Order status updated → Seats marked SOLD → Confirmation email sent
3. Cleanup job (every 60 seconds) → Checks expired holds/orders → Auto-releases seats

---

## Implementation Checklist

### Backend ✅
- [x] Added `HOLD` status to seat model
- [x] Added `paymentPendingUntil` and `paymentUrl` to Order model
- [x] Created `createPaymentPendingOrder()` endpoint
- [x] Created `completePaymentPendingOrder()` endpoint
- [x] Enhanced `cleanupExpiredHolds()` with payment pending logic
- [x] Updated `cancelOrder()` to handle HOLD seats
- [x] Created payment pending email template
- [x] Added new routes for payment pending operations

### Frontend ✅
- [x] Updated `SeatStatus` enum with HOLD
- [x] Updated `SeatGrid` color logic for HOLD status

### To-Do (Next Phase)
- [ ] Create organizer UI component for "Hold Seats" action in Live Seat Map
- [ ] Create payment completion page for customers
- [ ] Add real-time WebSocket updates for seat status changes
- [ ] Update analytics dashboard to show held vs. paid orders
- [ ] Add admin controls to manually release holds or extend deadlines
- [ ] Integrate with Stripe for actual payment processing

---

## Testing the Feature

### Test Case 1: Create Payment Pending Order
```bash
curl -X POST http://localhost:5000/api/orders/payment-pending \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "evt-123",
    "seatIds": ["seat-1", "seat-2"],
    "customer": {
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    },
    "serviceFee": 5.00
  }'
```

### Test Case 2: Complete Payment
```bash
curl -X POST http://localhost:5000/api/orders/order-id/complete-payment \
  -H "Content-Type: application/json" \
  -d '{
    "paymentMode": "STRIPE",
    "transactionId": "pi_xxx"
  }'
```

### Test Case 3: Auto-Release Expired Hold
Wait 24 hours or manually test cleanup function to verify:
- Order status changes to CANCELLED
- Seats change from HOLD to AVAILABLE
- Seats become available for new bookings

---

## Future Enhancements

1. **Partial Payment Option** - Allow organizers to charge a deposit
2. **SMS Reminders** - Send SMS reminder before 24-hour deadline
3. **Extend Hold** - Allow organizers to extend hold period
4. **Multiple Payment Methods** - Beyond Stripe (PayPal, etc.)
5. **Bulk Operations** - Organizers can place holds on multiple seats at once
6. **Analytics** - Track hold-to-paid conversion rates
7. **Waitlist Integration** - Auto-offer released seats to waitlist

---

## Database Indexes (Recommended)
```javascript
// Order schema
db.orders.createIndex({ "status": 1, "paymentPendingUntil": 1 })
db.orders.createIndex({ "customerEmail": 1 })

// Event schema
db.events.createIndex({ "seats.status": 1, "seats.holdUntil": 1 })
```

---

## Environment Variables
Ensure these are set in `.env`:
```
FRONTEND_URL=http://localhost:5173  # For payment URL generation
STRIPE_SECRET_KEY=sk_xxx            # For payment processing
TICKET_PREFIX=JH                    # Ticket ID prefix
EMAIL_FROM=noreply@jayhotickets.com # Email sender
```

---

## Support & Troubleshooting

### Issue: Seats not releasing after 24 hours
- Check if cleanup job is running: `console.log()` at top of cleanupExpiredHolds
- Verify database connection and Event/Order queries
- Check `holdUntil` timestamp format in database

### Issue: Customer not receiving payment pending email
- Verify AWS SES credentials in `.env`
- Check email service logs for SendEmailCommand errors
- Verify `customerEmail` is correct in request body

### Issue: Payment completion not updating seat status
- Confirm order status is `PAYMENT_PENDING` before calling complete endpoint
- Verify Event exists and has seats with correct IDs
- Check transaction ID is being stored correctly

---

## Related Files
- [SeatGrid Component](./components/SeatGrid.tsx)
- [Order Controller](./backend/controllers/orderController.js)
- [Email Service](./backend/utils/emailService.js)
- [Event Controller](./backend/controllers/eventController.js)
- [Order Model](./backend/models/Order.js)
- [Type Definitions](./types.ts)
