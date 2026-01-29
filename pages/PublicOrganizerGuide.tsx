import React from 'react';

const PublicOrganizerGuide: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold mb-4">Organizer Platform — Public Guide</h1>

      <p className="mb-6">This public guide explains how an organizer can create events, check orders, and view event analysis in the organizer platform.</p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">How to Create an Event</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li><strong>Open Organizer Dashboard:</strong> Sign in as an organizer and navigate to the Organizer Dashboard.</li>
          <li><strong>Start New Event:</strong> Click the <em>Create Event</em> (or <em>New Event</em>) button.</li>
          <li><strong>Basic Details:</strong> Fill in Event Title, Description, Start/End Date &amp; Time, and Category.</li>
          <li><strong>Venue &amp; Theater:</strong> Select the venue and theater. Use the Theater Builder to configure seating layout and sections if needed.</li>
          <li><strong>Seating &amp; Capacity:</strong> Configure seat map or general admission capacity; set seat categories (VIP, General).</li>
          <li><strong>Ticket Types &amp; Pricing:</strong> Add ticket types (name, price, quantity, per-ticket fees) and availability windows.</li>
          <li><strong>Service Charges &amp; Taxes:</strong> Add service charges or taxes applied to purchases.</li>
          <li><strong>Coupons &amp; Discounts (optional):</strong> Attach or create coupon codes for buyers.</li>
          <li><strong>Uploads:</strong> Add featured images and attachments (seat maps, flyers).</li>
          <li><strong>Preview &amp; Publish:</strong> Preview the listing, then Publish or save as Draft.</li>
        </ul>
        <p className="mt-3 text-sm text-gray-600">Tip: Keep descriptions clear and verify seating and pricing via preview.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">How to Check Orders for an Event</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li><strong>Go to Orders / Sales:</strong> From the Organizer Dashboard, open Orders or Sales.</li>
          <li><strong>Filter by Event:</strong> Use filters to select the specific event, date range, or ticket type.</li>
          <li><strong>Order List:</strong> View order ID, purchaser name/email, tickets purchased, gross amount, fees, and status.</li>
          <li><strong>View Order Details:</strong> Click an order to see contact info, payment method, ticket codes/QRs, and refund status.</li>
          <li><strong>Manage Refunds/Exchanges:</strong> Issue refunds or exchanges if supported.</li>
          <li><strong>Export Orders:</strong> Export filtered orders to CSV for reconciliation.</li>
        </ul>
        <p className="mt-3 text-sm text-gray-600">Common actions: search by order ID or purchaser email; re-send tickets from the order detail page.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-3">How to View Event Analysis</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li><strong>Open Analytics/Reports:</strong> From the Organizer Dashboard, open Analytics, Reports, or Event Insights.</li>
          <li><strong>Select Event &amp; Timeframe:</strong> Choose event and timeframe to analyze.</li>
          <li><strong>Key Metrics:</strong> Tickets Sold, Gross Revenue, Net Revenue, Average Order Value, Sales Over Time, Ticket Type Breakdown, Top Promo Performance.</li>
          <li><strong>Attendee Demographics (if available):</strong> Age ranges, locations, or segments.</li>
          <li><strong>Scan/Check-In Data:</strong> View real-time check-ins and no-show rates if scanning is enabled.</li>
          <li><strong>Export &amp; Share:</strong> Export charts or CSV reports for stakeholders.</li>
        </ul>
        <p className="mt-3 text-sm text-gray-600">Use analysis to monitor sales velocity and plan targeted promotions.</p>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Troubleshooting &amp; Next Steps</h2>
        <ul className="list-disc ml-6 space-y-2">
          <li>Confirm your account role is Organizer and the event is assigned to your organization if a feature is missing.</li>
          <li>For payment issues, check the Payments section or contact support with order IDs.</li>
        </ul>
        <p className="mt-4">Want this rendered as a site page component or included in the main docs navigation? I can wire that up.</p>
      </section>
    </div>
  );
};

export default PublicOrganizerGuide;
