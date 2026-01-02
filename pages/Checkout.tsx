
import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Event, Seat, Coupon, ServiceCharge, PaymentMode, SeatingType } from '../types';
import { validateCoupon, processPayment, fetchServiceCharges, createPaymentIntent, releaseSeats, releaseSeatsKeepAlive } from '../services/mockBackend';
import { useAuth } from '../context/AuthContext';
import { TicketCheck, CreditCard, Tag, Info, AlertTriangle, Timer, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_51Npw4pKUXa8cL1IH4peMAyX0L2VQZfdd3geTwYivtTZUDtCE83NcGuP3vibkB8ndW6vhOzzDOLTtNTfGbzeJFC1600s4Jkldwa');

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
            const { clientSecret } = await createPaymentIntent(selectedSeats, appliedCoupon?.id);
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

    return (
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
                    I agree to the <a href="/terms" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Terms &amp; Conditions</a>
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
  const [serviceCharges, setServiceCharges] = useState<ServiceCharge[]>([]);
  const [calculatedFee, setCalculatedFee] = useState(0);

  // Timer State
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes in seconds
  const isPaidRef = useRef(false);
  const releasedRef = useRef(false);

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
            if (prev <= 1) {
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
                return 0;
            }
            return prev - 1;
        });
    }, 1000);

    // Release seats on unmount if not paid. Also register a beforeunload
    // handler for browser/tab closes that uses keepalive.
    const beforeUnload = (e: BeforeUnloadEvent) => {
        if (!isPaidRef.current) {
            try {
                // Best-effort synchronous/keepalive release
                releasedRef.current = true;
                releaseSeatsKeepAlive(event.id, selectedSeats.map(s => s.id));
            } catch (err) {
                // ignore
            }
            e.preventDefault();
            e.returnValue = '';
        }
    };

    window.addEventListener('beforeunload', beforeUnload);

    return () => {
        clearInterval(timer);
        window.removeEventListener('beforeunload', beforeUnload);
        if (!isPaidRef.current && !releasedRef.current && event.seatingType === SeatingType.RESERVED) {
            // Fire-and-forget release; UI is unmounting so we don't await
            releasedRef.current = true;
            releaseSeatsKeepAlive(event.id, selectedSeats.map(s => s.id));
        }
    };
  }, [event]);

  const handleTimeout = () => {
      alert("Your booking session has expired. The seats have been released.");
      navigate(`/event/${event.id}`);
  };

  const handleManualBack = () => {
      if (window.confirm("Navigating back will release your selected seats. Continue?")) {
          (async () => {
              try {
                  if (!isPaidRef.current && event.seatingType === SeatingType.RESERVED) {
                      releasedRef.current = true;
                      await releaseSeats(event.id, selectedSeats.map(s => s.id));
                  }
              } catch (err) {
                  console.error('Failed to release seats on manual back', err);
              } finally {
                  // Use replace so the checkout page isn't reachable via back button
                  navigate(`/event/${event.id}`);
              }
          })();
      }
  };
useEffect(() => {
  // Push a dummy state so back stays on this page
  window.history.pushState(null, "", window.location.href);

  const onPopState = () => {
    window.history.pushState(null, "", window.location.href);
    handleManualBack(); // optional: show confirm + release seats
  };

  window.addEventListener("popstate", onPopState);

  return () => {
    window.removeEventListener("popstate", onPopState);
  };
}, []);

useEffect(() => {
  // Lock back navigation on checkout
  window.history.pushState(null, "", window.location.href);

  const onPopState = () => {
    const confirmed = window.confirm(
      "Going back will release your selected seats. Continue?"
    );

    if (!confirmed) {
      // Stay on checkout
      window.history.pushState(null, "", window.location.href);
      return;
    }

    // Allow navigation back
    window.removeEventListener("popstate", onPopState);
    window.location.href = `http://localhost:3000/#/event/${event.id}`;

    // Force reload after navigation
    // setTimeout(() => {
    //   window.location.reload();
    // }, 0);
  };

  window.addEventListener("popstate", onPopState);

  return () => {
    window.removeEventListener("popstate", onPopState);
  };
}, []);


  if (!event || !selectedSeats) return null;

  const subtotal = selectedSeats.reduce((acc, s) => acc + (s.price || 0), 0);
  let discountAmount = 0;
  if (appliedCoupon) {
      discountAmount = appliedCoupon.discountType === 'PERCENTAGE' 
        ? subtotal * (appliedCoupon.value / 100) 
        : appliedCoupon.value;
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
        const coupon = await validateCoupon(couponCode, event.id);
        setAppliedCoupon(coupon);
    } catch (e: any) {
        setCouponError(e.message || "Invalid code");
        setAppliedCoupon(null);
    }
  };

  const handleOrderSuccess = async (transactionId: string, termsAccepted?: boolean) => {
    isPaidRef.current = true; // Prevents the cleanup releaser from running
    try {
        const order = await processPayment(
                { name: customerName, email: customerEmail, phone: customerPhone, id: user?.id, termsAccepted: !!termsAccepted }, 
            event, 
            selectedSeats, 
            calculatedFee, 
            appliedCoupon?.id,
            PaymentMode.ONLINE,
            transactionId
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
      {/* Timer Banner */}
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

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 grid grid-cols-1 md:grid-cols-2">
        {/* Order Summary */}
        <div className="p-8 bg-slate-50 border-r border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                <TicketCheck className="w-5 h-5 mr-2 text-indigo-600"/> Order Summary
            </h2>
            <div className="mb-6">
                <h3 className="font-semibold text-slate-900">{event.title}</h3>
                <p className="text-sm text-slate-500">{new Date(event.startTime).toLocaleString()}</p>
                <p className="text-sm text-slate-500">{event.location}</p>
            </div>
            <div className="space-y-3 mb-6 max-h-48 overflow-y-auto pr-2">
                {selectedSeats.map(seat => (
                    <div key={seat.id} className="flex justify-between text-sm text-slate-600">
                         <span>{seat.tier} - {seat.rowLabel}{seat.seatNumber}</span>
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
                    <div className="flex justify-between text-green-600 font-medium">
                        <span>Discount ({appliedCoupon.code})</span>
                        <span>-${discountAmount.toFixed(2)}</span>
                    </div>
                )}
                {calculatedFee > 0 && (
                     <div className="flex justify-between text-slate-600">
                        <span className="flex items-center" title="Platform and Processing Fees">
                            Service Fees <Info className="w-3 h-3 ml-1 text-slate-400" />
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Credit Card</label>
                <Elements stripe={stripePromise} >
                    <CheckoutForm event={event} selectedSeats={selectedSeats} customerName={customerName} customerEmail={customerEmail}  customerPhone={customerPhone} appliedCoupon={appliedCoupon} calculatedFee={calculatedFee} finalTotal={finalTotal} onSuccess={handleOrderSuccess} />
                </Elements>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;