import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TermsAndConditions: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-12">
      <div className="mb-6">
        <button onClick={() => navigate(-1)} className="text-slate-600 hover:text-slate-900 flex items-center gap-2 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h1 className="text-2xl md:text-3xl font-bold">Terms & Conditions</h1>
        <p className="text-sm text-slate-500 mt-2">Please read these terms and important instructions carefully.</p>
      </div>

      <section className="bg-white border rounded-lg p-6 mb-6 shadow-sm">
        <h2 className="font-semibold text-lg mb-3">Important Instructions</h2>
        <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700">
          <li>Please arrive 30 minutes before the event starts</li>
          <li>Bring a valid photo ID along with this confirmation</li>
          <li>Screenshots of this email are acceptable for entry</li>
          <li>Contact support if you need to make any changes</li>
        </ul>
      </section>

      <section className="bg-white border rounded-lg p-6 shadow-sm">
        <h2 className="font-semibold text-lg mb-3">Terms and Conditions</h2>
        <p className="text-sm text-slate-700 mb-4">Please carefully read and understand these terms and conditions before purchasing tickets for this event. By purchasing tickets, you acknowledge and agree to adhere to the following terms and conditions:</p>

        <div className="space-y-4 text-sm text-slate-700">
          <div>
            <h3 className="font-semibold">Ticket Modifications, Cancellations, and Refunds</h3>
            <p>Tickets purchased for the Event are non-modifiable and non-cancelable. Refunds will be initiated only in the event of cancellation of the Event. In case of Event cancellation, Jay-Ho! will initiate refunds for the face value of the ticket only. Service or transaction fees are non-refundable.</p>
          </div>

          <div>
            <h3 className="font-semibold">Payment Gateway Charges</h3>
            <p>Payment gateways apply a service fee per ticket purchased, and this fee is directed solely to the payment gateway. Ensure you review the total amount including this fee before making payment.</p>
          </div>

          <div>
            <h3 className="font-semibold">Late Entry and Venue Arrival</h3>
            <p>The organizers reserve the right to deny late entry to the Event. To ensure seamless entry, we strongly recommend arriving at the venue at least an hour before the scheduled start time of the Event.</p>
          </div>

          <div>
            <h3 className="font-semibold">Event Cancellation/Postponement Refunds</h3>
            <p>In the event of Event cancellation or postponement, Jay-Ho! will refund only the face value of the ticket. Service or transaction fees are non-refundable.</p>
          </div>

          <div>
            <h3 className="font-semibold">Venue Rules and Entry</h3>
            <p>Each venue has its own set of rules and regulations. The venue management holds the right to deny entry to individuals who do not comply with these rules.</p>
          </div>

          <div>
            <h3 className="font-semibold">Modification of Terms and Conditions</h3>
            <p>These terms and conditions are subject to change at the sole discretion of the organizer. Any changes will be effective immediately upon being posted on the official website or communicated through official channels.</p>
          </div>

          <p className="text-sm text-slate-600">Please note that your ticket purchase signifies your understanding and acceptance of these terms and conditions.</p>
        </div>
      </section>
    </div>
  );
};

export default TermsAndConditions;
