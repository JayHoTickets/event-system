import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Search, Download, Eye, Ticket, DollarSign } from 'lucide-react';
import { formatDateInTimeZone, formatTimeInTimeZone } from '../../../utils/date';

const EventAnalyticsStats: React.FC<any> = (props) => {
  const {
    event,
    totalRevenue,
    totalTicketsSold,
    totalCapacity,
    percentageSold,
    totalEarningOnline,
    totalEarningCash,
    chartData,
    COLORS,
    filteredOrders,
    searchTerm,
    setSearchTerm,
    orderDateFrom,
    setOrderDateFrom,
    orderDateTo,
    setOrderDateTo,
    orderStatusFilter,
    setOrderStatusFilter,
    orderModeFilter,
    setOrderModeFilter,
    handleExportOrders,
    setSelectedOrder,
  } = props;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase">Total Revenue</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">${totalRevenue.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-green-100 text-green-600 rounded-lg">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 uppercase">Tickets Sold</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalTicketsSold} <span className="text-sm font-normal text-slate-400">{totalCapacity > 0 ? `/ ${totalCapacity}` : ""}</span></h3>
            </div>
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
              <Ticket className="w-6 h-6" />
            </div>
          </div>
          {totalCapacity > 0 && (
            <div className="w-full bg-slate-100 h-1.5 mt-4 rounded-full overflow-hidden">
              <div className="bg-indigo-600 h-full" style={{ width: `${percentageSold}%` }} />
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500 uppercase mb-4">Sales by Ticket Type</p>
          <div className="h-20">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Tooltip cursor={{ fill: "#f8fafc" }} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" hide />
                <Bar dataKey="count" barSize={10} radius={[0, 4, 4, 0]}>
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Earnings by payment channel</h2>
          <p className="text-sm text-slate-500 mt-1">Actual earning (total paid minus service fees), non-cancelled orders only.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Channel</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Total earning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-slate-900">Online</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">${totalEarningOnline.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-slate-900">Cash</td>
                <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">${totalEarningCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold text-slate-900">Order Management</h2>
          <div className="flex gap-2 items-center w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input type="text" className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Search order ID, email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-white" value={orderDateFrom} onChange={e => setOrderDateFrom(e.target.value)} title="From date" />
            <input type="date" className="border rounded-lg px-3 py-2 text-sm bg-white" value={orderDateTo} onChange={e => setOrderDateTo(e.target.value)} title="To date" />
            <select className="border rounded-lg px-3 py-2 text-sm bg-white" value={orderStatusFilter} onChange={e => setOrderStatusFilter(e.target.value as any)}>
              <option value="ALL">All Status</option>
              <option value="PAID">Paid</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select className="border rounded-lg px-3 py-2 text-sm bg-white" value={orderModeFilter} onChange={e => setOrderModeFilter(e.target.value as any)}>
              <option value="ALL">All Modes</option>
              <option value="ONLINE">Online</option>
              <option value="CASH">Cash</option>
              <option value="CHARITY">Charity</option>
            </select>
            <button onClick={handleExportOrders} className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg flex items-center hover:bg-slate-50 text-sm font-medium"><Download className="w-4 h-4 mr-2" /> Export</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Order ID</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Received</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Customer</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Booked By</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Items</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Actual Earning</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Service Fee</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Total</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Mode</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Refund Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-400">No orders found matching criteria.</td>
                </tr>
              ) : (
                filteredOrders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-600">{order.id}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDateInTimeZone(order.date, event.timezone)} at {formatTimeInTimeZone(order.date, event.timezone)}</td>
                    <td className="px-6 py-4"><p className="text-sm font-medium text-slate-900">{order.customerName}</p><p className="text-xs text-slate-500">{order.customerEmail}</p></td>
                    <td className="px-6 py-4"><p className="text-sm font-medium text-slate-900">{(order.bookedBy && (order.bookedBy.name || order.bookedBy.id)) ? `${order.bookedBy.name || order.bookedBy.id}${order.bookedBy.role ? ` (${order.bookedBy.role})` : ''}` : (order.userId && !String(order.userId).startsWith('guest-') ? order.userId : order.customerName)}</p></td>
                    <td className="px-6 py-4 text-sm text-slate-600">{order.tickets.length} Tickets {order.couponCode && <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200">{order.couponCode}</span>}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">${(((order.totalAmount || 0) - (order.serviceFee || 0))).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">${(order.serviceFee || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">${(order.totalAmount || 0).toFixed(2)}</td>
                    <td className="px-6 py-4"><span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{order.paymentMode || 'ONLINE'}</span></td>
                    <td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${order.status === 'PAID' ? 'bg-green-100 text-green-800' : order.status === 'REFUNDED' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{order.status}</span></td>
                    <td className="px-6 py-4">{order.status === 'CANCELLED' ? (<span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${(order.refundStatus || 'PENDING') === 'PROCESSED' ? 'bg-green-100 text-green-800' : (order.refundStatus || 'PENDING') === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{(order.refundStatus || 'PENDING')}</span>) : (<span className="text-sm text-slate-400">—</span>)}</td>
                    <td className="px-6 py-4 text-right"><button onClick={() => setSelectedOrder(order)} className="text-slate-500 hover:text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition" title="View Details"><Eye className="w-4 h-4" /></button></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default EventAnalyticsStats;
