# Organizer UI Implementation Guide - "Hold" Seats Feature

## Overview
This guide covers how to integrate the "Hold" seat feature into the organizer's Live Seat Map component.

---

## 1. Update SeatGrid Component Props

Add a new prop to enable hold functionality for organizers:

```typescript
interface SeatGridProps {
  // ... existing props ...
  onHoldSeats?: (seatIds: string[]) => void;  // NEW: Hold seat callback
  isOrganizerMode?: boolean;                    // NEW: Show hold button for organizers
}
```

---

## 2. Add Hold Button to Seat Display

In `components/SeatGrid.tsx`, update the seat rendering to show "Hold" button for organizers:

```tsx
{/* Render seats */}
{seats.map(seat => {
    const isSelected = selectedSeatIds.includes(seat.id);
    const seatColor = seatColorizer ? seatColorizer(seat, isSelected) : defaultGetSeatColor(seat, isSelected);
    
    return (
        <button
            key={seat.id}
            onClick={() => {
                if (isOrganizerMode && seat.status === 'AVAILABLE') {
                    // For organizers: show hold action
                    onHoldSeats?.([seat.id]);
                } else {
                    // For customers: normal selection
                    onSeatClick?.(seat);
                }
            }}
            className={clsx(
                "absolute transition-all duration-150 ease-in-out rounded-md border flex items-center justify-center text-xs font-bold cursor-pointer",
                seatColor,
                // Show "Hold" label for organizers instead of seat number
                isOrganizerMode && seat.status === 'AVAILABLE' ? 'hover:bg-yellow-500' : ''
            )}
            style={{
                left: (seat.x !== undefined ? seat.x : seat.col * CELL_SIZE) + 'px',
                top: (seat.y !== undefined ? seat.y : seat.row * CELL_SIZE) + 'px',
                width: (CELL_SIZE - 6) + 'px',
                height: (CELL_SIZE - 6) + 'px'
            }}
            title={
                isOrganizerMode 
                    ? `${seat.rowLabel}${seat.seatNumber} - Click to Hold`
                    : `${seat.rowLabel}${seat.seatNumber}`
            }
        >
            {/* For organizers, show "Hold" instead of seat number */}
            {isOrganizerMode && seat.status === 'AVAILABLE' ? 'Hold' : `${seat.rowLabel}${seat.seatNumber}`}
        </button>
    );
})}
```

---

## 3. Organizer Live Seat Map Component Example

Create a new component or update existing one:

```tsx
// pages/organizer/LiveSeatMap.tsx
import React, { useState } from 'react';
import SeatGrid from '../../components/SeatGrid';
import { Event, Seat } from '../../types';

interface LiveSeatMapProps {
    event: Event;
    onRefresh?: () => void;
}

const OrganizerLiveSeatMap: React.FC<LiveSeatMapProps> = ({ event, onRefresh }) => {
    const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [holdingSeats, setHoldingSeats] = useState(false);

    const handleHoldSeats = async (seatIds: string[]) => {
        // Show hold dialog for customer info
        const showHoldDialog = true;
        if (showHoldDialog) {
            // Open modal to collect customer details
            handleOpenCustomerModal(seatIds);
        }
    };

    const handleOpenCustomerModal = (seatIds: string[]) => {
        // Show modal with customer info form
        console.log('Open customer modal for seats:', seatIds);
        // Collect: customer name, email, phone
        // Then call: placeHold(seatIds, customer)
    };

    const placeHold = async (seatIds: string[], customer: any) => {
        setHoldingSeats(true);
        try {
            const response = await fetch('/api/orders/payment-pending', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: event.id,
                    seatIds,
                    customer,
                    serviceFee: 5.00  // Adjust as needed
                })
            });

            if (!response.ok) {
                throw new Error('Failed to place hold');
            }

            const order = await response.json();
            
            // Show success message
            alert(`Hold placed! Payment URL sent to ${customer.email}`);
            
            // Refresh event to see updated seat statuses
            onRefresh?.();
            setSelectedSeatIds([]);
        } catch (error) {
            console.error('Error placing hold:', error);
            alert('Failed to place hold. Please try again.');
        } finally {
            setHoldingSeats(false);
        }
    };

    return (
        <div className="p-6">
            <h2 className="text-2xl font-bold mb-4">Live Seat Map</h2>
            
            {/* Status Legend */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-3">Seat Status Legend</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-white border-2 border-gray-300 rounded"></div>
                        <span>Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-yellow-400 border-2 border-yellow-500 rounded"></div>
                        <span>Hold (Pending Payment)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-amber-200 border-2 border-amber-300 rounded animate-pulse"></div>
                        <span>Booking in Progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-slate-200 border-2 border-slate-200 rounded"></div>
                        <span>Sold</span>
                    </div>
                </div>
            </div>

            {/* Seat Grid */}
            <div className="border rounded-lg p-4 bg-white">
                <SeatGrid
                    seats={event.seats || []}
                    selectedSeatIds={selectedSeatIds}
                    onSeatClick={(seat) => {
                        // Organizers use Hold button, not selection
                    }}
                    onHoldSeats={handleHoldSeats}
                    isOrganizerMode={true}
                    stage={event.stage}
                    totalRows={event.rows}
                    totalCols={event.cols}
                    scale={1}
                />
            </div>

            {/* Instructions */}
            <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
                <h3 className="font-semibold text-blue-900 mb-2">How to Place a Hold</h3>
                <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                    <li>Click on an "Available" seat to select it for holding</li>
                    <li>The system will ask for customer details (name, email, phone)</li>
                    <li>A payment-pending email will be sent to the customer</li>
                    <li>The customer has 24 hours to complete payment</li>
                    <li>Once paid, the seat becomes "Sold" and tickets are issued</li>
                    <li>If payment isn't received, the seat automatically releases</li>
                </ol>
            </div>

            {/* Refresh Button */}
            <button
                onClick={onRefresh}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={holdingSeats}
            >
                {holdingSeats ? 'Placing Hold...' : 'Refresh Seat Status'}
            </button>
        </div>
    );
};

export default OrganizerLiveSeatMap;
```

---

## 4. Customer Modal Component Example

```tsx
// components/HoldCustomerModal.tsx
import React, { useState } from 'react';
import { X } from 'lucide-react';

interface HoldCustomerModalProps {
    seatIds: string[];
    seats: any[];
    onSubmit: (customer: any) => void;
    onCancel: () => void;
    loading?: boolean;
}

const HoldCustomerModal: React.FC<HoldCustomerModalProps> = ({
    seatIds,
    seats,
    onSubmit,
    onCancel,
    loading
}) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: ''
    });

    const selectedSeats = seats.filter(s => seatIds.includes(s.id));
    const totalPrice = selectedSeats.reduce((sum, s) => sum + (s.price || 0), 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name || !formData.email) {
            alert('Please fill in all required fields');
            return;
        }
        onSubmit(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b">
                    <h2 className="text-xl font-bold">Place Hold on Seats</h2>
                    <button
                        onClick={onCancel}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Selected Seats Summary */}
                    <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <h3 className="font-semibold text-yellow-900 mb-2">Selected Seats</h3>
                        <div className="space-y-1">
                            {selectedSeats.map(seat => (
                                <div key={seat.id} className="text-sm text-yellow-800">
                                    {seat.rowLabel}{seat.seatNumber} - ${seat.price?.toFixed(2)}
                                </div>
                            ))}
                        </div>
                        <div className="border-t border-yellow-200 mt-2 pt-2 font-semibold text-yellow-900">
                            Total: ${totalPrice.toFixed(2)}
                        </div>
                    </div>

                    {/* Customer Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Customer Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="John Doe"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email Address *
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="john@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="+1 (555) 123-4567"
                            />
                        </div>

                        {/* Info Box */}
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-sm text-blue-800">
                                ✓ Payment-pending email will be sent to {formData.email || 'the customer'}
                                <br />
                                ✓ Customer has 24 hours to complete payment
                                <br />
                                ✓ Seats will auto-release if payment isn't received
                            </p>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t bg-gray-50">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-100 font-medium"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium disabled:opacity-50"
                        disabled={loading}
                    >
                        {loading ? 'Placing Hold...' : 'Place Hold'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HoldCustomerModal;
```

---

## 5. Integration Steps

### Step 1: Add Live Seat Map Page
Create or update the organizer dashboard to include the Live Seat Map component.

### Step 2: Add Mockup for Testing
Update `services/mockBackend.ts` to support the payment pending flow:

```typescript
export const createPaymentPendingOrder = async (eventId: string, seatIds: string[], customer: any) => {
    try {
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
        return await response.json();
    } catch (err) {
        console.error('Failed to create payment pending order:', err);
        throw err;
    }
};

export const completePaymentPendingOrder = async (orderId: string, paymentMode: string, transactionId?: string) => {
    try {
        const response = await fetch(`/api/orders/${orderId}/complete-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                orderId,
                paymentMode,
                transactionId
            })
        });
        return await response.json();
    } catch (err) {
        console.error('Failed to complete payment:', err);
        throw err;
    }
};
```

### Step 3: Test the Flow
1. Organizer navigates to Live Seat Map
2. Clicks on an available seat → "Hold" label shows
3. Modal opens to collect customer info
4. Submits form → Order created with PAYMENT_PENDING status
5. Check email for payment pending email
6. Call complete payment endpoint
7. Verify seat status changed to SOLD
8. Check email for confirmation with QR codes

---

## 6. Real-Time Updates (Future Enhancement)

For real-time seat status updates without page refresh:

```typescript
// Add WebSocket listener for seat status changes
useEffect(() => {
    const ws = new WebSocket(`ws://localhost:5000/events/${event.id}`);
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'SEAT_STATUS_CHANGED') {
            // Update seat in state
            // Refresh grid display
        }
    };
    
    return () => ws.close();
}, [event.id]);
```

---

## 7. UI/UX Best Practices

✅ **Do:**
- Show clear status legend for all seat states
- Provide immediate feedback when placing holds
- Make payment deadline prominent in emails
- Show customer details collected during hold
- Allow organizers to view all holds and their status
- Include cancel button on hold details

❌ **Don't:**
- Auto-deselect seats after hold is placed
- Hide payment deadline info
- Make it unclear which seats are held vs sold
- Require organizers to refresh page manually
- Send confusing emails about payment status

---

## 8. Accessibility Considerations

- Use `aria-labels` for organizer-specific actions
- Ensure color distinction isn't the only indicator
- Provide keyboard navigation for seat selection
- Include tooltips for hold-related actions
- Make modal keyboard accessible

---

## Questions & Support

For issues integrating the feature:
1. Check [PAY_LATER_FEATURE.md](./PAY_LATER_FEATURE.md) for backend details
2. Verify seat status colors match documentation
3. Test with console logs for API responses
4. Check email service configuration for sending payment emails
