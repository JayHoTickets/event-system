import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Search, Download, CheckCircle, UserCheck } from 'lucide-react';

const EventAnalyticsCheckin: React.FC<any> = (props) => {
  const {
    filteredTickets,
    ticketSearch,
    setTicketSearch,
    checkInFilter,
    setCheckInFilter,
    handleExport,
    totalCheckedIn,
    totalTicketsSold,
    percentageCheckedIn,
    allTickets,
  } = props;

  const CHECKIN_COLORS = ["#22c55e", "#e2e8f0"];
  const checkInData = [
    { name: "Checked In", value: totalCheckedIn },
    { name: "Pending", value: totalTicketsSold - totalCheckedIn },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold text-slate-900 mb-4">Check-in Progress</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={checkInData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {checkInData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHECKIN_COLORS[index % CHECKIN_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="text-center mt-2">
            <p className="text-3xl font-bold text-slate-900">{totalCheckedIn}</p>
            <p className="text-sm text-slate-500">Checked In out of {totalTicketsSold}</p>
          </div>
        </div>

        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
          <h4 className="font-bold text-indigo-900 mb-2">Quick Stats</h4>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-indigo-700">Percentage</span><span className="font-bold text-indigo-900">{percentageCheckedIn}%</span></div>
            <div className="flex justify-between"><span className="text-indigo-700">Remaining</span><span className="font-bold text-indigo-900">{totalTicketsSold - totalCheckedIn}</span></div>
            <div className="flex justify-between"><span className="text-indigo-700">Last Scan</span><span className="font-bold text-indigo-900">{allTickets.filter((t:any) => t.checkedIn).sort((a:any,b:any)=>new Date(b.checkInDate).getTime()-new Date(a.checkInDate).getTime())[0]?.checkInDate ? new Date(allTickets.filter((t:any)=>t.checkedIn).sort((a:any,b:any)=>new Date(b.checkInDate).getTime()-new Date(a.checkInDate).getTime())[0].checkInDate!).toLocaleTimeString() : 'N/A'}</span></div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[800px]">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50 rounded-t-xl">
          <h3 className="font-bold text-slate-900">Attendee List ({filteredTickets.length})</h3>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input type="text" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Search name, ticket ID..." value={ticketSearch} onChange={(e)=>setTicketSearch(e.target.value)} />
            </div>
            <select className="border rounded-lg px-3 py-2 text-sm bg-white" value={checkInFilter} onChange={(e)=>setCheckInFilter(e.target.value as any)}>
              <option value="ALL">All Tickets</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="PENDING">Pending</option>
            </select>
            <button onClick={handleExport} className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg flex items-center hover:bg-slate-50 text-sm font-medium"><Download className="w-4 h-4 mr-2" /> Export</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-20 text-slate-400">No tickets found matching your filters.</div>
          ) : (
            <table className="w-full text-left">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Info</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((ticket:any) => (
                  <tr key={ticket.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4"><p className="font-bold text-slate-900 text-sm">{ticket.seatLabel}</p><p className="text-xs font-mono text-slate-400">{ticket.id}</p><span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 mt-1 inline-block">{ticket.ticketType || "Standard"}</span></td>
                    <td className="px-6 py-4"><p className="text-sm font-medium text-slate-900">{ticket.customerName}</p></td>
                    <td className="px-6 py-4">{ticket.checkedIn ? (<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1"/> Checked In</span>) : (<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">Pending</span>)}</td>
                    <td className="px-6 py-4 text-right text-sm text-slate-500">{ticket.checkedIn && ticket.checkInDate ? new Date(ticket.checkInDate).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventAnalyticsCheckin;
