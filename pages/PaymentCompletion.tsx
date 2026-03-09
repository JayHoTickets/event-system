import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Event, Order, PaymentMode } from '../types';
import { completePaymentPendingOrder, fetchEventById, fetchOrderById } from '../services/mockBackend';
import { AlertTriangle, CheckCircle, CreditCard, ArrowLeft } from 'lucide-react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_51Npw4pKUXa8cL1IH4peMAyX0L2VQZfdd3geTwYivtTZUDtCE83NcGuP3vibkB8ndW6vhOzzDOLTtNTfGbzeJFC1600s4Jkldwa');

interface PaymentFormProps {
    orderId: string;
    onSuccess: (transactionId: string) => Promise<void>;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ orderId, onSuccess }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setProcessing(true);
        setError(null);

        try {
            // In a real scenario, you would create a payment intent on the backend
            // For now, we'll simulate a successful payment
            const cardElement = elements.getElement(CardElement);
            if (!cardElement) throw new Error("Card Element not found");

            // Create a token for testing (in production, use payment intents)
            const { token, error: tokenError } = await stripe.createToken(cardElement);
            
            if (tokenError) {
                setError(tokenError.message || "Payment failed");
                setProcessing(false);
                return;
            }

            if (token) {
                // Call backend to complete the payment
                await onSuccess(token.id);
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
            <button
                type="submit"
                disabled={!stripe || processing}
                className="w-full mt-4 bg-black text-white py-3 rounded-lg font-bold shadow-lg hover:bg-[#d7ae4b] hover:text-black transition-colors flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
            >
                {processing ? (
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                    `Complete Payment`
                )}
            </button>
            <div className="flex justify-center items-center gap-2 mt-4 opacity-50 grayscale">
                <img src="https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg" alt="Stripe" className="h-6" />
            </div>
        </form>
    );
};

const PaymentCompletion: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState<Order | null>(null);
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const orderId = searchParams.get('orderId');
    const eventId = searchParams.get('eventId');

    useEffect(() => {
        const loadData = async () => {
            try {
                if (!orderId || !eventId) {
                    setError('Invalid payment link. Missing order or event information.');
                    setLoading(false);
                    return;
                }

                // Load event data
                const eventData = await fetchEventById(eventId);
                if (eventData) setEvent(eventData);

                // Load order data (this requires backend support)
                try {
                    const orderData = await fetchOrderById(orderId);
                    if (orderData) {
                        setOrder(orderData);
                        // Check if order is still valid (not expired, not already paid)
                        if (orderData.status === 'PAID') {
                            setError('This order has already been paid. Please check your confirmation email.');
                        } else if (orderData.status === 'CANCELLED') {
                            setError('This order has been cancelled. The seats have been released.');
                        } else if (orderData.paymentPendingUntil) {
                            const deadline = new Date(orderData.paymentPendingUntil);
                            const now = new Date();
                            if (deadline < now) {
                                setError('This hold has expired. Please contact support to rebook.');
                            }
                        }
                    }
                } catch (err: any) {
                    // If order fetch fails, check if it's an invalid ID format
                    if (err.message && err.message.includes('Invalid')) {
                        setError('Invalid payment link format. Please check your email and try again.');
                    } else if (err.message && err.message.includes('not found')) {
                        setError('Order not found. Please contact support with your order details.');
                    } else {
                        // Silent fail - let user proceed with payment, order will be fetched on submit
                        console.log('Order not found in initial load:', err.message);
                    }
                }

                setLoading(false);
            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Failed to load payment information');
                setLoading(false);
            }
        };

        loadData();
    }, [orderId, eventId]);

    const handlePaymentSuccess = async (transactionId: string) => {
        try {
            setProcessing(true);
            setError(null);

            if (!orderId) {
                setError('Order ID is missing');
                setProcessing(false);
                return;
            }

            // Complete the payment-pending order
            const response = await completePaymentPendingOrder(orderId, PaymentMode.ONLINE, transactionId);
            
            if (response && response.success) {
                // Redirect to confirmation page
                setTimeout(() => {
                    navigate('/confirmation', {
                        state: {
                            order: response.order,
                            message: 'Payment successful! Your tickets have been issued.'
                        }
                    });
                }, 1500);
            } else {
                setError(response?.message || 'Failed to complete payment');
                setProcessing(false);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to complete payment');
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-slate-300 border-t-black rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading payment information...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header with back button */}
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center text-slate-600 hover:text-slate-900 mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Home
                </button>

                {/* Main content */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-8 text-white">
                        <h1 className="text-3xl font-bold mb-2">Complete Payment</h1>
                        <p className="text-indigo-100">Pay for your event tickets</p>
                    </div>

                    {/* Content */}
                    <div className="p-8">
                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="font-semibold text-red-900">{error}</p>
                                    {error.includes('expired') && (
                                        <p className="text-sm text-red-700 mt-1">
                                            Please contact support or place a new hold on the seats you want.
                                        </p>
                                    )}
                                    {error.includes('Invalid') || error.includes('not found') && (
                                        <div className="text-sm text-red-700 mt-2">
                                            <p className="font-semibold mb-1">Here's what you can do:</p>
                                            <ol className="list-decimal list-inside space-y-1">
                                                <li>Check that you're using the link from your email</li>
                                                <li>Copy the entire URL carefully without adding spaces</li>
                                                <li>If the issue persists, contact support with:</li>
                                            </ol>
                                            <div className="bg-red-100 rounded p-2 mt-2 font-mono text-xs">
                                                Order ID: {orderId}
                                            </div>
                                        </div>
                                    )}
                                    {error.includes('already been paid') && (
                                        <p className="text-sm text-red-700 mt-1">
                                            Please check your email for confirmation and download your tickets.
                                        </p>
                                    )}
                                    {error.includes('cancelled') && (
                                        <p className="text-sm text-red-700 mt-1">
                                            Please place a new hold if you wish to purchase these seats again.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {event && (
                            <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <h3 className="font-semibold text-slate-900 mb-2">{event.title}</h3>
                                <p className="text-sm text-slate-600">{event.location}</p>
                            </div>
                        )}

                        {order && !error && (
                            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-900">
                                    <span className="font-semibold">Order Amount:</span> ${order.totalAmount?.toFixed(2) || '0.00'}
                                </p>
                                <p className="text-sm text-blue-700 mt-1">
                                    You have until <span className="font-semibold">{new Date(order.paymentPendingUntil || Date.now()).toLocaleString()}</span> to complete this payment.
                                </p>
                            </div>
                        )}

                        {!error && !processing && (
                            <Elements stripe={stripePromise}>
                                <PaymentForm orderId={orderId || ''} onSuccess={handlePaymentSuccess} />
                            </Elements>
                        )}

                        {processing && (
                            <div className="text-center py-12">
                                <div className="w-12 h-12 border-4 border-slate-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
                                <p className="text-slate-600">Processing your payment...</p>
                            </div>
                        )}

                        {error && error.includes('already been paid') && (
                            <div className="text-center py-8">
                                <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                                <p className="text-slate-600">Please check your email for your confirmation and tickets.</p>
                                <button
                                    onClick={() => navigate('/confirmation')}
                                    className="mt-4 px-6 py-2 bg-black text-white rounded-lg hover:bg-[#d7ae4b] hover:text-black transition-colors"
                                >
                                    View Confirmation
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="bg-slate-50 px-8 py-4 border-t border-slate-200">
                        <p className="text-xs text-slate-600 text-center">
                            Your payment is secure and processed by Stripe. We never store your card details.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentCompletion;
