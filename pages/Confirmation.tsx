
import React, { useEffect, useState } from 'react';
// Import local ticket stub so bundler serves it from same-origin
import ticketStub from '../assets/white_90 degree.png';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useLocation, Link } from 'react-router-dom';
import { Order } from '../types';
import { formatDateInTimeZone, formatTimeInTimeZone } from '../utils/date';
import { fetchEventById } from '../services/mockBackend';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, Mail, Download } from 'lucide-react';

const Confirmation: React.FC = () => {
  const { state } = useLocation();
  const order = (state as any)?.order as Order;
    const [seatingType, setSeatingType] = useState<string | null>(null);
    const [eventStart, setEventStart] = useState<string | null>(null);
    const [eventTimezone, setEventTimezone] = useState<string | null>(null);
    const [venueName, setVenueName] = useState<string | null>(null);

    useEffect(() => {
        const fetchEvent = async () => {
            try {
                if (!order || !order.tickets || order.tickets.length === 0) return;
                const eventId = order.tickets[0].eventId;
                const data = await fetchEventById(eventId);
                if (!data) return;
                setSeatingType(data.seatingType || null);
                setEventStart(data.startTime || null);
                setEventTimezone(data.timezone || null);
                setVenueName((data as any).venueName || data.location || null);
            } catch (err) {
                // ignore
            }
        };
        fetchEvent();
    }, [order]);

    const handleDownload = async (ticket: any) => {
        try {
            const el = document.getElementById(`ticket-${ticket.id}`);
            if (!el) return;

            // Try to inline images (convert to data URLs) when possible so html2canvas captures them.
            const inlineImagesInElement = async (container: HTMLElement) => {
                const imgs = Array.from(container.getElementsByTagName('img')) as HTMLImageElement[];
                await Promise.all(imgs.map(async (img) => {
                    const src = img.getAttribute('src') || '';
                    if (!src || src.startsWith('data:')) return;
                    try {
                        // Try to inline by fetching through our backend proxy to avoid CORS blocking
                        const apiBase = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) ? import.meta.env.VITE_API_BASE : 'http://localhost:5000';
                        const proxyUrl = `${apiBase.replace(/\/$/, '')}/image-proxy?url=${encodeURIComponent(src)}`;
                        const resp = await fetch(proxyUrl);
                        if (!resp.ok) throw new Error('proxy-failed');
                        const blob = await resp.blob();
                        const dataUrl = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });
                        img.src = dataUrl;
                    } catch (e) {
                        // Couldn't inline (likely CORS); leave original src so it still displays in-browser.
                    }
                }));
            };

            await inlineImagesInElement(el);

            // Wait for any (now inlined or original) images inside the ticket element to finish loading
            const imgs = Array.from(el.getElementsByTagName('img')) as HTMLImageElement[];
            await Promise.all(imgs.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise<void>(resolve => {
                    img.onload = () => resolve();
                    img.onerror = () => resolve();
                });
            }));

            const canvas = await html2canvas(el, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const imgProps = (pdf as any).getImageProperties(imgData);
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`ticket-${ticket.id}.pdf`);
        } catch (err) {
            // silent fail for now
            console.error('Download failed', err);
        }
    };

  if (!order) {
      return (
          <div className="text-center pt-20">
              <h2 className="text-2xl font-bold">No Order Found</h2>
              <Link to="/" className="text-black underline mt-4 block">Return Home</Link>
          </div>
      )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="bg-white rounded-xl shadow-lg border border-green-100 overflow-hidden">
        <div className="bg-green-600 p-8 text-center text-white">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-90" />
            <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
            <p className="text-green-100">Order ID: {order.id}</p>
        </div>
        
        <div className="p-8">
            <div className="flex items-center justify-center gap-2 text-slate-600 bg-slate-50 p-4 rounded-lg mb-8 border border-slate-200">
                <Mail className="w-5 h-5 text-[#d7ae4b]" />
                <span>Confirmation email sent to your inbox.</span>
            </div>

            {order.couponCode && order.discountApplied > 0 && (
                <div className="mb-6 p-4 rounded bg-green-50 text-green-800 border border-green-100">
                    <strong>Coupon applied:</strong> {order.couponCode} — you saved ${order.discountApplied.toFixed(2)}
                </div>
            )}

            <h2 className="text-xl font-bold text-slate-900 mb-6">Your Tickets</h2>
            
            <div className="space-y-6">
                    {order.tickets.map(ticket => (
                        <div id={`ticket-${ticket.id}`} key={ticket.id} className="flex flex-col sm:flex-row border-2 rounded-lg overflow-hidden shadow-sm">
                            {/* Left stub column */}
                            <div className="flex items-center justify-center bg-[#d7ae4b] p-3">
                                <img src={ticketStub} alt="Ticket stub" className="w-40 h-16 sm:w-16 sm:h-40 object-contain rotate-90 sm:rotate-0" />
                            </div>
                            {/* Vertical dashed separator */}
                            <div className="hidden sm:block border-r-2 border-dashed border-slate-200" />
                            {/* QR and details area */}
                            <div className="flex flex-1 flex-col sm:flex-row items-center sm:items-start gap-6 p-6 bg-white">
                                <div className="bg-white p-2 rounded border border-slate-200 shadow-sm flex-shrink-0">
                                    {/* Value is ticket.id which acts as QR data */}
                                    <QRCodeSVG value={ticket.id} size={120} />
                                </div>
                                <div className="flex-1 text-center sm:text-left">
                            <h3 className="text-lg font-bold text-slate-900">{ticket.eventTitle}</h3>
                            {eventStart && (
                                <div className="text-sm text-slate-500 mt-1">
                                    <div>{formatDateInTimeZone(eventStart, eventTimezone)} {eventTimezone ? `• ${formatTimeInTimeZone(eventStart, eventTimezone)}` : ''}</div>
                                    <div className="font-medium text-slate-700">{venueName || 'Unknown Venue'}</div>
                                </div>
                            )}
                            <div className="mt-2">
                                {ticket.color && (
                                    <span className="inline-block w-4 h-4 rounded-sm mr-2 align-middle" style={{ backgroundColor: ticket.color, border: '1px solid rgba(0,0,0,0.06)' }} />
                                )}
                                <span className="text-sm text-slate-600">{ticket.ticketType || 'Standard'}</span>
                            </div>
                            <div className="mt-2 text-slate-600 space-y-1">
                                {seatingType === 'RESERVED' && (
                                    <p><span className="font-semibold text-slate-800">Seat:</span> {ticket.seatLabel}</p>
                                )}
                                <p><span className="font-semibold text-slate-800">Ticket ID:</span> {ticket.id}</p>
                                <p><span className="font-semibold text-slate-800">Price:</span> ${ticket.price}</p>
                            </div>
                        </div>
                        <button onClick={async () => await handleDownload(ticket)} className="text-black hover:bg-[#d7ae4b] p-2 rounded-full transition-colors" title="Download Ticket">
                            <Download className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                ))}
            </div>

            <div className="mt-10 border-t pt-6">
                <div className="flex justify-between text-slate-500 text-sm mb-1">
                    <span>Subtotal</span>
                    <span>${(order.totalAmount - (order.serviceFee || 0) + (order.discountApplied || 0)).toFixed(2)}</span>
                </div>
                {order.discountApplied > 0 && (
                     <div className="flex justify-between text-green-600 text-sm mb-1">
                        <span>Discount</span>
                        <span>-${order.discountApplied.toFixed(2)}</span>
                    </div>
                )}
                {order.serviceFee > 0 && (
                     <div className="flex justify-between text-slate-500 text-sm mb-1">
                        <span>Booking Fee</span>
                        <span>${order.serviceFee.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between font-bold text-lg text-slate-900 mt-2">
                    <span>Total Paid</span>
                    <span>${order.totalAmount.toFixed(2)}</span>
                </div>
            </div>

            <div className="mt-10 text-center">
                {/* <Link to="/" className="bg-slate-900 text-white px-8 py-3 rounded-lg font-medium hover:bg-slate-800 transition">
                    Browse More Events
                </Link> */}
            </div>

            {/* Footer Information */}
            <div className="mt-12 pt-8 border-t border-slate-200 text-slate-600">
                <div className="mb-8">
                    <h3 className="font-bold text-slate-900 mb-3 flex items-center">
                        <span className="mr-2">⚠️</span> Important Instructions
                    </h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                        <li>Please arrive 30 minutes before the event starts</li>
                        <li>Bring a valid photo ID along with this confirmation</li>
                        <li>Screenshots of this email are acceptable for entry</li>
                        <li>Contact support if you need to make any changes</li>
                    </ul>
                </div>

                <div className="mb-8">
                    <h3 className="font-bold text-slate-900 mb-3">Terms and Conditions</h3>
                    <div className="text-xs text-slate-500 space-y-3 text-justify leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <p>Please carefully read and understand these terms and conditions before purchasing tickets for this event. By purchasing tickets, you acknowledge and agree to adhere to the following terms and conditions:</p>
                        
                        <div>
                            <span className="font-semibold block text-slate-700 mb-0.5">Ticket Modifications, Cancellations, and Refunds</span>
                            Tickets purchased for the Event are non-modifiable and non-cancelable. Refunds will be initiated only in the event of cancellation of the Event.
                            In case of Event cancellation, Jay-Ho! will initiate refunds for the face value of the ticket only. Booking or transaction fees are non-refundable.
                        </div>

                        <div>
                            <span className="font-semibold block text-slate-700 mb-0.5">Payment Gateway Charges</span>
                            Payment gateways apply a booking fee per ticket purchased, and this fee is directed solely to the payment gateway. Ensure you review the total amount including this fee before making payment.
                        </div>

                        <div>
                            <span className="font-semibold block text-slate-700 mb-0.5">Late Entry and Venue Arrival</span>
                            The organizers reserve the right to deny late entry to the Event. To ensure seamless entry, we strongly recommend arriving at the venue at least an hour before the scheduled start time of the Event.
                        </div>

                        <div>
                            <span className="font-semibold block text-slate-700 mb-0.5">Event Cancellation/Postponement Refunds</span>
                            In the event of Event cancellation or postponement, Jay-Ho! will refund only the face value of the ticket. Booking or transaction fees are non-refundable.
                        </div>

                        <div>
                            <span className="font-semibold block text-slate-700 mb-0.5">Venue Rules and Entry</span>
                            Each venue has its own set of rules and regulations. The venue management holds the right to deny entry to individuals who do not comply with these rules.
                        </div>

                         <div>
                            <span className="font-semibold block text-slate-700 mb-0.5">Modification of Terms and Conditions</span>
                            These terms and conditions are subject to change at the sole discretion of the organizer. Any changes will be effective immediately upon being posted on the official website or communicated through official channels.
                        </div>
                        
                        <p className="mt-2 italic">Please note that your ticket purchase signifies your understanding and acceptance of these terms and conditions.</p>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-6 text-center border border-slate-200">
                    <p className="font-bold text-slate-800 mb-1">Thank you for choosing JayHo Tickets!</p>
                    <p className="text-sm text-slate-500 mb-4">We're excited to see you at the event. If you have any questions, we're here to help.</p>
                    
                    <div className="flex flex-col sm:flex-row justify-center gap-4 text-sm">
                        <span className="font-medium text-[#d7ae4b">Support: Jayho@jay-ho.com</span>
                        <span className="hidden sm:inline text-slate-300">|</span>
                        <span className="font-medium text-slate-700">Phone: +1 (339) 245-8655</span>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default Confirmation;