# Quick Reference: Pay Later Feature API

## Seat Status Values

```
AVAILABLE              White/Custom Color
HOLD                   Yellow (#FBBF24)
BOOKING_IN_PROGRESS   Amber with Pulse (#FCD34D)
SOLD                   Light Grey (#E2E8F0)
UNAVAILABLE           Dark Grey (#1E293B)
SELECTED              Green (#10B981)
```

---

## Order Status Values

```
PAID              Order completed, tickets issued
PAYMENT_PENDING   Organizer placed hold, awaiting payment
CANCELLED         Order cancelled or hold expired
```

---

## API Endpoints

### 1. Create Payment Pending Order (Organizer)
```
POST /api/orders/payment-pending
Content-Type: application/json

{
  "eventId": "evt-123",
  "seatIds": ["seat-1", "seat-2", "seat-3"],
  "customer": {
    "id": "cust-456",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1-555-123-4567"
  },
  "serviceFee": 5.00
}

Response: {
  "id": "order-789",
  "status": "PAYMENT_PENDING",
  "totalAmount": 305.00,
  "paymentPendingUntil": "2026-03-06T12:30:00Z",
  "paymentUrl": "http://localhost:5173/checkout?orderId=...",
  "tickets": [
    {
      "id": "JH123ABC",
      "seatLabel": "A1",
      "price": 100.00,
      "qrCodeData": null
    }
  ]
}
```

### 2. Complete Payment for Hold
```
POST /api/orders/{orderId}/complete-payment
Content-Type: application/json

{
  "orderId": "order-789",
  "paymentMode": "STRIPE",
  "transactionId": "pi_1234567890"
}

Response: {
  "success": true,
  "order": {
    "id": "order-789",
    "status": "PAID",
    "paymentPendingUntil": null,
    "tickets": [
      {
        "id": "JH123ABC",
        "seatLabel": "A1",
        "qrCodeData": "JH123ABC"  // Now populated
      }
    ]
  },
  "message": "Payment completed successfully. Confirmation email sent."
}
```

### 3. Cancel Order (Existing)
```
POST /api/orders/{orderId}/cancel
Content-Type: application/json

{
  "organizerId": "org-456",
  "refundAmount": 300.00,
  "notes": "Customer requested cancellation",
  "refundStatus": "PENDING"
}

Response: {
  "success": true,
  "order": { ... }
}
```

### 4. Get Events by Organizer (To fetch event for live seat map)
```
GET /api/events?organizerId=org-456

Response: [
  {
    "id": "evt-123",
    "title": "Summer Concert",
    "seats": [
      {
        "id": "seat-1",
        "rowLabel": "A",
        "seatNumber": "1",
        "status": "AVAILABLE",
        "price": 100.00,
        "holdUntil": null
      },
      {
        "id": "seat-2",
        "rowLabel": "A",
        "seatNumber": "2",
        "status": "HOLD",
        "price": 100.00,
        "holdUntil": "2026-03-06T12:30:00Z"
      }
    ]
  }
]
```

---

## Email Templates

### Payment Pending Email
```
Subject: Payment Required for [Event Title]

Body includes:
- Event name, date, time, location
- Seat(s) information with prices
- Price breakdown (subtotal, discount, fees, total)
- "💳 Complete Payment Now" button
- 24-hour deadline with exact expiration time
- Important notes about hold expiration
- Support contact information

NO QR codes - NO tickets (payment pending)
```

### Order Confirmation Email (After Payment)
```
Subject: Your Tickets: [Event Title]

Body includes:
- Event name, date, time, location
- Seat(s) information with prices
- QR code for each ticket
- Ticket check-in instructions
- Venue rules and policies
- Support contact information

HAS QR codes - HAS ticket information
```

---

## Key Timings

```
HOLD expires after:           24 hours
BOOKING_IN_PROGRESS expires:   5 minutes
Cleanup job runs every:        60 seconds
```

---

## Database Fields

### Order Document
```javascript
{
  _id: ObjectId,
  userId: String,
  customerName: String,
  customerEmail: String,
  customerPhone: String,
  tickets: [
    {
      id: String,
      seatId: String,
      seatLabel: String,
      price: Number,
      qrCodeData: String,  // null if PAYMENT_PENDING
      purchaseDate: Date,
      checkedIn: Boolean
    }
  ],
  totalAmount: Number,
  serviceFee: Number,
  discountApplied: Number,
  couponCode: String,
  status: String,  // 'PAID', 'PAYMENT_PENDING', 'CANCELLED'
  
  // NEW FIELDS
  paymentPendingUntil: Date,    // null if PAID or CANCELLED
  paymentUrl: String,            // null if PAID or CANCELLED
  
  // Refund fields
  refundAmount: Number,
  refundStatus: String,
  cancellationNotes: String,
  
  // Payment fields
  paymentMode: String,
  transactionId: String,
  refundTransactionId: String,
  
  createdAt: Date
}
```

### Event Seat Document
```javascript
{
  id: String,
  row: Number,
  col: Number,
  rowLabel: String,
  seatNumber: String,
  status: String,  // 'AVAILABLE', 'HOLD', 'BOOKING_IN_PROGRESS', 'SOLD', 'UNAVAILABLE'
  
  // HOLD-specific
  holdUntil: Date,  // When this hold expires (null if not held)
  
  // Pricing
  tier: String,
  price: Number,
  color: String,
  ticketTypeId: String
}
```

---

## Frontend Integration Example

### Place Hold (Organizer)
```javascript
const placeHold = async (eventId, seatIds, customer) => {
  const response = await fetch('/api/orders/payment-pending', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId,
      seatIds,
      customer,
      serviceFee: 5.00
    })
  });
  
  if (!response.ok) throw new Error('Failed to place hold');
  
  const order = await response.json();
  console.log('Hold placed:', order);
  console.log('Payment URL:', order.paymentUrl);
  return order;
};
```

### Complete Payment (Customer)
```javascript
const completePayment = async (orderId, paymentMode, transactionId) => {
  const response = await fetch(`/api/orders/${orderId}/complete-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      paymentMode,
      transactionId
    })
  });
  
  if (!response.ok) throw new Error('Payment failed');
  
  const result = await response.json();
  console.log('Payment completed:', result);
  // User receives tickets via email
  return result;
};
```

---

## Seat Color Implementation

```typescript
// In SeatGrid component
const defaultGetSeatColor = (seat: Seat, isSelected: boolean) => {
  if (isSelected) return 'bg-green-500 text-white ring-2 ring-green-300';
  if (seat.status === SeatStatus.SOLD) return 'bg-slate-200 text-slate-400';
  if (seat.status === SeatStatus.HOLD) return 'bg-yellow-400 text-yellow-900 font-semibold';
  if (seat.status === SeatStatus.BOOKING_IN_PROGRESS) return 'bg-amber-200 text-amber-800 animate-pulse';
  if (seat.status === SeatStatus.UNAVAILABLE) return 'bg-slate-800 text-slate-600';
  return 'bg-white border-slate-300 text-slate-700';
};
```

---

## Error Handling

### Seats Not Available
```json
{
  "message": "Some seats are not available",
  "conflicts": [
    { "id": "seat-1", "reason": "SOLD" },
    { "id": "seat-2", "reason": "HOLD" }
  ],
  "statusCode": 409
}
```

### Payment Hold Expired
```json
{
  "message": "Payment hold has expired. Please contact support to rebook.",
  "statusCode": 400
}
```

### Order Not Payment Pending
```json
{
  "message": "Order is not in payment pending state",
  "statusCode": 400
}
```

---

## Testing Checklist

### Create Hold
- [ ] POST to /api/orders/payment-pending works
- [ ] Order created with PAYMENT_PENDING status
- [ ] Seats marked as HOLD with holdUntil set to 24h
- [ ] Email sent to customer with payment URL
- [ ] paymentUrl contains valid URL

### Complete Payment
- [ ] POST to /api/orders/:id/complete-payment works
- [ ] Order status changed from PAYMENT_PENDING to PAID
- [ ] Seat status changed from HOLD to SOLD
- [ ] QR codes generated (qrCodeData populated)
- [ ] Confirmation email sent
- [ ] Email contains QR codes

### Auto-Release
- [ ] Cleanup job runs every 60 seconds
- [ ] Expired HOLD seats released to AVAILABLE
- [ ] Expired orders marked CANCELLED
- [ ] Check logs: "cleanupExpiredHolds" message appears

### Cancellation
- [ ] Cancel PAYMENT_PENDING order releases HOLD seats
- [ ] Seats changed back to AVAILABLE
- [ ] Order marked CANCELLED

---

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Email not sending | Check AWS SES credentials in .env |
| Seats not releasing | Check cleanup job is running (check logs) |
| Order not updating | Verify order status is PAYMENT_PENDING |
| Wrong payment URL | Check FRONTEND_URL env variable is set |
| QR codes not generated | Confirm payment completion endpoint called |
| Seat color not showing | Verify SeatStatus enum has HOLD value |

---

## Environment Variables

```bash
# Email Setup
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=***
AWS_SECRET_ACCESS_KEY=***
EMAIL_FROM=noreply@jayhotickets.com

# Payment Processing
STRIPE_SECRET_KEY=sk_live_***

# Frontend
FRONTEND_URL=https://yourdomain.com

# Ticketing
TICKET_PREFIX=JH
```

---

## Related Documentation

- Full Feature Guide: [PAY_LATER_FEATURE.md](./PAY_LATER_FEATURE.md)
- Organizer UI Guide: [ORGANIZER_UI_GUIDE.md](./ORGANIZER_UI_GUIDE.md)
- Implementation Summary: [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)
