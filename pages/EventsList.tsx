
import React, { useEffect, useState } from 'react';
import { Event } from '../types';
import { fetchEvents } from '../services/mockBackend';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin } from 'lucide-react';

const EventsList: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const data = await fetchEvents();
      setEvents(data);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return <div className="p-12 text-center text-slate-500">Loading events...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-bold text-slate-900 mb-8">Upcoming Events</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {events.map((event) => (
          <div key={event.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col h-full border border-slate-100">
            <div className="h-48 overflow-hidden">
                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <h2 className="text-xl font-bold text-slate-900 mb-2">{event.title}</h2>
              <div className="flex items-center text-slate-500 mb-2">
                <Calendar className="w-4 h-4 mr-2" />
                <span className="text-sm">{new Date(event.startTime).toLocaleDateString()} at {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex items-center text-slate-500 mb-6">
                <MapPin className="w-4 h-4 mr-2" />
                <span className="text-sm">{event.location}</span>
              </div>
              
              <div className="mt-auto">
                <button 
                  onClick={() => navigate(`/event/${event.id}`)}
                  className="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors focus:ring-4 focus:ring-indigo-100"
                >
                  View Event Details
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventsList;
