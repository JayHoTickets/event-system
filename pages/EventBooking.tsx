
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Event, Seat, SeatingType, SeatStatus } from '../types';
import { fetchEventById, holdSeat, lockSeats } from '../services/mockBackend';
import SeatGrid, { CELL_SIZE } from '../components/SeatGrid';
import { ArrowLeft, Clock, ShoppingCart, Tag, ZoomIn, ZoomOut, Maximize, Minus, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

const EventBooking: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // GA State: ticketTypeId -> count
  const [gaSelection, setGaSelection] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!id) return;
    fetchEventById(id).then(e => {
        setEvent(e || null);
        console.log('Loaded event', e);
        setLoading(false);
    });
  }, [id]);

  // Auto-fit map logic
  const fitMapToContainer = () => {
    if (event && event.seatingType === SeatingType.RESERVED && mapContainerRef.current) {
        const padding = 60; // Less padding for mobile to maximize view
        const cols = event.cols || 30;
        const rows = event.rows || 20;
        
        // Calculate content dimensions
        const contentW = cols * CELL_SIZE + padding;
        const contentH = rows * CELL_SIZE + padding;
        
        const containerW = mapContainerRef.current.clientWidth;
        const containerH = mapContainerRef.current.clientHeight;

        // Calculate scales
        const scaleX = containerW / contentW;
        const scaleY = containerH / contentH;
        
        // Use the smaller scale to ensure it fits entirely, but cap at 1.0 (no pixelation upsizing)
        // Also set a minimum so it's not microscopic
        const newScale = Math.min(1.2, Math.min(scaleX, scaleY));
        setZoom(Math.max(0.1, newScale));
    }
  };

  // Initial Fit and Window Resize Listener
  useEffect(() => {
    fitMapToContainer();
    window.addEventListener('resize', fitMapToContainer);
    return () => window.removeEventListener('resize', fitMapToContainer);
  }, [event]);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading event details...</div>;
  if (!event) return <div className="p-10 text-center text-red-500">Event not found</div>;

  const handleSeatClick = async (seat: Seat) => {
      // Toggle selection logic
      const isSelected = selectedSeats.some(s => s.id === seat.id);
      
      if (isSelected) {
          setSelectedSeats(prev => prev.filter(s => s.id !== seat.id));
      } else {
          // Check backend availability (mock)
          const isAvailable = await holdSeat(event.id, seat.id);
          if (isAvailable) {
              setSelectedSeats(prev => [...prev, seat]);
              setError(null);
          } else {
              setError(`Seat ${seat.rowLabel}${seat.seatNumber} is no longer available.`);
          }
      }
  };

  const updateGaCount = (ticketTypeId: string, delta: number) => {
      setGaSelection(prev => {
          const current = prev[ticketTypeId] || 0;
          const newValue = Math.max(0, current + delta);
          return { ...prev, [ticketTypeId]: newValue };
      });
  };

  const handleCheckout = () => {
      if (event.seatingType === SeatingType.RESERVED) {
        if (selectedSeats.length === 0) {
            setError("Please select at least one seat.");
            return;
        }

        // Try to atomically lock seats on the backend. Backend should
        // respond with { success: true } or { success: false, conflicts: [seatIds] }
        (async () => {
            try {
                const seatIds = selectedSeats.map(s => s.id);
                const res: any = await lockSeats(event.id, seatIds);
                if (res && res.success) {
                    // Navigates to checkout only when lock succeeds
                    navigate('/checkout', { state: { event, selectedSeats } });
                } else {
                    const conflicts = (res && res.conflicts) || [];
                    // Refresh event to get latest seat states
                    const refreshed = await fetchEventById(event.id);
                    setEvent(refreshed || event);
                    setSelectedSeats(prev => prev.filter(s => !conflicts.includes(s.id)));
                    setError(conflicts.length > 0 ? `Some seats were taken: ${conflicts.join(', ')}.` : 'Failed to lock selected seats. Please try again.');
                }
            } catch (err: any) {
                console.error('Lock seats error', err);
                setError(err.message || 'Failed to lock seats.');
            }
        })();
      } else {
        // Build GA seats virtual objects
        const gaSeats: Seat[] = [];
        Object.entries(gaSelection).forEach(([typeId, count]) => {
            if (count > 0) {
                const type = event.ticketTypes.find(t => t.id === typeId);
                for(let i=0; i<count; i++) {
                    gaSeats.push({
                        id: `ga-${typeId}-${i}-${Date.now()}`,
                        row: 0,
                        col: 0,
                        rowLabel: 'GA',
                        seatNumber: 'Any',
                        status: SeatStatus.AVAILABLE,
                        price: type?.price || 0,
                        tier: type?.name || 'General Admission',
                        ticketTypeId: typeId
                    });
                }
            }
        });
        
        if (gaSeats.length === 0) {
            setError("Please select at least one ticket.");
            return;
        }
        navigate('/checkout', { state: { event, selectedSeats: gaSeats } });
      }
  };

  const selectedTotal = event.seatingType === SeatingType.RESERVED 
      ? selectedSeats.reduce((acc, s) => acc + (s.price || 0), 0)
      : Object.entries(gaSelection).reduce((acc, [id, count]) => {
          const t = event.ticketTypes.find(tt => tt.id === id);
          return acc + (t ? t.price * count : 0);
      }, 0);
  
  const selectedCount = event.seatingType === SeatingType.RESERVED
      ? selectedSeats.length
      : Object.values(gaSelection).reduce((a, b) => a + b, 0);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-white md:bg-transparent">
      
      {/* HEADER: Title & Info */}
      <div className="relative mb-6">
          <div className="w-full h-56 md:h-96 rounded-b-xl overflow-hidden relative bg-slate-900">
              {/* Poster image shown fully (object-contain) so it isn't cropped */}
              {event.imageUrl && (
                  <img src={event.imageUrl} alt={event.title} className="absolute inset-0 w-full h-full object-contain" />
              )}
              <div className="absolute inset-0 bg-black/40"></div>
              <div className="hidden md:block absolute left-4 top-4 md:left-12 md:top-12 text-white max-w-3xl">
                  <button onClick={() => navigate('/')} className="text-white/90 flex items-center mb-2 text-sm">
                      <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </button>
                  <h1 className="text-2xl md:text-4xl font-bold leading-tight">{event.title}</h1>
                  <p className="mt-2 text-sm md:text-lg text-white/90 flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      {new Date(event.startTime).toLocaleDateString()} &bull; {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-white/90 text-sm mt-1">{event.location}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                      {event.ticketTypes && event.ticketTypes.map(tt => (
                          <div key={tt.id} className="text-xs px-2 py-1 rounded-md bg-white/20 text-white backdrop-blur-sm">
                              <span className="font-semibold">{tt.name}</span>
                              <span className="ml-2">${tt.price.toFixed(2)}</span>
                          </div>
                      ))}
                  </div>
              </div>

              {/* Floating checkout card on desktop */}
              <div className="hidden md:block absolute right-6 top-6 w-72">
                  <div className="bg-white border rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                          <span className="text-sm text-slate-500">Total</span>
                          <span className="text-2xl font-bold text-slate-900">${selectedTotal.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-4">{selectedCount} items selected</p>
                      <button
                          onClick={handleCheckout}
                          disabled={selectedCount === 0}
                          className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition"
                      >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Checkout
                      </button>
                      {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
                  </div>
              </div>
          </div>
      </div>

      {/* Mobile: details shown below the poster (not overlay) */}
      <div className="block md:hidden px-4 mt-3">
          <h2 className="text-lg font-bold text-slate-900">{event.title}</h2>
          <p className="text-slate-500 mt-1 text-sm flex items-center">
              <Clock className="w-4 h-4 mr-2" />
              {new Date(event.startTime).toLocaleDateString()} &bull; {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-slate-500 text-sm mt-1">{event.location}</p>
          <p className="text-slate-500 text-sm mt-1">{event.seatingType === SeatingType.RESERVED ? `${event.seats?.length || 0} seats` : 'General Admission'}</p>
          {event.ticketTypes && event.ticketTypes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                  {event.ticketTypes.map(tt => (
                      <div key={tt.id} className="text-xs px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-700">
                          <span className="font-semibold">{tt.name}</span>
                          <span className="ml-2">${tt.price.toFixed(2)}</span>
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden min-h-0 relative">
          
          {/* MAP / SELECTION AREA */}
          {event.seatingType === SeatingType.RESERVED ? (
              <div className="flex-1 bg-slate-100 md:bg-white md:rounded-xl md:border md:border-slate-200 md:shadow-sm flex flex-col relative overflow-hidden md:mx-4 md:mb-4">
                  
                  {/* Legend Bar - Scrollable on mobile */}
                  <div className="p-3 border-b bg-white shrink-0 overflow-x-auto scrollbar-hide z-10 shadow-sm md:shadow-none">
                      <div className="flex gap-4 text-xs font-medium text-slate-600 whitespace-nowrap px-2">
                          <div className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded-sm bg-slate-200 border border-slate-300"></div>
                              <span>Sold</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                               <div className="w-3 h-3 rounded-sm bg-green-500 border border-green-600"></div>
                               <span>Selected</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                               <div className="w-3 h-3 rounded-sm bg-slate-800 border border-slate-900 flex items-center justify-center">
                                   <div className="w-2 h-px bg-slate-500 rotate-45 transform absolute"></div>
                                   <div className="w-2 h-px bg-slate-500 -rotate-45 transform absolute"></div>
                               </div>
                               <span>Blocked</span>
                          </div>
                              <div className="flex items-center gap-1.5">
                               <div className="w-3 h-3 rounded-sm bg-amber-200 border border-amber-300"></div>
                               <span>Booking (In-progress)</span>
                              </div>
                          {event.ticketTypes.map(tt => (
                              <div key={tt.id} className="flex items-center gap-1.5">
                                  <div className="w-3 h-3 rounded-sm" style={{backgroundColor: tt.color}}></div>
                                  <span>{tt.name} (${tt.price})</span>
                              </div>
                          ))}
                      </div>
                  </div>
                  
                  {/* Map Canvas */}
                  <div ref={mapContainerRef} className="flex-1 bg-slate-100 overflow-hidden flex items-center justify-center p-4 relative touch-none">
                      <SeatGrid 
                          // Ensure seats show ticket-type color when assigned (ticketTypeId -> ticketTypes)
                          seats={event.seats.map(s => {
                              const t = event.ticketTypes?.find(tt => tt.id === s.ticketTypeId);
                              return { ...s, color: t ? t.color : s.color };
                          })}
                          stage={event.stage}
                          selectedSeatIds={selectedSeats.map(s => s.id)}
                          onSeatClick={handleSeatClick}
                          scale={zoom}
                          // Blocked seats not selectable by user
                      />
                      
                      {/* Floating Zoom Controls */}
                      <div className="absolute bottom-6 right-4 flex flex-col gap-2 bg-white rounded-lg shadow-lg border border-slate-200 p-1.5 z-20">
                           <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-2 hover:bg-slate-100 rounded text-slate-700 bg-slate-50 border border-slate-200"><ZoomIn className="w-5 h-5"/></button>
                           <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-2 hover:bg-slate-100 rounded text-slate-700 bg-slate-50 border border-slate-200"><ZoomOut className="w-5 h-5"/></button>
                           <button onClick={fitMapToContainer} className="p-2 hover:bg-slate-100 rounded text-slate-700 border-t mt-1" title="Fit to Screen"><Maximize className="w-5 h-5"/></button>
                      </div>
                  </div>
              </div>
          ) : (
              // GA Selection UI
              <div className="flex-1 bg-white md:rounded-xl md:border md:border-slate-200 md:shadow-sm p-4 md:p-8 overflow-y-auto md:mx-4 md:mb-4">
                  <h2 className="text-xl font-bold mb-6">Select Tickets</h2>
                  <div className="space-y-4 max-w-2xl mx-auto">
                      {event.ticketTypes.map(tt => (
                          <div key={tt.id} className="flex items-center justify-between p-4 border rounded-lg hover:border-indigo-300 transition shadow-sm">
                              <div>
                                  <h3 className="font-bold text-slate-900">{tt.name}</h3>
                                  <p className="text-slate-500 text-sm">{tt.description || 'General Admission Entry'}</p>
                                  <p className="text-indigo-600 font-bold mt-1">${tt.price.toFixed(2)}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                  <button 
                                    onClick={() => updateGaCount(tt.id, -1)}
                                    className="p-3 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                                    disabled={!gaSelection[tt.id]}
                                  >
                                      <Minus className="w-4 h-4" />
                                  </button>
                                  <span className="w-8 text-center font-bold text-lg">{gaSelection[tt.id] || 0}</span>
                                  <button 
                                    onClick={() => updateGaCount(tt.id, 1)}
                                    className="p-3 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 transition"
                                  >
                                      <Plus className="w-4 h-4" />
                                  </button>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </div>

      {/* MOBILE STICKY FOOTER (Hidden on Desktop) */}
      <div className="md:hidden bg-white border-t border-slate-200 p-4 safe-area-pb shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30">
        <div className="flex justify-between items-center mb-2">
            <div>
                <p className="text-xs text-slate-500 font-medium">{selectedCount} tickets selected</p>
                <p className="text-xl font-bold text-slate-900">${selectedTotal.toFixed(2)}</p>
            </div>
             <button 
                  onClick={handleCheckout}
                  disabled={selectedCount === 0}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                  Checkout
              </button>
        </div>
        {error && <p className="text-red-500 text-xs text-center">{error}</p>}
      </div>
    </div>
  );
};

export default EventBooking;
