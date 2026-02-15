
const SibApiV3Sdk = require('sib-api-v3-sdk');
const { DateTime } = require('luxon');

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
    let dateStr = '';
    let timeStr = '';
    try {
        // Try to create a Luxon DateTime from the stored value. The
        // event.startTime may be a string or a Date; handle both.
        let dt = null;
        const jsDate = event.startTime ? new Date(event.startTime) : null;
        if (jsDate && !isNaN(jsDate.getTime())) {
            dt = DateTime.fromJSDate(jsDate);
        } else if (event.startTime) {
            const iso = DateTime.fromISO(String(event.startTime));
            if (iso.isValid) dt = iso;
        }

        // If a timezone was provided, attempt to apply it but only
        // accept the result if it's valid — otherwise fall back to
        // the parsed DateTime (or JS Date below).
        if (dt && event.timezone) {
            const withZone = dt.setZone(event.timezone);
            if (withZone.isValid) dt = withZone;
        }

        if (dt && dt.isValid) {
            dateStr = dt.toLocaleString(DateTime.DATE_MED);
            timeStr = dt.toLocaleString(DateTime.TIME_SIMPLE);
        } else {
            // Final fallback to plain JS Date formatting
            const fallback = new Date(event.startTime);
            dateStr = isNaN(fallback.getTime()) ? 'Unknown date' : fallback.toLocaleDateString();
            timeStr = isNaN(fallback.getTime()) ? 'Unknown time' : fallback.toLocaleTimeString();
        }
    } catch (e) {
        const fallback = new Date(event.startTime);
        dateStr = isNaN(fallback.getTime()) ? 'Unknown date' : fallback.toLocaleDateString();
        timeStr = isNaN(fallback.getTime()) ? 'Unknown time' : fallback.toLocaleTimeString();
    }

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
                    ${event.seatingType === 'RESERVED' ? `<p style="margin: 0; color: #555;"><strong>Seat:</strong> ${t.seatLabel}</p>` : ''}
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
                        <ul style="margin:0;padding-left:18px;">
                            <li><strong>No Refunds or Exchanges:</strong> All ticket purchases are final. Tickets are non-refundable and non-transferable unless explicitly stated otherwise by the event organizer.</li>
                            <li><strong>Service Fees Non-Refundable:</strong> Any service fees or transaction fees charged by Jay-Ho! are non-refundable, even if the event is canceled or rescheduled by the organizer.</li>
                            <li><strong>Event Changes:</strong> The event organizer reserves the right to alter the schedule, performers, or venue without prior notice. Jay-Ho! is not liable for such changes.</li>
                            <li><strong>Organizer’s Contact Information:</strong> For questions or concerns related to this event, please contact the event organizer directly at the contact information provided on the event page.</li>
                            <li><strong>Lost Tickets:</strong> Jay-Ho! and the event organizer are not responsible for lost, stolen, or damaged tickets.</li>
                            <li><strong>Valid ID Required:</strong> Entry may be subject to verification with a valid government-issued photo ID matching the ticket holder’s name, as required by the event organizer.</li>
                            <li><strong>Venue Rules:</strong> Venue-specific rules (such as no re-entry, prohibited items, or security checks) will apply and must be followed.</li>
                            <li><strong>Late Entry:</strong> Late arrivals may be seated at a suitable break in the performance, as determined by the event staff.</li>
                            <li><strong>Health and Safety:</strong> Attendees must comply with all health and safety protocols required by the event organizer and venue.</li>
                            <li><strong>Rights of Admission Reserved:</strong> The event organizer and venue reserve the right to refuse admission to anyone without explanation.</li>
                            <li><strong>Prohibited Items:</strong> Weapons, alcohol, fireworks, and any illegal substances are not permitted on the premises.</li>
                            <li><strong>Digital Ticket Disclaimer:</strong> Entry is only guaranteed with valid digital or physical tickets issued through Jay-Ho!. Screenshots or altered tickets may be rejected.</li>
                            <li><strong>Transfer Policy Disclaimer:</strong> Ticket transferability is subject to the event organizer’s policies. Jay-Ho! cannot guarantee the acceptance of transferred tickets at the venue.</li>
                            <li><strong>Force Majeure Clause:</strong> Jay-Ho! and the event organizer are not responsible for delays, changes, or cancellations caused by circumstances beyond reasonable control, including weather, natural disasters, government actions, or public health emergencies.</li>
                            <li><strong>Limit of Liability:</strong> Jay-Ho!’s liability is strictly limited to the face value of the ticket purchased, excluding any fees, and only where legally required.</li>
                            <li><strong>Responsibility for Disputes:</strong> Any disputes regarding the event, its quality, schedule, or artist performance must be resolved directly with the event organizer. Jay-Ho! will not mediate or be involved in such disputes.</li>
                            <li><strong>Acceptance of Organizer Terms:</strong> By purchasing a ticket, you also agree to abide by the event organizer’s terms and conditions, which may include additional requirements.</li>
                        </ul>
                    </div>
                </div>

                <div style="margin-top:20px;background:#f3f4f6;border-radius:8px;padding:18px;text-align:center;border:1px solid #e6e6e6;">
                    <p style="margin:0;font-weight:700;color:#111;">Thank you for choosing JayHo Tickets!</p>
                    <p style="margin:6px 0 0 0;color:#6b7280;font-size:13px;">We're excited to see you at the event. If you have any questions, we're here to help.</p>
                    <div style="margin-top:10px;color:#374151;font-size:13px;">
                        <span style="display:block;margin-bottom:6px;color:#4f46e5;font-weight:600;">Support: <a href="mailto:Jayho@jay-ho.com" style="color:#4f46e5;text-decoration:none;">Jayho@jay-ho.com</a></span>
                        <span style="display:block;color:#374151;">Phone: +1 (339) 245-8655</span>
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

exports.sendCancellationEmails = async ({ order, event, organizerEmail, adminEmail }) => {
    const formatCurrency = (amount) => `$${(amount || 0).toFixed(2)}`;
    const subject = `Order Cancelled: ${event.title} — ${order.id}`;
    const body = `
        <div style="font-family: Arial, sans-serif; max-width:680px;margin:0 auto;color:#333;">
            <div style="background:#ef4444;color:#fff;padding:18px;border-radius:8px;">
                <h2 style="margin:0">Order Cancelled</h2>
                <p style="margin:6px 0 0 0">Order ID: ${order.id}</p>
            </div>
            <div style="background:#fff;padding:18px;border:1px solid #eee;border-radius:8px;margin-top:12px;">
                <p><strong>Event:</strong> ${event.title}</p>
                <p><strong>Cancellation Status:</strong> CANCELLED</p>
                <p><strong>Refund Amount:</strong> ${formatCurrency(order.refundAmount)}</p>
                <p><strong>Notes:</strong> ${order.cancellationNotes || 'N/A'}</p>
                <h4 style="margin-top:12px">Tickets</h4>
                ${order.tickets.map(t => `<div style="padding:8px;border:1px solid #f3f4f6;margin-bottom:8px;border-radius:6px;"><strong>${t.seatLabel}</strong> — ID: ${t.id}</div>`).join('')}
            </div>
        </div>
    `;

    if (order.customerEmail) {
        await sendEmail(order.customerEmail, subject, body);
    }
    if (organizerEmail) {
        await sendEmail(organizerEmail, `Order Cancelled: ${order.id}`, body);
    }
    if (adminEmail) {
        await sendEmail(adminEmail, `Order Cancelled: ${order.id}`, body);
    }
};
