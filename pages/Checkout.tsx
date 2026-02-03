
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Event, Seat, Coupon, ServiceCharge, PaymentMode, SeatingType } from '../types';
import { validateCoupon, processPayment, fetchServiceCharges, createPaymentIntent, releaseSeats, releaseSeatsKeepAlive, fetchBestCoupon } from '../services/mockBackend';
import { useAuth } from '../context/AuthContext';
import { TicketCheck, CreditCard, Tag, Info, AlertTriangle, Timer, ArrowLeft } from 'lucide-react';
import { formatInTimeZone } from '../utils/date';
import clsx from 'clsx';
import.meta.env

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51Npw4pKUXa8cL1IH4peMAyX0L2VQZfdd3geTwYivtTZUDtCE83NcGuP3vibkB8ndW6vhOzzDOLTtNTfGbzeJFC1600s4Jkldwa');

const CheckoutForm: React.FC<{
    event: Event,
    selectedSeats: Seat[],
    customerName: string,
    customerPhone:string,
    customerEmail: string,
    appliedCoupon: Coupon | null,
    calculatedFee: number,
    finalTotal: number,
    onSuccess: (transactionId: string, termsAccepted: boolean) => Promise<void>
}> = ({ event, selectedSeats, customerName, customerPhone, customerEmail, appliedCoupon, calculatedFee, finalTotal, onSuccess }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [termsError, setTermsError] = useState<string | null>(null);
    const [showTermsModal, setShowTermsModal] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        if (!customerName.trim() || !customerEmail.trim()) {
            setError("Please provide your full name and email address.");
            return;
        }
        if (!termsAccepted) {
            setTermsError('Please accept the Terms & Conditions before proceeding.');
            return;
        }
        setTermsError(null);
        setProcessing(true);
        setError(null);
        try {
            const { clientSecret } = await createPaymentIntent(selectedSeats, appliedCoupon?.id, event.id);
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) throw new Error("Card Element not found");
            const result = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement,
                    billing_details: {
                            name: customerName,
                            email: customerEmail,
                            phone: customerPhone
                    },
                },
            });
            if (result.error) {
                setError(result.error.message || "Payment failed");
                setProcessing(false);
            } else if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
                await onSuccess(result.paymentIntent.id);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "An unexpected error occurred.");
            setProcessing(false);
        }
    };

    return (<>
        <form onSubmit={handleSubmit} className="space-y-6">
             <div className="bg-white p-4 rounded-md border border-slate-300">
                <CardElement 
                    options={{
                        style: {
                            base: {
                                fontSize: '16px',
                                color: '#424770',
                                '::placeholder': { color: '#aab7c4' },
                            },
                            invalid: { color: '#9e2146' },
                        },
                    }}
                />
            </div>
            {error && (
                <div className="flex items-center text-red-600 bg-red-50 p-3 rounded-md text-sm">
                    <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
                    {error}
                </div>
            )}
            <div className="flex items-start gap-3">
                <input id="terms" type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1" />
                <label htmlFor="terms" className="text-sm text-slate-700">
                    I agree to the <button type="button" onClick={() => setShowTermsModal(true)} className="text-indigo-600 underline">Terms &amp; Conditions</button>
                </label>
            </div>
            {termsError && <p className="text-red-500 text-xs mt-2">{termsError}</p>}

            <button
                type="submit"
                disabled={!stripe || processing || !termsAccepted}
                className="w-full mt-4 bg-indigo-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-indigo-700 transition-colors flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {processing ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                    `Pay $${finalTotal.toFixed(2)}`
                )}
            </button>
             <div className="flex justify-center items-center gap-2 mt-4 opacity-50 grayscale">
                <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" className="h-6" />
            </div>
        </form>
        {showTermsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="fixed inset-0 bg-black/50" onClick={() => setShowTermsModal(false)} />
                <div className="relative w-full max-w-lg md:max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden max-h-[90vh]">
                    <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                        <h3 className="text-lg font-bold">Terms &amp; Conditions</h3>
                        <button onClick={() => setShowTermsModal(false)} className="text-slate-500 hover:text-slate-800 p-2 rounded">
                            Close
                        </button>
                    </div>
                    <div className="p-4 overflow-y-auto max-h-[72vh] text-sm text-slate-700">
                        <section className="mb-4">
                            <h4 className="font-semibold mb-2">Important Instructions</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Please arrive 30 minutes before the event starts</li>
                                <li>Bring a valid photo ID along with this confirmation</li>
                                <li>Screenshots of this email are acceptable for entry</li>
                                <li>Contact support if you need to make any changes</li>
                            </ul>
                        </section>

                        <section>
                            <h4 className="font-semibold mb-2">Terms and Conditions</h4>
                            <p className="mb-3">Please carefully read and understand these terms and conditions before purchasing tickets for this event. By purchasing tickets, you acknowledge and agree to adhere to the following terms and conditions:</p>

                            <div className="space-y-4">
                                <div>
                                    <h5 className="font-semibold">Ticket Modifications, Cancellations, and Refunds</h5>
                                    <p>Tickets purchased for the Event are non-modifiable and non-cancelable. Refunds will be initiated only in the event of cancellation of the Event. In case of Event cancellation, refunds will be initiated for the face value of the ticket only. Booking or transaction fees are non-refundable.</p>
                                </div>

                                <div>
                                    <h5 className="font-semibold">Payment Gateway Charges</h5>
                                    <p>Payment gateways apply a booking fee per ticket purchased, and this fee is directed solely to the payment gateway. Ensure you review the total amount including this fee before making payment.</p>
                                </div>

                                <div>
                                    <h5 className="font-semibold">Late Entry and Venue Arrival</h5>
                                    <p>The organizers reserve the right to deny late entry to the Event. To ensure seamless entry, we strongly recommend arriving at the venue at least an hour before the scheduled start time of the Event.</p>
                                </div>

                                <div>
                                    <h5 className="font-semibold">Event Cancellation/Postponement Refunds</h5>
                                    <p>In the event of Event cancellation or postponement, refunds will cover only the face value of the ticket. Booking or transaction fees are non-refundable.</p>
                                </div>

                                <div>
                                    <h5 className="font-semibold">Venue Rules and Entry</h5>
                                    <p>Each venue has its own set of rules and regulations. The venue management holds the right to deny entry to individuals who do not comply with these rules.</p>
                                </div>

                                <div>
                                    <h5 className="font-semibold">Modification of Terms and Conditions</h5>
                                    <p>These terms and conditions are subject to change at the sole discretion of the organizer. Any changes will be effective immediately upon being posted on the official website or communicated through official channels.</p>
                                </div>
                            </div>
                        </section>
                    </div>
                    <div className="p-4 border-t bg-white flex items-center gap-3 justify-end">
                        <button onClick={() => { setTermsAccepted(true); setShowTermsModal(false); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Accept</button>
                        <button onClick={() => setShowTermsModal(false)} className="px-4 py-2 border rounded-lg">Close</button>
                    </div>
                </div>
            </div>
        )}
    </>
    );
};

const FreeBookingPanel: React.FC<{
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    event: Event;
    selectedSeats: Seat[];
    appliedCoupon: Coupon | null;
    calculatedFee: number;
    onSuccess: (transactionId: string, termsAccepted: boolean) => Promise<void>
}> = ({ customerName, customerEmail, customerPhone, event, selectedSeats, appliedCoupon, calculatedFee, onSuccess }) => {
    const [processing, setProcessing] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [termsError, setTermsError] = useState<string | null>(null);
    const [showTermsModal, setShowTermsModal] = useState(false);

    const handleFree = async () => {
        setTermsError(null);
        if (!customerName.trim() || !customerEmail.trim()) {
            setTermsError('Please provide your full name and email address.');
            return;
        }
        if (!termsAccepted) {
            setTermsError('Please accept the Terms & Conditions before proceeding.');
            return;
        }
        setProcessing(true);
        try {
            // Call parent onSuccess with a sentinel transaction id 'FREE'
            await onSuccess('FREE', true);
        } catch (err: any) {
            console.error(err);
            alert(err?.message || 'Failed to complete booking.');
            setProcessing(false);
        }
    };

    return (
        <div>
            {termsError && (
                <div className="flex items-center text-red-600 bg-red-50 p-3 rounded-md text-sm mb-3">
                    {termsError}
                </div>
            )}
            <div className="flex items-start gap-3 mb-3">
                <input id="free-terms" type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1" />
                <label htmlFor="free-terms" className="text-sm text-slate-700">
                    I agree to the <button type="button" onClick={() => setShowTermsModal(true)} className="text-indigo-600 underline">Terms &amp; Conditions</button>
                </label>
            </div>

            <button
                onClick={handleFree}
                disabled={processing}
                className="w-full mt-2 bg-green-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-green-700 transition-colors flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {processing ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                    `Book Now` 
                )}
            </button>

            {showTermsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setShowTermsModal(false)} />
                    <div className="relative w-full max-w-lg md:max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden max-h-[90vh]">
                        <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                            <h3 className="text-lg font-bold">Terms &amp; Conditions</h3>
                            <button onClick={() => setShowTermsModal(false)} className="text-slate-500 hover:text-slate-800 p-2 rounded">Close</button>
                        </div>
                        <div className="p-4 overflow-y-auto max-h-[72vh] text-sm text-slate-700">
                            <section className="mb-4">
                                <h4 className="font-semibold mb-2">Important Instructions</h4>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Please arrive 30 minutes before the event starts</li>
                                    <li>Bring a valid photo ID along with this confirmation</li>
                                    <li>Screenshots of this email are acceptable for entry</li>
                                    <li>Contact support if you need to make any changes</li>
                                </ul>
                            </section>
                            <section>
                                <h4 className="font-semibold mb-2">Terms and Conditions</h4>
                                <p className="mb-3">Please carefully read and understand these terms and conditions before purchasing tickets for this event. By purchasing tickets, you acknowledge and agree to adhere to the following terms and conditions:</p>
                                <div className="space-y-4">
                                    <div>
                                        <h5 className="font-semibold">Ticket Modifications, Cancellations, and Refunds</h5>
                                        <p>Tickets purchased for the Event are non-modifiable and non-cancelable. Refunds will be initiated only in the event of cancellation of the Event. In case of Event cancellation, refunds will be initiated for the face value of the ticket only. Booking or transaction fees are non-refundable.</p>
                                    </div>
                                    <div>
                                        <h5 className="font-semibold">Payment Gateway Charges</h5>
                                        <p>Payment gateways apply a booking fee per ticket purchased, and this fee is directed solely to the payment gateway. Ensure you review the total amount including this fee before making payment.</p>
                                    </div>
                                </div>
                            </section>
                        </div>
                        <div className="p-4 border-t bg-white flex items-center gap-3 justify-end">
                            <button onClick={() => { setTermsAccepted(true); setShowTermsModal(false); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">Accept</button>
                            <button onClick={() => setShowTermsModal(false)} className="px-4 py-2 border rounded-lg">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const Checkout: React.FC = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const event = (state as any)?.event as Event;
  const selectedSeats = (state as any)?.selectedSeats as Seat[];

  const [customerName, setCustomerName] = useState(user?.name || '');
  const [customerEmail, setCustomerEmail] = useState(user?.email || '');
  const [customerPhone, setCustomerPhone] = useState<any>('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
    const [manualCouponApplied, setManualCouponApplied] = useState(false);
    const [autoApplied, setAutoApplied] = useState(false);
  const [serviceCharges, setServiceCharges] = useState<ServiceCharge[]>([]);
  const [calculatedFee, setCalculatedFee] = useState(0);

  // Timer State
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const isPaidRef = useRef(false);
  const releasedRef = useRef(false);
    const timeLeftRef = useRef(timeLeft);

  useEffect(() => {
    if (!event || !selectedSeats) {
        navigate('/');
        return;
    }
    fetchServiceCharges().then(charges => {
        setServiceCharges(charges.filter(c => c.active));
    });
  }, []);



  // Timer Lifecycle & Seat Release
  useEffect(() => {
    if (!event || event.seatingType !== SeatingType.RESERVED) return;

    const timer = setInterval(() => {
        setTimeLeft(prev => {
            const next = prev <= 1 ? 0 : prev - 1;
            timeLeftRef.current = next;
            if (next === 0) {
                clearInterval(timer);
                // Explicitly release seats before navigating away on timeout
                (async () => {
                    try {
                        releasedRef.current = true;
                        await releaseSeats(event.id, selectedSeats.map(s => s.id));
                    } catch (e) {
                        console.error('Failed to release seats on timeout', e);
                    }
                    handleTimeout();
                })();
            }
            return next;
        });
    }, 1000);

    // Release seats on unmount if not paid. Register `pagehide`/`unload`
    // handlers for best-effort release (these do not trigger a browser
    // confirmation dialog). We intentionally avoid `beforeunload` so the
    // browser's "Changes that you made may not be saved." prompt doesn't
    // duplicate our custom confirmation when the user presses Back.
    const handlePageHide = () => {
        if (!isPaidRef.current && !releasedRef.current && event.seatingType === SeatingType.RESERVED) {
            releasedRef.current = true;
            // Best-effort release using keepalive (sendBeacon / fetch keepalive)
            releaseSeatsKeepAlive(event.id, selectedSeats.map(s => s.id));
        }
    };

    window.addEventListener('pagehide', handlePageHide as EventListener);
    window.addEventListener('unload', handlePageHide as EventListener);

    return () => {
        clearInterval(timer);
        window.removeEventListener('pagehide', handlePageHide as EventListener);
        window.removeEventListener('unload', handlePageHide as EventListener);
        if (!isPaidRef.current && !releasedRef.current && event.seatingType === SeatingType.RESERVED) {
            // Fire-and-forget release when SPA unmounts (navigation within app)
            releasedRef.current = true;
            releaseSeatsKeepAlive(event.id, selectedSeats.map(s => s.id));
        }
    };
  }, [event]);

  const handleTimeout = () => {
      alert("Your booking session has expired. The seats have been released.");
      window.location.href = `/event/${event.id}`;
  };

  const handleManualBack = () => {
      if (event && event.seatingType === SeatingType.RESERVED) {
        if (!window.confirm("Navigating back will release your selected seats. Continue?")) return;
        (async () => {
            try {
                if (!isPaidRef.current) {
                    releasedRef.current = true;
                    await releaseSeats(event.id, selectedSeats.map(s => s.id));
                }
            } catch (err) {
                console.error('Failed to release seats on manual back', err);
            } finally {
                window.location.href = `/event/${event.id}`;
            }
        })();
      } else if (event) {
        // For non-reserved events just navigate back without prompts or release logic
        window.location.href = `/event/${event.id}`;
      }
  };
useEffect(() => {
    if (!event || event.seatingType !== SeatingType.RESERVED) return;
    // Push a dummy state so back stays on this page
    window.history.pushState(null, "", window.location.href);

    const onPopState = () => {
        window.history.pushState(null, "", window.location.href);
        handleManualBack(); // show confirm + release seats only for reserved
    };

    window.addEventListener("popstate", onPopState);

    return () => {
        window.removeEventListener("popstate", onPopState);
    };
}, [event]);


  if (!event || !selectedSeats) return null;

  const subtotal = selectedSeats.reduce((acc, s) => acc + (s.price || 0), 0);
  let discountAmount = 0;
  if (appliedCoupon) {
      if (typeof (appliedCoupon as any).discount === 'number') {
          discountAmount = (appliedCoupon as any).discount;
      } else {
          discountAmount = appliedCoupon.discountType === 'PERCENTAGE' 
            ? subtotal * (appliedCoupon.value / 100) 
            : appliedCoupon.value;
      }
  }
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  useEffect(() => {
      let feeTotal = 0;
      serviceCharges.forEach(charge => {
          feeTotal += charge.type === 'FIXED' ? charge.value : discountedSubtotal * (charge.value / 100);
      });
      setCalculatedFee(feeTotal);
  }, [serviceCharges, discountedSubtotal]);

  const finalTotal = discountedSubtotal + calculatedFee;

  const handleApplyCoupon = async () => {
    setCouponError(null);
    try {
                                const coupon = await validateCoupon(couponCode, event.id, selectedSeats);
                                setAppliedCoupon(coupon);
                                setManualCouponApplied(true);
                                setAutoApplied(false);
    } catch (e: any) {
        setCouponError(e.message || "Invalid code");
        setAppliedCoupon(null);
    }
  };

    // Auto-poll for best applicable coupon while checkout timer is active
    useEffect(() => {
        if (!event || !selectedSeats || manualCouponApplied) return;

        let stopped = false;

        const checkBest = async () => {
            try {
                const res = await fetchBestCoupon(event.id, selectedSeats);
                const best = res?.coupon || null;
                if (best && typeof (best as any).discount === 'number') {
                    const currentDiscount = appliedCoupon && typeof (appliedCoupon as any).discount === 'number' ? (appliedCoupon as any).discount : 0;
                    if ((best as any).discount > currentDiscount) {
                        setAppliedCoupon(best as any);
                        setCouponCode((best as any).code || '');
                        setAutoApplied(true);
                    }
                }
            } catch (err) {
                // ignore network errors during polling
            }
        };

        // Initial check immediately
        checkBest();

        const poll = setInterval(() => {
            // Use the ref for timeLeft so we don't re-create this effect every second
            if (isPaidRef.current || timeLeftRef.current <= 0 || stopped || manualCouponApplied) {
                clearInterval(poll);
                return;
            }
            checkBest();
        }, 15000);

        return () => { stopped = true; clearInterval(poll); };
    }, [event, selectedSeats, manualCouponApplied]);

  const handleOrderSuccess = async (transactionId: string, termsAccepted?: boolean) => {
    isPaidRef.current = true; // Prevents the cleanup releaser from running
    try {
        const paymentModeToUse = transactionId === 'FREE' ? PaymentMode.CASH : PaymentMode.ONLINE;
        const order = await processPayment(
                { name: customerName, email: customerEmail, phone: customerPhone, id: user?.id, termsAccepted: !!termsAccepted },
            event,
            selectedSeats,
            calculatedFee,
            appliedCoupon?.id,
            paymentModeToUse,
            transactionId === 'FREE' ? null : transactionId
        );
        // Use replace: true so they can't go back to checkout
        navigate('/confirmation', { state: { order }, replace: true });
    } catch (error) {
        alert("Payment successful but failed to record order. Please contact support with Transaction ID: " + transactionId);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Timer Banner (only for reserved seating) */}
      {event.seatingType === SeatingType.RESERVED && (
        <div className={clsx(
            "mb-6 flex items-center justify-between p-4 rounded-xl border-2 transition-colors",
            timeLeft < 60 ? "bg-red-50 border-red-200 text-red-700 animate-pulse" : "bg-indigo-50 border-indigo-200 text-indigo-700"
        )}>
            <div className="flex items-center gap-2 font-bold">
                <Timer className="w-5 h-5" />
                <span>Checkout Timer</span>
            </div>
            <div className="text-2xl font-mono font-bold tracking-widest">
                {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
            </div>
            <button 
              onClick={handleManualBack}
              className="flex items-center text-xs font-bold uppercase hover:underline"
            >
                <ArrowLeft className="w-3 h-3 mr-1" /> Change Seats
            </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 grid grid-cols-1 md:grid-cols-2">
        {/* Order Summary */}
        <div className="p-8 bg-slate-50 border-r border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                <TicketCheck className="w-5 h-5 mr-2 text-indigo-600"/> Order Summary
            </h2>
            <div className="mb-6">
                <h3 className="font-semibold text-slate-900">{event.title}</h3>
                <p className="text-sm text-slate-500">{formatInTimeZone(event.startTime, event.timezone, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-sm text-slate-500">{event.location}</p>
            </div>
            <div className="space-y-3 mb-6 max-h-48 overflow-y-auto pr-2">
                {selectedSeats.map(seat => (
                    <div key={seat.id} className="flex justify-between text-sm text-slate-600">
                         <span>
                            {seat.tier}
                            {event.seatingType === SeatingType.RESERVED && (
                                <> - {seat.rowLabel}{seat.seatNumber}</>
                            )}
                         </span>
                         <span>${(seat.price || 0).toFixed(2)}</span>
                    </div>
                ))}
            </div>
            <div className="border-t border-slate-200 pt-4 space-y-2">
                <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                </div>
                                {appliedCoupon && (
                                        <>
                                            {!manualCouponApplied && autoApplied && (
                                                <div className="p-3 mb-3 bg-green-50 text-green-800 rounded flex items-center justify-between">
                                                    <div>
                                                        <strong>Auto-applied discount:</strong> {appliedCoupon.code} — you saved ${discountAmount.toFixed(2)}
                                                    </div>
                                                    <div>
                                                        <button onClick={() => { setAppliedCoupon(null); setCouponCode(''); setManualCouponApplied(true); setAutoApplied(false); }} className="text-sm text-red-600 underline">Remove</button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex justify-between text-green-600 font-medium">
                                                <span>Discount ({appliedCoupon.code})</span>
                                                <span>-${discountAmount.toFixed(2)}</span>
                                            </div>
                                        </>
                                )}
                {calculatedFee > 0 && (
                     <div className="flex justify-between text-slate-600">
                        <span className="flex items-center" title="Platform and Processing Fees">
                            Booking Fee <Info className="w-3 h-3 ml-1 text-slate-400" />
                        </span>
                        <span>${calculatedFee.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between text-xl font-bold text-slate-900 pt-2 border-t border-slate-200 mt-2">
                    <span>Total</span>
                    <span>${finalTotal.toFixed(2)}</span>
                </div>
            </div>
        </div>

        {/* Payment Details */}
        <div className="p-8">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-indigo-600"/> Payment Details
            </h2>
            <div className="mb-6 border-b border-slate-100 pb-6">
                <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Contact Information</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                        <input type="email" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                        <input type="tel" className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-indigo-500" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="e.g. +1 555 555 5555" />
                    </div>
                </div>
            </div>
            <div className="mb-8">
                <label className="block text-sm font-medium text-slate-700 mb-2">Promo Code</label>
                <div className="flex gap-2">
                    <input type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-200 focus:outline-none" />
                    <button onClick={handleApplyCoupon} className="px-4 py-2 bg-slate-800 text-white rounded-md text-sm hover:bg-slate-700">Apply</button>
                </div>
                {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
                {appliedCoupon && <p className="text-green-600 text-xs mt-1 flex items-center"><Tag className="w-3 h-3 mr-1"/> Code applied successfully!</p>}
            </div>
            <div className="mt-6">
                {finalTotal <= 0 ? (
                    // Free / zero-amount booking: show direct booking button and no card UI
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Booking</label>
                        <FreeBookingPanel
                            customerName={customerName}
                            customerEmail={customerEmail}
                            customerPhone={customerPhone}
                            event={event}
                            selectedSeats={selectedSeats}
                            appliedCoupon={appliedCoupon}
                            calculatedFee={calculatedFee}
                            onSuccess={handleOrderSuccess}
                        />
                    </div>
                ) : (
                    <>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Credit Card</label>
                        <Elements stripe={stripePromise} >
                            <CheckoutForm event={event} selectedSeats={selectedSeats} customerName={customerName} customerEmail={customerEmail}  customerPhone={customerPhone} appliedCoupon={appliedCoupon} calculatedFee={calculatedFee} finalTotal={finalTotal} onSuccess={handleOrderSuccess} />
                        </Elements>
                    </>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;