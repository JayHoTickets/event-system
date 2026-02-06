
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchVenues, fetchTheatersByVenue, createEvent, fetchTheaterById, fetchEventById, updateEvent } from '../../services/mockBackend';
import { Venue, Theater, EventCategory, SeatingType, EventStatus, TicketType } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { toLocalDatetimeInput } from '../../utils/date';
import { ArrowLeft, Building2, Calendar, Globe, FileText, Banknote, Plus, Trash2, Map, Check, Grid, CheckSquare, ZoomIn, ZoomOut, Maximize, Armchair, Users } from 'lucide-react';
import SeatGrid, { CELL_SIZE } from '../../components/SeatGrid';

const PRESET_COLORS = [
    '#3b82f6', // blue
    '#9333ea', // purple
    '#ef4444', // red
    '#f59e0b', // amber
    '#10b981', // green
    '#ec4899', // pink
    '#6366f1', // indigo
    '#14b8a6', // teal
];

const CreateEvent: React.FC = () => {
    const { id } = useParams<{ id: string }>(); // Check for Edit Mode
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const isEditMode = !!id;

    // Data Sources
    const [venues, setVenues] = useState<Venue[]>([]);
    const [theaters, setTheaters] = useState<Theater[]>([]);
    const [selectedTheaterLayout, setSelectedTheaterLayout] = useState<Theater | null>(null);
    
    // UI State
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
    const [zoom, setZoom] = useState(1);
    const mapContainerRef = useRef<HTMLDivElement>(null);

    // Form State
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        venueId: '',
        theaterId: '',
        startTime: '',
        endTime: '',
        timezone: 'UTC',
        imageUrl: '',
        category: EventCategory.OTHER,
        seatingType: SeatingType.RESERVED,
        status: EventStatus.PUBLISHED,
        currency: 'USD',
        terms: '',
    });

    // `toLocalDatetimeInput` imported from utils/date — preserves event timezone when editing

    // Ticket Types State
    const [ticketTypes, setTicketTypes] = useState<TicketType[]>([
        { id: 'tt-1', name: 'Standard', price: 50, color: '#3b82f6', totalQuantity: 100, sold: 0 }
    ]);

    // Seat Mapping State: seatId -> ticketTypeId
    const [seatMappings, setSeatMappings] = useState<Record<string, string>>({});
    
    // Mapping UI State
    const [activeTicketTypeId, setActiveTicketTypeId] = useState<string | null>(ticketTypes[0]?.id || null);
    const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);

    useEffect(() => {
        fetchVenues().then(setVenues);
    }, []);

    // Load Event Data if in Edit Mode
    useEffect(() => {
        if (isEditMode && id) {
            setLoading(true);
            fetchEventById(id).then(async (event) => {
                if (event) {
                    // 1. Set Basic Data
                    setFormData({
                        title: event.title,
                        description: event.description,
                        venueId: event.venueId,
                        theaterId: event.theaterId || '',
                        // Convert stored ISO datetimes into the format expected by <input type="datetime-local" />
                            startTime: toLocalDatetimeInput(event.startTime as any, event.timezone),
                            endTime: toLocalDatetimeInput(event.endTime as any, event.timezone),
                            timezone: event.timezone || 'UTC',
                        imageUrl: event.imageUrl,
                        category: event.category,
                        seatingType: event.seatingType,
                        status: event.status,
                        currency: event.currency,
                        terms: event.terms,
                    });
                    
                    // 2. Set Ticket Types
                    setTicketTypes(event.ticketTypes);
                    if (event.ticketTypes.length > 0) setActiveTicketTypeId(event.ticketTypes[0].id);

                    // 3. Set Mappings (Reverse Engineer) - Only for Reserved
                    if (event.seatingType === SeatingType.RESERVED) {
                        const mappings: Record<string, string> = {};
                        event.seats.forEach(s => {
                            if (s.ticketTypeId) {
                                mappings[s.id] = s.ticketTypeId;
                            } else {
                                const matchedType = event.ticketTypes.find(tt => tt.name === s.tier);
                                if (matchedType) mappings[s.id] = matchedType.id;
                            }
                        });
                        setSeatMappings(mappings);
                        
                         // 4. Load Theater Options
                         if (event.venueId) {
                            const venueTheaters = await fetchTheatersByVenue(event.venueId);
                            setTheaters(venueTheaters);
                         }

                        // 5. Load Layout Visualization
                        if (event.theaterId) {
                            const layout = await fetchTheaterById(event.theaterId);
                            if (layout) {
                                // Prefer the event's saved stage visuals (textSize/borderRadius)
                                const mergedLayout = { ...layout } as Theater;
                                if (event.stage) {
                                    mergedLayout.stage = { ...layout.stage, ...event.stage };
                                }
                                setSelectedTheaterLayout(mergedLayout);

                                // Reconcile mappings to use the theater layout seat IDs.
                                // Some events store seat assignments on event.seats which may
                                // have different ids than the theater template. Try to map
                                // by exact id first, then by rowLabel+seatNumber as a fallback.
                                const reconciled: Record<string, string> = {};
                                const layoutSeats = layout.seats || [];

                                (event.seats || []).forEach(es => {
                                    if (!es.ticketTypeId) return;
                                    // 1) Try exact id match in layout
                                    let target = layoutSeats.find(ls => ls.id === es.id);
                                    // 2) Fallback: match by rowLabel + seatNumber
                                    if (!target) {
                                        target = layoutSeats.find(ls => ls.rowLabel === es.rowLabel && String(ls.seatNumber) === String(es.seatNumber));
                                    }
                                    // 3) If found, map layout seat id -> ticketTypeId
                                    if (target) {
                                        reconciled[target.id] = es.ticketTypeId;
                                    }
                                });

                                // Merge with earlier mappings (so manual mappings remain)
                                setSeatMappings(prev => ({ ...prev, ...reconciled }));
                            }
                        }
                    }
                }
                setLoading(false);
                setInitialLoad(false);
            });
        } else {
            setInitialLoad(false);
        }
    }, [id, isEditMode]);

    // Auto-zoom logic when layout or step changes
    useEffect(() => {
        if (step === 3 && formData.seatingType === SeatingType.RESERVED && selectedTheaterLayout && mapContainerRef.current) {
            const padding = 120; // Matches SeatGrid spacer logic
            const contentW = selectedTheaterLayout.cols * CELL_SIZE + padding;
            const contentH = selectedTheaterLayout.rows * CELL_SIZE + padding;
            
            const containerW = mapContainerRef.current.clientWidth;
            const containerH = mapContainerRef.current.clientHeight;
            
            // Calculate scale to fit
            const scaleW = (containerW - 40) / contentW;
            const scaleH = (containerH - 40) / contentH;
            
            // Use the smaller scale to ensure it fits, max 1
            const newScale = Math.min(1, Math.min(scaleW, scaleH));
            
            // Set zoom, but prevent it from being too tiny
            setZoom(Math.max(0.15, newScale));
        }
    }, [step, selectedTheaterLayout, formData.seatingType]);

    // Load Theaters when Venue changes (User Interaction)
    useEffect(() => {
        if (initialLoad) return; 

        setTheaters([]);
        
        if (formData.venueId) {
            fetchTheatersByVenue(formData.venueId).then(setTheaters);
        }
    }, [formData.venueId]); 

    // Handle theater change
    useEffect(() => {
        if (initialLoad) return;

        if (formData.theaterId) {
            if (selectedTheaterLayout?.id !== formData.theaterId) {
                setSeatMappings({});
                setSelectedSeatIds([]);
                fetchTheaterById(formData.theaterId).then(t => {
                    setSelectedTheaterLayout(t || null);
                });
            }
        } else {
            setSelectedTheaterLayout(null);
        }
    }, [formData.theaterId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        if (name === 'venueId') {
             setFormData(prev => ({ ...prev, theaterId: '' }));
             setSelectedTheaterLayout(null);
             setSeatMappings({});
        }
    };

    const addTicketType = () => {
        const newId = `tt-${Date.now()}`;
        const color = PRESET_COLORS[ticketTypes.length % PRESET_COLORS.length];
        const newType = { id: newId, name: 'New Ticket', price: 0, color, totalQuantity: 100, sold: 0 };
        setTicketTypes([...ticketTypes, newType]);
        setActiveTicketTypeId(newId);
    };

    const removeTicketType = (id: string) => {
        setTicketTypes(prev => prev.filter(t => t.id !== id));
        // Remove mappings for this type
        const newMappings = { ...seatMappings };
        Object.keys(newMappings).forEach(key => {
            if (newMappings[key] === id) delete newMappings[key];
        });
        setSeatMappings(newMappings);
        if (activeTicketTypeId === id) setActiveTicketTypeId(ticketTypes[0]?.id || null);
    };

    const updateTicketType = (id: string, field: keyof TicketType, value: any) => {
        setTicketTypes(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    };

    const handleSeatClick = (seat: any) => {
        if (selectedSeatIds.includes(seat.id)) {
            setSelectedSeatIds(prev => prev.filter(id => id !== seat.id));
        } else {
            setSelectedSeatIds(prev => [...prev, seat.id]);
        }
    };

    const handleBulkSelect = (ids: string[]) => {
        setSelectedSeatIds(prev => {
             const set = new Set(prev);
             ids.forEach(id => set.add(id));
             return Array.from(set);
        });
    };

    const handleRowClick = (rowLabel: string) => {
        if (!selectedTheaterLayout) return;
        const seatsInRow = selectedTheaterLayout.seats.filter(s => s.rowLabel === rowLabel);
        const allRowIds = seatsInRow.map(s => s.id);
        const allSelected = allRowIds.every(id => selectedSeatIds.includes(id));
        
        if (allSelected) {
            setSelectedSeatIds(prev => prev.filter(id => !allRowIds.includes(id)));
        } else {
            setSelectedSeatIds(prev => [...new Set([...prev, ...allRowIds])]);
        }
    };

    const selectAllSeats = () => {
        if (!selectedTheaterLayout) return;
        const allIds = selectedTheaterLayout.seats.map(s => s.id);
        if (selectedSeatIds.length === allIds.length) {
            setSelectedSeatIds([]);
        } else {
            setSelectedSeatIds(allIds);
        }
    };

    const assignSelectedSeats = () => {
        if (!activeTicketTypeId) return;
        const newMappings = { ...seatMappings };
        selectedSeatIds.forEach(seatId => {
            newMappings[seatId] = activeTicketTypeId;
        });
        setSeatMappings(newMappings);
        setSelectedSeatIds([]); 
    };

    const clearSelectedMapping = () => {
         const newMappings = { ...seatMappings };
         selectedSeatIds.forEach(seatId => {
             delete newMappings[seatId];
         });
         setSeatMappings(newMappings);
         setSelectedSeatIds([]);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        setLoading(true);
        try {
                if (isEditMode && id) {
                 await updateEvent(id, {
                    ...formData,
                    // Send the datetime-local wall time and timezone; backend will parse into UTC
                    startTime: formData.startTime ? formData.startTime : '',
                    endTime: formData.endTime ? formData.endTime : '',
                    ticketTypes,
                    seatMappings
                });
                alert("Event updated successfully!");
            } else {
                await createEvent({
                    ...formData,
                    // Send wall-clock datetime-local and timezone; backend will interpret with timezone
                    startTime: formData.startTime ? formData.startTime : '',
                    endTime: formData.endTime ? formData.endTime : '',
                    organizerId: user.id,
                    ticketTypes,
                    seatMappings
                });
            }
            navigate('/organizer');
        } catch (error) {
            alert("Failed to save event: " + error);
            setLoading(false);
        }
    };

    const seatColorizer = (seat: any, isSelected: boolean) => {
        if (isSelected) return 'bg-slate-800 text-white ring-2 ring-indigo-400';
        const mappedTypeId = seatMappings[seat.id];
        if (mappedTypeId) {
            return 'text-white border-transparent';
        }
        return 'bg-white border-slate-200 text-slate-300';
    };

    const isReserved = formData.seatingType === SeatingType.RESERVED;
    const isStep1Valid = formData.title && formData.venueId && (!isReserved || formData.theaterId);

    if (loading && initialLoad) return <div className="p-10 text-center">Loading event data...</div>;

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <button onClick={() => navigate('/organizer')} className="flex items-center text-slate-500 hover:text-slate-800 mb-6">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </button>

            <h1 className="text-3xl font-bold text-slate-900 mb-8">{isEditMode ? 'Edit Event' : 'Create New Event'}</h1>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden flex flex-col min-h-[600px]">
                {/* Progress Bar */}
                <div className="bg-slate-50 border-b p-4 flex gap-4 text-sm font-medium text-slate-500">
                    <span className={step >= 1 ? "text-[#d7ae4b] font-bold" : ""}>1. Details</span>
                    <span>&rarr;</span>
                    <span className={step >= 2 ? "text-[#d7ae4b] font-bold" : ""}>2. Schedule</span>
                    <span>&rarr;</span>
                    <span className={step >= 3 ? "text-[#d7ae4b] font-bold" : ""}>3. Tickets {isReserved ? '& Map' : ''}</span>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                    
                    {/* STEP 1: Venue & Basic Info */}
                    <div className={step === 1 ? 'p-8 block' : 'hidden'}>
                        <h2 className="text-xl font-bold mb-6 flex items-center"><Building2 className="w-5 h-5 mr-2 text-indigo-500"/> Location & Basics</h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Event Title</label>
                                <input required name="title" value={formData.title} onChange={handleChange} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Summer Rock Fest" />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Event Format</label>
                                <div className="flex gap-4">
                                    <button 
                                        type="button" 
                                        onClick={() => setFormData(p => ({...p, seatingType: SeatingType.RESERVED}))}
                                        className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-2 ${formData.seatingType === SeatingType.RESERVED ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <Armchair className="w-6 h-6" />
                                        <span className="font-bold">Reserved Seating</span>
                                        <span className="text-xs text-center opacity-70">For theaters, stadiums with seat map</span>
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={() => setFormData(p => ({...p, seatingType: SeatingType.GENERAL_ADMISSION}))}
                                        className={`flex-1 p-4 rounded-xl border-2 flex flex-col items-center gap-2 ${formData.seatingType === SeatingType.GENERAL_ADMISSION ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-slate-200 hover:border-slate-300'}`}
                                    >
                                        <Users className="w-6 h-6" />
                                        <span className="font-bold">General Admission</span>
                                        <span className="text-xs text-center opacity-70">Standing room or free seating by capacity</span>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Select Venue</label>
                                <select required name="venueId" value={formData.venueId} onChange={handleChange} className="w-full border rounded-lg px-3 py-2">
                                    <option value="">-- Choose Venue --</option>
                                    {venues.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.name}{v.address ? ` — ${v.address}` : ''}{v.city ? `, ${v.city}` : ''}{v.state ? `, ${v.state}` : ''}{v.zipCode ? ` ${v.zipCode}` : ''}{v.country ? ` (${v.country})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {isReserved && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Hall/Theater</label>
                                    <select required name="theaterId" value={formData.theaterId} onChange={handleChange} disabled={!formData.venueId} className="w-full border rounded-lg px-3 py-2 disabled:bg-slate-100">
                                        <option value="">-- Choose Layout --</option>
                                        {theaters.map(t => <option key={t.id} value={t.id}>{t.name} (Cap: {t.seats.length})</option>)}
                                    </select>
                                </div>
                            )}

                             <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Banner Image URL</label>
                                <input name="imageUrl" value={formData.imageUrl} onChange={handleChange} className="w-full border rounded-lg px-3 py-2" placeholder="https://..." />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                <select name="status" value={formData.status} onChange={handleChange} className="w-full border rounded-lg px-3 py-2">
                                    <option value={EventStatus.DRAFT}>Draft</option>
                                    <option value={EventStatus.PUBLISHED}>Active</option>
                                    <option value={EventStatus.COMPLETED}>Completed</option>
                                </select>
                            </div>
                            
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea name="description" value={formData.description} onChange={handleChange} rows={3} className="w-full border rounded-lg px-3 py-2"></textarea>
                            </div>
                        </div>

                        <div className="flex justify-end mt-auto">
                            <button 
                                type="button" 
                                disabled={!isStep1Valid}
                                onClick={() => setStep(2)} 
                                className="bg-black text-white px-6 py-2 rounded-lg hover:bg-[#d7ae4b] hover:text-black  disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next Step
                            </button>
                        </div>
                    </div>

                    {/* STEP 2: Schedule */}
                    <div className={step === 2 ? 'p-8 block' : 'hidden'}>
                         <h2 className="text-xl font-bold mb-6 flex items-center"><Calendar className="w-5 h-5 mr-2 text-indigo-500"/> Schedule</h2>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
                                <input required type="datetime-local" name="startTime" value={formData.startTime} onChange={handleChange} className="w-full border rounded-lg px-3 py-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
                                <input required type="datetime-local" name="endTime" value={formData.endTime} onChange={handleChange} className="w-full border rounded-lg px-3 py-2" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <input name="timezone" value={formData.timezone} onChange={handleChange} className="w-full border rounded-lg pl-9 pr-3 py-2" />
                                </div>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                                <select name="category" value={formData.category} onChange={handleChange} className="w-full border rounded-lg px-3 py-2">
                                    {Object.values(EventCategory).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                         </div>

                         <div className="flex justify-between mt-auto">
                            <button type="button" onClick={() => setStep(1)} className="text-black px-6 py-2 hover:bg-slate-50 rounded-lg">Back</button>
                            <button type="button" onClick={() => setStep(3)} className="bg-black text-white px-6 py-2 rounded-lg hover:bg-[#d7ae4b] hover:text-black">Next: Tickets</button>
                        </div>
                    </div>

                    {/* STEP 3: Tickets & Mapping */}
                    <div className={step === 3 ? 'flex flex-col flex-1 h-full' : 'hidden'}>
                        <div className="flex flex-1 overflow-hidden">
                            {/* Left Panel: Ticket Types */}
                            <div className={`${isReserved ? 'w-80' : 'w-full'} border-r bg-slate-50 p-6 overflow-y-auto flex flex-col gap-6`}>
                                <div>
                                    <h3 className="font-bold text-slate-900 mb-4 flex items-center justify-between">
                                        <span className="flex items-center"><Banknote className="w-4 h-4 mr-2"/> Ticket Types</span>
                                        <button type="button" onClick={addTicketType} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded"><Plus className="w-5 h-5"/></button>
                                    </h3>
                                    
                                    <div className={`${isReserved ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}`}>
                                        {ticketTypes.map(tt => (
                                            <div 
                                                key={tt.id} 
                                                className={`p-4 rounded-lg border transition-all cursor-pointer relative ${isReserved && activeTicketTypeId === tt.id ? 'border-indigo-500 ring-1 ring-indigo-500 bg-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                                onClick={() => isReserved && setActiveTicketTypeId(tt.id)}
                                            >
                                                <div className="mb-2">
                                                    <label className="text-[10px] text-slate-400 font-bold uppercase">Name</label>
                                                    <input 
                                                        className="w-full border-b focus:border-indigo-500 outline-none text-sm font-medium py-1" 
                                                        value={tt.name} 
                                                        onChange={(e) => updateTicketType(tt.id, 'name', e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex gap-4 mb-2">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] text-slate-400 font-bold uppercase">Price</label>
                                                        <input 
                                                            type="number"
                                                            className="w-full border-b focus:border-indigo-500 outline-none text-sm font-medium py-1" 
                                                            value={tt.price} 
                                                            onChange={(e) => updateTicketType(tt.id, 'price', Number(e.target.value))}
                                                        />
                                                    </div>
                                                    {!isReserved && (
                                                        <div className="flex-1">
                                                            <label className="text-[10px] text-slate-400 font-bold uppercase">Capacity</label>
                                                            <input 
                                                                type="number"
                                                                className="w-full border-b focus:border-indigo-500 outline-none text-sm font-medium py-1" 
                                                                value={tt.totalQuantity || 0} 
                                                                onChange={(e) => updateTicketType(tt.id, 'totalQuantity', Number(e.target.value))}
                                                            />
                                                        </div>
                                                    )}
                                                    <div className="w-24">
                                                        <label className="text-[10px] text-slate-400 font-bold uppercase block mb-1">Color</label>
                                                        <div className="flex gap-1 flex-wrap items-center">
                                                            {PRESET_COLORS.map(c => (
                                                                <button 
                                                                    key={c}
                                                                    type="button"
                                                                    className={`w-4 h-4 rounded-full ${tt.color === c ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                                                                    style={{ backgroundColor: c }}
                                                                    onClick={(e) => { e.stopPropagation(); updateTicketType(tt.id, 'color', c); }}
                                                                    title={c}
                                                                />
                                                            ))}
                                                            <input
                                                                type="color"
                                                                value={tt.color}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => updateTicketType(tt.id, 'color', e.target.value)}
                                                                className="w-8 h-8 p-0 border-0 rounded"
                                                                aria-label="Custom color"
                                                            />
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 mt-1 truncate">{tt.color}</div>
                                                    </div>
                                                </div>
                                                {ticketTypes.length > 1 && (
                                                    <button 
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); removeTicketType(tt.id); }}
                                                        className="absolute top-2 right-2 text-slate-300 hover:text-red-500"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {isReserved && (
                                    <div className="mt-auto border-t pt-4">
                                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                            <p className="text-xs font-bold text-indigo-800 uppercase mb-2">Selection Actions</p>
                                            
                                            <button 
                                                type="button"
                                                onClick={selectAllSeats}
                                                className="w-full mb-2 bg-white border border-indigo-200 text-black py-1.5 rounded text-xs font-medium hover:bg-[#d7ae4b] hover:opacity-80 flex items-center justify-center"
                                            >
                                                <CheckSquare className="w-3 h-3 mr-1" />
                                                {selectedSeatIds.length > 0 ? 'Deselect All' : 'Select All Seats'}
                                            </button>

                                            <div className="flex gap-2">
                                                <button 
                                                    type="button"
                                                    onClick={assignSelectedSeats}
                                                    disabled={selectedSeatIds.length === 0 || !activeTicketTypeId}
                                                    className="flex-1 bg-black text-white py-2 rounded text-xs font-bold hover:bg-[#d7ae4b] hover:text-black disabled:opacity-50"
                                                >
                                                    Assign {selectedSeatIds.length} Seats
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={clearSelectedMapping}
                                                    disabled={selectedSeatIds.length === 0}
                                                    className="px-3 bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-50 disabled:opacity-50"
                                                    title="Clear Mapping for Selection"
                                                >
                                                    <Trash2 className="w-4 h-4"/>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Panel: Map (Only for Reserved) */}
                            {isReserved && (
                                <div className="flex-1 bg-slate-200 overflow-hidden flex flex-col relative">
                                    <div className="absolute top-4 right-4 z-20 bg-white rounded-lg shadow-md p-1 flex items-center gap-1 border border-slate-200">
                                        <button type="button" onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-1.5 hover:bg-slate-100 rounded text-slate-600"><ZoomOut className="w-4 h-4"/></button>
                                        <span className="text-xs font-bold text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
                                        <button type="button" onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1.5 hover:bg-slate-100 rounded text-slate-600"><ZoomIn className="w-4 h-4"/></button>
                                        <button type="button" onClick={() => setZoom(1)} className="p-1.5 hover:bg-slate-100 rounded text-slate-600 border-l ml-1" title="Reset"><Maximize className="w-4 h-4"/></button>
                                    </div>

                                    <div ref={mapContainerRef} className="flex-1 overflow-auto p-0 flex justify-center items-start">
                                        {selectedTheaterLayout ? (
                                            <SeatGrid 
                                                seats={selectedTheaterLayout.seats.map(s => {
                                                    const mappedId = seatMappings[s.id];
                                                    const mappedType = ticketTypes.find(t => t.id === mappedId);
                                                    return {
                                                        ...s,
                                                        color: mappedType ? mappedType.color : undefined
                                                    };
                                                })}
                                                stage={selectedTheaterLayout.stage}
                                                selectedSeatIds={selectedSeatIds}
                                                onSeatClick={handleSeatClick}
                                                onRowClick={handleRowClick}
                                                seatColorizer={seatColorizer}
                                                allowDragSelect={true}
                                                onBulkSelect={handleBulkSelect}
                                                totalRows={selectedTheaterLayout.rows}
                                                totalCols={selectedTheaterLayout.cols}
                                                scale={zoom}
                                            />
                                        ) : (
                                            <div className="text-slate-400 mt-20 flex w-full justify-center">Select a layout in Step 1 first</div>
                                        )}
                                    </div>
                                    <div className="bg-white p-3 text-xs text-slate-500 border-t flex justify-between items-center z-20">
                                        <span>Tip: Click <span className="font-bold">Row Labels</span> or <span className="font-bold">Drag</span> to select multiple seats.</span>
                                        <span>Mapped: {Object.keys(seatMappings).length} / {selectedTheaterLayout?.seats.length || 0}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t bg-white flex justify-between">
                            <button type="button" onClick={() => setStep(2)} className="text-black px-6 py-2 hover:bg-slate-50 rounded-lg">Back</button>
                            <button 
                                type="submit" 
                                disabled={loading || ticketTypes.length === 0}
                                className="bg-green-600 text-white px-8 py-2 rounded-lg hover:bg-green-700 font-bold shadow-md disabled:opacity-70 flex items-center"
                            >
                                {loading ? 'Saving...' : <><Check className="w-4 h-4 mr-2"/> {isEditMode ? 'Update Event' : 'Publish Event'}</>}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateEvent;
