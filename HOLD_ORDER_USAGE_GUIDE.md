# Hold Order Feature - Live Seat Map Integration Guide

## 🎯 Overview
The Hold Order (Pay Later) feature has been integrated into the **Live Seat Map** in the Event Analytics page, alongside the existing Box Office Booking functionality.

---

## 📍 Location
**Path:** Organizer Dashboard → Event Analytics → **MAP** Tab

---

## How to Use

### Step 1: Navigate to Live Seat Map
1. Go to **Organizer Dashboard**
2. Click on an **Event**
3. Select the **MAP** tab at the top
4. You'll see the live seat map with all seats

### Step 2: Select Seats for Hold
1. Click on individual seats OR drag to select multiple seats
2. Selected seats will turn **green**
3. You'll see the count of selected seats at the bottom

### Step 3: Open Hold Order Modal
1. At the bottom of the screen, you'll see a floating action bar with your selected seats
2. Click the **"Hold (Pay Later)"** button (yellow button)
3. The Hold Order modal will open

### Step 4: Fill Customer Information
In the modal, enter:
- **Customer Name** * (Required)
- **Email Address** * (Required) - Payment link will be sent here
- **Phone Number** (Optional)

### Step 5: Review Hold Details
The modal shows:
- ✅ Selected seats list with prices
- ✅ Total amount to be paid
- ✅ 24-hour hold information
- ✅ What happens next

### Step 6: Confirm Hold
Click **"Place Hold ($X.XX)"** button to confirm

### Step 7: Auto-Actions
Once confirmed:
1. ✅ Seats are marked as **HOLD** (Yellow color) on the map
2. ✅ Payment-pending email sent to customer
3. ✅ Email includes 24-hour countdown and payment link
4. ✅ Seats automatically reserved for 24 hours

---

## Seat Status Reference

### Visual Indicators on Live Seat Map

```
AVAILABLE
├─ Color: White or Custom Color
├─ Status: Can be selected or held
└─ Action: Click to select

HOLD (NEW)
├─ Color: Yellow (#FBBF24)
├─ Status: Awaiting payment within 24 hours
├─ Action: Cannot select (already held)
└─ Payment: Customer can pay via email link

BOOKING_IN_PROGRESS
├─ Color: Amber with pulse
├─ Status: Customer in checkout flow
└─ Time: 5-minute hold

SOLD
├─ Color: Light Grey
├─ Status: Order completed
└─ Tickets: Issued to customer

UNAVAILABLE
├─ Color: Dark Grey
└─ Status: Not assigned to ticket type
```

---

## Action Bar Buttons

### After Selecting Seats (Bottom Floating Bar)

```
[Selected Count] | [Block] | [Unblock] | [Book (Box Office)] | [Hold (Pay Later)]
```

**Button Colors:**
- **Block** - Red ❌ (Block seat from selection)
- **Unblock** - Green ✅ (Release blocked seats)
- **Book (Box Office)** - Blue/Indigo (Immediate payment)
- **Hold (Pay Later)** - Yellow (Deferred payment)

---

## Key Differences: Box Office vs Hold Order

| Feature | Box Office | Hold Order |
|---------|-----------|-----------|
| **Payment** | Immediate | Deferred (24h window) |
| **QR Codes** | Sent immediately | Sent after payment |
| **Tickets** | Issued immediately | Issued after payment |
| **Email** | Confirmation with QR | Payment pending (no QR) |
| **Payment Modes** | CASH, CHARITY | Direct payment link |
| **Service Fee** | No fee | No fee |
| **Seat Status** | SOLD | HOLD → SOLD |

---

## Customer Experience

### Timeline After Hold is Placed

```
T+0 min: Organizer places hold
    │
    ├─ Seats marked as HOLD
    └─ Email sent to customer
         ├─ Event details
         ├─ Seat information
         ├─ Price breakdown
         ├─ "Pay Now" button
         └─ 24-hour countdown

T+0-1440 min: Customer payment window
    │
    ├─ Customer receives email
    ├─ Seats remain HOLD status
    └─ Nothing happens until payment

Customer clicks "Pay Now" OR T+1440 min:
    │
    ├─ If PAID:
    │  ├─ Order status: PAID
    │  ├─ Seats: HOLD → SOLD
    │  ├─ QR codes generated
    │  └─ Confirmation email sent with tickets
    │
    └─ If NOT PAID (24h expired):
       ├─ Order status: CANCELLED
       ├─ Seats: HOLD → AVAILABLE
       └─ Seats released for other customers
```

---

## Modal Screenshots & Components

### Hold Order Modal

**Header:** Yellow background with title "Hold Order (Pay Later)"

**Content:**
1. **Selected Seats Section**
   - Yellow background box
   - Shows count and total amount
   - Lists each seat with price

2. **Information Box (Blue)**
   - Title: "⏰ 24-Hour Hold"
   - Explains the hold mechanism

3. **Customer Form**
   - Name field (required)
   - Email field (required, marked with envelope icon)
   - Phone field (optional)

4. **Process Info Box (Green)**
   - Title: "✓ What Happens Next"
   - Bullet points explaining workflow

5. **Action Button**
   - Yellow button: "Place Hold ($X.XX)"
   - Shows total amount in button text

---

## What Organizers See

### Before Hold
```
[Live Seat Map showing AVAILABLE and SOLD seats]
        ↓
[Select seats by clicking]
        ↓
[Floating action bar appears with Hold button]
```

### After Hold is Placed
```
✅ Selected seats turn YELLOW
✅ Popup confirms: "Hold placed! Payment email sent to [email]"
✅ Seats on map immediately show HOLD status
✅ Can now select different seats for another booking
```

### Real-time Updates
- **Automatic seat color updates** when:
  - Seats are placed on hold (YELLOW)
  - Customer pays (HOLD → SOLD, becomes LIGHT GREY)
  - 24-hour hold expires (HOLD → AVAILABLE, becomes WHITE)

---

## Backend Integration

### API Endpoint Called
```
POST /api/orders/payment-pending
```

### Data Sent
```json
{
  "eventId": "evt-123",
  "seatIds": ["seat-1", "seat-2"],
  "customer": {
    "id": "hold-1709724000000",
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+1 555 123 4567"
  },
  "serviceFee": 0
}
```

### Response
```json
{
  "id": "order-123",
  "status": "PAYMENT_PENDING",
  "totalAmount": 200.00,
  "paymentPendingUntil": "2026-03-06T12:30:00Z",
  "paymentUrl": "http://...",
  "tickets": [...]
}
```

---

## Email Sent to Customer

### Subject
"Payment Required for [Event Title]"

### Contents
- ✅ Event details (date, time, location)
- ✅ Seat information
- ✅ Price breakdown
- ✅ **Pay Now button** with payment URL
- ✅ 24-hour deadline with exact time
- ✅ Important notes about expiration
- ✅ Support contact info
- ❌ **NO QR codes** (payment pending)
- ❌ **NO tickets** (payment pending)

---

## Common Scenarios

### Scenario 1: Customer Pays Within 24 Hours
```
1. Organizer places hold
2. Email sent with payment link
3. Customer clicks link within 24 hours
4. Payment processed
5. Order status: PAYMENT_PENDING → PAID
6. Seats change: HOLD → SOLD
7. Confirmation email sent with QR codes and tickets
8. Customer can check-in at event
✅ Complete success!
```

### Scenario 2: Hold Expires (No Payment)
```
1. Organizer places hold
2. Email sent with payment link
3. 24 hours pass without payment
4. Automatic cleanup job runs
5. Order status: PAYMENT_PENDING → CANCELLED
6. Seats change: HOLD → AVAILABLE
7. Other customers can now book these seats
⏰ Hold expired
```

### Scenario 3: Organizer Cancels Hold (Before Payment)
```
1. Hold is placed
2. Organizer realizes mistake and cancels from order details
3. Order marked as CANCELLED
4. Held seats released immediately
5. Seats change: HOLD → AVAILABLE
✅ Cancelled by operator
```

---

## Tips & Best Practices

### ✅ Do
- Collect email address - it's required for payment link
- Review seat selection before confirming
- Use for bulk tickets that need time to finalize
- Monitor held orders to see payment status

### ❌ Don't
- Forget to get customer contact info
- Place holds for seats already held by others
- Rely on hold exceeding expected duration (24 hours is hard limit)
- Create holds without email (payment won't be sent)

---

## Troubleshooting

### "Failed to place hold"
- Check internet connection
- Verify email address is valid
- Check if backend server is running
- Review browser console for errors

### Email not received by customer
- Verify AWS SES is configured
- Check spam/junk folder
- Confirm email address was entered correctly
- Check backend logs

### Seats still show AVAILABLE not HOLD
- Refresh the page
- Check if API call succeeded (check browser Network tab)
- Verify event loaded correctly

### Customer can't find payment link
- Check email spam folder
- Ask them to reload email
- Regenerate payment link from admin panel (if available)

---

## Integration with Other Features

### Box Office Booking (Existing)
- Still works as before
- Creates SOLD orders immediately
- No payment pending step

### Live Seat Map
- Both Box Office and Hold Order use same seat selection
- Seats marked differently based on status

### Analytics
- Hold orders appear in order list
- Can filter by PAYMENT_PENDING status
- Can cancel or resend payment links

---

## Future Enhancements

- [ ] Extend hold duration (24h + more)
- [ ] SMS reminders before deadline
- [ ] Partial payment option
- [ ] Retry payment for failed attempts
- [ ] Bulk hold operations
- [ ] Hold analytics on dashboard

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Verify all fields are filled correctly
3. Check backend logs for API errors
4. Contact support with order ID and email

---

## Quick Reference

| Action | Steps |
|--------|-------|
| **Place Hold** | Select seats → Hold button → Enter customer info → Confirm |
| **Cancel Hold** | Go to Orders → Find order → Click Cancel |
| **View Hold Status** | Analytics → Orders tab → Filter by PAYMENT_PENDING |
| **Extend Hold** | (Feature coming soon) |
| **Resend Payment Link** | (Feature coming soon) |

---

## System Requirements

**For Organizers:**
- Access to Live Seat Map (MAP tab)
- Permissions: `live_map`

**For Customers:**
- Valid email address
- Ability to click payment link within 24 hours

**Backend:**
- API endpoint: `/api/orders/payment-pending`
- Email service: AWS SES configured
- Database: MongoDB with Order model supporting PAYMENT_PENDING status

---

## Video Tutorial (When Available)

When you're ready to practice:
1. Go to Event Analytics
2. Click MAP tab
3. Select a few test seats
4. Click "Hold (Pay Later)"
5. Enter test customer info
6. Click "Place Hold"
7. Check that custom email received payment link

Done! You've successfully placed your first hold order! 🎉
