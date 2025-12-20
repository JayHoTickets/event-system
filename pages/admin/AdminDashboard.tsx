
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, DollarSign, Calendar, Ticket, Building2, ChevronRight } from 'lucide-react';
import { fetchAllOrders, fetchAllEventsForAdmin, fetchUsersByRole } from '../../services/mockBackend';
import { UserRole, EventStatus } from '../../types';

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ef4444', '#3b82f6'];

const StatCard: React.FC<{ title: string; value: string | number; icon: any; color: string }> = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-slate-500">{title}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
            </div>
            <div className={`p-3 rounded-lg ${color}`}>
                <Icon className="w-6 h-6 text-white" />
            </div>
        </div>
    </div>
);

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Stats State
  const [stats, setStats] = useState({
      revenue: 0,
      tickets: 0,
      activeEvents: 0,
      users: 0
  });
  
  // Charts State
  const [salesData, setSalesData] = useState<any[]>([]);
  const [seatDist, setSeatDist] = useState<any[]>([]);

  useEffect(() => {
     const loadData = async () => {
         try {
             const [orders, events, users] = await Promise.all([
                 fetchAllOrders(),
                 fetchAllEventsForAdmin(),
                 fetchUsersByRole(UserRole.USER)
             ]);

             // 1. Calculate KPI Stats
             const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
             const totalTickets = orders.reduce((sum, o) => sum + o.tickets.length, 0);
             const activeEventsCount = events.filter(e => e.status === EventStatus.PUBLISHED).length;
             
             setStats({
                 revenue: totalRevenue,
                 tickets: totalTickets,
                 activeEvents: activeEventsCount,
                 users: users.length
             });

             // 2. Prepare Revenue by Event Chart
             const salesMap: Record<string, number> = {};
             orders.forEach(o => {
                 // Iterate tickets to attribute sales to specific events correctly
                 // Note: In this system, orders are typically for one event, but we iterate tickets to be precise.
                 o.tickets.forEach(t => {
                    const title = t.eventTitle || 'Unknown Event';
                    salesMap[title] = (salesMap[title] || 0) + t.price;
                 });
             });

             const salesChart = Object.entries(salesMap)
                .map(([name, sales]) => ({ name, sales }))
                .sort((a,b) => b.sales - a.sales)
                .slice(0, 5); // Top 5 Events
             
             setSalesData(salesChart);

             // 3. Prepare Seat/Ticket Type Distribution
             const typeMap: Record<string, number> = {};
             orders.forEach(o => {
                 o.tickets.forEach(t => {
                     const typeName = t.ticketType || 'Standard';
                     typeMap[typeName] = (typeMap[typeName] || 0) + 1;
                 });
             });

             const seatChart = Object.entries(typeMap)
                .map(([name, value]) => ({ name, value }))
                .sort((a, b) => b.value - a.value);

             setSeatDist(seatChart);

             setLoading(false);
         } catch (error) {
             console.error("Failed to load dashboard data", error);
             setLoading(false);
         }
     };

     loadData();
  }, []);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading dashboard analytics...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
        
        {/* Quick Action to Venues */}
        <button 
            onClick={() => navigate('/admin/venues')}
            className="bg-slate-900 text-white px-5 py-3 rounded-lg flex items-center shadow-lg hover:bg-slate-800 transition"
        >
            <Building2 className="w-5 h-5 mr-2" />
            Manage Venues
            <ChevronRight className="w-4 h-4 ml-1 opacity-50" />
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
            title="Total Revenue" 
            value={`$${stats.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
            icon={DollarSign} 
            color="bg-green-500" 
        />
        <StatCard title="Tickets Sold" value={stats.tickets.toLocaleString()} icon={Ticket} color="bg-blue-500" />
        <StatCard title="Active Events" value={stats.activeEvents} icon={Calendar} color="bg-purple-500" />
        <StatCard title="Registered Users" value={stats.users} icon={Users} color="bg-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Sales Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-96">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Top Events by Revenue</h2>
            {salesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                        <Tooltip 
                            cursor={{ fill: '#f8fafc' }} 
                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                        />
                        <Bar dataKey="sales" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400">No sales data yet.</div>
            )}
        </div>

        {/* Demographics/Pie */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-96">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Ticket Type Distribution</h2>
            {seatDist.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={seatDist}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {seatDist.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-slate-400">No ticket data yet.</div>
            )}
            {seatDist.length > 0 && (
                <div className="flex flex-wrap justify-center gap-4 mt-[-20px] relative z-10">
                    {seatDist.map((entry, index) => (
                        <div key={entry.name} className="flex items-center text-xs text-slate-600">
                            <div className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                            {entry.name}: {entry.value}
                        </div>
                    ))}
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;
