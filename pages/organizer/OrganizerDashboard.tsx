
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEventsByOrganizer, updateEvent, deleteEvent } from '../../services/mockBackend';
import { Event, User, EventStatus } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Plus, Calendar, MapPin, Ticket, AlertCircle, Search, Trash2, Edit, Tag, BarChart2 } from 'lucide-react';
import { formatDateInTimeZone, formatTimeInTimeZone } from '../../utils/date';
import clsx from 'clsx';

type TabType = 'ALL' | 'PUBLISHED' | 'DRAFT' | 'CANCELLED' | 'COMPLETED' | 'DELETED';

const OrganizerDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('ALL');

    useEffect(() => {
        loadEvents();
    }, [user, activeTab]);

    const loadEvents = () => {
        if (user) {
            setLoading(true);
            // If logged in user is a STAFF, use their organizerId to fetch organizer-scoped resources
            const organizerId = (user.role === 'STAFF') ? (user as any).organizerId : user.id;
            // Always fetch all events (including deleted) so tab counts are accurate
            fetchEventsByOrganizer(organizerId, true).then(data => {
                setEvents(data);
                setLoading(false);
            });
        }
    }

    const handleStatusChange = async (eventId: string, newStatus: EventStatus) => {
        // Optimistic update
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, status: newStatus } : e));
        try {
            await updateEvent(eventId, { status: newStatus });
        } catch (error) {
            console.error("Failed to update status", error);
            loadEvents(); // Revert on error
        }
    };

    const handleDelete = async (eventId: string) => {
        if (window.confirm("Are you sure you want to delete this event? This action moves it to trash.")) {
            setEvents(prev => prev.filter(e => e.id !== eventId)); // Optimistic remove
            try {
                await deleteEvent(eventId);
            } catch (error) {
                 console.error("Failed to delete", error);
                 loadEvents();
            }
        }
    };

    const filteredEvents = events.filter(e => {
        if (activeTab === 'ALL') return !e.deleted;
        if (activeTab === 'DELETED') return e.deleted === true;
        return !e.deleted && e.status === activeTab;
    });

    const getStatusStyle = (status: string) => {
        switch(status) {
            case 'PUBLISHED': return 'bg-green-100 text-green-800 border-green-200';
            case 'DRAFT': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-200';
            case 'COMPLETED': return 'bg-slate-100 text-slate-800 border-slate-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Organizer Dashboard</h1>
                    <p className="text-slate-500 mt-1">Manage your events and ticket sales.</p>
                </div>
                <div className="flex gap-3">
                    {/* <button 
                        onClick={() => navigate('/organizer/coupons')}
                        className="bg-white border border-slate-300 text-slate-700 px-5 py-2.5 rounded-lg flex items-center shadow-sm hover:bg-slate-50 transition font-medium"
                    >
                        <Tag className="w-5 h-5 mr-2" />
                        Manage Coupons
                    </button> */}
                    <button 
                        onClick={() => navigate('/organizer/create-event')}
                        className="bg-black text-white px-5 py-2.5 rounded-lg flex items-center shadow-md hover:bg-[#d7ae4b] hover:text-black transition font-medium"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Create New Event
                    </button>
                </div>
            </div> 

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Total Events', value: events.filter(e => !e.deleted).length },
                    { label: 'Published', value: events.filter(e => !e.deleted && e.status === EventStatus.PUBLISHED).length },
                    { label: 'Drafts', value: events.filter(e => !e.deleted && e.status === EventStatus.DRAFT).length },
                    { label: 'Completed', value: events.filter(e => !e.deleted && e.status === EventStatus.COMPLETED).length },
                ].map((stat, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{stat.label}</p>
                        <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 mb-6 overflow-x-auto">
                {(['ALL', 'PUBLISHED', 'DRAFT', 'COMPLETED', 'CANCELLED', 'DELETED'] as TabType[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={clsx(
                            "px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                            activeTab === tab 
                                ? "border-indigo-600 text-indigo-600" 
                                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                        )}
                    >
                        {tab.charAt(0) + tab.slice(1).toLowerCase()} 
                        <span className="ml-2 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                            {tab === 'ALL' ? events.filter(e => !e.deleted).length : tab === 'DELETED' ? events.filter(e => e.deleted).length : events.filter(e => !e.deleted && e.status === tab).length}
                        </span>
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading events...</div>
            ) : filteredEvents.length === 0 ? (
                <div className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
                    <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-900">No {activeTab.toLowerCase()} events found</h3>
                    <p className="text-slate-500 mb-6">Change tabs or create a new event.</p>
                    {activeTab === 'ALL' && (
                        <button 
                             onClick={() => navigate('/organizer/create-event')}
                             className="text-indigo-600 font-medium hover:underline"
                        >
                            Create Event Now &rarr;
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredEvents.map(event => (
                        <div key={event.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col md:flex-row gap-6 items-center">
                            {/* Image */}
                            <div className="w-full md:w-48 h-32 bg-slate-100 rounded-lg overflow-hidden shrink-0 relative group">
                                <img src={event.imageUrl} alt="" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                    <button onClick={() => navigate(`/organizer/edit-event/${event.id}`)} className="text-white flex items-center text-sm font-bold">
                                        <Edit className="w-4 h-4 mr-1"/> Edit
                                    </button>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 w-full">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-lg font-bold text-slate-900 mb-1">{event.title}</h3>
                                    <div className="text-xs font-mono text-slate-400">ID: {event.id}</div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1 gap-x-4 mb-3">
                                    <p className="text-sm text-slate-500 flex items-center">
                                        <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                                        {formatDateInTimeZone(event.startTime, event.timezone)} at {formatTimeInTimeZone(event.startTime, event.timezone)}
                                    </p>
                                    <p className="text-sm text-slate-500 flex items-center">
                                        <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                                        {event.location}
                                    </p>
                                    <p className="text-sm text-slate-500 flex items-center">
                                        <Ticket className="w-4 h-4 mr-2 text-slate-400" />
                                        {event.seats.length} Seats
                                    </p>
                                </div>
                            </div>

                            {/* Actions / Status */}
                            <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto items-end justify-between h-full border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                                
                                {/* Status Dropdown */}
                                <div className="w-full md:w-40">
                                    <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Status</label>
                                        {!event.deleted ? (
                                            <select 
                                            value={event.status}
                                            onChange={(e) => handleStatusChange(event.id, e.target.value as EventStatus)}
                                        className={clsx(
                                            "w-full text-xs font-bold px-3 py-2 rounded-lg border appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500",
                                            getStatusStyle(event.status)
                                        )}
                                            >
                                        <option value="DRAFT">DRAFT</option>
                                        <option value="PUBLISHED">PUBLISHED</option>
                                        <option value="COMPLETED">COMPLETED</option>
                                        <option value="CANCELLED">CANCELLED</option>
                                            </select>
                                        ) : (
                                            <div className="text-xs font-semibold text-red-600">DELETED</div>
                                        )}
                                </div>

                                <div className="flex gap-2 w-full md:w-auto">
                                    <button 
                                        onClick={() => navigate(`/organizer/event/${event.id}/analytics`)}
                                        className="flex-1 md:flex-none text-sm font-medium text-slate-600 bg-white border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition flex items-center justify-center"
                                        title="View Analytics"
                                    >
                                        <BarChart2 className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => navigate(`/organizer/edit-event/${event.id}`)}
                                        className="flex-1 md:flex-none text-sm font-medium text-slate-600 bg-white border border-slate-300 px-3 py-2 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition"
                                    >
                                        Edit
                                    </button>
                                    {event.deleted && (
                                        <button onClick={async () => {
                                            if (!window.confirm('Restore this event from deleted state?')) return;
                                            try {
                                                // Restore: unset deleted and set to DRAFT so organizer can edit
                                                await updateEvent(event.id, { deleted: false, status: 'DRAFT' });
                                                loadEvents();
                                            } catch (err) {
                                                console.error('Failed to restore', err);
                                                alert('Failed to restore event');
                                            }
                                        }} className="px-3 py-2 text-green-600 bg-green-50 border border-green-100 rounded-lg">Restore</button>
                                    )}
                                    <button 
                                        onClick={() => handleDelete(event.id)}
                                        className="px-3 py-2 text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition"
                                        title="Delete Event"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OrganizerDashboard;
