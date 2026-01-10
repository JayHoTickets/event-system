
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Order } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle, Mail, Download } from 'lucide-react';

const Confirmation: React.FC = () => {
  const { state } = useLocation();
  const order = (state as any)?.order as Order;

    // Helper: convert an SVG element to an Image object
    const svgElementToImage = (svgEl: SVGSVGElement) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
            try {
                let svgString = new XMLSerializer().serializeToString(svgEl);
                if (!svgString.includes('xmlns')) {
                    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
                }
                const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    resolve(img);
                };
                img.onerror = (e) => {
                    URL.revokeObjectURL(url);
                    reject(e);
                };
                img.src = url;
            } catch (err) {
                reject(err);
            }
        });
    };

    // Generate a PNG of the ticket area (QR + details) and trigger download
    const downloadTicket = async (ticketId: string) => {
        const wrapper = document.getElementById(`ticket-${ticketId}`);
        if (!wrapper) throw new Error('Ticket element not found');

        const svg = wrapper.querySelector('svg') as SVGSVGElement | null;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported');

        const width = 900;
        const height = 280;
        canvas.width = width;
        canvas.height = height;

        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        // Draw QR from shared order QR element if present
        const sharedSvg = document.querySelector('#order-qr svg') as SVGSVGElement | null;
        if (sharedSvg) {
            const img = await svgElementToImage(sharedSvg);
            const qrSize = 180;
            ctx.drawImage(img, 32, (height - qrSize) / 2, qrSize, qrSize);
        }

        // Read textual details from DOM elements
        const titleEl = wrapper.querySelector('h3');
        const seatEl = wrapper.querySelector('p span.font-semibold')?.parentElement;
        const ticketIdEl = Array.from(wrapper.querySelectorAll('p')).find(p => p.textContent?.includes('Ticket ID'));
        const priceEl = Array.from(wrapper.querySelectorAll('p')).find(p => p.textContent?.includes('Price'));

        const paddingLeft = 240;
        const lineHeight = 28;
        let y = 70;

        ctx.fillStyle = '#0f172a';
        ctx.font = '22px Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
        if (titleEl) {
            ctx.fillText(titleEl.textContent || '', paddingLeft, y);
            y += lineHeight + 8;
        }

        ctx.fillStyle = '#374151';
        ctx.font = '16px Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
        if (seatEl) {
            ctx.fillText(seatEl.textContent || '', paddingLeft, y);
            y += lineHeight;
        }
        if (ticketIdEl) {
            ctx.fillText(ticketIdEl.textContent || '', paddingLeft, y);
            y += lineHeight;
        }
        if (priceEl) {
            ctx.fillText(priceEl.textContent || '', paddingLeft, y);
            y += lineHeight;
        }

        // Footer / order id small
        const orderIdText = `Order: ${order.id}`;
        ctx.fillStyle = '#6b7280';
        ctx.font = '14px Inter, system-ui';
        ctx.fillText(orderIdText, paddingLeft, height - 28);

        // Trigger download
        const dataUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `ticket-${ticketId}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    // Generate a PDF of the entire confirmation content
    const downloadConfirmationPdf = async () => {
        const el = document.getElementById('confirmation-root');
        if (!el) throw new Error('Confirmation element not found');

        // Dynamically import to avoid build errors if packages are missing
        const { default: html2canvas }: any = await import('html2canvas');
        const { jsPDF }: any = await import('jspdf');

        // Hide elements marked for exclusion from PDF
        const excluded = Array.from(document.querySelectorAll('.exclude-from-pdf')) as HTMLElement[];
        const previousDisplays = excluded.map(el => el.style.display);
        try {
            excluded.forEach(el => (el.style.display = 'none'));
            const canvas = await html2canvas(el, { scale: 2, useCORS: true });

            const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const margin = 40; // pts
            const usablePdfWidth = pdfWidth - margin * 2;

            // scale from canvas px to PDF pts
            const scale = usablePdfWidth / canvas.width;
            const totalImgHeightPts = canvas.height * scale;

            // how many px correspond to one PDF page height (usable area)
            const usablePdfHeight = pdfHeight - margin * 2;
            const pageHeightPx = Math.floor(usablePdfHeight / scale);

            let renderedHeight = 0;
            let page = 0;

            while (renderedHeight < canvas.height) {
                const sliceHeight = Math.min(pageHeightPx, canvas.height - renderedHeight);

                // create a page-sized canvas slice
                const pageCanvas = document.createElement('canvas');
                pageCanvas.width = canvas.width;
                pageCanvas.height = sliceHeight;
                const pageCtx = pageCanvas.getContext('2d');
                if (!pageCtx) throw new Error('Canvas not supported');

                pageCtx.drawImage(canvas, 0, renderedHeight, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

                const imgData = pageCanvas.toDataURL('image/png');
                const imgHeightPts = sliceHeight * scale;

                if (page > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', margin, margin, usablePdfWidth, imgHeightPts);

                renderedHeight += sliceHeight;
                page += 1;
            }

            pdf.save(`confirmation-${order.id}.pdf`);
        } finally {
            excluded.forEach((el, i) => (el.style.display = previousDisplays[i] || ''));
        }
    };

  if (!order) {
      return (
          <div className="text-center pt-20">
              <h2 className="text-2xl font-bold">No Order Found</h2>
              <Link to="/" className="text-indigo-600 underline mt-4 block">Return Home</Link>
          </div>
      )
  }

  return (
      <div id="confirmation-root" className="relative max-w-3xl mx-auto px-4 py-12">
      <div className="bg-white rounded-xl shadow-lg border border-green-100 overflow-hidden">
        <div className="bg-green-600 p-8 text-center text-white">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-90" />
            <h1 className="text-3xl font-bold mb-2">Payment Successful!</h1>
            <p className="text-green-100">Order ID: {order.id}</p>
        </div>
        
        <div className="p-8">
            {/* Top-right icon-only PDF download (visible on page, excluded from PDF) */}
            <div className="absolute right-6 top-6 z-20">
                <button
                    onClick={async () => {
                        try {
                            await downloadConfirmationPdf();
                        } catch (err) {
                            console.error('PDF generation failed', err);
                        }
                    }}
                    title="Download Confirmation"
                    className="exclude-from-pdf text-indigo-600 bg-white p-2 rounded-full shadow hover:bg-indigo-50 transition"
                >
                    <Download className="w-5 h-5" />
                </button>
            </div>
            <div className="flex items-center justify-center gap-2 text-slate-600 bg-slate-50 p-4 rounded-lg mb-8 border border-slate-200">
                <Mail className="w-5 h-5 text-indigo-500" />
                <span>Confirmation email sent to your inbox.</span>
            </div>

            {order.couponCode && order.discountApplied > 0 && (
                <div className="mb-6 p-4 rounded bg-green-50 text-green-800 border border-green-100">
                    <strong>Coupon applied:</strong> {order.couponCode} — you saved ${order.discountApplied.toFixed(2)}
                </div>
            )}

            <h2 className="text-xl font-bold text-slate-900 mb-6">Your Tickets</h2>
            
            <div id="order-qr" className="flex items-center justify-center mb-6">
                <div className="bg-white p-3 rounded border border-slate-200 shadow-sm">
                    <QRCodeSVG value={JSON.stringify({ orderId: order.id, tickets: order.tickets.map(t => t.id) })} size={180} />
                </div>
            </div>

            <div className="space-y-6">
                {order.tickets.map(ticket => (
                    <div id={`ticket-${ticket.id}`} key={ticket.id} className="flex flex-col sm:flex-row border-2 border-dashed border-slate-300 rounded-lg p-6 items-center gap-6">
                        <div className="flex-1 text-center sm:text-left">
                            <h3 className="text-lg font-bold text-slate-900">{ticket.eventTitle}</h3>
                            <div className="mt-2 text-slate-600 space-y-1">
                                <p><span className="font-semibold text-slate-800">Seat:</span> {ticket.seatLabel}</p>
                                <p><span className="font-semibold text-slate-800">Ticket ID:</span> {ticket.id}</p>
                                <p><span className="font-semibold text-slate-800">Price:</span> ${ticket.price}</p>
                            </div>
                        </div>
                        {/* <button
                            onClick={async () => {
                                try {
                                    await downloadTicket(ticket.id);
                                } catch (err) {
                                    console.error('Download failed', err);
                                }
                            }}
                            className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-full transition-colors"
                            title="Download Ticket"
                        >
                            <Download className="w-6 h-6" />
                        </button> */}
                    </div>
                ))}
            </div>

            {/* Download helper (client-side only) */}

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
                        <span>Service Fees</span>
                        <span>${order.serviceFee.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between font-bold text-lg text-slate-900 mt-2">
                    <span>Total Paid</span>
                    <span>${order.totalAmount.toFixed(2)}</span>
                </div>
            </div>

            {/* <div className="mt-10 text-center">
                                <div className="flex flex-col sm:flex-row justify-center gap-4">
                                    <button
                                        onClick={async () => {
                                            try {
                                                await downloadConfirmationPdf();
                                            } catch (err) {
                                                console.error('PDF generation failed', err);
                                            }
                                        }}
                                        className="exclude-from-pdf bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-500 transition"
                                    >
                                        Download Confirmation (PDF)
                                    </button>

                                    <Link to="/" className="exclude-from-pdf bg-slate-900 text-white px-8 py-3 rounded-lg font-medium hover:bg-slate-800 transition">
                                        Browse More Events
                                    </Link>
                                </div>
            </div> */}

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
                            In case of Event cancellation, Jay-Ho! will initiate refunds for the face value of the ticket only. Service or transaction fees are non-refundable.
                        </div>

                        <div>
                            <span className="font-semibold block text-slate-700 mb-0.5">Payment Gateway Charges</span>
                            Payment gateways apply a service fee per ticket purchased, and this fee is directed solely to the payment gateway. Ensure you review the total amount including this fee before making payment.
                        </div>

                        <div>
                            <span className="font-semibold block text-slate-700 mb-0.5">Late Entry and Venue Arrival</span>
                            The organizers reserve the right to deny late entry to the Event. To ensure seamless entry, we strongly recommend arriving at the venue at least an hour before the scheduled start time of the Event.
                        </div>

                        <div>
                            <span className="font-semibold block text-slate-700 mb-0.5">Event Cancellation/Postponement Refunds</span>
                            In the event of Event cancellation or postponement, Jay-Ho! will refund only the face value of the ticket. Service or transaction fees are non-refundable.
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
                        <span className="font-medium text-indigo-600">Support: support@jayhotickets.com</span>
                        <span className="hidden sm:inline text-slate-300">|</span>
                        <span className="font-medium text-slate-700">Phone: +1 (555) 123-4567</span>
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default Confirmation;
