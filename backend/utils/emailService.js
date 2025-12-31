
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
                    <h3 style="margin: 0 0 5px 0; color: #333;">${t.ticketType || 'Ticket'}</h3>
                    <p style="margin: 0; color: #555;"><strong>Seat:</strong> ${t.seatLabel}</p>
                    <p style="margin: 0; color: #555;"><strong>Price:</strong> ${formatCurrency(t.price)}</p>
                    <p style="margin: 5px 0 0 0; font-size: 11px; color: #888;">ID: ${t.id}</p>
                </div>
            </div>
        `;
    }).join('');

    // 1. Email to Customer (Ticket Confirmation)
    const customerHtml = `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4f46e5; text-align: center;">Your Tickets are Here!</h2>
            <p>Hi ${customerName},</p>
            <p>Thank you for your purchase for <strong>${event.title}</strong>.</p>
            
            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Date:</strong> ${dateStr} at ${timeStr}</p>
                <p style="margin: 5px 0;"><strong>Location:</strong> ${event.location || 'See event details'}</p>
                <p style="margin: 5px 0;"><strong>Order ID:</strong> ${order.id}</p>
            </div>

            <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px;">Your Tickets</h3>
            ${ticketsHtml}
            
            <div style="margin-top: 20px; text-align: right;">
                <p><strong>Total Paid: ${formatCurrency(order.totalAmount)}</strong></p>
            </div>

            <p style="margin-top: 30px; font-size: 12px; color: #888; text-align: center;">
                Please present the QR codes above at the venue entrance. Each code is unique to a seat.
            </p>

            <div style="margin-top: 40px; border-top: 1px solid #eee; padding-top: 30px; color: #555;">
                <!-- Important Instructions -->
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #333; margin-bottom: 10px; font-size: 16px;">⚠️ Important Instructions</h3>
                    <ul style="font-size: 14px; line-height: 1.6; padding-left: 20px; color: #444;">
                        <li>Please arrive 30 minutes before the event starts</li>
                        <li>Bring a valid photo ID along with this confirmation</li>
                        <li>Screenshots of this email are acceptable for entry</li>
                        <li>Contact support if you need to make any changes</li>
                    </ul>
                </div>

                <!-- Terms and Conditions -->
                <div style="margin-bottom: 30px; background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
                    <h3 style="color: #333; margin-bottom: 15px; margin-top: 0; font-size: 16px;">Terms and Conditions</h3>
                    <div style="font-size: 11px; line-height: 1.5; color: #666; text-align: justify;">
                        <p style="margin-bottom: 10px;">Please carefully read and understand these terms and conditions before purchasing tickets for this event. By purchasing tickets, you acknowledge and agree to adhere to the following terms and conditions:</p>
                        
                        <p style="margin-bottom: 10px;">
                            <strong style="color: #333;">Ticket Modifications, Cancellations, and Refunds</strong><br/>
                            Tickets purchased for the Event are non-modifiable and non-cancelable. Refunds will be initiated only in the event of cancellation of the Event.
                            In case of Event cancellation, Jay-Ho! will initiate refunds for the face value of the ticket only. Service or transaction fees are non-refundable.
                        </p>

                        <p style="margin-bottom: 10px;">
                            <strong style="color: #333;">Payment Gateway Charges</strong><br/>
                            Payment gateways apply a service fee per ticket purchased, and this fee is directed solely to the payment gateway. Ensure you review the total amount including this fee before making payment.
                        </p>

                        <p style="margin-bottom: 10px;">
                            <strong style="color: #333;">Late Entry and Venue Arrival</strong><br/>
                            The organizers reserve the right to deny late entry to the Event. To ensure seamless entry, we strongly recommend arriving at the venue at least an hour before the scheduled start time of the Event.
                        </p>

                        <p style="margin-bottom: 10px;">
                            <strong style="color: #333;">Event Cancellation/Postponement Refunds</strong><br/>
                            In the event of Event cancellation or postponement, Jay-Ho! will refund only the face value of the ticket. Service or transaction fees are non-refundable.
                        </p>

                        <p style="margin-bottom: 10px;">
                            <strong style="color: #333;">Venue Rules and Entry</strong><br/>
                            Each venue has its own set of rules and regulations. The venue management holds the right to deny entry to individuals who do not comply with these rules.
                        </p>

                         <p style="margin-bottom: 10px;">
                            <strong style="color: #333;">Modification of Terms and Conditions</strong><br/>
                            These terms and conditions are subject to change at the sole discretion of the organizer. Any changes will be effective immediately upon being posted on the official website or communicated through official channels.
                        </p>
                        
                        <p>Please note that your ticket purchase signifies your understanding and acceptance of these terms and conditions.</p>
                    </div>
                </div>

                <!-- Support Footer -->
                <div style="background-color: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 25px; text-align: center;">
                    <p style="font-weight: bold; color: #1f2937; margin: 0 0 5px 0; font-size: 16px;">Thank you for choosing JayHo Tickets!</p>
                    <p style="font-size: 14px; color: #6b7280; margin: 0 0 20px 0;">We're excited to see you at the event. If you have any questions, we're here to help.</p>
                    
                    <div style="font-size: 14px;">
                        <p style="margin: 5px 0;"><span style="color: #4f46e5; font-weight: bold;">Support:</span> <a href="mailto:support@jayhotickets.com" style="color: #4f46e5; text-decoration: none;">support@jayhotickets.com</a></p>
                        <p style="margin: 5px 0;"><span style="color: #374151; font-weight: bold;">Phone:</span> +1 (555) 123-4567</p>
                    </div>
                </div>
            </div>
        </div>
    `;

    await sendEmail(customerEmail, `Your Tickets: ${event.title}`, customerHtml);

    // 2. Email to Organizer (New Sale Alert)
    if (organizerEmail) {
        const organizerHtml = `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #4f46e5;">New Ticket Sale!</h2>
                <p>You have received a new order for <strong>${event.title}</strong>.</p>
                
                <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Customer:</strong> ${customerName} (${customerEmail})</p>
                    <p><strong>Items:</strong> ${order.tickets.length} Ticket(s)</p>
                    <p><strong>Total Revenue:</strong> ${formatCurrency(order.totalAmount)}</p>
                </div>
                
                <p><a href="#">Login to Dashboard</a> to view full details.</p>
            </div>
        `;
        await sendEmail(organizerEmail, `New Sale: ${event.title}`, organizerHtml);
    }
};
