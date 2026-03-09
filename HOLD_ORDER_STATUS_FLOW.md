# Hold Order Status Flow & Diagrams

## 🔄 Complete Order Status Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                   HOLD ORDER (PAY LATER) FLOW                        │
└─────────────────────────────────────────────────────────────────────┘

                          START
                            ↓
                  ┌─────────────────┐
                  │ Live Seat Map   │
                  │ (Organizer)     │
                  └────────┬────────┘
                           ↓
                  ┌─────────────────┐
                  │  Select Seats   │
                  │  (Green color)  │
                  └────────┬────────┘
                           ↓
                  ┌─────────────────────┐
                  │ Click "Hold (Pay    │
                  │ Later)" button      │
                  │ (Yellow button)     │
                  └────────┬────────────┘
                           ↓
                  ┌──────────────────────┐
                  │ Hold Order Modal     │
                  │ Opens                │
                  │ - Enter customer     │
                  │   info               │
                  │ - Review seats       │
                  │ - Review amount      │
                  └────────┬─────────────┘
                           ↓
                  ┌──────────────────────┐
                  │ Click "Place Hold"   │
                  │ Button               │
                  └────────┬─────────────┘
                           ↓
          ┌────────────────┴────────────────┐
          │                                 │
          ↓                                 ↓
    ┌──────────────┐            ┌──────────────┐
    │  SUCCESS ✓   │            │   FAILED ✗   │
    └──────┬───────┘            └──────┬───────┘
           ↓                           ↓
    ┌──────────────┐        ┌────────────────┐
    │ Seats marked │        │ Error alert    │
    │ HOLD         │        │ displayed      │
    │ (Yellow)     │        │ Check form     │
    └──────┬───────┘        │ or server      │
           ↓                │ status         │
    ┌──────────────┐        └────────────────┘
    │ Email sent   │                 ↓
    │ to customer  │         [Return to form]
    │ with payment │
    │ link & time  │
    └──────┬───────┘
           ↓
    ┌──────────────────────┐
    │ PAYMENT_PENDING      │
    │ Status               │
    │ Timer: 24 hours      │
    └──────┬───────────────┘
           │
    ┌──────┴──────────────┐
    │                     │
    ↓                     ↓
[WITHIN 24h]      [AFTER 24 HOURS]
Customer Pays     No Payment
    │                  │
    ↓                  ↓
┌─────────┐      ┌─────────────┐
│ Payment │      │ Auto-Cleanup│
│ Received│      │ Job Runs    │
└────┬────┘      └────┬────────┘
     │                │
     ↓                ↓
┌────────────┐   ┌──────────────┐
│Order:PAID  │   │Order:CANCELLED
└────┬───────┘   │Seats:AVAILABLE
     │           └──────┬───────┘
     │                  │
     ↓                  ↓
┌──────────────┐   ┌──────────────┐
│Seats:SOLD    │   │Released      │
│(Light grey)  │   │for other     │
└────┬─────────┘   │customers     │
     │             └──────────────┘
     ↓
┌──────────────────┐
│QR Codes          │
│Generated &       │
│Sent to Customer  │
└────┬─────────────┘
     ↓
┌──────────────────┐
│Confirmation      │
│Email with        │
│Tickets           │
└────┬─────────────┘
     ↓
    END ✓
    Customer has valid
    tickets with QRs
```

---

## 📊 Seat Status Transitions

```
AVAILABLE (White/Color)
    ↓ [Organizer clicks "Hold (Pay Later)"]
    ↓
HOLD (Yellow) ─────────────────┬─────────────────┐
    ↓                           ↓                 ↓
[Customer Pays]           [No Payment]     [Organizer Cancels]
    ↓                      [24h expires]        ↓
    ↓                           ↓                ↓
SOLD (Light Grey)         AVAILABLE (White)  AVAILABLE (White)
    ↓
[Customer Checks In]
    ↓
REDEEMED
```

---

## Customer Payment Timeline

```
T=0 minutes
├─ Hold placed by organizer
├─ Seats change to YELLOW (HOLD)
├─ Payment email sent to customer
│  Contains:
│  - Payment link (clickable button)
│  - Event details
│  - Seat information
│  - Amount to pay
│  - 24-hour deadline message
│  - Time remaining
│  - No QR codes yet
│
├─ Customer receives email
│
T=0 to T=1440 minutes (24 hours)
├─ Customer has this window to pay
├─ Seats remain YELLOW (HOLD)
├─ Payment link is active
│
├─ SCENARIO A: Customer Clicks "Pay Now"
│  ├─ Customer redirected to payment page
│  ├─ Payment processed (e.g., Stripe)
│  ├─ Order status: PAYMENT_PENDING → PAID
│  ├─ Seats: HOLD → SOLD (change to light grey)
│  ├─ QR codes generated
│  ├─ Confirmation email sent with:
│  │  - Tickets with QR codes
│  │  - Check-in instructions
│  │  - Event details
│  │  - Support contact
│  └─ Order complete ✓
│
├─ SCENARIO B: Customer Does Nothing
│  └─ Payment window expires at T=1440
│
T=1440+ minutes (After 24 hours)
├─ Auto-cleanup job triggers (every 60 seconds)
├─ Finds all PAYMENT_PENDING orders older than 24h
├─ For each expired order:
│  ├─ Changes status: PAYMENT_PENDING → CANCELLED
│  ├─ Releases seats: HOLD → AVAILABLE
│  ├─ Sends expiration email to customer (if configured)
│  │  - Hold expired message
│  │  - Seats released
│  │  - Re-booking instructions
│  └─ Seats now available for other customers
│
└─ END: Order cancelled, seats available
```

---

## 🎨 Visual Seat Map Status Colors

```
┌─────────────────────────────────────────────────┐
│              SEAT MAP COLOR LEGEND              │
├─────────────────────────────────────────────────┤
│                                                 │
│ ██ WHITE/CUSTOM      = AVAILABLE                │
│    Can be selected or held                      │
│    Can be clicked for selection                 │
│                                                 │
│ ██ YELLOW (#FBBF24)  = HOLD (PAY LATER)         │
│    Awaiting payment within 24 hours             │
│    Cannot be selected (already held)            │
│    Seats reserved for specific customer        │
│                                                 │
│ ██ AMBER (Pulsing)   = BOOKING_IN_PROGRESS     │
│    Customer in checkout flow                    │
│    5-minute temporary hold                      │
│    Will revert to AVAILABLE if abandoned       │
│                                                 │
│ ██ LIGHT GREY        = SOLD                     │
│    Order completed and paid                     │
│    Tickets issued with QR codes                │
│    Cannot be selected                          │
│                                                 │
│ ██ DARK GREY         = UNAVAILABLE              │
│    Not assigned to ticket type                 │
│    Not available for selection                 │
│    Reserved or blocked                         │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Organizer Options at Each Stage

```
┌─────────────────────────────────────────────────────────┐
│            ORGANIZER ACTIONS BY STAGE                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ STAGE 1: Selecting Seats                                │
│ ├─ Click seats to select (turn green)                   │
│ ├─ Unselect by clicking again                           │
│ ├─ Use "Block" to mark unavailable                      │
│ └─ Use "Unblock" to mark available again                │
│                                                          │
│ STAGE 2: After Selection                                │
│ ├─ [Book (Box Office)] - Immediate SOLD status          │
│ └─ [Hold (Pay Later)] - 24-hour HOLD status             │
│                                                          │
│ STAGE 3: In Modal                                       │
│ ├─ Enter customer name*                                 │
│ ├─ Enter customer email*                                │
│ ├─ Enter phone (optional)                               │
│ ├─ Review seat details                                  │
│ ├─ Review total amount                                  │
│ └─ Click "Place Hold" or cancel                         │
│                                                          │
│ STAGE 4: After Hold Placed                              │
│ ├─ View hold in Orders list                             │
│ ├─ Check payment status (PAYMENT_PENDING)               │
│ ├─ See customer email for reference                     │
│ ├─ (Upcoming) Extend hold duration                      │
│ ├─ (Upcoming) Resend payment link                       │
│ ├─ Cancel order (releases seats)                        │
│ └─ Wait for customer payment or 24h expiry             │
│                                                          │
│ STAGE 5: Payment Received                               │
│ ├─ Seats automatically change to SOLD                   │
│ ├─ Order status becomes PAID                            │
│ ├─ Refresh view to see color change                     │
│ └─ Check-in available at event                          │
│                                                          │
│ STAGE 6: Hold Expired (No Payment)                      │
│ ├─ Order status changes to CANCELLED                    │
│ ├─ Seats automatically released                         │
│ ├─ Seats change back to AVAILABLE                       │
│ └─ Other customers can now book                         │
│                                                          │
└─────────────────────────────────────────────────────────┘

* Required fields
```

---

## 📋 Order Lifecycle Comparison

```
BOX OFFICE BOOKING vs HOLD ORDER

┌────────────────────────────────────┬────────────────────────────────────┐
│        BOX OFFICE BOOKING           │        HOLD ORDER (PAY LATER)      │
├────────────────────────────────────┼────────────────────────────────────┤
│ STEP 1                             │ STEP 1                             │
│ Select seats                       │ Select seats                       │
│ └─ Seats turn GREEN                │ └─ Seats turn GREEN                │
│                                    │                                    │
│ STEP 2                             │ STEP 2                             │
│ Click "Book (Box Office)"          │ Click "Hold (Pay Later)"           │
│                                    │                                    │
│ STEP 3                             │ STEP 3                             │
│ Modal opens                        │ Modal opens                        │
│ Get customer info (optional)       │ Get customer info (required)       │
│                                    │                                    │
│ STEP 4                             │ STEP 4                             │
│ Click "Book Seats"                 │ Click "Place Hold"                 │
│                                    │                                    │
│ IMMEDIATE RESULT:                  │ IMMEDIATE RESULT:                  │
│ ✅ Order created: PAID             │ ✅ Order created: PAYMENT_PENDING  │
│ ✅ Seats: SOLD (light grey)        │ ✅ Seats: HOLD (yellow)            │
│ ✅ QR codes generated              │ ✅ Payment email sent              │
│ ✅ Tickets issued                  │ ✅ NO QR codes yet                 │
│ ✅ Confirmation email sent         │ ✅ NO tickets yet                  │
│ ✅ Ready for check-in              │ ⏳ Waiting for payment             │
│                                    │                                    │
│ FINAL STATUS:                      │ AFTER CUSTOMER PAYS:               │
│ Customer has tickets with QR       │ ✅ Order: PAID                     │
│                                    │ ✅ Seats: SOLD (light grey)        │
│                                    │ ✅ QR codes generated              │
│                                    │ ✅ Confirmation email sent with QR │
│                                    │                                    │
│ Total time: Instant                │ PAYMENT WINDOW: 24 hours max       │
│ Payment: Cash/Charity              │ Payment: Direct payment link       │
│ Cost: No fee                       │ Cost: No fee                       │
└────────────────────────────────────┴────────────────────────────────────┘
```

---

## ⏰ Timeline View

```
HOUR 0: HOLD PLACED
┌─────────────────┐
│ Organizer clicks│
│ "Hold (Pay Later)"
│ Seats: AVAILABLE → HOLD
│ Order: Created with PAYMENT_PENDING
│ Email: Sent to customer
└─────────────────┘

HOUR 1-23: PENDING WINDOW
┌─────────────────────────┐
│ Customer has this window│
│ to complete payment     │
│ Seats remain: HOLD      │
│ Order status: PAYMENT_PENDING
│ Payment link: Active    │
└─────────────────────────┘

SCENARIO A: BEFORE HOUR 24
┌──────────────────┐
│ Customer pays    │
│ Payment received │
│ Order: PAYMENT_PENDING → PAID
│ Seats: HOLD → SOLD
│ QR codes: Generated
│ Confirmation: Email sent
│ Status: Complete ✓
└──────────────────┘

SCENARIO B: AFTER HOUR 24
┌─────────────────────┐
│ No payment received │
│ Auto-cleanup runs  │
│ Order: PAYMENT_PENDING → CANCELLED
│ Seats: HOLD → AVAILABLE
│ Expiry email: Sent to customer
│ Status: Expired ❌
└─────────────────────┘
```

---

## 🔔 Email Notifications Sent

```
┌──────────────────────────────────────────────────────┐
│        EMAILS SENT DURING HOLD ORDER PROCESS         │
├──────────────────────────────────────────────────────┤
│                                                      │
│ EMAIL 1: PAYMENT PENDING EMAIL                      │
│ ├─ Sent to: Customer email (from hold form)        │
│ ├─ When: Immediately after hold placed              │
│ ├─ Subject: "Payment Required for [Event]"         │
│ ├─ Contains:                                        │
│ │  ✓ Event details (name, date, time, location)   │
│ │  ✓ Seat information (seat numbers, prices)      │
│ │  ✓ Total amount due                              │
│ │  ✓ [PAY NOW] button linking to payment page     │
│ │  ✓ Countdown timer (24 hours)                    │
│ │  ✗ NOT QR codes (payment pending)                │
│ │  ✗ NOT tickets (payment pending)                 │
│ └─ Purpose: Get customer to pay within 24h        │
│                                                      │
│ EMAIL 2: CONFIRMATION EMAIL (If paid)              │
│ ├─ Sent to: Customer email                         │
│ ├─ When: Immediately after payment successful      │
│ ├─ Subject: "Your Tickets for [Event]"            │
│ ├─ Contains:                                        │
│ │  ✓ Order confirmation                           │
│ │  ✓ Event details                                 │
│ │  ✓ Seat information                             │
│ │  ✓ Price summary                                │
│ │  ✓ Tickets with QR codes                        │
│ │  ✓ Check-in instructions                        │
│ │  ✓ Support contact info                         │
│ └─ Purpose: Provide tickets and event details    │
│                                                      │
│ EMAIL 3: HOLD EXPIRED EMAIL (If not paid)         │
│ ├─ Sent to: Customer email                        │
│ ├─ When: After 24 hours with no payment (optional)│
│ ├─ Subject: "Your Hold Has Expired"              │
│ ├─ Contains:                                       │
│ │  ✓ Expiry notification                         │
│ │  ✓ Seats now available for others              │
│ │  ✓ Re-booking instructions                     │
│ │  ✓ Support contact                             │
│ └─ Purpose: Inform customer hold is released    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 🔄 Auto-Cleanup Job

```
╔════════════════════════════════════════════════════╗
║         AUTO-CLEANUP JOB (Runs every 60s)          ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║ 1. Query database for:                            ║
║    └─ Orders with status = PAYMENT_PENDING        ║
║    └─ paymentPendingUntil < current_time          ║
║                                                    ║
║ 2. For each expired order:                        ║
║    ├─ Set order.status = CANCELLED                ║
║    ├─ For each seat in order:                     ║
║    │  └─ Set seat.status = AVAILABLE              ║
║    └─ Send (optional) expiry email                ║
║                                                    ║
║ 3. Broadcast updates:                             ║
║    └─ WebSocket notification to organizer         ║
║    └─ Refresh seat map view automatically         ║
║                                                    ║
║ 4. Logging:                                       ║
║    └─ Log number of holds released                ║
║    └─ Log seats that became available             ║
║                                                    ║
║ ✓ Fully automatic (no organizer action needed)    ║
║ ✓ Seats guaranteed released after 24h             ║
║ ✓ No manual cleanup required                      ║
║                                                    ║
╚════════════════════════════════════════════════════╝
```

---

## 🎭 Multi-Concurrent Holds Scenario

```
Live Seat Map with Multiple Holds in Progress

SEAT MAP VIEW:
┌──────────────────────────────┐
│  Event: Concert 2024         │
│  Theater: Main Hall          │
│                              │
│  A1[█] A2[█] A3[█] A4[█]    │  [█] = SOLD (completed)
│  B1[██] B2[█] B3[█] B4[█]  │  [██] = HOLD (awaiting payment)
│  C1[█] C2[█] C3[██] C4[█]  │  [ ] = AVAILABLE
│  D1[ ] D2[ ] D3[ ] D4[ ]   │
│  E1[█] E2[█] E3[█] E4[█]   │
│                              │
└──────────────────────────────┘

ORDERS TABLE:
┌────────┬──────────┬─────────┬────────────────┬──────────────┐
│ ID     │ Status   │ Seats   │ Customer Email │ Expires      │
├────────┼──────────┼─────────┼────────────────┼──────────────┤
│ ORD-01 │ PAID     │ A1      │ (paid)         │ N/A          │
│ ORD-02 │ PAID     │ A2, B2  │ (paid)         │ N/A          │
│ ORD-03 │ PAYMENT_ │ B1, C3  │ john@ex.com    │ 2024-01-15   │
│        │ PENDING  │         │                │ 10:30 AM     │
│ ORD-04 │ PAYMENT_ │ B3, E1  │ jane@ex.com    │ 2024-01-15   │
│        │ PENDING  │         │                │ 11:45 AM     │
│ ORD-05 │ PAID     │ A3, A4  │ (paid)         │ N/A          │
│ ORD-06 │ PAYMENT_ │ E2, E3  │ bob@ex.com     │ 2024-01-16   │
│        │ PENDING  │         │                │ 09:00 AM     │
│ ORD-07 │ PAID     │ E4      │ (paid)         │ N/A          │
└────────┴──────────┴─────────┴────────────────┴──────────────┘

TIMELINE:
2024-01-14 10:30 AM
├─ ORD-01 created (Paid immediately)
├─ ORD-02 created (Paid immediately)
└─ ORD-03 created (Payment pending, expires in 24h)

2024-01-14 11:45 AM
└─ ORD-04 created (Payment pending, expires in 24h)

2024-01-14 02:00 PM
└─ ORD-05 created (Paid immediately)

2024-01-14 05:00 PM
└─ ORD-06 created (Payment pending, expires in 24h)

2024-01-15 10:30 AM
├─ Auto-cleanup triggers
├─ ORD-03 still unpaid → status changed to CANCELLED
├─ Seats B1, C3 → changed to AVAILABLE
└─ (Optional) Expiry email sent to john@ex.com

2024-01-15 11:45 AM
├─ Auto-cleanup triggers
├─ ORD-04 still unpaid → status changed to CANCELLED
├─ Seats B3, E1 → changed to AVAILABLE
└─ (Optional) Expiry email sent to jane@ex.com
   [Now organizer can place new holds on B3, E1]

2024-01-16 09:00 AM
├─ Auto-cleanup triggers
├─ ORD-06 still unpaid → status changed to CANCELLED
├─ Seats E2, E3 → changed to AVAILABLE
└─ (Optional) Expiry email sent to bob@ex.com
```

---

## 📱 API Response Flow

```
ORGANIZER ACTION:
"Hold (Pay Later)" button clicked
         ↓
┌───────────────────────────────────────┐
│ POST /api/orders/payment-pending      │
│ {                                     │
│   "eventId": "evt-123",               │
│   "seatIds": ["A1", "B2"],            │
│   "customer": {                       │
│     "name": "John Smith",             │
│     "email": "john@example.com",      │
│     "phone": "+1 555-0123"            │
│   },                                  │
│   "serviceFee": 0                     │
│ }                                     │
└───────────────────────────────────────┘
         ↓
    BACKEND PROCESSING
         ↓
┌────────────────────────────────────────────┐
│ VALIDATIONS:                               │
│ ✓ Event exists and active                 │
│ ✓ Seats are AVAILABLE                     │
│ ✓ Customer email provided                 │
│ ✓ Seats not already held/sold             │
└────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│ DATABASE UPDATES:                          │
│ ✓ Create Order with PAYMENT_PENDING       │
│ ✓ Set paymentPendingUntil = now + 24h    │
│ ✓ Generate unique paymentUrl              │
│ ✓ Create Order items for each seat        │
│ ✓ Update Seat statuses to HOLD            │
│ ✓ Set holdUntil per seat                  │
└────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│ EMAIL SERVICE:                             │
│ ✓ Send payment pending email              │
│ ✓ Include paymentUrl                      │
│ ✓ Include event details                   │
│ ✓ Include 24-hour countdown               │
│ ✓ NO QR codes                             │
└────────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────────┐
│ HTTP RESPONSE 200 OK:                      │
│ {                                          │
│   "id": "order-456",                       │
│   "status": "PAYMENT_PENDING",             │
│   "totalAmount": 250.00,                   │
│   "paymentPendingUntil": "2024-01-15",    │
│   "paymentUrl": "https://...",             │
│   "customer": {                            │
│     "name": "John Smith",                  │
│     "email": "john@example.com"            │
│   },                                       │
│   "seats": [                               │
│     { "number": "A1", "price": 125 },     │
│     { "number": "B2", "price": 125 }      │
│   ],                                       │
│   "createdAt": "2024-01-14T10:30:00Z"    │
│ }                                          │
└────────────────────────────────────────────┘
         ↓
    FRONTEND UPDATES
         ↓
┌────────────────────────────────────────────┐
│ UI UPDATES:                                │
│ ✓ Modal closes                            │
│ ✓ Success message shows                   │
│ ✓ Page refreshes/reloads data             │
│ ✓ Seats now show YELLOW (HOLD) color     │
│ ✓ Organizer can select new seat group   │
└────────────────────────────────────────────┘
```

---

## 🎯 Quick Reference Matrix

```
┌──────────────────┬──────────┬──────────────────┬─────────────┐
│ SEAT STATUS      │ COLOR    │ CLICKABLE?       │ ACTION      │
├──────────────────┼──────────┼──────────────────┼─────────────┤
│ AVAILABLE        │ White    │ YES              │ Select/Hold │
│ HOLD             │ Yellow   │ NO (Reserved)    │ —           │
│ BOOKING_PROGRESS │ Amber    │ NO (In checkout) │ —           │
│ SOLD             │ Light    │ NO (Paid)        │ —           │
│                  │ Grey     │                  │             │
│ UNAVAILABLE      │ Dark     │ NO (N/A)         │ —           │
│                  │ Grey     │                  │             │
└──────────────────┴──────────┴──────────────────┴─────────────┘
```

---

## 🔗 Quick Links

- **Full Usage Guide**: HOLD_ORDER_USAGE_GUIDE.md
- **Technical Reference**: PAY_LATER_FEATURE.md
- **Implementation Summary**: IMPLEMENTATION_SUMMARY.md
- **API Quick Reference**: QUICK_REFERENCE.md
- **Live Seat Map**: Event Analytics → MAP Tab
- **Orders List**: Event Analytics → ORDERS Tab

---

*Last Updated: 2024 | Hold Order Feature v1.0*
