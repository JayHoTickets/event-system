import React, { useEffect, useState } from "react";
// Import local ticket stub so bundler serves it from same-origin
import ticketStub from "../assets/white_90 degree.png";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { useLocation, Link } from "react-router-dom";
import { Order } from "../types";
import { formatDateInTimeZone, formatTimeInTimeZone } from "../utils/date";
import { fetchEventById } from "../services/mockBackend";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, Mail, Download } from "lucide-react";

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
        const imgs = Array.from(
          container.getElementsByTagName("img"),
        ) as HTMLImageElement[];
        await Promise.all(
          imgs.map(async (img) => {
            const src = img.getAttribute("src") || "";
            if (!src || src.startsWith("data:")) return;
            try {
              // Try to inline by fetching through our backend proxy to avoid CORS blocking
              const apiBase =
                import.meta && import.meta.env && import.meta.env.VITE_API_BASE
                  ? import.meta.env.VITE_API_BASE
                  : "http://localhost:5000";
              const proxyUrl = `${apiBase.replace(/\/$/, "")}/image-proxy?url=${encodeURIComponent(src)}`;
              const resp = await fetch(proxyUrl);
              if (!resp.ok) throw new Error("proxy-failed");
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
          }),
        );
      };

      await inlineImagesInElement(el);

      // Wait for any (now inlined or original) images inside the ticket element to finish loading
      const imgs = Array.from(
        el.getElementsByTagName("img"),
      ) as HTMLImageElement[];
      await Promise.all(
        imgs.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        }),
      );

      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps = (pdf as any).getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`ticket-${ticket.id}.pdf`);
    } catch (err) {
      // silent fail for now
      console.error("Download failed", err);
    }
  };

  if (!order) {
    return (
      <div className="text-center pt-20">
        <h2 className="text-2xl font-bold">No Order Found</h2>
        <Link to="/" className="text-black underline mt-4 block">
          Return Home
        </Link>
      </div>
    );
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
              <strong>Coupon applied:</strong> {order.couponCode} — you saved $
              {order.discountApplied.toFixed(2)}
            </div>
          )}

          <h2 className="text-xl font-bold text-slate-900 mb-6">
            Your Tickets
          </h2>

          <div className="space-y-6">
            {order.tickets.map((ticket) => (
              <div
                id={`ticket-${ticket.id}`}
                key={ticket.id}
                className="flex flex-col sm:flex-row border-2 rounded-lg overflow-hidden shadow-sm"
              >
                {/* Left stub column */}
                <div className="flex items-center justify-center bg-[#d7ae4b] p-3">
                  <img
                    src={ticketStub}
                    alt="Ticket stub"
                    className="w-40 h-16 sm:w-16 sm:h-40 object-contain rotate-90 sm:rotate-0"
                  />
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
                    <h3 className="text-lg font-bold text-slate-900">
                      {ticket.eventTitle}
                    </h3>
                    {eventStart && (
                      <div className="text-sm text-slate-500 mt-1">
                        <div>
                          {formatDateInTimeZone(eventStart, eventTimezone)}{" "}
                          {eventTimezone
                            ? `• ${formatTimeInTimeZone(eventStart, eventTimezone)}`
                            : ""}
                        </div>
                        <div className="font-medium text-slate-700">
                          {venueName || "Unknown Venue"}
                        </div>
                      </div>
                    )}
                    <div className="mt-2">
                      {ticket.color && (
                        <span
                          className="inline-block w-4 h-4 rounded-sm mr-2 align-middle"
                          style={{
                            backgroundColor: ticket.color,
                            border: "1px solid rgba(0,0,0,0.06)",
                          }}
                        />
                      )}
                      <span className="text-sm text-slate-600">
                        {ticket.ticketType || "Standard"}
                      </span>
                    </div>
                    <div className="mt-2 text-slate-600 space-y-1">
                      {seatingType === "RESERVED" && (
                        <p>
                          <span className="font-semibold text-slate-800">
                            Seat:
                          </span>{" "}
                          {ticket.seatLabel}
                        </p>
                      )}
                      <p>
                        <span className="font-semibold text-slate-800">
                          Ticket ID:
                        </span>{" "}
                        {ticket.id}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">
                          Price:
                        </span>{" "}
                        ${ticket.price}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => await handleDownload(ticket)}
                    className="text-black hover:bg-[#d7ae4b] p-2 rounded-full transition-colors"
                    title="Download Ticket"
                  >
                    <Download className="w-6 h-6" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 border-t pt-6">
            <div className="flex justify-between text-slate-500 text-sm mb-1">
              <span>Subtotal</span>
              <span>
                $
                {(
                  order.totalAmount -
                  (order.serviceFee || 0) +
                  (order.discountApplied || 0)
                ).toFixed(2)}
              </span>
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
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={"/event/" + order.tickets[0].eventId}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg font-medium"
            >
              Buy More Tickets
            </Link>
            <a 
            href="https://events.jay-ho.com"
            
              className="bg-white border border-slate-200 text-slate-800 px-5 py-2 rounded-lg font-medium hover:bg-slate-50"
              title="Coming soon"
            >
              Discover More Events
            </a>
            <a
              href="https://jay-ho.com/"
              target="_blank"
              rel="noreferrer"
              className="bg-white border border-slate-200 text-slate-800 px-5 py-2 rounded-lg font-medium hover:bg-slate-50"
            >
              Explore Jay-Ho.com
            </a>
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
              <p>
                Important Disclaimer:
This event is organized and produced by a third party. Jay-Ho! is acting solely as a ticketing platform and is not responsible for any changes, schedule delays, cancellations, or the quality of the event production. All event-related decisions, including refunds or rescheduling, are at the discretion of the event organizer.

              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
                <li>Please arrive 30 minutes before the event starts</li>
                <li>Bring a valid photo ID along with this confirmation</li>
                <li>Screenshots of this email are acceptable for entry</li>
                <li>Contact support if you need to make any changes</li>
              </ul>
            </div>

            <div className="mb-8">
              <h3 className="font-bold text-slate-900 mb-3">
                Terms and Conditions
              </h3>
              <div className="text-xs text-slate-500 space-y-3 text-justify leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong>No Refunds or Exchanges:</strong> All ticket
                    purchases are final. Tickets are non-refundable and
                    non-transferable unless explicitly stated otherwise by the
                    event organizer.
                  </li>
                  <li>
                    <strong>Service Fees Non-Refundable:</strong> Any service
                    fees or transaction fees charged by Jay-Ho! are
                    non-refundable, even if the event is canceled or rescheduled
                    by the organizer.
                  </li>
                  <li>
                    <strong>Event Changes:</strong> The event organizer reserves
                    the right to alter the schedule, performers, or venue
                    without prior notice. Jay-Ho! is not liable for such
                    changes.
                  </li>
                  <li>
                    <strong>Organizer’s Contact Information:</strong> For
                    questions or concerns related to this event, please contact
                    the event organizer directly at the contact information
                    provided on the event page.
                  </li>
                  <li>
                    <strong>Lost Tickets:</strong> Jay-Ho! and the event
                    organizer are not responsible for lost, stolen, or damaged
                    tickets.
                  </li>
                  <li>
                    <strong>Valid ID Required:</strong> Entry may be subject to
                    verification with a valid government-issued photo ID
                    matching the ticket holder’s name, as required by the event
                    organizer.
                  </li>
                  <li>
                    <strong>Venue Rules:</strong> Venue-specific rules (such as
                    no re-entry, prohibited items, or security checks) will
                    apply and must be followed.
                  </li>
                  <li>
                    <strong>Late Entry:</strong> Late arrivals may be seated at
                    a suitable break in the performance, as determined by the
                    event staff.
                  </li>
                  <li>
                    <strong>Health and Safety:</strong> Attendees must comply
                    with all health and safety protocols required by the event
                    organizer and venue.
                  </li>
                  <li>
                    <strong>Rights of Admission Reserved:</strong> The event
                    organizer and venue reserve the right to refuse admission to
                    anyone without explanation.
                  </li>
                  <li>
                    <strong>Prohibited Items:</strong> Weapons, alcohol,
                    fireworks, and any illegal substances are not permitted on
                    the premises.
                  </li>
                  <li>
                    <strong>Digital Ticket Disclaimer:</strong> Entry is only
                    guaranteed with valid digital or physical tickets issued
                    through Jay-Ho!. Screenshots or altered tickets may be
                    rejected.
                  </li>
                  <li>
                    <strong>Transfer Policy Disclaimer:</strong> Ticket
                    transferability is subject to the event organizer’s
                    policies. Jay-Ho! cannot guarantee the acceptance of
                    transferred tickets at the venue.
                  </li>
                  <li>
                    <strong>Force Majeure Clause:</strong> Jay-Ho! and the event
                    organizer are not responsible for delays, changes, or
                    cancellations caused by circumstances beyond reasonable
                    control, including weather, natural disasters, government
                    actions, or public health emergencies.
                  </li>
                  <li>
                    <strong>Limit of Liability:</strong> Jay-Ho!’s liability is
                    strictly limited to the face value of the ticket purchased,
                    excluding any fees, and only where legally required.
                  </li>
                  <li>
                    <strong>Responsibility for Disputes:</strong> Any disputes
                    regarding the event, its quality, schedule, or artist
                    performance must be resolved directly with the event
                    organizer. Jay-Ho! will not mediate or be involved in such
                    disputes.
                  </li>
                  <li>
                    <strong>Acceptance of Organizer Terms:</strong> By
                    purchasing a ticket, you also agree to abide by the event
                    organizer’s terms and conditions, which may include
                    additional requirements.
                  </li>
                </ul>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-6 text-center border border-slate-200">
              <p className="font-bold text-slate-800 mb-1">
                Thank you for choosing JayHo Tickets!
              </p>
              <p className="text-sm text-slate-500 mb-4">
                We're excited to see you at the event. If you have any
                questions, we're here to help.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-4 text-sm">
                <span className="font-medium text-[#d7ae4b">
                  Support: Jayho@jay-ho.com
                </span>
                <span className="hidden sm:inline text-slate-300">|</span>
                <span className="font-medium text-slate-700">
                  Phone: +1 (339) 245-8655
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Confirmation;
