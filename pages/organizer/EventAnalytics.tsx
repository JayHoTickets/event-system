import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchEventById,
  fetchEventOrders,
  updateSeatStatus,
  processPayment,
} from "../../services/mockBackend";
import {
  Event,
  Order,
  SeatingType,
  SeatStatus,
  PaymentMode,
  Seat,
} from "../../types";
import {
  ArrowLeft,
  DollarSign,
  Ticket,
  Calendar,
  Search,
  Filter,
  Download,
  Eye,
  X,
  Map as MapIcon,
  BarChart2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Ban,
  CheckCircle,
  CreditCard,
  User as UserIcon,
  UserCheck,
  PieChart as PieChartIcon,
} from "lucide-react";
import { formatDateInTimeZone, formatTimeInTimeZone } from "../../utils/date";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import SeatGrid, { CELL_SIZE } from "../../components/SeatGrid";
import clsx from "clsx";

const EventAnalytics: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<Event | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<
    "ALL" | "PAID" | "FAILED" | "REFUNDED"
  >("ALL");
  const [orderModeFilter, setOrderModeFilter] = useState<"ALL" | PaymentMode>(
    "ALL",
  );

  // View State
  const [activeView, setActiveView] = useState<"STATS" | "MAP" | "CHECKIN">(
    "STATS",
  );

  // Map Zoom State
  const [zoom, setZoom] = useState(1);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Selection State
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);

  // Modal State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showBoxOffice, setShowBoxOffice] = useState(false);

  // Box Office Form
  const [boName, setBoName] = useState("");
  const [boEmail, setBoEmail] = useState("");
  const [boPhone, setBoPhone] = useState("");
  const [boMode, setBoMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [boProcessing, setBoProcessing] = useState(false);

  // Check-in Report State
  const [ticketSearch, setTicketSearch] = useState("");
  const [checkInFilter, setCheckInFilter] = useState<
    "ALL" | "CHECKED_IN" | "PENDING"
  >("ALL");

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = () => {
    if (id) {
      Promise.all([fetchEventById(id), fetchEventOrders(id)]).then(
        ([eData, oData]) => {
          setEvent(eData || null);
          setOrders(oData);
          setLoading(false);
        },
      );
    }
  };

  // Auto-fit map when switching to MAP view
  useEffect(() => {
    if (
      activeView === "MAP" &&
      event &&
      event.seatingType === SeatingType.RESERVED &&
      mapContainerRef.current
    ) {
      const padding = 100;
      const cols = event.cols || 30;
      const contentW = cols * CELL_SIZE + padding;
      const containerW = mapContainerRef.current.clientWidth;
      const newScale = Math.min(1, (containerW - 40) / contentW);
      setZoom(Math.max(0.2, newScale));
    }
  }, [activeView, event]);

  if (loading)
    return (
      <div className="p-10 text-center text-slate-500">
        Loading analytics...
      </div>
    );
  if (!event)
    return <div className="p-10 text-center text-red-500">Event not found</div>;

  // --- Stats Calculation ---
  // Subtract service fees from total amount to show net revenue to organizer
  const totalRevenue = orders.reduce(
    (acc, o) => acc + (o.totalAmount - (o.serviceFee || 0)),
    0,
  );
  const totalTicketsSold = orders.reduce((acc, o) => acc + o.tickets.length, 0);
  const totalCapacity = event.seats.length;
  const percentageSold =
    totalCapacity > 0
      ? Math.round((totalTicketsSold / totalCapacity) * 100)
      : 0;

  // Check-in Stats
  const totalCheckedIn = orders.reduce(
    (acc, o) => acc + o.tickets.filter((t) => t.checkedIn).length,
    0,
  );
  const percentageCheckedIn =
    totalTicketsSold > 0
      ? Math.round((totalCheckedIn / totalTicketsSold) * 100)
      : 0;

  // --- Chart Data Preparation ---
  const salesByType: Record<string, number> = {};
  orders.forEach((o) => {
    o.tickets.forEach((t) => {
      const type = t.ticketType || "Unknown";
      salesByType[type] = (salesByType[type] || 0) + 1;
    });
  });

  const chartData = Object.entries(salesByType).map(([name, count]) => ({
    name,
    count,
  }));
  const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e"];
  const CHECKIN_COLORS = ["#22c55e", "#e2e8f0"]; // Green for checked in, Grey for pending

  const checkInData = [
    { name: "Checked In", value: totalCheckedIn },
    { name: "Pending", value: totalTicketsSold - totalCheckedIn },
  ];

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
        orderStatusFilter === "ALL" ? true : o.status === orderStatusFilter;

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

      const escapeCell = (v: any) => {
        if (v === null || v === undefined) return "";
        return `"${String(v).replace(/"/g, '""')}"`;
      };

      const csv = [headers, ...rows]
        .map((r) => r.map(escapeCell).join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${event?.id || "event"}-checkin-report.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed", err);
      alert("Export failed. Check console for details.");
    }
  };

  const isReserved = event.seatingType === SeatingType.RESERVED;

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
    await updateSeatStatus(event.id, selectedSeatIds, SeatStatus.UNAVAILABLE);
    setSelectedSeatIds([]);
    loadData();
  };

  const handleUnblockSeats = async () => {
    if (!event) return;
    await updateSeatStatus(event.id, selectedSeatIds, SeatStatus.AVAILABLE);
    setSelectedSeatIds([]);
    loadData();
  };

  const handleOpenBoxOffice = () => {
    setBoName("");
    setBoEmail("");
    setBoMode(PaymentMode.CASH);
    setShowBoxOffice(true);
  };

  const handleBoxOfficeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event) return;
    setBoProcessing(true);

    const selectedSeatObjs = event.seats.filter((s) =>
      selectedSeatIds.includes(s.id),
    );

    try {
      await processPayment(
        { name: boName, email: boEmail, phone: boPhone },
        event,
        selectedSeatObjs,
        0, // No service fee for box office
        undefined,
        boMode,
      );
      setBoProcessing(false);
      setShowBoxOffice(false);
      setSelectedSeatIds([]);
      loadData();
      alert("Booking confirmed!");
    } catch (err) {
      alert("Booking failed");
      setBoProcessing(false);
    }
  };

  const selectedSeatObjs = event.seats.filter((s) =>
    selectedSeatIds.includes(s.id),
  );
  const selectionTotal = selectedSeatObjs.reduce(
    (acc, s) => acc + (s.price || 0),
    0,
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative">
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
          <button
            onClick={handleExport}
            className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg flex items-center hover:bg-slate-50 text-sm font-medium"
          >
            <Download className="w-4 h-4 mr-2" /> Export
          </button>
          <button
            onClick={() => navigate("/organizer/scanner")}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 text-sm font-medium"
          >
            <UserCheck className="w-4 h-4 mr-2" /> Scan Tickets
          </button>
        </div>
      </div>

      {/* VIEW TOGGLE TABS */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto">
        <button
          onClick={() => setActiveView("STATS")}
          className={clsx(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center whitespace-nowrap",
            activeView === "STATS"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
          )}
        >
          <BarChart2 className="w-4 h-4 mr-2" /> Overview & Sales
        </button>
        <button
          onClick={() => setActiveView("CHECKIN")}
          className={clsx(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center whitespace-nowrap",
            activeView === "CHECKIN"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
          )}
        >
          <PieChartIcon className="w-4 h-4 mr-2" /> Check-in Report
        </button>
        {isReserved && (
          <button
            onClick={() => setActiveView("MAP")}
            className={clsx(
              "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center whitespace-nowrap",
              activeView === "MAP"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
            )}
          >
            <MapIcon className="w-4 h-4 mr-2" /> Live Seating Map
          </button>
        )}
      </div>

      {activeView === "STATS" && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500 uppercase">
                    Total Revenue
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">
                    ${totalRevenue.toLocaleString()}
                  </h3>
                </div>
                <div className="p-3 bg-green-100 text-green-600 rounded-lg">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500 uppercase">
                    Tickets Sold
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">
                    {totalTicketsSold}{" "}
                    <span className="text-sm font-normal text-slate-400">
                      {totalCapacity > 0 ? `/ ${totalCapacity}` : ""}
                    </span>
                  </h3>
                </div>
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Ticket className="w-6 h-6" />
                </div>
              </div>
              {totalCapacity > 0 && (
                <div className="w-full bg-slate-100 h-1.5 mt-4 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full"
                    style={{ width: `${percentageSold}%` }}
                  ></div>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-slate-500 uppercase">
                    Attendance
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900 mt-1">
                    {totalCheckedIn}{" "}
                    <span className="text-sm font-normal text-slate-400">
                      / {totalTicketsSold}
                    </span>
                  </h3>
                </div>
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                  <UserCheck className="w-6 h-6" />
                </div>
              </div>
              <div className="w-full bg-slate-100 h-1.5 mt-4 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full"
                  style={{ width: `${percentageCheckedIn}%` }}
                ></div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <p className="text-sm font-medium text-slate-500 uppercase mb-4">
                Sales by Ticket Type
              </p>
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                  >
                    <Tooltip cursor={{ fill: "#f8fafc" }} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" hide />
                    <Bar dataKey="count" barSize={10} radius={[0, 4, 4, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
              <h2 className="text-lg font-bold text-slate-900">
                Order Management
              </h2>
              <div className="flex gap-2 items-center w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Search order ID, email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <input
                  type="date"
                  className="border rounded-lg px-3 py-2 text-sm bg-white"
                  value={orderDateFrom}
                  onChange={(e) => setOrderDateFrom(e.target.value)}
                  title="From date"
                />
                <input
                  type="date"
                  className="border rounded-lg px-3 py-2 text-sm bg-white"
                  value={orderDateTo}
                  onChange={(e) => setOrderDateTo(e.target.value)}
                  title="To date"
                />
                <select
                  className="border rounded-lg px-3 py-2 text-sm bg-white"
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value as any)}
                >
                  <option value="ALL">All Status</option>
                  <option value="PAID">Paid</option>
                  <option value="FAILED">Failed</option>
                  <option value="REFUNDED">Refunded</option>
                </select>
                <select
                  className="border rounded-lg px-3 py-2 text-sm bg-white"
                  value={orderModeFilter}
                  onChange={(e) => setOrderModeFilter(e.target.value as any)}
                >
                  <option value="ALL">All Modes</option>
                  <option value="ONLINE">Online</option>
                  <option value="CASH">Cash</option>
                  <option value="CHARITY">Charity</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">
                      Order ID
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">
                      Received
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">
                      Customer
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">
                      Items
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">
                      Total (Net)
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">
                      Mode
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700">
                      Status
                    </th>
                    <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-6 py-12 text-center text-slate-400"
                      >
                        No orders found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm font-mono text-slate-600">
                          {order.id}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatDateInTimeZone(order.date, event.timezone)} at{" "}
                          {formatTimeInTimeZone(order.date, event.timezone)}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-900">
                            {order.customerName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {order.customerEmail}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {order.tickets.length} Tickets
                          {order.couponCode && (
                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200">
                              {order.couponCode}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">
                          $
                          {(
                            order.totalAmount - (order.serviceFee || 0)
                          ).toFixed(2)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                            {order.paymentMode || "ONLINE"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              order.status === "PAID"
                                ? "bg-green-100 text-green-800"
                                : order.status === "REFUNDED"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="text-slate-500 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeView === "CHECKIN" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Left Column: Summary */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-4">
                Check-in Progress
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={checkInData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {checkInData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHECKIN_COLORS[index % CHECKIN_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center mt-2">
                <p className="text-3xl font-bold text-slate-900">
                  {totalCheckedIn}
                </p>
                <p className="text-sm text-slate-500">
                  Checked In out of {totalTicketsSold}
                </p>
              </div>
            </div>

            <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
              <h4 className="font-bold text-indigo-900 mb-2">Quick Stats</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-indigo-700">Percentage</span>
                  <span className="font-bold text-indigo-900">
                    {percentageCheckedIn}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-indigo-700">Remaining</span>
                  <span className="font-bold text-indigo-900">
                    {totalTicketsSold - totalCheckedIn}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-indigo-700">Last Scan</span>
                  <span className="font-bold text-indigo-900">
                    {/* Find most recent check-in */}
                    {allTickets
                      .filter((t) => t.checkedIn)
                      .sort(
                        (a, b) =>
                          new Date(b.checkInDate!).getTime() -
                          new Date(a.checkInDate!).getTime(),
                      )[0]?.checkInDate
                      ? new Date(
                          allTickets
                            .filter((t) => t.checkedIn)
                            .sort(
                              (a, b) =>
                                new Date(b.checkInDate!).getTime() -
                                new Date(a.checkInDate!).getTime(),
                            )[0].checkInDate!,
                        ).toLocaleTimeString()
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Detailed List */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[800px]">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50 rounded-t-xl">
              <h3 className="font-bold text-slate-900">
                Attendee List ({filteredTickets.length})
              </h3>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Search name, ticket ID..."
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                  />
                </div>
                <select
                  className="border rounded-lg px-3 py-2 text-sm bg-white"
                  value={checkInFilter}
                  onChange={(e) => setCheckInFilter(e.target.value as any)}
                >
                  <option value="ALL">All Tickets</option>
                  <option value="CHECKED_IN">Checked In</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  No tickets found matching your filters.
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Ticket Info
                      </th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                        Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900 text-sm">
                            {ticket.seatLabel}
                          </p>
                          <p className="text-xs font-mono text-slate-400">
                            {ticket.id}
                          </p>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 mt-1 inline-block">
                            {ticket.ticketType || "Standard"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-900">
                            {ticket.customerName}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          {ticket.checkedIn ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" /> Checked
                              In
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-slate-500">
                          {ticket.checkedIn && ticket.checkInDate
                            ? new Date(ticket.checkInDate).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" },
                              )
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {activeView === "MAP" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[600px] relative">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
            <div className="flex items-center gap-4">
              <h2 className="font-bold text-slate-900">Seating Status</h2>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-slate-200 border border-slate-300 rounded"></div>
                  <span>Sold</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-amber-100 border border-amber-200 rounded"></div>
                  <span>Held</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-amber-200 border border-amber-300 rounded animate-pulse"></div>
                  <span>Booking (In-progress)</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-slate-800 border border-slate-800 flex items-center justify-center rounded">
                    <div className="w-2 h-px bg-slate-500 rotate-45 transform absolute"></div>
                    <div className="w-2 h-px bg-slate-500 -rotate-45 transform absolute"></div>
                  </div>
                  <span>Blocked</span>
                </div>
                {event.ticketTypes.map((tt) => (
                  <div key={tt.id} className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: tt.color }}
                    ></div>
                    <span>{tt.name} (Avail)</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 bg-white p-1 rounded border shadow-sm">
              <button
                onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-500 w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="p-1.5 hover:bg-slate-100 rounded text-slate-600 border-l ml-1"
                title="Reset"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div
            ref={mapContainerRef}
            className="flex-1 bg-slate-100 overflow-hidden flex items-center justify-center p-4"
          >
            <SeatGrid
              seats={event.seats}
              stage={event.stage}
              selectedSeatIds={selectedSeatIds}
              totalRows={event.rows}
              totalCols={event.cols}
              scale={zoom}
              onSeatClick={handleSeatClick}
              allowDragSelect={true}
              onBulkSelect={handleBulkSelect}
              canSelectUnavailable={true}
            />
          </div>

          {/* Floating Action Bar */}
          {selectedSeatIds.length > 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 flex gap-2 animate-in slide-in-from-bottom-4 duration-200 z-10">
              <div className="flex items-center px-4 border-r border-slate-200 mr-2">
                <span className="font-bold text-indigo-600">
                  {selectedSeatIds.length}
                </span>
                <span className="text-sm text-slate-500 ml-1">selected</span>
              </div>
              <button
                onClick={handleBlockSeats}
                className="flex items-center px-4 py-2 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition"
              >
                <Ban className="w-4 h-4 mr-2 text-red-500" /> Block
              </button>
              <button
                onClick={handleUnblockSeats}
                className="flex items-center px-4 py-2 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition"
              >
                <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Unblock
              </button>
              <div className="w-px bg-slate-200 mx-1"></div>
              <button
                onClick={handleOpenBoxOffice}
                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm"
              >
                <Ticket className="w-4 h-4 mr-2" /> Book (Box Office)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  Order Details
                </h3>
                <p className="text-sm text-slate-500 font-mono">
                  {selectedOrder.id}
                </p>
                <p className="text-sm text-slate-500">
                  Received:{" "}
                  {formatDateInTimeZone(selectedOrder.date, event.timezone)} at{" "}
                  {formatTimeInTimeZone(selectedOrder.date, event.timezone)}
                </p>
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-sm text-slate-500">Event</div>
                <div className="font-medium text-slate-900">{event?.title}</div>
                <div className="text-xs text-slate-500">
                  {event
                    ? formatDateInTimeZone(event.startTime, event.timezone)
                    : ""}
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200 rounded-full transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {/* Customer Info */}
              <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Customer Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 block mb-1">Name</span>
                    <span className="font-medium text-slate-900">
                      {selectedOrder.customerName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Email</span>
                    <span className="font-medium text-slate-900">
                      {selectedOrder.customerEmail}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Phone</span>
                    <span className="font-medium text-slate-900">
                      {selectedOrder.customerPhone}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">
                      Payment Mode
                    </span>
                    <span className="font-bold text-slate-900">
                      {selectedOrder.paymentMode || "ONLINE"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Status</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        selectedOrder.status === "PAID"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {selectedOrder.status}
                    </span>
                  </div>
                </div>
              </div>

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
                      <th className="px-4 py-2 font-medium text-slate-600">
                        Ticket Type
                      </th>
                      <th className="px-4 py-2 font-medium text-slate-600">
                        Seat / Label
                      </th>
                      <th className="px-4 py-2 font-medium text-slate-600 text-right">
                        Price
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.tickets.map((t) => (
                      <tr key={t.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Ticket className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-900">
                              {t.ticketType || "Standard"}
                            </span>
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

              {/* Totals */}
              <div className="flex justify-end mb-6">
                <div className="w-64 space-y-2">
                  {selectedOrder.discountApplied > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-${selectedOrder.discountApplied.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center font-bold text-xl text-slate-900 border-t pt-3 mt-2">
                    <span>Total Paid</span>
                    <span>${selectedOrder.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Cancel Order Button - Placed below totals */}
              <div className="border-t pt-6">
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      // Add your cancel order logic here
                      alert("Cancel order functionality to be implemented");
                    }}
                    disabled={selectedOrder.status !== "PAID"}
                    className={`px-4 py-2 rounded-lg font-medium text-sm ${
                      selectedOrder.status !== "PAID"
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                    }`}
                  >
                    Cancel Order & Refund
                  </button>
                </div>
                {selectedOrder.status !== "PAID" && (
                  <p className="text-xs text-slate-500 text-right mt-2">
                    Only PAID orders can be cancelled
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Box Office Modal */}
      {showBoxOffice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
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
            <div className="p-6">
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
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Payment Mode
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setBoMode(PaymentMode.CASH)}
                        className={`p-3 border rounded-lg flex flex-col items-center justify-center gap-1 transition ${boMode === PaymentMode.CASH ? "bg-green-50 border-green-500 text-green-700" : "hover:bg-slate-50"}`}
                      >
                        <DollarSign className="w-5 h-5" />
                        <span className="text-xs font-bold">CASH</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setBoMode(PaymentMode.CHARITY)}
                        className={`p-3 border rounded-lg flex flex-col items-center justify-center gap-1 transition ${boMode === PaymentMode.CHARITY ? "bg-purple-50 border-purple-500 text-purple-700" : "hover:bg-slate-50"}`}
                      >
                        <CreditCard className="w-5 h-5" />
                        <span className="text-xs font-bold">
                          CHARITY / COMP
                        </span>
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
                    : `Confirm Booking ($${selectionTotal.toFixed(2)})`}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventAnalytics;
