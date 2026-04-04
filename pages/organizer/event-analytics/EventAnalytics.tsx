
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchEventById, fetchEventOrders, updateSeatStatus, processPayment, cancelOrder, updateRefundStatus, createPaymentPendingOrder, fetchChargesQuote, fetchUsersByRole, validateCoupon } from '../../../services/mockBackend';
import { Event, Order, SeatingType, SeatStatus, PaymentMode, Seat, UserRole } from '../../../types';
import { ArrowLeft, DollarSign, Ticket, Calendar, Search, Filter, Download, Eye, X, Map as MapIcon, BarChart2, ZoomIn, ZoomOut, Maximize, Ban, CheckCircle, CreditCard, User as UserIcon, UserCheck, PieChart as PieChartIcon } from 'lucide-react';
import { formatDateInTimeZone, formatTimeInTimeZone } from '../../../utils/date';
import { useAuth } from '../../../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import SeatGrid, { CELL_SIZE } from '../../../components/SeatGrid';
import clsx from 'clsx';
import EventAnalyticsStats from './EventAnalyticsStats';
import EventAnalyticsCheckin from './EventAnalyticsCheckin';
import EventAnalyticsMap from './EventAnalyticsMap';

const EventAnalytics: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    
    const [event, setEvent] = useState<Event | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string,string>>({});
    const { user } = useAuth();
    const currentOrganizerId = user ? ((user.role === 'STAFF') ? (user as any).organizerId : user.id) : null;
    const perms: string[] = (user as any)?.permissions || [];
    const isStaff = user?.role === 'STAFF';
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [orderDateFrom, setOrderDateFrom] = useState('');
    const [orderDateTo, setOrderDateTo] = useState('');
    const [orderStatusFilter, setOrderStatusFilter] = useState<'ALL'|'PAID'|'FAILED'|'REFUND'|'CANCELLED'>('ALL');
    const [orderModeFilter, setOrderModeFilter] = useState<'ALL' | PaymentMode>('ALL');
    
    // View State
    const [activeView, setActiveView] = useState<'STATS' | 'MAP' | 'CHECKIN'>('STATS');
    
    // Map Zoom State
    const [zoom, setZoom] = useState(1);
    const mapContainerRef = useRef<HTMLDivElement>(null);

  // Selection State
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const selectedSeatObjs = (event ? event.seats.filter((s) => selectedSeatIds.includes(s.id)) : []);
  const selectionTotal = selectedSeatObjs.reduce((acc, s) => acc + (s.price || 0), 0);

    // Modal State
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showBoxOffice, setShowBoxOffice] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelRefundAmount, setCancelRefundAmount] = useState<number>(0);
    const [cancelNotes, setCancelNotes] = useState<string>('');
    const [cancelRefundStatus, setCancelRefundStatus] = useState<'PENDING'|'PROCESSED'|'FAILED'>('PENDING');
    const [cancelProcessing, setCancelProcessing] = useState<boolean>(false);
    const [refundStatusProcessing, setRefundStatusProcessing] = useState<boolean>(false);

  // Box Office Form
  const [boName, setBoName] = useState("");
  const [boEmail, setBoEmail] = useState("");
  const [boPhone, setBoPhone] = useState("");
  const [boMode, setBoMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [boProcessing, setBoProcessing] = useState(false);
  const [boCouponCode, setBoCouponCode] = useState<string>("");
  const [boCoupon, setBoCoupon] = useState<any | null>(null);
  const [boCouponError, setBoCouponError] = useState<string | null>(null);
  const [boCouponApplying, setBoCouponApplying] = useState(false);
  const [boQuote, setBoQuote] = useState<any | null>(null);
  const [showNotEligibleModal, setShowNotEligibleModal] = useState(false);

  // Hold Order Form (Pay Later)
  const [showHoldOrder, setShowHoldOrder] = useState(false);
  const [holdName, setHoldName] = useState("");
  const [holdEmail, setHoldEmail] = useState("");
  const [holdPhone, setHoldPhone] = useState("");
  const [holdProcessing, setHoldProcessing] = useState(false);
  const [holdCouponCode, setHoldCouponCode] = useState<string>("");
  const [holdCoupon, setHoldCoupon] = useState<any | null>(null);
  const [holdCouponError, setHoldCouponError] = useState<string | null>(null);
  const [holdCouponApplying, setHoldCouponApplying] = useState(false);
  const [holdQuote, setHoldQuote] = useState<any | null>(null);

  // Organizer-only: block/unblock seats action in-flight.
  const [seatStatusProcessing, setSeatStatusProcessing] = useState(false);

  // Check-in Report State
  const [ticketSearch, setTicketSearch] = useState("");
  const [checkInFilter, setCheckInFilter] = useState<
    "ALL" | "CHECKED_IN" | "PENDING"
  >("ALL");

  useEffect(() => {
    loadData();
  }, [id]);

  // Refresh seat status often while Live Seating Map is open (checkout locks / releases).
  useEffect(() => {
    if (!id || activeView !== 'MAP') return;
    const tick = () => {
      fetchEventById(id)
        .then((eData) => {
          if (eData) setEvent(eData);
        })
        .catch(() => {});
    };
    tick();
    const interval = setInterval(tick, 6000);
    return () => clearInterval(interval);
  }, [id, activeView]);

  // Refresh event + orders every 30s while Order Report (stats) is open.
  useEffect(() => {
    if (!id || activeView !== 'STATS') return;
    const tick = () => {
      Promise.all([fetchEventById(id), fetchEventOrders(id)])
        .then(([eData, oData]) => {
          if (eData) setEvent(eData);
          setOrders(oData);
        })
        .catch(() => {});
    };
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [id, activeView]);

  // Refresh event + orders every 30s while Check-in Report is open (attendee list & stats).
  useEffect(() => {
    if (!id || activeView !== 'CHECKIN') return;
    const tick = () => {
      Promise.all([fetchEventById(id), fetchEventOrders(id)])
        .then(([eData, oData]) => {
          if (eData) setEvent(eData);
          setOrders(oData);
        })
        .catch(() => {});
    };
    const interval = setInterval(tick, 30_000);
    return () => clearInterval(interval);
  }, [id, activeView]);

    const loadData = () => {
        if (id) {
        Promise.all([
          fetchEventById(id),
          fetchEventOrders(id),
          fetchUsersByRole(UserRole.ORGANIZER),
          fetchUsersByRole(UserRole.STAFF),
          fetchUsersByRole(UserRole.USER)
        ]).then(([eData, oData, orgs, staffs, users]) => {
          setEvent(eData || null);
          setOrders(oData);
          // Build simple id->name map from fetched users
          const map: Record<string,string> = {};
          (orgs || []).forEach((u:any) => { if (u && u.id) map[u.id] = u.name + ' (Organizer)'; });
          (staffs || []).forEach((u:any) => { if (u && u.id) map[u.id] = u.name + ' (Staff)'; });
          (users || []).forEach((u:any) => { if (u && u.id) map[u.id] = map[u.id] || u.name + ' (User)'; });
          setUsersMap(map);
          setLoading(false);
        }).catch(err => {
          // fallback: still try to load event/orders
          Promise.all([fetchEventById(id), fetchEventOrders(id)]).then(([eData, oData]) => {
            setEvent(eData || null);
            setOrders(oData);
            setLoading(false);
          }).catch(e => { setLoading(false); });
        });
        }
    }

    

  // Auto-fit map when switching to MAP view
  // Determine allowed views based on role/permissions and choose sensible default
  useEffect(() => {
    const perms: string[] = (user as any)?.permissions || [];
    const isStaff = user?.role === 'STAFF';
    const canViewStats = !isStaff || perms.includes('revenue');
    const canViewCheckin = !isStaff || perms.includes('checkin');
    const canViewMap = !isStaff || perms.includes('live_map');

    // If current activeView is not allowed, pick the first allowed view
    const allowedOrder: ('STATS'|'CHECKIN'|'MAP')[] = ['STATS','CHECKIN','MAP'];
    const isAllowed = (v: typeof activeView) => {
      if (v === 'STATS') return canViewStats;
      if (v === 'CHECKIN') return canViewCheckin;
      if (v === 'MAP') return canViewMap;
      return false;
    }

    if (!isAllowed(activeView)) {
      for (const v of allowedOrder) {
        if (isAllowed(v as any)) { setActiveView(v as any); break; }
      }
    }

    if (
      activeView === "MAP" &&
      event &&
      event.seatingType === SeatingType.RESERVED &&
      mapContainerRef.current
    ) {
      (async () => {
        try {
          // Fetch an authoritative quote for display (do NOT create orders here).
          // This keeps MAP view read-only; actual bookings happen on explicit form submit.
          try {
            await fetchChargesQuote(selectedSeatObjs, undefined, event.id, boMode);
          } catch (e) {
            console.debug('MAP view - failed to fetch server quote', e);
          }
        } catch (err) {
          console.error('MAP view quote fetch failed', err);
        }
      })();
    }
  }, [activeView, event, selectedSeatIds, boMode, user]);
  if (loading)
    return (
      <div className="p-10 text-center text-slate-500">
        Loading analytics...
      </div>
    );
  if (!event)
    return <div className="p-10 text-center text-red-500">Event not found</div>;

    // --- Stats Calculation ---
    const activeOrders = orders.filter(
      (o) => o.status !== 'CANCELLED' && o.status !== 'REFUND' && o.status !== 'REFUNDED',
    );
    const orderActualEarning = (o: Order) => o.totalAmount - (o.serviceFee || 0);
    const paidOrders = activeOrders.filter(o => o.status === 'PAID');
    const onlinePaidOrders = paidOrders.filter(
      (o) => (o.paymentMode || PaymentMode.ONLINE) === PaymentMode.ONLINE,
    );
    const cashPaidOrders = paidOrders.filter((o) => o.paymentMode === PaymentMode.CASH);

    const totalOnlinePaid = onlinePaidOrders.reduce((a, o) => a + o.totalAmount, 0);
    const onlineServiceFeesPaid = onlinePaidOrders.reduce((a, o) => a + (o.serviceFee || 0), 0);
    const onlineTotalEarning = onlinePaidOrders.reduce((a, o) => a + orderActualEarning(o), 0);

    const totalCashCollected = cashPaidOrders.reduce((a, o) => a + o.totalAmount, 0);
    const dueCashServiceFee = cashPaidOrders.reduce((a, o) => a + (o.serviceFee || 0), 0);
    const estimatedCashEarning = cashPaidOrders.reduce((a, o) => a + orderActualEarning(o), 0);

    const onlineEarningMinusDueCashService = onlineTotalEarning - dueCashServiceFee;

    const totalTicketsSold = activeOrders.reduce((acc, o) => acc + o.tickets.length, 0);

    const totalCheckedIn = orders.reduce((acc, o) => acc + o.tickets.filter(t => t.checkedIn).length, 0);
    const percentageCheckedIn = totalTicketsSold > 0 ? Math.round((totalCheckedIn / totalTicketsSold) * 100) : 0;

  // --- Filtering Orders ---
  const filteredOrders = orders
    .filter((o) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        o.id.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q);

      // Status filter
      const matchesStatus =
        orderStatusFilter === "ALL"
          ? true
          : orderStatusFilter === "REFUND"
            ? o.status === "REFUND" || o.status === "REFUNDED"
            : o.status === orderStatusFilter;

      // Mode filter
      const matchesMode =
        orderModeFilter === "ALL" ? true : o.paymentMode === orderModeFilter;

      // Date range filter (order.date expected to be ISO string)
      let matchesDate = true;
      const orderTs = new Date(o.date).getTime();
      if (orderDateFrom) {
        const fromTs = new Date(orderDateFrom + "T00:00:00").getTime();
        if (orderTs < fromTs) matchesDate = false;
      }
      if (orderDateTo) {
        const toTs = new Date(orderDateTo + "T23:59:59").getTime();
        if (orderTs > toTs) matchesDate = false;
      }

      return matchesSearch && matchesStatus && matchesMode && matchesDate;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // --- Flatten Tickets for Check-in Report ---
  const allTickets = orders.flatMap((o) =>
    o.tickets.map((t) => ({
      ...t,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      orderId: o.id,
    })),
  );

  const filteredTickets = allTickets
    .filter((t) => {
      const matchesSearch =
        t.id.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.seatLabel.toLowerCase().includes(ticketSearch.toLowerCase()) ||
        t.customerName.toLowerCase().includes(ticketSearch.toLowerCase());

      const matchesStatus =
        checkInFilter === "ALL"
          ? true
          : checkInFilter === "CHECKED_IN"
            ? t.checkedIn
            : !t.checkedIn;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Sort by check-in time desc if checked in, else purchase date
      if (a.checkedIn && b.checkedIn) {
        return (
          new Date(b.checkInDate!).getTime() -
          new Date(a.checkInDate!).getTime()
        );
      }
      return 0;
    });

  const escapeCell = (v: unknown) => {
    if (v === null || v === undefined) return '';
    return `"${String(v).replace(/"/g, '""')}"`;
  };

  const fmtMoneySummary = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // --- Export Handler (CSV) ---
  const handleExport = () => {
    try {
      const headers = [
        "Ticket ID",
        "Order ID",
        "Customer Name",
        "Customer Email",
        "Seat",
        "Ticket Type",
        "Checked In",
        "Check-In Time",
      ];
      const rows = filteredTickets.map((t) => [
        t.id,
        t.orderId,
        t.customerName,
        t.customerEmail,
        t.seatLabel,
        t.ticketType || "",
        t.checkedIn ? "Yes" : "No",
        t.checkInDate ? new Date(t.checkInDate).toISOString() : "",
      ]);

      const csv = [headers, ...rows]
        .map((r) => r.map(escapeCell).join(","))
        .join("\n");

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${event?.id || 'event'}-checkin-report.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed', err);
            alert('Export failed. Check console for details.');
        }
    };

  // --- Orders Export Handler (CSV) ---
  const handleExportOrders = () => {
    try {
      const tz = event.timezone;
      const headers = [
        'Order ID',
        'Order Date',
        'Customer',
        'Booked By',
        'Tickets',
        'Net Revenue',
        'Service Fee',
        'Order Amount',
        'Mode',
        'Status',
        'Refund Status',
      ];

      const bookedByLabel = (o: Order) =>
        o.bookedBy && (o.bookedBy.name || o.bookedBy.id)
          ? `${o.bookedBy.name || o.bookedBy.id}${o.bookedBy.role ? ` (${o.bookedBy.role})` : ''}`
          : o.userId && !String(o.userId).startsWith('guest-')
            ? String(o.userId)
            : o.customerName;

      const ticketsLabel = (o: Order) => {
        const base = `${o.tickets.length} Tickets`;
        return o.couponCode ? `${base} ${o.couponCode}` : base;
      };

      const orderDateLabel = (o: Order) => {
        if (!o.date) return '';
        return `${formatDateInTimeZone(o.date, tz)} at ${formatTimeInTimeZone(o.date, tz)}`;
      };

      const refundLabel = (o: Order) =>
        o.status === 'CANCELLED' || o.status === 'REFUND' || o.status === 'REFUNDED'
          ? o.refundStatus || 'PENDING'
          : '—';

      const rows = filteredOrders.map((o) => [
        o.id,
        orderDateLabel(o),
        `${o.customerName}\n${o.customerEmail}`,
        bookedByLabel(o),
        ticketsLabel(o),
        `$${((o.totalAmount || 0) - (o.serviceFee || 0)).toFixed(2)}`,
        `$${(o.serviceFee || 0).toFixed(2)}`,
        `$${(o.totalAmount || 0).toFixed(2)}`,
        o.paymentMode || 'ONLINE',
        o.status,
        refundLabel(o),
      ]);

      const pad9 = ['', '', '', '', '', '', '', '', ''];
      const summary: string[][] = [
        ['', '', '', '', '', '', '', '', '', '', ''],
        [
          'Analytics summary (dashboard cards; all paid orders, excludes cancelled)',
          '',
          ...pad9,
        ],
        ['Online Sales (Gross)', fmtMoneySummary(totalOnlinePaid), ...pad9],
        ['Fees Collected', fmtMoneySummary(onlineServiceFeesPaid), ...pad9],
        ['Net Sales (Online)', fmtMoneySummary(onlineTotalEarning), ...pad9],
        ['Offline Sales', fmtMoneySummary(totalCashCollected), ...pad9],
        ['Outstanding Fees', `-${fmtMoneySummary(dueCashServiceFee)}`, ...pad9],
        ['Net Sales (Offline)', fmtMoneySummary(estimatedCashEarning), ...pad9],
        ['Total Payout', fmtMoneySummary(onlineEarningMinusDueCashService), ...pad9],
      ];

      const csv = [headers, ...rows, ...summary].map((r) => r.map(escapeCell).join(',')).join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${event?.id || 'event'}-orders-report.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export orders failed', err);
      alert('Export failed. Check console for details.');
    }
  };

    // Open refund modal prefilled for selected order
    const handleCancelOrder = (order: Order) => {
        setSelectedOrder(order);
        setCancelRefundAmount(order.refundAmount || 0);
        setCancelNotes(order.cancellationNotes || '');
        setCancelRefundStatus((order.refundStatus as any) || 'PENDING');
        setShowCancelModal(true);
    };

    const confirmCancelOrder = async () => {
        if (!selectedOrder) return;
        setCancelProcessing(true);
        try {
            const payload = {
                organizerId: user?.id,
                refundAmount: Number(cancelRefundAmount) || 0,
                notes: cancelNotes,
                refundStatus: cancelRefundStatus
            };
            const res = await cancelOrder(selectedOrder.id, payload);
            if (res && res.success) {
                // Update local orders state
                setOrders(prev => prev.map(o => o.id === res.order.id ? res.order : o));
                setSelectedOrder(res.order);
                setShowCancelModal(false);
            } else {
                alert('Failed to process refund');
            }
        } catch (err: any) {
            console.error('Refund failed', err);
            alert('Refund failed: ' + (err.message || err));
        } finally {
            setCancelProcessing(false);
        }
    };


  const isReserved = event.seatingType === SeatingType.RESERVED;

  const showSeatActionOverlay = boProcessing || holdProcessing || seatStatusProcessing;

  // --- Map Interactions ---
  const handleSeatClick = (seat: Seat) => {
    if (seat.status === SeatStatus.SOLD) return;
    // Note: SeatGrid handles the check for UNAVAILABLE + canSelectUnavailable, so we just toggle here.
    setSelectedSeatIds((prev) => {
      if (prev.includes(seat.id)) return prev.filter((id) => id !== seat.id);
      return [...prev, seat.id];
    });
  };

  const handleBulkSelect = (ids: string[]) => {
    setSelectedSeatIds((prev) => [...new Set([...prev, ...ids])]);
  };

  const handleBlockSeats = async () => {
    if (!event) return;
    if (seatStatusProcessing) return;
    setSeatStatusProcessing(true);
    try {
      await updateSeatStatus(event.id, selectedSeatIds, SeatStatus.UNAVAILABLE);
      setSelectedSeatIds([]);
      loadData();
    } catch (err: any) {
      alert('Failed to block seats. ' + (err?.message || String(err)));
    } finally {
      setSeatStatusProcessing(false);
    }
  };

  const handleUnblockSeats = async () => {
    if (!event) return;
    if (seatStatusProcessing) return;
    setSeatStatusProcessing(true);
    try {
      await updateSeatStatus(event.id, selectedSeatIds, SeatStatus.AVAILABLE);
      setSelectedSeatIds([]);
      loadData();
    } catch (err: any) {
      alert('Failed to unblock seats. ' + (err?.message || String(err)));
    } finally {
      setSeatStatusProcessing(false);
    }
  };

  const handleOpenBoxOffice = () => {
    setBoName("");
    setBoEmail("");
    setBoMode(PaymentMode.CASH);
    setBoCoupon(null);
    setBoCouponCode('');
    setBoQuote(null);
    // Try fetch server quote for current selection to show fees/discounts
    (async () => {
      if (!event) return;
      try {
        const selectedSeatObjs = event.seats.filter((s) => selectedSeatIds.includes(s.id));
        const quote = await fetchChargesQuote(selectedSeatObjs, undefined, event.id, PaymentMode.CASH);
        setBoQuote(quote);
      } catch (e) {
        setBoQuote(null);
      }
    })();
    setShowBoxOffice(true);
  };

  const handleBoxOfficeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    setBoProcessing(true);

    const selectedSeatObjs = event.seats.filter((s) =>
      selectedSeatIds.includes(s.id),
    );

    // Prevent box-office bookings for seats with a price of 0
    const hasZeroPriceTicket = selectedSeatObjs.some(s => (s.price ?? 0) === 0);
    if (hasZeroPriceTicket) {
      alert('Cannot book seats with price $0 via Box Office. Please use the Hold/Charity flow or adjust ticket pricing.');
      setBoProcessing(false);
      return;
    }

      try {
      const isComplimentaryBo = boMode === PaymentMode.COMPLIMENTARY;
      // Ask server for authoritative quote for this payment mode so charges apply correctly (not for complimentary)
      let serverQuote: any = null;
      if (!isComplimentaryBo) {
        try {
          const couponId = boCoupon ? boCoupon.id : undefined;
          serverQuote = await fetchChargesQuote(selectedSeatObjs, couponId, event.id, boMode);
        } catch (e) {
          console.debug('BoxOffice - failed to fetch server quote, falling back to 0 service fee', e);
        }
      }
      let serviceFeeToUse = isComplimentaryBo
        ? 0
        : (serverQuote && typeof serverQuote.serviceFee === 'number' ? serverQuote.serviceFee : 0);
      let appliedChargesToUse = isComplimentaryBo
        ? undefined
        : (serverQuote && Array.isArray(serverQuote.appliedCharges) ? serverQuote.appliedCharges : undefined);
      await processPayment(
        { name: boName, email: boEmail, phone: boPhone },
        event,
        selectedSeatObjs,
        serviceFeeToUse,
        appliedChargesToUse,
        isComplimentaryBo ? undefined : (boCoupon ? boCoupon.id : undefined),
        boMode,
        undefined,
        // bookedBy: organizer/staff performing box-office action
        { id: user?.id, role: (user as any)?.role, name: (user as any)?.name }
      );
      setBoProcessing(false);
      setShowBoxOffice(false);
      setSelectedSeatIds([]);
      loadData();
      alert("Booking confirmed!");
    } catch (err: any) {
      alert("Booking failed "+(err.message || String(err)));
      setBoProcessing(false);
    }
  };

  const handleOpenHoldOrder = () => {
    setHoldName("");
    setHoldEmail("");
    setHoldPhone("");
    setHoldCoupon(null);
    setHoldCouponCode('');
    setHoldQuote(null);
    (async () => {
      if (!event) return;
      try {
        const selectedSeatObjs = event.seats.filter((s) => selectedSeatIds.includes(s.id));
        const quote = await fetchChargesQuote(selectedSeatObjs, undefined, event.id, PaymentMode.ONLINE);
        setHoldQuote(quote);
      } catch (e) {
        setHoldQuote(null);
      }
    })();
    setShowHoldOrder(true);
  };

  const handleHoldOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !currentOrganizerId) return;
    setHoldProcessing(true);

    const selectedSeatObjsLocal = event.seats.filter((s) => selectedSeatIds.includes(s.id));
    const hasZeroPriceTicketForHold = selectedSeatObjsLocal.some(s => (s.price ?? 0) === 0);
    if (hasZeroPriceTicketForHold) {
      setHoldProcessing(false);
      setShowHoldOrder(false)
      setShowNotEligibleModal(true);
      return;
    }

    try {
      // Call API to create payment pending order (hold)
      const order = await createPaymentPendingOrder(
        event.id,
        selectedSeatIds,
        {
          id: `hold-${Date.now()}`,
          name: holdName,
          email: holdEmail,
          phone: holdPhone
        },
        typeof (holdQuote as any)?.serviceFee === 'number' ? (holdQuote as any).serviceFee : 0,
        // bookedBy: organizer/staff placing the hold
        { id: user?.id, role: (user as any)?.role, name: (user as any)?.name },
        holdCoupon ? holdCoupon.id : undefined,
        undefined // paymentMode (optional)
      );
      
      setHoldProcessing(false);
      setShowHoldOrder(false);
      setSelectedSeatIds([]);
      // clear coupon UI
      setHoldCoupon(null);
      setHoldCouponCode('');
      setHoldQuote(null);
      setHoldCouponError(null);
      loadData();
      alert(`Hold placed! Payment email sent to ${holdEmail}. Customer has 24 hours to pay.`);
    } catch (err) {
      console.error('Hold order failed:', err);
      alert("Failed to place hold. Please try again.");
      setHoldProcessing(false);
    }
  };

  

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative">
      {showSeatActionOverlay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl shadow-2xl px-6 py-5 flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-200 border-t-indigo-600" />
            <p className="mt-3 text-slate-700 font-medium">Processing...</p>
          </div>
        </div>
      )}
      <button
        onClick={() => navigate("/organizer")}
        className="flex items-center text-slate-500 hover:text-slate-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">
            {event.title}{" "}
            <span className="text-slate-400 font-normal">| Analytics</span>
          </h1>
          <p className="text-slate-500 mt-1 flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            {formatDateInTimeZone(event.startTime, event.timezone)}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Export button moved into Check-in tab header to scope it to check-in report */}
        </div>
      </div>

      {/* VIEW TOGGLE TABS */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto">
        {((user?.role !== 'STAFF') || ((user as any)?.permissions || []).includes('revenue')) && (
          <button
            onClick={() => setActiveView("STATS")}
            className={clsx(
              "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center whitespace-nowrap",
              activeView === "STATS"
                ? "border-[#d7ae4b] text-[#d7ae4b]"
                : "border-transparent text-slate-500 hover:text-[#d7ae4b] hover:border-slate-300",
            )}
          >
            <BarChart2 className="w-4 h-4 mr-2" /> Overview & Sales
          </button>
        )}
        {((user?.role !== 'STAFF') || ((user as any)?.permissions || []).includes('checkin')) && (
          <button
            onClick={() => setActiveView("CHECKIN")}
            className={clsx(
              "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center whitespace-nowrap",
              activeView === "CHECKIN"
                ? "border-[#d7ae4b] text-[#d7ae4b]"
                : "border-transparent text-slate-500 hover:text-[#d7ae4b] hover:border-slate-300",
            )}
          >
            <PieChartIcon className="w-4 h-4 mr-2" /> Check-in Report
          </button>
        )}
        {/* Render tabs only if organizer or staff has specific permission */}
        {((user?.role !== 'STAFF') || ((user as any)?.permissions || []).includes('revenue')) && (
          <></>
        )}
        {((user?.role !== 'STAFF') || ((user as any)?.permissions || []).includes('checkin')) && (
          <></>
        )}
        {isReserved && ((user?.role !== 'STAFF') || ((user as any)?.permissions || []).includes('live_map')) && (
          <button
            onClick={() => setActiveView("MAP")}
            className={clsx(
              "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center whitespace-nowrap",
              activeView === "MAP"
                ? "border-[#d7ae4b] text-[#d7ae4b]"
                : "border-transparent text-slate-500 hover:text-[#d7ae4b] hover:border-slate-300",
            )}
          >
            <MapIcon className="w-4 h-4 mr-2" /> Live Seating Map
          </button>
        )}
      </div>

      {activeView === "STATS" && (!isStaff || perms.includes('revenue')) && (
        <EventAnalyticsStats
          event={event}
          totalOnlinePaid={totalOnlinePaid}
          onlineServiceFeesPaid={onlineServiceFeesPaid}
          onlineTotalEarning={onlineTotalEarning}
          totalCashCollected={totalCashCollected}
          dueCashServiceFee={dueCashServiceFee}
          estimatedCashEarning={estimatedCashEarning}
          onlineEarningMinusDueCashService={onlineEarningMinusDueCashService}
          filteredOrders={filteredOrders}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          orderDateFrom={orderDateFrom}
          setOrderDateFrom={setOrderDateFrom}
          orderDateTo={orderDateTo}
          setOrderDateTo={setOrderDateTo}
          orderStatusFilter={orderStatusFilter}
          setOrderStatusFilter={setOrderStatusFilter}
          orderModeFilter={orderModeFilter}
          setOrderModeFilter={setOrderModeFilter}
          handleExportOrders={handleExportOrders}
          setSelectedOrder={setSelectedOrder}
        />
      )}

      {activeView === "CHECKIN" && (!isStaff || perms.includes('checkin')) && (
        <EventAnalyticsCheckin
          filteredTickets={filteredTickets}
          ticketSearch={ticketSearch}
          setTicketSearch={setTicketSearch}
          checkInFilter={checkInFilter}
          setCheckInFilter={setCheckInFilter}
          handleExport={handleExport}
          totalCheckedIn={totalCheckedIn}
          totalTicketsSold={totalTicketsSold}
          percentageCheckedIn={percentageCheckedIn}
          allTickets={allTickets}
        />
      )}

      {activeView === "MAP" && (!isStaff || perms.includes('live_map')) && (
        <EventAnalyticsMap
          event={event}
          selectedSeatIds={selectedSeatIds}
          setSelectedSeatIds={setSelectedSeatIds}
          selectedSeatObjs={selectedSeatObjs}
          selectionTotal={selectionTotal}
          zoom={zoom}
          setZoom={setZoom}
          mapContainerRef={mapContainerRef}
          handleSeatClick={handleSeatClick}
          handleBulkSelect={handleBulkSelect}
          handleBlockSeats={handleBlockSeats}
          handleUnblockSeats={handleUnblockSeats}
          handleOpenBoxOffice={handleOpenBoxOffice}
          handleOpenHoldOrder={handleOpenHoldOrder}
          isReserved={isReserved}
        />
      )}

            {/* Order Details Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-lg text-slate-900">Order Summery</h3>
                                <p className="text-sm text-slate-500 font-mono">{selectedOrder.id}</p>
                                <p className="text-sm text-slate-500">Order Date: {formatDateInTimeZone(selectedOrder.date, event.timezone)} at {formatTimeInTimeZone(selectedOrder.date, event.timezone)}</p>
                            </div>
                            <div className="text-right hidden sm:block">
                                <div className="text-sm text-slate-500">Event</div>
                                <div className="font-medium text-slate-900">{event?.title}</div>
                                <div className="text-xs text-slate-500">{event ? formatDateInTimeZone(event.startTime, event.timezone) : ''}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                
                                <button 
                                    onClick={() => setSelectedOrder(null)} 
                                    className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition"
                                >
                                    <X className="w-6 h-6"/>
                                </button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[70vh]">
                            {/* Customer Info */}
                            <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Customer Information</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-slate-500 block mb-1">Name</span>
                                        <span className="font-medium text-slate-900">{selectedOrder.customerName}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block mb-1">Email</span>
                                        <span className="font-medium text-slate-900">{selectedOrder.customerEmail}</span>
                                    </div>
                                       <div>
                                        <span className="text-slate-500 block mb-1">Phone</span>
                                        <span className="font-medium text-slate-900">{selectedOrder.customerPhone}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block mb-1">Payment Mode</span>
                                        <span className="font-bold text-slate-900">{selectedOrder.paymentMode || 'ONLINE'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block mb-1">Status</span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                                            selectedOrder.status === 'PAID'
                                              ? 'bg-green-100 text-green-800'
                                              : selectedOrder.status === 'REFUND' || selectedOrder.status === 'REFUNDED'
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                            {selectedOrder.status}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Cancellation Details (if cancelled) */}
                            {(selectedOrder.status === 'CANCELLED' ||
                                selectedOrder.status === 'REFUND' ||
                                selectedOrder.status === 'REFUNDED') && (
                                <div className="bg-red-50 rounded-lg p-4 mb-6 border border-red-100">
                                    <h4 className="text-sm font-bold text-red-700 mb-2">Cancellation / refund details</h4>
                                    <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                                        <div>
                                            <span className="text-slate-500 block mb-1">Refund Amount</span>
                                            <span className="font-medium">${(selectedOrder.refundAmount || 0).toFixed(2)}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block mb-1">Refund Status</span>
                                                    {currentOrganizerId && String(currentOrganizerId) === String(event.organizerId) ? (
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        className="w-full border rounded-lg px-3 py-2"
                                                        value={(selectedOrder.refundStatus || 'PENDING') as any}
                                                        onChange={async (e) => {
                                                            const newStatus = e.target.value as 'PENDING'|'PROCESSED'|'FAILED';
                                                            try {
                                                                setRefundStatusProcessing(true);
                                                                const payload = {
                                                                    organizerId: user?.id,
                                                                    refundStatus: newStatus
                                                                };
                                                                const res = await updateRefundStatus(selectedOrder.id, payload);
                                                                if (res && res.success) {
                                                                    setOrders(prev => prev.map(o => o.id === res.order.id ? res.order : o));
                                                                    setSelectedOrder(res.order);
                                                                } else {
                                                                    alert('Failed to update refund status');
                                                                }
                                                            } catch (err: any) {
                                                                console.error('Failed to update refund status', err);
                                                                alert('Update failed: ' + (err.message || err));
                                                            } finally {
                                                                setRefundStatusProcessing(false);
                                                            }
                                                        }}
                                                        disabled={refundStatusProcessing}
                                                    >
                                                        <option value="PENDING">Pending</option>
                                                        <option value="PROCESSED">Processed</option>
                                                        <option value="FAILED">Failed</option>
                                                    </select>
                                                    {refundStatusProcessing && (
                                                        <svg className="animate-spin h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                                        </svg>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="font-medium">{selectedOrder.refundStatus || 'PENDING'}</span>
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-slate-500 block mb-1">Notes</span>
                                            <div className="text-sm text-slate-700">{selectedOrder.cancellationNotes || '—'}</div>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block mb-1">Cancelled By</span>
                                            <div className="text-sm text-slate-700">{selectedOrder.cancelledBy || 'Organizer'}</div>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block mb-1">Date</span>
                                            <div className="text-sm text-slate-700">{selectedOrder.cancelledAt ? new Date(selectedOrder.cancelledAt).toLocaleString() : '—'}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Ticket List */}
                            <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                                <span>Purchased Tickets ({selectedOrder.tickets.length})</span>
                                {selectedOrder.couponCode && (
                                    <span className="text-xs text-green-600 font-normal bg-green-50 px-2 py-1 rounded border border-green-100">
                                        Coupon Applied: {selectedOrder.couponCode}
                                    </span>
                                )}
                            </h4>
                            <div className="border rounded-lg mb-6 max-h-[20vh] overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 border-b">
                                        <tr>
                                            <th className="px-4 py-2 font-medium text-slate-600">Ticket Type</th>
                                            <th className="px-4 py-2 font-medium text-slate-600">Seat / Label</th>
                                            <th className="px-4 py-2 font-medium text-slate-600 text-right">Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {selectedOrder.tickets.map(t => (
                                            <tr key={t.id}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <Ticket className="w-4 h-4 text-slate-400" />
                                                        <span className="font-medium text-slate-900">{t.ticketType || 'Standard'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                                                    {t.seatLabel}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-slate-900">
                                                    ${t.price.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Order totals */}
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mt-2">
                                <div className="w-full sm:max-w-sm sm:ml-auto space-y-1.5 text-sm border border-slate-200 rounded-lg p-4 bg-slate-50">
                                    {(() => {
                                        const lineSubtotal = selectedOrder.tickets.reduce((acc, t) => acc + (t.price || 0), 0);
                                        const discount = selectedOrder.discountApplied || 0;
                                        const service = selectedOrder.serviceFee || 0;
                                        const total = selectedOrder.totalAmount ?? 0;
                                        const isComplimentaryOrder = selectedOrder.paymentMode === PaymentMode.COMPLIMENTARY;
                                        const actualEarning = isComplimentaryOrder
                                            ? 0
                                            : lineSubtotal - discount;
                                        return (
                                            <>
                                                <div className="flex justify-between text-slate-600">
                                                    <span>Subtotal</span>
                                                    <span className="font-medium text-slate-900">${lineSubtotal.toFixed(2)}</span>
                                                </div>
                                                {!isComplimentaryOrder && (
                                                    <div className="flex justify-between text-slate-600">
                                                        <span>Discount</span>
                                                        <span className={`font-medium ${discount > 0 ? 'text-green-700' : 'text-slate-900'}`}>
                                                            {discount > 0 ? `-$${discount.toFixed(2)}` : '$0.00'}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between text-slate-700 border-t border-dashed border-slate-200 pt-2 mt-2">
                                                    <span className="font-semibold">Net Sales</span>
                                                    <span className="font-semibold text-slate-900">${actualEarning.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between text-slate-600">
                                                    <span>Service Fees</span>
                                                    <span className="font-medium text-slate-900">${service.toFixed(2)}</span>
                                                </div>
                                               
                                                <div className="flex justify-between items-center font-bold text-base text-slate-900 border-t border-slate-200 pt-2 mt-2">
                                                    <span>Total paid</span>
                                                    <span>${total.toFixed(2)}</span>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                                {currentOrganizerId && String(currentOrganizerId) === String(event.organizerId) && selectedOrder.status === 'PAID' && (
                                    <button
                                        type="button"
                                        onClick={() => handleCancelOrder(selectedOrder)}
                                        className="self-start sm:self-end px-3 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 shrink-0"
                                        title="Process refund and cancel this order"
                                    >
                                        Refund
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Refund order modal (cancels order on the server) */}
            {showCancelModal && selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-lg text-slate-900">Refund</h3>
                            <button onClick={() => setShowCancelModal(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-600">Refund order <span className="font-mono text-slate-700">{selectedOrder.id}</span>. Seats are released when you confirm. With refund amount <strong>0</strong> the order is marked <strong>CANCELLED</strong>; with a <strong>positive</strong> refund amount it is marked <strong>REFUND</strong>. Tickets cannot be scanned either way.</p>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Refund Amount</label>
                                <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2" value={cancelRefundAmount} onChange={e => setCancelRefundAmount(Number(e.target.value))} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Refund Status</label>
                                <select className="w-full border rounded-lg px-3 py-2" value={cancelRefundStatus} onChange={e => setCancelRefundStatus(e.target.value as any)}>
                                    <option value="PENDING">Pending</option>
                                    <option value="PROCESSED">Processed</option>
                                    <option value="FAILED">Failed</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Refund notes</label>
                                <textarea className="w-full border rounded-lg px-3 py-2" rows={4} value={cancelNotes} onChange={e => setCancelNotes(e.target.value)} />
                            </div>

                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setShowCancelModal(false)} className="px-4 py-2 rounded-lg border">Close</button>
                                <button 
                                    type="button"
                                    onClick={confirmCancelOrder} 
                                    className="px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 flex items-center gap-2"
                                    disabled={cancelProcessing}
                                >
                                    {cancelProcessing ? (
                                        <>
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                                            </svg>
                                            Processing...
                                        </>
                                    ) : 'Confirm refund'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

      {/* Box Office Modal */}
      {showBoxOffice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-4 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center">
                <Ticket className="w-5 h-5 mr-2" /> Box Office Booking
              </h3>
              <button
                onClick={() => setShowBoxOffice(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[66vh]">
              <div className="mb-6 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold">
                      Selected Seats
                    </p>
                    <p className="font-medium text-slate-900">
                      {selectedSeatIds.length} tickets
                    </p>
                  </div>
                  <p className="text-lg font-bold text-indigo-600">
                    ${selectionTotal.toFixed(2)}
                  </p>
                </div>
                <div className="max-h-32 overflow-y-auto text-sm space-y-1 border-t border-slate-200 pt-2 mt-2">
                  {selectedSeatObjs.map((seat) => (
                    <div
                      key={seat.id}
                      className="flex justify-between text-slate-600"
                    >
                      <span>
                        {seat.rowLabel}
                        {seat.seatNumber}{" "}
                        <span className="text-xs text-slate-400">
                          ({seat.tier})
                        </span>
                      </span>
                      <span>${(seat.price || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price breakdown */}
              <div className="mb-4 p-3 bg-white border rounded-lg text-sm">
                {boMode === PaymentMode.COMPLIMENTARY ? (
                  <>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>Face value (not charged)</span>
                      <span className="font-medium">${selectionTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-bold mt-2 border-t pt-2">
                      <span>Total charged</span>
                      <span>$0.00</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>Subtotal</span>
                      <span className="font-medium">${selectionTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>Discount</span>
                      <span className="font-medium">${((boQuote && boQuote.discount) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 mb-1">
                      <span>Service Fee</span>
                      <span className="font-medium">${((boQuote && boQuote.serviceFee) || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 font-bold mt-2">
                      <span>Total</span>
                      <span>${( (selectionTotal - ((boQuote && boQuote.discount) || 0)) + ((boQuote && boQuote.serviceFee) || 0) ).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              <form onSubmit={handleBoxOfficeSubmit}>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Customer Name
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        required
                        className="w-full border rounded-lg pl-9 pr-3 py-2"
                        placeholder="e.g. John Smith"
                        value={boName}
                        onChange={(e) => setBoName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email (Optional)
                    </label>
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="john@example.com"
                      value={boEmail}
                      onChange={(e) => setBoEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone (Optional)
                    </label>
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="+1 555 123 4567"
                      value={boPhone}
                      onChange={(e) => setBoPhone(e.target.value)}
                    />
                  </div>
                  {boMode !== PaymentMode.COMPLIMENTARY && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Coupon Code (optional)</label>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border rounded-lg px-3 py-2"
                        placeholder="Enter coupon code"
                        value={boCouponCode}
                        onChange={(e) => { setBoCouponCode(e.target.value); setBoCouponError(null); }}
                      />
                      {!boCoupon ? (
                        <button
                          type="button"
                          disabled={!boCouponCode || boCouponApplying}
                          onClick={async () => {
                            if (!event) return;
                            setBoCouponApplying(true);
                            setBoCouponError(null);
                            try {
                              const selectedSeatObjsLocal = event.seats.filter((s) => selectedSeatIds.includes(s.id));
                              const coupon = await validateCoupon(boCouponCode.trim(), event.id, selectedSeatObjsLocal);
                              setBoCoupon(coupon);
                              try {
                                const quote = await fetchChargesQuote(selectedSeatObjsLocal, coupon.id, event.id, boMode);
                                setBoQuote(quote);
                              } catch (qe) { console.debug('Quote with coupon failed', qe); setBoQuote(null); }
                            } catch (err: any) {
                              setBoCoupon(null);
                              setBoCouponError(err?.message || 'Invalid coupon');
                            } finally {
                              setBoCouponApplying(false);
                            }
                          }}
                          className="px-3 py-2 bg-slate-900 text-white rounded-lg disabled:opacity-60"
                        >
                          {boCouponApplying ? 'Checking...' : 'Apply'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setBoCoupon(null); setBoCouponCode(''); setBoQuote(null); setBoCouponError(null); }}
                          className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {boCoupon && (
                      <p className="text-xs text-green-700 mt-1">Applied: {boCoupon.code} — {boQuote ? `$${(boQuote.discount || 0).toFixed(2)} discount` : 'coupon applied'}</p>
                    )}
                    {boCouponError && <p className="text-xs text-red-600 mt-1">{boCouponError}</p>}
                  </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Payment Mode
                    </label>
                      <div className="grid grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          setBoMode(PaymentMode.CASH);
                          if (!event) return;
                          try {
                            const selectedSeatObjsLocal = event.seats.filter((s) => selectedSeatIds.includes(s.id));
                            const quote = await fetchChargesQuote(selectedSeatObjsLocal, undefined, event.id, PaymentMode.CASH);
                            setBoQuote(quote);
                          } catch {
                            setBoQuote(null);
                          }
                        }}
                        className={`p-3 border rounded-lg flex flex-col items-center justify-center gap-1 transition ${boMode === PaymentMode.CASH ? "bg-green-50 border-green-500 text-green-700" : "hover:bg-slate-50"}`}
                      >
                        <DollarSign className="w-5 h-5" />
                        <span className="text-xs font-bold">CASH</span>
                      </button>
                      {/* <button
                        type="button"
                        onClick={() => setBoMode(PaymentMode.CHARITY)}
                        className={`p-3 border rounded-lg flex flex-col items-center justify-center gap-1 transition ${boMode === PaymentMode.CHARITY ? "bg-purple-50 border-purple-500 text-purple-700" : "hover:bg-slate-50"}`}
                      >
                        <CreditCard className="w-5 h-5" />
                        <span className="text-xs font-bold">CHARITY</span>
                      </button> */}

                      <button
                        type="button"
                        onClick={() => {
                          setBoMode(PaymentMode.COMPLIMENTARY);
                          setBoCoupon(null);
                          setBoCouponCode('');
                          setBoCouponError(null);
                          setBoQuote(null);
                        }}
                        className={`p-3 border rounded-lg flex flex-col items-center justify-center gap-1 transition ${boMode === PaymentMode.COMPLIMENTARY ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "hover:bg-slate-50"}`}
                      >
                        <Ban className="w-5 h-5" />
                        <span className="text-xs font-bold">COMP</span>
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={boProcessing}
                  className="w-full bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 disabled:opacity-70"
                >
                  {boProcessing
                    ? "Processing..."
                    : boMode === PaymentMode.COMPLIMENTARY
                      ? "Confirm Complimentary Booking ($0.00)"
                      : `Confirm Booking ($${(((selectionTotal - ((boQuote && boQuote.discount) || 0)) + ((boQuote && boQuote.serviceFee) || 0))).toFixed(2)})`}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Not Eligible Modal for $0 tickets */}
      {showNotEligibleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 p-4 flex justify-between items-center">
              <h3 className="font-bold text-white">Not Eligible</h3>
              <button
                onClick={() => setShowNotEligibleModal(false)}
                className="text-slate-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-700">This flow cannot be used for $0 price tickets. Use the Hold flow or adjust ticket pricing.</p>
              <div className="mt-6 text-right">
                <button onClick={() => setShowNotEligibleModal(false)} className="px-4 py-2 rounded-lg bg-slate-900 text-white">OK</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hold Order Modal (Pay Later) */}
      {showHoldOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-yellow-600 p-4 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center">
                <Ticket className="w-5 h-5 mr-2" /> Held Order (Pay Later)
              </h3>
              <button
                onClick={() => setShowHoldOrder(false)}
                className="text-slate-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6" style={{height:"600px", overflowY:'scroll'}}>
              <div className="mb-6 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-xs text-yellow-700 uppercase font-bold">
                      Selected Seats
                    </p>
                    <p className="font-medium text-slate-900">
                      {selectedSeatIds.length} seats
                    </p>
                  </div>
                  <p className="text-lg font-bold text-yellow-700">
                    ${selectionTotal.toFixed(2)}
                  </p>
                </div>
                <div className="max-h-32 overflow-y-auto text-sm space-y-1 border-t border-yellow-200 pt-2 mt-2">
                  {selectedSeatObjs.map((seat) => (
                    <div
                      key={seat.id}
                      className="flex justify-between text-slate-600"
                    >
                      <span>
                        {seat.rowLabel}
                        {seat.seatNumber}{" "}
                        <span className="text-xs text-slate-400">
                          ({seat.tier})
                        </span>
                      </span>
                      <span>${(seat.price || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price breakdown for Hold */}
              <div className="mb-4 p-3 bg-white border rounded-lg text-sm">
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Subtotal</span>
                  <span className="font-medium">${selectionTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Discount</span>
                  <span className="font-medium">${((holdQuote && holdQuote.discount) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Service Fee</span>
                  <span className="font-medium">${((holdQuote && holdQuote.serviceFee) || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold mt-2">
                  <span>Total</span>
                  <span>${( (selectionTotal - ((holdQuote && holdQuote.discount) || 0)) + ((holdQuote && holdQuote.serviceFee) || 0) ).toFixed(2)}</span>
                </div>
              </div>

              {/* Hold Information Box */}
              <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-900 font-semibold mb-2">⏰ 24-Hour Hold</p>
                <p className="text-xs text-blue-800">
                  Seats will be held for 24 hours. Customer receives payment email with payment link. If not paid, seats auto-release.
                </p>
              </div>

              <form onSubmit={handleHoldOrderSubmit}>
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Customer Name *
                    </label>
                    <div className="relative">
                      <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        required
                        className="w-full border rounded-lg pl-9 pr-3 py-2"
                        placeholder="e.g. John Smith"
                        value={holdName}
                        onChange={(e) => setHoldName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      required
                      type="email"
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="john@example.com"
                      value={holdEmail}
                      onChange={(e) => setHoldEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Phone Number (Optional)
                    </label>
                    <input
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="+1 555 123 4567"
                      value={holdPhone}
                      onChange={(e) => setHoldPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Coupon Code (optional)</label>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border rounded-lg px-3 py-2"
                        placeholder="Enter coupon code"
                        value={holdCouponCode}
                        onChange={(e) => { setHoldCouponCode(e.target.value); setHoldCouponError(null); }}
                      />
                      {!holdCoupon ? (
                        <button
                          type="button"
                          disabled={!holdCouponCode || holdCouponApplying}
                          onClick={async () => {
                            if (!event) return;
                            setHoldCouponApplying(true);
                            setHoldCouponError(null);
                            try {
                              const selectedSeatObjsLocal = event.seats.filter((s) => selectedSeatIds.includes(s.id));
                              const coupon = await validateCoupon(holdCouponCode.trim(), event.id, selectedSeatObjsLocal);
                              setHoldCoupon(coupon);
                              try {
                                const quote = await fetchChargesQuote(selectedSeatObjsLocal, coupon.id, event.id, PaymentMode.ONLINE);
                                setHoldQuote(quote);
                              } catch (qe) { console.debug('Quote with coupon failed', qe); setHoldQuote(null); }
                            } catch (err: any) {
                              setHoldCoupon(null);
                              setHoldCouponError(err?.message || 'Invalid coupon');
                            } finally {
                              setHoldCouponApplying(false);
                            }
                          }}
                          className="px-3 py-2 bg-slate-900 text-white rounded-lg disabled:opacity-60"
                        >
                          {holdCouponApplying ? 'Checking...' : 'Apply'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setHoldCoupon(null); setHoldCouponCode(''); setHoldQuote(null); setHoldCouponError(null); }}
                          className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {holdCoupon && (
                      <p className="text-xs text-green-700 mt-1">Applied: {holdCoupon.code} — {holdQuote ? `$${(holdQuote.discount || 0).toFixed(2)} discount` : 'coupon applied'}</p>
                    )}
                    {holdCouponError && <p className="text-xs text-red-600 mt-1">{holdCouponError}</p>}
                  </div>
                </div>

                {/* Hold Process Info */}
                <div className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-900 font-semibold mb-2">✓ What Happens Next</p>
                  <ul className="text-xs text-green-800 space-y-1">
                    <li>• Payment-pending email sent to {holdEmail || 'customer'}</li>
                    <li>• Seats reserved for 24 hours</li>
                    <li>• Auto-release if payment not received</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={holdProcessing}
                  className="w-full bg-yellow-600 text-white py-3 rounded-lg font-bold hover:bg-yellow-700 disabled:opacity-70"
                >
                  {holdProcessing
                    ? "Placing Hold..."
                    : `Place Hold ($${(((selectionTotal - ((holdQuote && holdQuote.discount) || 0)) + ((holdQuote && holdQuote.serviceFee) || 0))).toFixed(2)})`}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
     </div>
  );
}
export default EventAnalytics;