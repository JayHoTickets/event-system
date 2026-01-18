
const SibApiV3Sdk = require('sib-api-v3-sdk');

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

const sendEmail = async (to, subject, htmlContent) => {
    if (!process.env.BREVO_API_KEY) {
        console.warn("BREVO_API_KEY is missing. Email not sent.");
        return;
    }

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.sender = { "name": "Jay-Ho! Tickets", "email": "noreply@jayhotickets.com" };
    sendSmtpEmail.to = [{ "email": to }];

    try {
        await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`Email sent successfully to ${to}`);
    } catch (error) {
        console.error(`Error sending email to ${to}:`, error);
    }
};

const formatCurrency = (amount) => `$${amount.toFixed(2)}`;

exports.sendOrderEmails = async ({ order, event, customerName, customerEmail, organizerEmail, adminEmail }) => {
    const dateStr = new Date(event.startTime).toLocaleDateString();
    const timeStr = new Date(event.startTime).toLocaleTimeString();

    // Generate Ticket List with QR Codes
    const ticketsHtml = order.tickets.map(t => {
        // Public API for QR Code generation (Use a secure internal service in production)
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(t.id)}`;
        
        return `
            <div style="border: 2px dashed #ccc; padding: 20px; margin-bottom: 20px; border-radius: 8px; display: flex; align-items: center;">
                <div style="margin-right: 20px;">
                    <img src="${qrUrl}" alt="QR Code" width="120" height="120" />
                </div>
                <div>
                    <h3 style="margin: 0 0 5px 0; color: #333; display:flex; align-items:center; gap:8px;">
                        ${t.color ? `<span style="width:14px;height:14px;display:inline-block;border-radius:3px;background:${t.color};border:1px solid rgba(0,0,0,0.08);"></span>` : ''}
                        ${t.ticketType || 'Ticket'}
                    </h3>
                    <p style="margin: 0 0 6px 0; color: #555;"><strong>Event:</strong> ${event.title}</p>
                    <p style="margin: 0; color: #555;"><strong>Seat:</strong> ${t.seatLabel}</p>
                    <p style="margin: 0; color: #555;"><strong>Price:</strong> ${formatCurrency(t.price)}</p>
                    <p style="margin: 5px 0 0 0; font-size: 11px; color: #888;">ID: ${t.id}</p>
                </div>
            </div>
        `;
    }).join('');

    // Shared renderer to produce the same formatted email for any recipient
    const renderCommonHtml = ({ headline, introHtml = '', includeCustomerInfo = false, showCoupon = true }) => `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 680px; margin: 0 auto;">
            <div style="background:#16a34a;padding:28px 18px;text-align:center;color:#fff;border-top-left-radius:8px;border-top-right-radius:8px;">
                <div style="font-size:44px;line-height:1;margin-bottom:6px;">✅</div>
                <h1 style="margin:0;font-size:28px;font-weight:700;">${headline}</h1>
                <p style="margin:6px 0 0 0;color:rgba(255,255,255,0.9);">Order ID: ${order.id}</p>
            </div>

            <div style="background:#fff;padding:24px;border:1px solid #e6e6e6;border-bottom-left-radius:8px;border-bottom-right-radius:8px;">

                ${introHtml}

                ${includeCustomerInfo ? `<p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>` : `<p>Thanks for purchasing tickets to <strong>${event.title}</strong>.</p>`}

                <div style="background:#f3f4f6;padding:12px;border-radius:8px;margin:18px 0;">
                    <p style="margin:6px 0;"><strong>Date:</strong> ${dateStr} at ${timeStr}</p>
                    <p style="margin:6px 0;"><strong>Location:</strong> ${event.location || 'See event details'}</p>
                    <p style="margin:6px 0;"><strong>Order ID:</strong> ${order.id}</p>
                </div>

                ${showCoupon && order.couponCode && order.discountApplied > 0 ? `<div style="margin-bottom:12px;padding:10px;border-radius:6px;background:#ecfdf5;color:#065f46;border:1px solid #bbf7d0;"><strong>Coupon applied:</strong> ${order.couponCode} — you saved ${formatCurrency(order.discountApplied)}</div>` : ''}

                <h3 style="font-size:18px;margin:14px 0;border-bottom:1px solid #eee;padding-bottom:10px;color:#111;">Your Tickets</h3>

                ${ticketsHtml}

                <div style="margin-top:18px;border-top:1px solid #eee;padding-top:14px;color:#374151;">
                    <div style="display:flex;justify-content:space-between;font-size:14px;color:#6b7280;margin-bottom:6px;">
                        <span>Subtotal</span>
                        <span>${formatCurrency((order.totalAmount || 0) - (order.serviceFee || 0) + (order.discountApplied || 0))}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px;">
                        <span style="color:#059669">Discount</span>
                        <span style="color:#059669">-${formatCurrency(order.discountApplied || 0)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:14px;color:#6b7280;margin-bottom:6px;">
                        <span>Booking Fee</span>
                        <span>${formatCurrency(order.serviceFee || 0)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-weight:800;font-size:18px;color:#111;margin-top:8px;">
                        <span>Total Paid</span>
                        <span>${formatCurrency(order.totalAmount || 0)}</span>
                    </div>
                </div>

                <div style="margin-top:22px;">
                    <h4 style="margin:0 0 8px 0;color:#111;font-size:16px;">⚠️ Important Instructions</h4>
                    <ul style="padding-left:18px;color:#444;font-size:13px;line-height:1.6;margin-top:8px;">
                        <li>Please arrive 30 minutes before the event starts</li>
                        <li>Bring a valid photo ID along with this confirmation</li>
                        <li>Screenshots of this email are acceptable for entry</li>
                        <li>Contact support if you need to make any changes</li>
                    </ul>
                </div>

                <div style="margin-top:18px;">
                    <h3 style="font-size:16px;margin:0 0 8px 0;color:#111;font-weight:700;">Terms and Conditions</h3>
                    <div style="font-size:12px;color:#666;line-height:1.5;text-align:justify;background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #eef2f7;">
                        <p>Please carefully read and understand these terms and conditions before purchasing tickets for this event. By purchasing tickets, you acknowledge and agree to adhere to the following terms and conditions:</p>

                        <div style="margin-top:8px;">
                            <strong style="display:block;color:#111;margin-bottom:4px;">Ticket Modifications, Cancellations, and Refunds</strong>
                            Tickets purchased for the Event are non-modifiable and non-cancelable. Refunds will be initiated only in the event of cancellation of the Event. In case of Event cancellation, Jay-Ho! will initiate refunds for the face value of the ticket only. Booking or transaction fees are non-refundable.
                        </div>

                        <div style="margin-top:10px;">
                            <strong style="display:block;color:#111;margin-bottom:4px;">Payment Gateway Charges</strong>
                            Payment gateways apply a booking fee per ticket purchased, and this fee is directed solely to the payment gateway. Ensure you review the total amount including this fee before making payment.
                        </div>

                        <div style="margin-top:10px;">
                            <strong style="display:block;color:#111;margin-bottom:4px;">Late Entry and Venue Arrival</strong>
                            The organizers reserve the right to deny late entry to the Event. To ensure seamless entry, we strongly recommend arriving at the venue at least an hour before the scheduled start time of the Event.
                        </div>

                        <div style="margin-top:10px;">
                            <strong style="display:block;color:#111;margin-bottom:4px;">Event Cancellation/Postponement Refunds</strong>
                            In the event of Event cancellation or postponement, Jay-Ho! will refund only the face value of the ticket. Booking or transaction fees are non-refundable.
                        </div>

                        <div style="margin-top:10px;">
                            <strong style="display:block;color:#111;margin-bottom:4px;">Venue Rules and Entry</strong>
                            Each venue has its own set of rules and regulations. The venue management holds the right to deny entry to individuals who do not comply with these rules.
                        </div>

                        <div style="margin-top:10px;">
                            <strong style="display:block;color:#111;margin-bottom:4px;">Modification of Terms and Conditions</strong>
                            These terms and conditions are subject to change at the sole discretion of the organizer. Any changes will be effective immediately upon being posted on the official website or communicated through official channels.
                        </div>

                        <p style="margin-top:8px;font-style:italic;">Please note that your ticket purchase signifies your understanding and acceptance of these terms and conditions.</p>
                    </div>
                </div>

                <div style="margin-top:20px;background:#f3f4f6;border-radius:8px;padding:18px;text-align:center;border:1px solid #e6e6e6;">
                    <p style="margin:0;font-weight:700;color:#111;">Thank you for choosing JayHo Tickets!</p>
                    <p style="margin:6px 0 0 0;color:#6b7280;font-size:13px;">We're excited to see you at the event. If you have any questions, we're here to help.</p>
                    <div style="margin-top:10px;color:#374151;font-size:13px;">
                        <span style="display:block;margin-bottom:6px;color:#4f46e5;font-weight:600;">Support: <a href="mailto:support@jayhotickets.com" style="color:#4f46e5;text-decoration:none;">support@jayhotickets.com</a></span>
                        <span style="display:block;color:#374151;">Phone: +1 (555) 123-4567</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Normalize organizer display name (fallbacks if not present)
    const organizerDisplayName = event.organizer || event.organizerName || (organizerEmail ? organizerEmail.split('@')[0] : 'Organizer');

    // Customer greeting
    const customerIntro = `<p>Hi ${customerName}, your order for ${event.title} has been received.</p>`;

    // Organizer greeting
    const organizerIntro = `<p>Hi Organizer, you have received an order for ${event.title}.</p>`;

    // Admin greeting includes organizer name
    const adminIntro = `<p>Hi Admin, ${organizerDisplayName} has received an order for ${event.title}.</p>`;

    // Send customer email (same shared template, customized greeting)
    await sendEmail(customerEmail, `Your Tickets: ${event.title}`, renderCommonHtml({ headline: 'Payment Successful!', introHtml: customerIntro, includeCustomerInfo: false }));

    // Send organizer email (shared template)
    if (organizerEmail) {
        await sendEmail(organizerEmail, `New Sale: ${event.title}`, renderCommonHtml({ headline: 'New Ticket Sale!', introHtml: organizerIntro, includeCustomerInfo: true }));
    }

    // Send admin email (shared template)
    if (adminEmail) {
        await sendEmail(adminEmail, `New Order: ${event.title}`, renderCommonHtml({ headline: 'New Ticket Sale (Admin)', introHtml: adminIntro, includeCustomerInfo: true }));
    }
};
