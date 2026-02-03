import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAllEventsForAdmin } from '../../services/mockBackend';
import { Event, EventStatus } from '../../types';
import { Eye, Edit2 } from 'lucide-react';

const AdminEvents: React.FC = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchAllEventsForAdmin();
        setEvents(res || []);
      } catch (err) {
        console.error('Failed to load events', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading events...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">All Events</h1>
          <p className="text-sm text-slate-500">View and manage all events hosted on the platform.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-3">Title</th>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Venue</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map(ev => (
              <tr key={ev.id} className="border-t last:border-b">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-800">{ev.title}</div>
                  <div className="text-xs text-slate-500">Organizer: {ev.organizerId || '—'}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{new Date(ev.startTime).toLocaleString()}</td>
                <td className="px-4 py-3 text-slate-600">{ev.location || ev.venueId || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${ev.status === EventStatus.PUBLISHED ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}`}>
                    {ev.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => navigate(`/event/${ev.id}`)} className="px-3 py-1 bg-white border rounded text-slate-600 hover:bg-slate-50">
                      <Eye className="w-4 h-4 inline-block mr-1" /> View
                    </button>
                    <button onClick={() => navigate(`/admin/events/${ev.id}/edit`)} className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                      <Edit2 className="w-4 h-4 inline-block mr-1" /> Edit
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminEvents;
