
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Event, Seat, SeatingType, SeatStatus, EventStatus } from '../types';
import { fetchEventById, holdSeat, lockSeats } from '../services/mockBackend';
import SeatGrid, { CELL_SIZE } from '../components/SeatGrid';
import { ArrowLeft, Clock, ShoppingCart, Tag, ZoomIn, ZoomOut, Maximize, Minus, Plus } from 'lucide-react';
import { formatDateInTimeZone, formatTimeInTimeZone, formatInTimeZone } from '../utils/date';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

const EventBooking: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [event, setEvent] = useState<Event | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const mapContainerRef = useRef<HTMLDivElement>(null);
    // Track seat ids currently being processed to avoid race conditions
    const pendingSeatIdsRef = useRef<Set<string>>(new Set());

  // GA State: ticketTypeId -> count
  const [gaSelection, setGaSelection] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!slug) return;
    fetchEventById(slug).then(e => {
        setEvent(e || null);
        if (e && e.status && e.status !== EventStatus.PUBLISHED) {
            setBlocked(true);
        }
        console.log('Loaded event', e);
        setLoading(false);
    });
  }, [slug]);
  
  // Handle fetch errors gracefully
  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    fetchEventById(slug)
      .then(e => {
        if (!mounted) return;
        setEvent(e || null);
        if (e && e.status && e.status !== EventStatus.PUBLISHED) {
            setBlocked(true);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load event', err);
        if (!mounted) return;
        setEvent(null);
        setLoading(false);
        setError('Failed to load event details. Please try again later.');
      });
    return () => { mounted = false; };
  }, [slug]);

  // Auto-fit map logic
  const fitMapToContainer = () => {
    if (event && event.seatingType === SeatingType.RESERVED && mapContainerRef.current) {
                // Use smaller padding on narrow viewports (mobile) so the map can fill more space
                const isMobile = window.innerWidth < 768;
                const padding = isMobile ? 20 : 60;
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
        
                // Use the smaller scale to ensure content fits entirely in the container.
                // Do NOT upscale above 1.0 — we want the full map visible by default and avoid zooming in.
                const newScale = Math.min(1, Math.min(scaleX, scaleY));
                // On mobile prefer a smaller default zoom so the full map is visible ("very small / second level").
                const mobileDefaultMax = 0.15; // clamp mobile default to 25% (adjustable)
                const finalScale = isMobile ? Math.min(newScale, mobileDefaultMax) : newScale;
                setZoom(Math.max(0.05, finalScale));
    }
  };

  // Initial Fit and Window Resize Listener
  useEffect(() => {
        // Run an immediate fit and a delayed fit to allow mobile layouts to settle
        fitMapToContainer();
        // Delay a bit so dynamic layout (safe areas, mobile UI) finishes before measuring
        const t = window.setTimeout(fitMapToContainer, 120);

        window.addEventListener('resize', fitMapToContainer);
        window.addEventListener('orientationchange', fitMapToContainer);
        return () => {
            window.removeEventListener('resize', fitMapToContainer);
            window.removeEventListener('orientationchange', fitMapToContainer);
            clearTimeout(t);
        };
  }, [event]);

  if (loading) return <div className="p-10 text-center text-slate-500">Loading event details...</div>;
  if (!event) return <div className="p-10 text-center text-red-500">Event not found</div>;
  if (blocked) return (
    <div className="p-10 text-center">
      <h2 className="text-2xl font-bold mb-4">This event is not available for booking</h2>
      <p className="text-slate-600 mb-4">The event status is {event?.status || 'unavailable'}. Tickets cannot be purchased.</p>
      <div className="flex justify-center gap-4">
        <button onClick={() => navigate('/')} className="px-4 py-2 bg-indigo-600 text-white rounded">Browse Events</button>
        <button onClick={() => navigate(-1)} className="px-4 py-2 border rounded">Go Back</button>
      </div>
    </div>
  );

  const handleSeatClick = async (seat: Seat) => {
      // Ignore clicks for seats that are currently being processed
      if (pendingSeatIdsRef.current.has(seat.id)) return;
      // Toggle selection logic
      const isSelected = selectedSeats.some(s => s.id === seat.id);
      
      if (isSelected) {
          setSelectedSeats(prev => prev.filter(s => s.id !== seat.id));
      } else {
          // Mark this seat as pending so rapid clicks don't cause duplicate adds
          pendingSeatIdsRef.current.add(seat.id);
          // Check backend availability (mock)
          try {
              const isAvailable = await holdSeat(event.id, seat.id);
              if (isAvailable) {
                  setSelectedSeats(prev => {
                      // protect against duplicates in case of odd timing
                      if (prev.some(s => s.id === seat.id)) return prev;
                      return [...prev, seat];
                  });
                  setError(null);
              } else {
                  setError(`Seat ${seat.rowLabel}${seat.seatNumber} is no longer available.`);
              }
          } finally {
              pendingSeatIdsRef.current.delete(seat.id);
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
    !isMobile ?
  <div className="h-[calc(100vh-64px)] flex flex-col bg-white md:bg-transparent">
    {/* HEADER: Back button and title - only on mobile */}
    <div className="relative mb-6 md:hidden">
        <div className="w-full h-56 rounded-b-xl overflow-hidden relative bg-slate-900">
          {event.imageUrl && (
            <>
              {/* Blurred background fill */}
              <div className="absolute inset-0">
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className="w-full h-full object-cover transform scale-105 filter blur-sm brightness-75"
                />
              </div>

              {/* Foreground: show full image centered without cropping */}
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className="max-h-full max-w-full object-contain rounded-md shadow-lg"
                />
              </div>
            </>
          )}
          <div className="absolute inset-0 bg-black/40"></div>
            <div className="absolute left-4 top-4 text-white max-w-3xl">
                <button onClick={() => navigate('/')} className="text-white/90 flex items-center mb-2 text-sm">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </button>
                <h1 className="text-2xl font-bold leading-tight">{event.title}</h1>
                <p className="mt-2 text-sm text-white/90 flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    {formatDateInTimeZone(event.startTime, event.timezone)} &bull; {formatTimeInTimeZone(event.startTime, event.timezone)}
                </p>
                <p className="text-white/90 text-sm mt-1">{event.location}</p>
            </div>
        </div>
    </div>
    {/* DESKTOP LAYOUT: Two parallel sections */}
    <div className="hidden md:flex flex-1 p-6 gap-6 overflow-hidden min-h-0">
      
      {/* Left Section: Event Details with small image */}
      <div className="w-1/3 flex flex-col">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
          <button 
            onClick={() => navigate('/')} 
            className="text-slate-600 flex items-center mb-4 text-sm hover:text-slate-900 self-start"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Events
          </button>
          
          {/* Small image */}
          {event.imageUrl && (
            <div className="w-full h-48 rounded-lg overflow-hidden mb-4 bg-slate-100 relative">
              {/* Blurred background fill so small images look good */}
              <div className="absolute inset-0">
                <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover transform scale-105 filter blur-sm brightness-90" />
              </div>

              {/* Foreground: show full image centered and contained */}
              <div className="absolute inset-0 flex items-center justify-center p-3">
                <img
                  src={event.imageUrl}
                  alt={event.title}
                  className="max-h-full max-w-full object-contain rounded-md shadow"
                />
              </div>
            </div>
          )}
          
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{event.title}</h1>
          
          <div className="space-y-3 mb-6">
            <p className="text-slate-600 flex items-center">
              <Clock className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="flex-1">
                {formatInTimeZone(event.startTime, event.timezone, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                <br />
                {formatTimeInTimeZone(event.startTime, event.timezone)}
              </span>
            </p>
            
            <p className="text-slate-600">{event.location}</p>
            
            <div className="flex items-center gap-2 text-slate-600">
              {/* <Tag className="w-4 h-4 flex-shrink-0" /> */}
              {/* <span>{event.seatingType === SeatingType.RESERVED ? 'Reserved Seating' : 'General Admission'}</span> */}
            </div>
          </div>
          
          {/* Ticket Types */}
          {/* <div className="mb-6">
            <h3 className="font-semibold text-slate-900 mb-3">Ticket Types</h3>
            <div className="space-y-2">
              {event.ticketTypes.map(tt => (
                <div 
                  key={tt.id} 
                  className="flex justify-between items-center p-3 border border-slate-200 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-sm" 
                      style={{backgroundColor: tt.color}}
                    ></div>
                    <div>
                      <p className="font-medium text-slate-900">{tt.name}</p>
                      <p className="text-sm text-slate-500">{tt.description}</p>
                    </div>
                  </div>
                  <span className="font-bold text-slate-900">${tt.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div> */}
        </div>
      </div>
      
      {/* Right Section: Theater/Seating or GA Selection */}
      <div className="w-2/3 flex flex-col">
        {event.seatingType === SeatingType.RESERVED ? (
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            {/* Legend Bar with ticket types on the right (desktop) */}
            <div className="p-4 border-b bg-white shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex gap-4 text-sm font-medium text-slate-600">
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
                </div>

                {/* Ticket type chips - visible on desktop */}
                <div className="hidden md:flex items-center gap-3 flex-wrap text-sm">
                  {event.ticketTypes.map(tt => (
                    <div key={tt.id} className="flex items-center gap-2 px-3 py-1 rounded-full border bg-white shadow-sm">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: tt.color }} />
                      <div className="text-slate-700 font-medium">{tt.name}</div>
                      <div className="text-slate-500 ml-2">${tt.price.toFixed(0)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Map Canvas */}
            <div ref={mapContainerRef} className="flex-1 bg-slate-50 overflow-hidden flex items-center justify-center p-4 relative">
              <SeatGrid 
                seats={event.seats.map(s => {
                  const t = event.ticketTypes?.find(tt => tt.id === s.ticketTypeId);
                  return { ...s, color: t ? t.color : s.color };
                })}
                stage={event.stage}
                selectedSeatIds={selectedSeats.map(s => s.id)}
                onSeatClick={handleSeatClick}
                scale={zoom}
              />
              
              {/* Floating Zoom Controls */}
              <div className="absolute bottom-6 right-4 flex flex-col gap-2 bg-white rounded-lg shadow-lg border border-slate-200 p-1.5 z-20">
                <button 
                  onClick={() => setZoom(z => Math.min(2, z + 0.1))} 
                  className="p-2 hover:bg-slate-100 rounded text-slate-700 bg-slate-50 border border-slate-200"
                >
                  <ZoomIn className="w-5 h-5"/>
                </button>
                <button 
                  onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} 
                  className="p-2 hover:bg-slate-100 rounded text-slate-700 bg-slate-50 border border-slate-200"
                >
                  <ZoomOut className="w-5 h-5"/>
                </button>
                <button 
                  onClick={fitMapToContainer} 
                  className="p-2 hover:bg-slate-100 rounded text-slate-700 border-t mt-1" 
                  title="Fit to Screen"
                >
                  <Maximize className="w-5 h-5"/>
                </button>
              </div>
            </div>
          </div>
        ) : (
          // GA Selection UI for Desktop
          <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-6 overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">Select Tickets</h2>
            <div className="space-y-4">
              {event.ticketTypes.map(tt => (
                <div key={tt.id} className="flex items-center justify-between p-4 border rounded-lg hover:border-indigo-300 transition shadow-sm">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-4 h-4 rounded-sm" 
                      style={{backgroundColor: tt.color}}
                    ></div>
                    <div>
                      <h3 className="font-bold text-slate-900">{tt.name}</h3>
                      <p className="text-slate-500 text-sm">{tt.description || 'General Admission Entry'}</p>
                      <p className="text-indigo-600 font-bold mt-1">${tt.price.toFixed(2)}</p>
                    </div>
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
        
        {/* Checkout Section - Desktop */}
        <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-slate-500">Total</p>
              <p className="text-3xl font-bold text-slate-900">${selectedTotal.toFixed(2)}</p>
              <p className="text-sm text-slate-500 mt-1">{selectedCount} items selected</p>
              {/* Selection summary: show seat numbers for reserved seating, or ticket type counts for GA */}
              <div className="text-sm text-slate-600 mt-2">
                {event.seatingType === SeatingType.RESERVED ? (
                  selectedSeats.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {selectedSeats.map(s => (
                        <span key={s.id} className="px-2 py-1 text-xs bg-slate-100 rounded border border-slate-200">{s.rowLabel}{s.seatNumber}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">No seats selected</span>
                  )
                ) : (
                  Object.entries(gaSelection).filter(([,c]) => c > 0).length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(gaSelection).filter(([,c]) => c > 0).map(([ttId,c]) => {
                        const tt = event.ticketTypes.find(t => t.id === ttId);
                        return (
                          <span key={ttId} className="px-2 py-1 text-xs bg-slate-100 rounded border border-slate-200">{tt?.name || ttId} x{c}</span>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">No tickets selected</span>
                  )
                )}
              </div>
            </div>
            <button
              onClick={handleCheckout}
              disabled={selectedCount === 0}
              className="bg-black text-white py-3 px-8 rounded-lg font-bold hover:bg-[#d7ae4b] hover:text-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition text-lg"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Checkout
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
        </div>
      </div>
    </div>
  </div>
  :
  <div className="h-[calc(100vh-64px)] flex flex-col bg-white">
    
    {/* Mobile: details left, small poster image on the right */}
    <div className="block px-4 mt-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">{event.title}</h2>
          <p className="text-slate-500 mt-1 text-sm flex items-center">
            <Clock className="w-4 h-4 mr-2" />
            {formatDateInTimeZone(event.startTime, event.timezone)} &bull; {formatTimeInTimeZone(event.startTime, event.timezone)}
          </p>
          <p className="text-slate-500 text-sm mt-1">{event.location}</p>
          {/* <p className="text-slate-500 text-sm mt-1">{event.seatingType === SeatingType.RESERVED ? 'Reserved Seating' : 'General Admission'}</p> */}
        </div>

        {/* Small poster on the right for mobile */}
        {event.imageUrl && (
          <div className="w-24 h-24 flex-shrink-0 rounded-md overflow-hidden bg-slate-100 border border-slate-100">
            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </div>

    {/* MAIN CONTENT AREA */}
    <div className="flex-1 flex flex-col overflow-hidden min-h-0 relative">
      
      {/* MAP / SELECTION AREA */}
      {event.seatingType === SeatingType.RESERVED ? (
        <div className="flex-1 bg-slate-100 flex flex-col relative overflow-hidden">
          
          {/* Legend Bar - wrap ticket types on mobile (no horizontal scroll) */}
          <div className="p-3 border-b bg-white shrink-0 z-10 shadow-sm">
            <div className="flex flex-wrap gap-3 items-center text-xs font-medium text-slate-600 px-2">
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
              <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-2 hover:bg-slate-100 rounded text-slate-700 bg-slate-50 border border-slate-200">
                <ZoomIn className="w-5 h-5"/>
              </button>
              <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-2 hover:bg-slate-100 rounded text-slate-700 bg-slate-50 border border-slate-200">
                <ZoomOut className="w-5 h-5"/>
              </button>
              <button onClick={fitMapToContainer} className="p-2 hover:bg-slate-100 rounded text-slate-700 border-t mt-1" title="Fit to Screen">
                <Maximize className="w-5 h-5"/>
              </button>
            </div>
          </div>
        </div>
      ) : (
        // GA Selection UI
        <div className="flex-1 bg-white p-4 overflow-y-auto">
          <h2 className="text-xl font-bold mb-6">Select Tickets</h2>
          <div className="space-y-4">
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

    {/* MOBILE STICKY FOOTER */}
      <div className="bg-white border-t border-slate-200 p-4 safe-area-pb shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30">
      <div className="flex justify-between items-center mb-2">
        <div>
          <p className="text-xs text-slate-500 font-medium">{selectedCount} tickets selected</p>
          <p className="text-xl font-bold text-slate-900">${selectedTotal.toFixed(2)}</p>
          <div className="text-xs text-slate-600 mt-1">
            {event.seatingType === SeatingType.RESERVED ? (
              selectedSeats.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {selectedSeats.map(s => (
                    <span key={s.id} className="px-2 py-1 bg-slate-100 rounded border border-slate-200">{s.rowLabel}{s.seatNumber}</span>
                  ))}
                </div>
              ) : 'No seats selected'
            ) : (
              Object.entries(gaSelection).filter(([,c]) => c > 0).length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(gaSelection).filter(([,c]) => c > 0).map(([ttId,c]) => {
                    const tt = event.ticketTypes.find(t => t.id === ttId);
                    return <span key={ttId} className="px-2 py-1 bg-slate-100 rounded border border-slate-200">{tt?.name || ttId} x{c}</span>;
                  })}
                </div>
              ) : 'No tickets selected'
            )}
          </div>
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
