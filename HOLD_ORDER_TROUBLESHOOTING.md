# Hold Order Feature - Troubleshooting & FAQ

## ❓ Frequently Asked Questions

### General Feature Questions

**Q: What is the "Hold (Pay Later)" feature?**
A: It allows organizers to reserve seats for customers without immediate payment. Customers have 24 hours to pay, after which the seats are automatically released for other customers.

**Q: How is this different from "Book (Box Office)"?**
A: 
- **Box Office**: Immediate payment, seats marked SOLD, QR codes sent instantly
- **Hold (Pay Later)**: 24-hour payment window, seats marked HOLD (yellow), QR codes sent only after payment

**Q: Where do I place a hold?**
A: In the **Event Analytics** page, click the **MAP** tab, select seats, then click the yellow **"Hold (Pay Later)"** button.

**Q: Can I place multiple holds on the same event?**
A: Yes! You can hold different sets of seats for different customers simultaneously. Each hold is independent.

**Q: What happens if a customer doesn't pay within 24 hours?**
A: The system automatically releases the seats after 24 hours, making them available for other customers. The order status changes to CANCELLED.

**Q: Can I extend a hold beyond 24 hours?**
A: Not in the current version. Future enhancements will include hold extension functionality.

**Q: Can I cancel a hold manually?**
A: Yes. Go to the Orders tab, find the order with PAYMENT_PENDING status, and click Cancel. This immediately releases the seats.

---

## 🔧 Troubleshooting Guide

### Issue 1: "Hold (Pay Later)" Button Not Appearing

**Symptoms:**
- You select seats on Live Seat Map
- Floating action bar appears with other buttons
- But no "Hold (Pay Later)" button visible

**Possible Causes & Solutions:**

1. **Not enough code updated**
   - ✅ Solution: Verify EventAnalytics.tsx has been updated with:
     - Hold Order state variables (line ~50)
     - handleHoldOrderSubmit function (line ~355)
     - Button markup with "Hold (Pay Later)" text

2. **Browser cache issue**
   - ✅ Solution: 
     - Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
     - Clear browser cache (F12 → Application → Clear Storage)
     - Close and reopen browser tab

3. **Styling/CSS issue**
   - ✅ Solution: Check that Tailwind CSS classes are included:
     - `bg-yellow-500` (button color)
     - `hover:bg-yellow-600` (hover state)

4. **Component not re-rendering**
   - ✅ Solution: Make sure state updates trigger re-render:
     - Check `setShowHoldOrder` is called in handler
     - Verify conditional rendering: `{showHoldOrder && <HoldOrderModal.... />}`

**Testing:**
```javascript
// In browser console, verify the component has the function:
console.log(window.React?.componentName)  // Should exist

// Or check Network tab to see if component JS loaded
```

---

### Issue 2: Modal Opens But Form Doesn't Submit

**Symptoms:**
- Click "Hold (Pay Later)" button
- Modal opens successfully
- Enter customer info
- Click "Place Hold" button
- Nothing happens (button doesn't respond)

**Possible Causes & Solutions:**

1. **Backend API not running**
   - ✅ Solution: 
     - Check if backend server is running on port 5000
     - Run: `cd backend && npm start`
     - Verify: `http://localhost:5000/api/events` loads (no error)

2. **CORS issues**
   - ✅ Solution:
     - Check backend has CORS enabled
     - Verify backend `server.js` has: `app.use(cors())`
     - Check browser console for CORS error messages

3. **Form validation failing silently**
   - ✅ Solution:
     - Enter ALL required fields:
       - Customer Name (required)
       - Email Address (required)
       - Phone (optional, can be empty)
     - Check for red error messages below fields

4. **Network request failing**
   - ✅ Solution:
     - Open Browser → F12 → Network tab
     - Complete form and click "Place Hold"
     - Look for POST request to `/api/orders/payment-pending`
     - Check Response tab for error message
     - Common error: `400 Bad Request` - check field validation

5. **Async operation not completing**
   - ✅ Solution:
     - Wait for button to finish (loading indicator should appear)
     - Check if `setHoldProcessing` state is being managed
     - Verify `await` statement in handler function

**Testing:**
```javascript
// Check if API function exists in mockBackend
import { createPaymentPendingOrder } from './mockBackend'
console.log(typeof createPaymentPendingOrder)  // Should be 'function'

// Test API call manually
createPaymentPendingOrder(
  'event-id',
  ['seat1', 'seat2'],
  { name: 'John', email: 'john@example.com' },
  0
).then(result => console.log('Success:', result))
 .catch(error => console.log('Error:', error))
```

---

### Issue 3: Email Not Received by Customer

**Symptoms:**
- Hold placed successfully ✓
- Modal shows success message ✓
- Seats show YELLOW on map ✓
- But customer doesn't receive payment email

**Possible Causes & Solutions:**

1. **AWS SES not configured**
   - ✅ Solution:
     - Check backend `.env` file has AWS credentials:
       ```
       AWS_REGION=us-east-1
       AWS_ACCESS_KEY_ID=<your-key>
       AWS_SECRET_ACCESS_KEY=<your-secret>
       SES_FROM_EMAIL=noreply@eventhorizon.com
       ```
     - Test: AWS Cloud shell → `aws ses verify-email-identity --email-address test@example.com`

2. **Email address not verified in SES**
   - ✅ Solution:
     - AWS Console → SES → Verified Identities
     - Add test email addresses to verified list
     - Customer emails must be verified or use SES sandbox mode

3. **Email service not sending**
   - ✅ Solution:
     - Check backend logs for email service errors
     - Look for: `sendPaymentPendingEmail()` in console output
     - Verify `emailService.js` is being imported correctly

4. **Email going to spam folder**
   - ✅ Solution:
     - Customer should check spam/junk folder
     - Check email headers (spam scores)
     - Use professional email template with proper formatting
     - Add SPF/DKIM records to domain

5. **Customer email address in form is wrong**
   - ✅ Solution:
     - Double-check organizer entered correct email
     - Check order details to see which email was used
     - Send test email to verify address is correct

**Testing:**
```javascript
// Test email service directly
const emailService = require('./emailService')
const testCustomer = {
  name: 'Test User',
  email: 'test@example.com'
}
const testOrder = {
  id: 'test-order',
  paymentUrl: 'http://localhost:3000/payment/test',
  totalAmount: 100,
  paymentPendingUntil: new Date(Date.now() + 24*60*60*1000),
  seats: [{number: 'A1', price: 100}],
  event: {title: 'Test Event', date: new Date()}
}

emailService.sendPaymentPendingEmail(testCustomer, testOrder)
  .then(() => console.log('Email sent!'))
  .catch(err => console.log('Email error:', err))
```

---

### Issue 4: Seats Don't Show as HOLD (Still White)

**Symptoms:**
- Place hold successfully ✓
- Order created (in Orders list) ✓
- But seats on map still show as AVAILABLE (white)
- Not showing YELLOW (HOLD) color

**Possible Causes & Solutions:**

1. **Page not refreshed**
   - ✅ Solution: 
     - Refresh page: `F5` or `Ctrl+R`
     - Or wait for auto-refresh (should happen after successful submit)

2. **SeatGrid component not updated**
   - ✅ Solution:
     - Check that seats array includes seat status
     - Verify color mapping includes 'HOLD' → yellow
     - Check SeatGrid.tsx for HOLD case in switch/if statement

3. **Event data not loaded correctly**
   - ✅ Solution:
     - Check `loadData()` function calls `/api/events/:id`
     - Verify API response includes seats with HOLD status
     - Check Network tab to see what data was returned

4. **Seat status enum mismatch**
   - ✅ Solution:
     - Verify backend uses exact string: `"HOLD"` (not "hold" or "Hold")
     - Check frontend types.ts has HOLD in SeatStatus enum
     - Ensure case sensitivity matches everywhere

5. **Conditional rendering issue**
   - ✅ Solution:
     - Check SeatGrid render logic for HOLD status
     - Verify CSS class for yellow color is applied
     - Inspect element in browser (F12) to see what color CSS is applied

**Testing:**
```javascript
// In browser console, check seat data
// After placing hold, inspect seats array:
const seats = document.querySelectorAll('[data-seat-id]')
seats.forEach(seat => {
  console.log(seat.getAttribute('data-seat-id'), 
              seat.className)  // Should include 'bg-yellow' class
})

// Or check API response
fetch('http://localhost:5000/api/events/event-id')
  .then(r => r.json())
  .then(data => {
    const holdSeats = data.seats.filter(s => s.status === 'HOLD')
    console.log('Hold seats:', holdSeats)
  })
```

---

### Issue 5: Can Still Select HOLD Seats (Shouldn't Be Clickable)

**Symptoms:**
- Seats show YELLOW (HOLD status) ✓
- But you can still click them
- Should NOT be selectable

**Possible Causes & Solutions:**

1. **Click handler not filtering HOLD seats**
   - ✅ Solution:
     - In SeatGrid, check seat click handler
     - Add check: `if (seat.status === 'HOLD') return;`
     - Don't add HOLD seats to selection array

2. **CSS pointer-events not disabled**
   - ✅ Solution:
     - Add CSS for HOLD seats: `pointer-events: none;`
     - Or mark in className: `disabled` class

3. **Selection logic doesn't check status**
   - ✅ Solution:
     - Check seat selection function `handleSeatClick()`
     - Ensure it validates: `if (seat.status !== 'AVAILABLE') return`

4. **State not updated after hold**
   - ✅ Solution:
     - Verify data refresh happens after successful hold
     - Check that seat status changes from AVAILABLE to HOLD in state
     - Look for: `loadData()` call after modal submit

---

### Issue 6: Auto-Cleanup Not Running / Holds Don't Expire

**Symptoms:**
- Place hold for customer
- Wait 24+ hours
- Order still shows PAYMENT_PENDING
- Seats still show HOLD (yellow)
- Should be CANCELLED and released

**Possible Causes & Solutions:**

1. **Backend server not running continuously**
   - ✅ Solution:
     - Auto-cleanup job runs every 60 seconds
     - Server must be running continuously
     - Check: Is `npm start` still running in backend?

2. **Cleanup job not started**
   - ✅ Solution:
     - Check `server.js` for cleanup job initialization
     - Look for: `setInterval(cleanupExpiredHolds, 60000)` or similar
     - Verify it's in the server startup code (not commented out)

3. **Database not saving paymentPendingUntil timestamp**
   - ✅ Solution:
     - Check Order model has `paymentPendingUntil` field
     - Verify backend sets: `paymentPendingUntil: new Date(Date.now() + 24*60*60*1000)`
     - Check database to confirm field exists and has value

4. **Cleanup job has errors (running but failing silently)**
   - ✅ Solution:
     - Check backend console for errors
     - Add logging to cleanup function
     - Verify database connection is healthy

5. **Timezone mismatch**
   - ✅ Solution:
     - Ensure all timestamps use UTC (Z suffix)
     - Backend and frontend should use same timezone
     - Use: `new Date()` without manipulation

**Testing:**
```javascript
// Test cleanup function manually:
const cleanupExpiredHolds = require('./path-to-cleanup')

// Manually trigger cleanup:
cleanupExpiredHolds()
  .then(result => console.log('Cleanup result:', result))
  .catch(err => console.log('Cleanup error:', err))

// Check database for expired orders:
const Order = require('./models/Order')
Order.find({
  status: 'PAYMENT_PENDING',
  paymentPendingUntil: { $lt: new Date() }
})
.then(orders => console.log('Expired orders:', orders))
```

---

### Issue 7: "Failed to place hold" Error Message

**Symptoms:**
- Fill form completely ✓
- Click "Place Hold" button
- Get error message: "Failed to place hold"
- No details about what went wrong

**Possible Causes & Solutions:**

1. **API endpoint doesn't exist**
   - ✅ Solution:
     - Check backend has route: `POST /api/orders/payment-pending`
     - Verify in `routes/orderRoutes.js`
     - Restart backend server

2. **Request validation failing**
   - ✅ Solution:
     - Open browser F12 → Network tab
     - Look at POST request Response
     - Check error message (e.g., "eventId required")
     - Verify all fields are being sent

3. **Seats already held/sold**
   - ✅ Solution:
     - Check if selected seats are AVAILABLE
     - Another organizer may have booked them
     - Refresh page and try different seats

4. **Event not found**
   - ✅ Solution:
     - Verify eventId is correct
     - Check event exists in database
     - Ensure event status is active

5. **Database connection issue**
   - ✅ Solution:
     - Check MongoDB is running
     - Verify connection string in backend `.env`
     - Test: `mongosh --uri "mongodb://localhost:27017"`

**Testing:**
```javascript
// Test API directly with curl:
curl -X POST http://localhost:5000/api/orders/payment-pending \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "test-event-id",
    "seatIds": ["A1", "A2"],
    "customer": {
      "name": "Test",
      "email": "test@example.com"
    },
    "serviceFee": 0
  }'

// Or in browser console:
fetch('http://localhost:5000/api/orders/payment-pending', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    eventId: 'test-event',
    seatIds: ['A1'],
    customer: { name: 'Test', email: 'test@example.com' },
    serviceFee: 0
  })
})
.then(r => r.json())
.then(data => console.log('Response:', data))
```

---

### Issue 8: Customer Can't Find Payment Link in Email

**Symptoms:**
- Customer receives payment-pending email ✓
- But can't find the "Pay Now" button
- Email looks incomplete or broken

**Possible Causes & Solutions:**

1. **Email template rendering issue**
   - ✅ Solution:
     - Check `emailService.js` sendPaymentPendingEmail() function
     - Verify HTML template is correct
     - Test email template in email client (Gmail, Outlook, etc.)

2. **Payment URL not generated**
   - ✅ Solution:
     - Check backend generates `paymentUrl` in createPaymentPendingOrder()
     - Verify format: `http://localhost:3000/payment/order-id`
     - Check if URL is being sent in email template

3. **Email client blocking HTML**
   - ✅ Solution:
     - Send test email to yourself
     - Check it renders properly
     - Try in different email clients (Gmail, Outlook, etc.)
     - Add plain text version and HTML version

4. **Button HTML not properly formatted**
   - ✅ Solution:
     - Use simple HTML: `<a href="${paymentUrl}">Pay Now</a>`
     - Avoid CSS that email clients don't support
     - Test in Email on Acid (emailonacid.com)

**Testing:**
```javascript
// Check what's in the email template:
const emailService = require('./utils/emailService')

// Look at sendPaymentPendingEmail() function
// Verify it includes:
// - paymentUrl (the payment button)
// - Payment deadline
// - Event details
// - Seat info
```

---

## 🔍 Debug Checklist

Use this checklist when troubleshooting:

### Frontend Debugging
- [ ] Hold button appears when seats selected
- [ ] Modal opens when button clicked
- [ ] Form fields are editable
- [ ] Form validates (shows error if empty)
- [ ] API call is sent (check Network tab, F12)
- [ ] Modal closes after success
- [ ] Page refreshes to show updated seats
- [ ] Seats show YELLOW (HOLD) color

### Backend Debugging  
- [ ] Server running on port 5000
- [ ] API endpoint exists: POST /api/orders/payment-pending
- [ ] Database connection working
- [ ] Order created in database with PAYMENT_PENDING status
- [ ] Seat status updated to HOLD in database
- [ ] Email service configured
- [ ] Email sent to customer
- [ ] paymentUrl generated and accessible

### Integration Debugging
- [ ] Frontend → Backend API calls working
- [ ] Backend → Database reads/writes working
- [ ] Backend → Email service working
- [ ] Frontend → Shows updated data after API call
- [ ] Auto-cleanup job running every 60 seconds
- [ ] Orders expire correctly after 24 hours

---

## 📋 Common Error Messages & Solutions

| Error Message | Cause | Solution |
|---------------|-------|----------|
| `Failed to place hold` | Generic API error | Check Network tab for details |
| `EventId is required` | Form not sending eventId | Verify EventAnalytics component setup |
| `Email is required` | Empty email field | Fill all required fields (marked with *) |
| `Seats are not available` | Seats already held/sold | Refresh and select different seats |
| `CORS error` | API CORS not configured | Add `cors()` to backend server.js |
| `404 Not Found` | API endpoint missing | Check route exists in backend |
| `500 Internal Server Error` | Backend error | Check backend console logs |
| `Email not sent` | Email service error | Check AWS SES configuration |
| `Cannot read undefined` | Missing data | Reload page or check event loaded |

---

## 📞 Support Resources

### Where to Find Help
1. **Documentation Files**
   - HOLD_ORDER_USAGE_GUIDE.md - How to use feature
   - PAY_LATER_FEATURE.md - Technical details
   - HOLD_ORDER_STATUS_FLOW.md - Process diagrams
   - IMPLEMENTATION_SUMMARY.md - Implementation details

2. **Browser Console (F12)**
   - Check for JavaScript errors
   - Review console logs
   - Inspect Network tab for API calls

3. **Backend Logs**
   - Check server console for errors
   - Look for email service logs
   - Verify API endpoint hit

4. **Database Checks**
   - Verify Order created
   - Check Seat status updated
   - Confirm paymentPendingUntil timestamp

---

## 🎓 Testing Scenarios

### Scenario 1: Happy Path (Everything Works)
```
1. Select 2 seats on map
2. Click "Hold (Pay Later)"
3. Fill customer info
4. Click "Place Hold"
5. ✓ Modal closes
6. ✓ Seats show YELLOW
7. ✓ Email received with payment link
8. ✓ Order in PAYMENT_PENDING status
```

### Scenario 2: Customer Pays Within 24h
```
1. Complete happy path above
2. Customer receives email
3. Customer clicks "Pay Now"
4. Goes to payment page
5. Enters payment info
6. Payment processed
7. ✓ Order status: PAID
8. ✓ Seats: HOLD → SOLD
9. ✓ QR codes sent in email
10. ✓ Customer can check-in
```

### Scenario 3: Hold Expires (24h)
```
1. Place hold
2. Wait 24+ hours (or force cleanup)
3. Auto-cleanup job triggers
4. ✓ Order status: CANCELLED
5. ✓ Seats: HOLD → AVAILABLE
6. ✓ Seats available for other customers
7. ✓ Expiry email sent to customer (optional)
```

### Scenario 4: Organizer Cancels Hold
```
1. Place hold
2. Go to Orders page
3. Find PAYMENT_PENDING order
4. Click Cancel
5. ✓ Order status: CANCELLED
6. ✓ Seats: HOLD → AVAILABLE
7. ✓ Can immediately place new holds
```

---

## 🚀 Performance Notes

- **Auto-cleanup job**: Runs every 60 seconds (configurable)
- **Email delivery**: Usually 1-5 seconds
- **Page refresh**: Should happen automatically after modal closes
- **Concurrent holds**: No limit (limited by database performance)

---

## 📌 Additional Notes

- Service fee is 0 for holds (no additional charges)
- QR codes are NOT sent in payment-pending email
- Tickets are NOT included in payment-pending email
- Hold status is visually distinct (yellow) from other statuses
- No organizer action needed for auto-cleanup
- Customer payment link expires after 24 hours

---

*Last Updated: 2024 | Hold Order Feature Troubleshooting v1.0*
