# Hold Order Feature - QA Testing Checklist

## 📋 Pre-Testing Setup

### Environment Check
- [ ] Backend server running: `http://localhost:5000`
- [ ] Frontend running: `http://localhost:3000` (or Vite dev server)
- [ ] MongoDB running locally or accessible
- [ ] AWS SES configured (or use mock email service)
- [ ] Browser DevTools available (F12)
- [ ] Network tab can monitor API calls
- [ ] Test user account with organizer privileges created

### Test Data Setup
- [ ] Test event created with ticket types
- [ ] Theater/venue assigned to event
- [ ] At least 30 seats defined in seat map
- [ ] Mix of seat types: regular, premium, etc.
- [ ] Seat status initialized to AVAILABLE
- [ ] Some test customers email addresses available

---

## 🎯 Feature-Level Test Cases

### TEST 1: Live Seat Map Display
**Objective:** Verify Live Seat Map displays correctly with all statuses

**Steps:**
1. Login as organizer
2. Navigate to Event Analytics
3. Click "MAP" tab
4. Observe seat map render

**Expected Results:**
- [ ] All seats displayed in grid
- [ ] AVAILABLE seats show white/default color
- [ ] Seats are clickable (pointer changes to pointer/hand)
- [ ] Seat numbers visible
- [ ] Theater/venue name visible
- [ ] Map responsive on different screen sizes

**Pass:** All expectations met  
**Fail:** Any seat missing, wrong color, not clickable, or layout broken

---

### TEST 2: Seat Selection
**Objective:** Verify seat selection works correctly

**Steps:**
1. From Live Seat Map, click on 3 individual AVAILABLE seats
2. Observe seat highlighting
3. Observe floating action bar

**Expected Results:**
- [ ] Clicked seats turn GREEN when selected
- [ ] Unclicked seats remain WHITE
- [ ] Can select/deselect multiple seats
- [ ] Floating action bar appears at bottom
- [ ] Selected seat count shows in action bar
- [ ] Selected seat total price shows
- [ ] Can select up to 10+ seats without issue

**Pass:** All selections work and display correctly  
**Fail:** Seats don't highlight, count wrong, or action bar doesn't appear

---

### TEST 3: Hold Button Visibility
**Objective:** Verify Hold button appears when appropriate

**Steps:**
1. Select at least 1 AVAILABLE seat
2. Observe floating action bar

**Expected Results:**
- [ ] "Hold (Pay Later)" button appears (yellow)
- [ ] Button text is correct
- [ ] Button is clickable (not disabled)
- [ ] Button positioned to right of "Book (Box Office)"
- [ ] Button has yellow background color (#FBBF24 or similar)
- [ ] Button has white text
- [ ] Button has hover effect (slightly darker)

**Pass:** Button visible with correct styling  
**Fail:** Button missing, wrong color, or not interactive

---

### TEST 4: Hold Modal Opens
**Objective:** Verify Hold Order modal opens correctly

**Steps:**
1. Select 2-3 seats
2. Click "Hold (Pay Later)" button
3. Observe modal

**Expected Results:**
- [ ] Modal opens with overlay (dark background)
- [ ] Modal has yellow header
- [ ] Header text: "Hold Order (Pay Later)"
- [ ] Modal not full screen (center positioned)
- [ ] Modal has X button to close
- [ ] Can see form fields
- [ ] Seats summary visible
- [ ] Information boxes visible

**Pass:** Modal displays correctly  
**Fail:** Modal doesn't open or displays incorrectly

---

### TEST 5: Form Fields & Validation
**Objective:** Verify form validation works

**Steps:**
1. Open Hold Order modal (as in TEST 4)
2. Leave all fields empty
3. Click "Place Hold" button
4. Fill only Name field
5. Click again
6. Fill all required fields
7. Click again

**Expected Results:**
- [ ] When empty: Error message shows "Name is required"
- [ ] When only name: Error message shows "Email is required"
- [ ] When all fields: Form accepts and submits
- [ ] Name field is text input (editable)
- [ ] Email field is email input (has @)
- [ ] Phone field is optional and can be skipped
- [ ] Fields have proper labels
- [ ] Required fields marked with *

**Pass:** Validation works correctly  
**Fail:** Submits without required fields or shows wrong errors

---

### TEST 6: Form Data Entry
**Objective:** Verify form accepts and displays data correctly

**Steps:**
1. Open Hold Order modal
2. Enter test data:
   - Name: "John Smith"
   - Email: "john@example.com"
   - Phone: "+1 555-0123" (optional)
3. Observe data display

**Expected Results:**
- [ ] Data appears in form as typed
- [ ] Email accepts valid format
- [ ] Phone accepts international format
- [ ] Data persists in fields
- [ ] Can edit fields after entering data
- [ ] No character limits enforced (reasonable)

**Pass:** Form accepts all data  
**Fail:** Data doesn't display or fields won't accept format

---

### TEST 7: Seats Summary in Modal
**Objective:** Verify selected seats display correctly in modal

**Steps:**
1. Select exactly 3 seats: A1 ($100), A2 ($100), B1 ($150)
2. Open Hold Order modal
3. Find "Selected Seats" section

**Expected Results:**
- [ ] Shows count: "3 Seats"
- [ ] Lists each seat: "Seat A1 - $100.00"
- [ ] Lists each seat: "Seat A2 - $100.00"
- [ ] Lists each seat: "Seat B1 - $150.00"
- [ ] Shows subtotal: "$350.00"
- [ ] Shows total: "$350.00" (no service fee)
- [ ] Yellow background for selected seats section

**Pass:** All seats and prices display correctly  
**Fail:** Missing seats, wrong prices, or incorrect totals

---

### TEST 8: Information Boxes
**Objective:** Verify info boxes display and have correct content

**Steps:**
1. Open Hold Order modal (with any seats)
2. Scroll down to find info boxes

**Expected Results:**
- [ ] "24-Hour Hold" info box present
- [ ] Contains text about 24-hour window
- [ ] Contains deadline information
- [ ] Contains payment action
- [ ] "What Happens Next" info box present
- [ ] Contains ordered steps (1, 2, 3, 4)
- [ ] Step 1: Email sent
- [ ] Step 2: Customer pays
- [ ] Step 3: Tickets issued
- [ ] Step 4: Ready for event
- [ ] Both boxes have appropriate colors/styling

**Pass:** Both info boxes present with correct content  
**Fail:** Missing info, wrong text, or formatting issues

---

### TEST 9: Place Hold Button
**Objective:** Verify Place Hold button behavior

**Steps:**
1. Open Hold Order modal with valid form data
2. Click "Place Hold ($X.XX)" button
3. Observe button during submission

**Expected Results:**
- [ ] Button shows amount: "Place Hold ($350.00)"
- [ ] Button is yellow (#FBBF24)
- [ ] Button text updates with total
- [ ] Button is clickable when form valid
- [ ] Button shows loading state (spinner/disabled during submit)
- [ ] Button is disabled while submitting (prevents double-click)
- [ ] Button re-enables after response

**Pass:** Button behaves correctly  
**Fail:** Button doesn't update, doesn't disable, or submits multiple times

---

### TEST 10: Successful Hold Submission
**Objective:** Verify successful hold placement

**Steps:**
1. Fill valid form data
2. Click "Place Hold" button
3. Wait for response
4. Observe page updates

**Expected Results:**
- [ ] API call sent: POST /api/orders/payment-pending (check Network tab)
- [ ] Response status: 200 OK
- [ ] Response includes order ID
- [ ] Response includes payment URL
- [ ] Modal closes after success
- [ ] Page refreshes (data reloaded)
- [ ] Success message/alert shown
- [ ] Selected seats disappear from selection (deselected)
- [ ] Action bar disappears

**Pass:** Order created and modal closes  
**Fail:** Modal stays open, error shown, or page not refreshed

---

### TEST 11: Seats Change to HOLD Status
**Objective:** Verify held seats show YELLOW on map

**Steps:**
1. Note seat numbers held: e.g., A1, A2, B1
2. Wait for page to refresh (1-2 seconds)
3. Observe same seats on map

**Expected Results:**
- [ ] Held seats show YELLOW (#FBBF24) color
- [ ] OTHER seats still show AVAILABLE color
- [ ] Held seats are NOT clickable anymore
- [ ] Cannot select YELLOW seats
- [ ] Held seats show distinct visual difference
- [ ] Color persists when viewing other seats

**Pass:** Seats correctly show HOLD status  
**Fail:** Seats still show AVAILABLE, or color doesn't update

---

### TEST 12: Order Appears in Orders List
**Objective:** Verify order created in system

**Steps:**
1. Click "ORDERS" tab (in Event Analytics)
2. Look for newly created order
3. Filter by PAYMENT_PENDING status if available

**Expected Results:**
- [ ] Order appears in list
- [ ] Order ID visible
- [ ] Status shows: "PAYMENT_PENDING"
- [ ] Seats show: A1, A2, B1 (the held seats)
- [ ] Amount shows: $350.00 (total)
- [ ] Customer email visible: john@example.com
- [ ] Created timestamp visible
- [ ] Expiry time visible (24h from now)

**Pass:** Order displays correctly in list  
**Fail:** Order missing, wrong status, or missing fields

---

### TEST 13: Payment Pending Email Receipt
**Objective:** Verify customer receives payment email

**Steps:**
1. Check email inbox for john@example.com
2. Look for email from noreply@eventhorizon.com
3. Open email

**Expected Results:**
- [ ] Email received within 5 seconds of hold
- [ ] Subject: "Payment Required for [Event Title]"
- [ ] From address: noreply@eventhorizon.com
- [ ] TO address: john@example.com
- [ ] Email body readable (not spam)
- [ ] Event details visible (name, date, venue)
- [ ] Seat information: A1, A2, B1
- [ ] Price: $350.00
- [ ] "Pay Now" button/link visible
- [ ] Countdown timer visible
- [ ] 24-hour deadline clear in email

**Expected NOT Present:**
- [ ] NO QR codes in email
- [ ] NO tickets in email
- [ ] NO check-in details in email

**Pass:** Email received with all required info  
**Fail:** Email not received or missing info

---

### TEST 14: Payment Link Validity
**Objective:** Verify payment URL works

**Steps:**
1. Open payment-pending email
2. Click "Pay Now" button/link
3. Wait for page load

**Expected Results:**
- [ ] Link is clickable (not broken)
- [ ] URL format: http://localhost:3000/payment/[order-id]
- [ ] Payment page loads without error
- [ ] Page shows order details
- [ ] Shows seats held
- [ ] Shows amount due
- [ ] Payment form visible (or redirects to payment)

**Pass:** Payment link works and page loads  
**Fail:** Link broken, page error, or wrong details

---

### TEST 15: Concurrent Holds
**Objective:** Verify multiple holds can exist simultaneously

**Steps:**
1. Select seats A1, A2 and place first hold
2. In same event, select seats B1, B2
3. Place second hold (different customer)
4. Select seats C1, C2
5. Place third hold (different customer)

**Expected Results:**
- [ ] First hold succeeds
- [ ] Second hold succeeds
- [ ] Third hold succeeds
- [ ] All 3 orders in PAYMENT_PENDING status
- [ ] All 6 seats show YELLOW
- [ ] Can place new holds on remaining seats
- [ ] Orders list shows all 3 holds
- [ ] Each has own expiry time

**Pass:** Multiple holds work independently  
**Fail:** Second hold fails, seats overlap, or list incorrect

---

### TEST 16: Seat Selection After Hold
**Objective:** Verify can select new seats after placing hold

**Steps:**
1. After placing hold (TEST 10, seats A1, A2, B1)
2. Try selecting seats C1, D1, E2
3. Open Hold Order modal again
4. Place second hold

**Expected Results:**
- [ ] Can select AVAILABLE seats (not held ones)
- [ ] Can place another hold
- [ ] Two independent holds exist
- [ ] Each hold has its own order
- [ ] Each hold is tracked separately

**Pass:** Can place multiple sequential holds  
**Fail:** Can't select new seats or holds interfere

---

### TEST 17: Manual Hold Cancellation
**Objective:** Verify organizer can cancel hold

**Steps:**
1. Go to ORDERS tab
2. Find a PAYMENT_PENDING order
3. Click Cancel button (if available)
4. Confirm cancellation

**Expected Results:**
- [ ] Cancel button present on PAYMENT_PENDING order
- [ ] Confirmation dialog shows (optional but recommended)
- [ ] Order status changes: PAYMENT_PENDING → CANCELLED
- [ ] Seats immediately become AVAILABLE again
- [ ] Seats change color: YELLOW → WHITE
- [ ] Map updates without page refresh (ideally)
- [ ] Order no longer shows as "pending"

**Pass:** Hold cancelled and seats released  
**Fail:** Cancel button missing or seats not released

---

### TEST 18: 24-Hour Auto-Expiry (Accelerated Testing)
**Objective:** Verify holds expire after 24 hours

**Steps:**
1. Place a hold (note paymentPendingUntil timestamp)
2. Manually trigger cleanup job OR wait for auto-cleanup
3. Check order status

**For Testing (Accelerated):**
- Modify test to use 1 minute instead of 24 hours
- Place hold with modified expiry
- Wait 1 minute
- Check auto-cleanup runs
- Verify order CANCELLED and seats AVAILABLE

**Expected Results:**
- [ ] Cleanup job runs every 60 seconds
- [ ] Expired orders found (paymentPendingUntil < now)
- [ ] Order status changes: PAYMENT_PENDING → CANCELLED
- [ ] Seats change: HOLD → AVAILABLE
- [ ] Expiry email sent to customer (if configured)
- [ ] No manual action required (fully automatic)

**Pass:** Auto-cleanup works and releases holds  
**Fail:** Cleanup doesn't run or sits don't release

---

### TEST 19: Prevent Duplicate Selection
**Objective:** Verify can't select both AVAILABLE and HOLD seats

**Steps:**
1. Place hold on seats A1, A2
2. Try to select A1 (held) AND C1 (available) together
3. Click "Hold (Pay Later)"

**Expected Results:**
- [ ] A1 not selectable (it's YELLOW/HOLD)
- [ ] Only C1 selectable
- [ ] Can place hold only on C1
- [ ] Can't mix held and available in one selection

**Pass:** System prevents invalid selections  
**Fail:** Can select held seats or mix statuses

---

### TEST 20: Error Handling - Invalid Email
**Objective:** Verify form validation rejects invalid email

**Steps:**
1. Open Hold Order modal
2. Fill Name: "John"
3. Fill Email: "invalid-email" (no @)
4. Fill Phone: "+1 555-0123"
5. Click "Place Hold"

**Expected Results:**
- [ ] Error message: "Please enter valid email"
- [ ] Form rejects submission
- [ ] Modal stays open
- [ ] Data preserved (doesn't clear)
- [ ] Can correct and resubmit

**Pass:** Invalid email rejected  
**Fail:** Bad email accepted or form cleared

---

### TEST 21: Error Handling - API Failure
**Objective:** Verify handles API errors gracefully

**Steps:**
1. Stop backend server (kill process)
2. Select seats and try to place hold
3. Leave backend stopped

**Expected Results:**
- [ ] API request fails (check Network tab)
- [ ] Error message shown: "Failed to place hold" or similar
- [ ] Modal stays open (data not lost)
- [ ] Button re-enables (not stuck loading)
- [ ] Can retry when backend available
- [ ] No crash or blank page

**Pass:** Error handled gracefully  
**Fail:** Crash, blank page, or no error message

---

### TEST 22: Error Handling - Already Held Seats
**Objective:** Verify can't re-hold already held seats

**Steps:**
1. Place hold on seats A1, A2
2. Try to place another hold on same seats A1, A2
3. Use different customer email

**Expected Results:**
- [ ] Request fails (seats no longer AVAILABLE)
- [ ] Error shown: "Seats are not available" or similar
- [ ] Order NOT created
- [ ] Seats still HOLD (not changed)
- [ ] Modal shows error and stays open

**Pass:** Duplicate holds prevented  
**Fail:** Second hold created on held seats

---

### TEST 23: UI Responsiveness
**Objective:** Verify feature works on different screen sizes

**Devices/Sizes to Test:**
- [ ] Desktop 1920x1080
- [ ] Tablet 768x1024
- [ ] Mobile 375x667

**Expected Results per Device:**
- [ ] Modal responsive (fits screen)
- [ ] Form fields accessible
- [ ] Buttons clickable (not too small on mobile)
- [ ] Text readable
- [ ] Seat map scrollable if needed
- [ ] No content cut off
- [ ] Touch-friendly on mobile

**Pass:** Feature works on all screen sizes  
**Fail:** Content cut off, not touch-friendly, or unreadable

---

### TEST 24: Browser Compatibility
**Browsers to Test:**
- [ ] Chrome/Chromium (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Expected Results per Browser:**
- [ ] Modal opens and closes
- [ ] Form submits successfully
- [ ] Colors display correctly
- [ ] Emails sent successfully
- [ ] No console errors
- [ ] All features work

**Pass:** Works in all major browsers  
**Fail:** Issues in specific browser

---

### TEST 25: Performance Under Load
**Objective:** Verify feature performs well with high load

**Steps:**
1. Place 50+ concurrent holds (simulated)
2. Monitor response times
3. Check for memory leaks
4. Verify database handles load

**Expected Results:**
- [ ] Average response time < 2 seconds
- [ ] No timeouts
- [ ] No errors with concurrent requests
- [ ] Database doesn't crash
- [ ] Auto-cleanup still runs
- [ ] Organizer UI stays responsive

**Pass:** Performance acceptable under load  
**Fail:** Timeouts, errors, or crashes

---

## 🔄 Integration Tests

### TEST 26: Full Customer Journey - Happy Path
**Objective:** End-to-end successful payment flow

**Steps:**
1. **Organizer:** Place hold on 3 seats
2. **Organizer:** Verify order shows PAYMENT_PENDING
3. **Organizer:** Verify seats show YELLOW
4. **Customer:** Open payment email
5. **Customer:** Click "Pay Now"
6. **Customer:** Process payment
7. **System:** Auto-update order to PAID
8. **Customer:** Receive confirmation email
9. **Organizer:** See order status PAID and seats SOLD
10. **Customer:** Check-in at event with QR code

**Expected Results:**
- [ ] Steps 1-3: Organizer side works
- [ ] Step 4: Email received
- [ ] Step 5: Payment link valid
- [ ] Step 6: Payment processed (or simulated)
- [ ] Step 7: Order status updated
- [ ] Step 8: Confirmation email with QR codes
- [ ] Step 9: Organizer sees SOLD status and LIGHT GREY seats
- [ ] Step 10: QR code scans successfully

**Pass:** Complete journey works end-to-end  
**Fail:** Any step fails or doesn't complete

---

### TEST 27: Full Customer Journey - Expiry Path
**Objective:** Hold expires after 24 hours without payment

**Steps:**
1. **Organizer:** Place hold
2. **Organizer:** Verify PAYMENT_PENDING
3. **Customer:** Receive email but don't pay
4. **Wait:** 24 hours (or simulate with modified expiry)
5. **System:** Auto-cleanup triggers
6. **Organizer:** Verify order CANCELLED
7. **Organizer:** Verify seats AVAILABLE again

**Expected Results:**
- [ ] Steps 1-3: Hold placed
- [ ] Step 4: Waiting period
- [ ] Step 5: Cleanup job runs
- [ ] Step 6: Order status = CANCELLED
- [ ] Step 7: Seats changed to AVAILABLE
- [ ] Seats become WHITE again

**Pass:** Auto-expiry works correctly  
**Fail:** Seats not released or order not cancelled

---

### TEST 28: Box Office vs. Hold Comparison
**Objective:** Verify both features work without conflicts

**Steps:**
1. Select seats A1, A2
2. Click "Book (Box Office)"
3. Complete box office booking
4. Verify seats SOLD
5. Select seats B1, B2
6. Click "Hold (Pay Later)"
7. Complete hold
8. Verify seats HOLD

**Expected Results:**
- [ ] Box office booking succeeds
- [ ] A1, A2 show as SOLD (light grey)
- [ ] Hold succeeds
- [ ] B1, B2 show as HOLD (yellow)
- [ ] Both features work together
- [ ] No conflicts or errors
- [ ] Orders appear separately

**Pass:** Both features coexist without issues  
**Fail:** Conflicts or only one works

---

## 🐛 Bug Report Template

Use this template when finding bugs:

```
TITLE: [Brief description of bug]

SEVERITY: Critical / High / Medium / Low

ENVIRONMENT:
- OS: [Windows/Mac/Linux]
- Browser: [Chrome, Firefox, Safari, Edge]
- Backend: [Local, Staging, Production]
- Test Data: [Describe setup]

STEPS TO REPRODUCE:
1. 
2. 
3. 

EXPECTED BEHAVIOR:
[What should happen]

ACTUAL BEHAVIOR:
[What actually happened]

SCREENSHOTS/VIDEOS:
[Attach if available]

LOGS/ERRORS:
[Console errors, API responses, etc.]

IMPACT:
[How does this affect users?]

NOTES:
[Any additional information]
```

---

## ✅ Test Coverage Summary

### Feature Coverage
- [x] UI/UX (Display, buttons, modals)
- [x] Form Validation (Required fields, format)
- [x] API Integration (Calls, responses, errors)
- [x] Data Management (Order creation, seat updates)
- [x] Email Notifications (Sending, content)
- [x] Auto-Cleanup (Expiry, release)
- [x] Concurrent Operations (Multiple holds)
- [x] Error Handling (Network, validation, duplicates)
- [x] Performance (Load, responsiveness)
- [x] Compatibility (Browsers, devices)

### Test Case Count
- **Unit Tests:** 8 (form validation, data)
- **Integration Tests:** 2 (full journeys)
- **Feature Tests:** 17 (individual features)
- **Edge Case Tests:** 5 (errors, duplicates)
- **Regression Tests:** Should include all above

**Total Test Cases:** 27+

---

## 📊 Test Execution Template

Use this to track test runs:

```
TEST CYCLE: Release v1.0
DATE: 2024-01-XX
TESTER: [Name]
BUILD: [Build number]

| Test ID | Test Name | Result | Notes |
|---------|-----------|--------|-------|
| TEST-1 | Display | ✓ Pass | All seats visible |
| TEST-2 | Selection | ✓ Pass | 10 seats selected |
| TEST-3 | Button | ✓ Pass | Yellow color correct |
| TEST-4 | Modal | ✓ Pass | Opens/closes |
| TEST-5 | Validation | ⚠ Fail | Email validation missing |
| ... | ... | ... | ... |

SUMMARY:
- Total: 25
- Passed: 23
- Failed: 2
- Skipped: 0

BLOCKERS: [Any critical issues]
REGRESSION: [Any new issues vs previous]
```

---

## 🎯 Sign-Off Criteria

**Feature is READY for production when:**
- [ ] All TEST 1-25 pass
- [ ] TEST 26 & TEST 27 (full journey) pass
- [ ] No critical bugs remaining
- [ ] Performance acceptable (< 2s response time)
- [ ] Works on Chrome, Firefox, Safari, Edge
- [ ] Works on Desktop, Tablet, Mobile
- [ ] Email service verified
- [ ] Auto-cleanup verified
- [ ] Documentation complete
- [ ] Organizer trained
- [ ] Support team trained

---

*Last Updated: 2024 | Hold Order QA Checklist v1.0*
