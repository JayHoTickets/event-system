import React from 'react';
import { Search, Download, Eye } from 'lucide-react';
import { formatDateInTimeZone, formatTimeInTimeZone } from '../../../utils/date';

const fmtMoney = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const EventAnalyticsStats: React.FC<any> = (props) => {
  const {
    event,
    totalOnlinePaid,
    onlineServiceFeesPaid,
    onlineTotalEarning,
    totalCashCollected,
    dueCashServiceFee,
    estimatedCashEarning,
    onlineEarningMinusDueCashService,
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

  const row = (
    label: string,
    value: number,
    options?: { valueClassName?: string; format?: (n: number) => string },
  ) => {
    const valueClassName =
      options?.valueClassName ?? 'font-semibold text-slate-900 tabular-nums text-right';
    const display = options?.format ? options.format(value) : fmtMoney(value);
    return (
      <div className="flex justify-between items-baseline gap-3 text-sm">
        <span className="text-slate-600 shrink-0">{label}</span>
        <span className={valueClassName}>{display}</span>
      </div>
    );
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="space-y-3">
            {row('Total Online Sales', totalOnlinePaid)}
            {row('Service Fees Collected', onlineServiceFeesPaid)}
            {row('Net Online Revenue', onlineTotalEarning)}
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="space-y-3">
            {row('Total Offline Sales', totalCashCollected)}
            {row('Due Service Fees', dueCashServiceFee, {
              valueClassName: 'font-semibold text-red-600 tabular-nums text-right',
              format: (n) => `-${fmtMoney(n)}`,
            })}
            {row('Net Offline Revenue:-', estimatedCashEarning)}
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="space-y-3">
            {row('Total Payout', onlineEarningMinusDueCashService, {
              valueClassName:
                onlineEarningMinusDueCashService < 0
                  ? 'font-semibold text-red-600 tabular-nums text-right'
                  : 'font-semibold text-green-600 tabular-nums text-right',
            })}
          </div>
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
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Order Date</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Customer</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Booked By</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Tickets</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Net Revenue</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">PLatform Fee</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Order Amount</th>
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
