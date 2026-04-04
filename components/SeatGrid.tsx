
import React, { useMemo, useState, useRef } from 'react';
import { Seat, Stage } from '../types';
import clsx from 'clsx';

export const CELL_SIZE = 36; // px

/** API / JSON may not match enum casing; keeps hold/blocked checks reliable. */
const normalizeSeatStatus = (status: Seat['status'] | string | undefined) =>
  String(status ?? '')
    .toUpperCase()
    .trim();

interface SeatGridProps {
  seats: Seat[];
  onSeatClick?: (seat: Seat) => void;
  onRowClick?: (rowLabel: string) => void;
  selectedSeatIds: string[];
  stage?: Stage;
  seatColorizer?: (seat: Seat, isSelected: boolean) => string; // Optional custom color logic
  allowDragSelect?: boolean;
  onBulkSelect?: (seatIds: string[]) => void;
  totalRows?: number;
  totalCols?: number;
  scale?: number;
    canSelectUnavailable?: boolean; // New prop to allow clicking blocked seats
    canSelectHold?: boolean; // New prop to allow clicking seats with HOLD status
    /** When true (public booking only), SOLD / HOLD / UNAVAILABLE use the same visuals as sold. Live/organizer maps keep distinct colors. */
    publicBookingUnifiedTakenSeats?: boolean;
}

const SeatGrid: React.FC<SeatGridProps> = ({ 
    seats, 
    onSeatClick, 
    onRowClick, 
    selectedSeatIds, 
    stage, 
    seatColorizer,
    allowDragSelect,
    onBulkSelect,
    totalRows,
    totalCols,
    scale = 1,
        canSelectUnavailable = false,
        canSelectHold = false,
        publicBookingUnifiedTakenSeats = false
}) => {
  
  // Drag Selection State
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{start: {x:number,y:number}, end: {x:number,y:number}} | null>(null);

  // Calculate grid dimensions based on seat coordinates
  const { width, height, rowLabels } = useMemo(() => {
      let maxX = 0;
      let maxY = 0;
      const labels: Record<string, {x: number, y: number, r: number}> = {};

      seats.forEach(s => {
          // Determine absolute position (use grid fallback if x/y undefined)
          const posX = s.x !== undefined ? s.x : s.col * CELL_SIZE;
          const posY = s.y !== undefined ? s.y : s.row * CELL_SIZE;

          maxX = Math.max(maxX, posX);
          maxY = Math.max(maxY, posY);
          
          // Identify where to place row labels (leftmost seat of the row)
          // We track the minimum X for each rowLabel
          if (!labels[s.rowLabel] || posX < labels[s.rowLabel].x) {
              labels[s.rowLabel] = { x: posX, y: posY, r: s.row };
          }
      });

      if (stage) {
          maxY = Math.max(maxY, (stage.y + stage.height) * CELL_SIZE);
          maxX = Math.max(maxX, (stage.x + stage.width) * CELL_SIZE);
      }

      // Add padding
      let finalW = maxX + 100;
      let finalH = maxY + 100;

      // Ensure it's at least the grid size if provided (for builder mostly)
      if (totalRows && totalCols) {
         finalW = Math.max(finalW, totalCols * CELL_SIZE);
         finalH = Math.max(finalH, totalRows * CELL_SIZE);
      }

      return {
          width: finalW,
          height: finalH,
          rowLabels: labels
      };
  }, [seats, stage, totalRows, totalCols]);

  const soldLikeUnavailableClass =
    'bg-slate-200 text-slate-400 cursor-not-allowed border-black';

  const defaultGetSeatColor = (seat: Seat, isSelected: boolean) => {
    const st = normalizeSeatStatus(seat.status);
    // 1. Selected state always wins (Green)
    if (isSelected) return 'bg-green-500 text-white ring-2 ring-green-300 z-10 shadow-lg scale-110';

    if (publicBookingUnifiedTakenSeats) {
      // Same gray as sold: sold, organizer hold, blocked (public map only). Booking-in-progress stays amber below.
      if (st === 'SOLD' || st === 'HOLD' || st === 'UNAVAILABLE') {
        return soldLikeUnavailableClass;
      }
    } else {
      // 2. Sold state (Grey/Light) — slightly darker border for contrast
      if (st === 'SOLD') return soldLikeUnavailableClass;

      // 3. Hold state (Organizer placed hold, awaiting payment) - Yellow
      if (st === 'HOLD')
        return 'bg-yellow-400 text-yellow-900 cursor-not-allowed border-yellow-500 font-semibold';

      // 5. Blocked/Unavailable state (Dark Grey/Black)
      if (st === 'UNAVAILABLE') {
        const base = 'bg-slate-800 border-black text-slate-400';
        const interactive = canSelectUnavailable
          ? 'cursor-pointer hover:bg-slate-700 hover:text-slate-300'
          : 'cursor-not-allowed';
        return `${base} ${interactive}`;
      }
    }

    // 4. Booking in progress (temporary lock from customer) - make it visually obvious
    if (st === 'BOOKING_IN_PROGRESS') {
      return 'bg-amber-200 text-amber-800 cursor-not-allowed border-amber-300 animate-pulse';
    }

    // 6. Available (White or Ticket Type Color)
    if (seat.color) {
      return `text-white shadow-sm hover:brightness-90 border-black`;
    }
    return 'bg-white border-black text-slate-700 hover:border-indigo-500 hover:shadow-md';
  };

    // Utility: darken a hex color by a given factor (0-1)
    const darkenHex = (hex: string, factor = 0.35) => {
        try {
            // Normalize shorthand
            let h = hex.replace('#', '');
            if (h.length === 3) h = h.split('').map(c => c + c).join('');
            const r = parseInt(h.substring(0,2), 16);
            const g = parseInt(h.substring(2,4), 16);
            const b = parseInt(h.substring(4,6), 16);
            const nr = Math.max(0, Math.min(255, Math.round(r * (1 - factor))));
            const ng = Math.max(0, Math.min(255, Math.round(g * (1 - factor))));
            const nb = Math.max(0, Math.min(255, Math.round(b * (1 - factor))));
            return `rgb(${nr}, ${ng}, ${nb})`;
        } catch (e) {
            return hex;
        }
    };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!allowDragSelect) return;
    // Don't start drag if clicking a specific button (let onClick handle that)
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Adjust coordinates for scale
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    setIsDragging(true);
    setSelectionBox({ start: {x, y}, end: {x, y} });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || !selectionBox) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;
      
      setSelectionBox(prev => prev ? ({ ...prev, end: {x, y} }) : null);
  };

  const handleMouseUp = () => {
      if (!isDragging || !selectionBox || !onBulkSelect) {
          setIsDragging(false);
          setSelectionBox(null);
          return;
      }

      const x1 = Math.min(selectionBox.start.x, selectionBox.end.x);
      const x2 = Math.max(selectionBox.start.x, selectionBox.end.x);
      const y1 = Math.min(selectionBox.start.y, selectionBox.end.y);
      const y2 = Math.max(selectionBox.start.y, selectionBox.end.y);

      // Simple intersection check
      const selectedIds: string[] = [];
      seats.forEach(seat => {
          const sX = seat.x !== undefined ? seat.x : seat.col * CELL_SIZE;
          const sY = seat.y !== undefined ? seat.y : seat.row * CELL_SIZE;
          const sW = CELL_SIZE - 6; 
          const sH = CELL_SIZE - 6;

          // Check if seat rectangle intersects selection box
          if (sX < x2 && sX + sW > x1 && sY < y2 && sY + sH > y1) {
              const st = normalizeSeatStatus(seat.status);
              const isBlockedButSelectable = canSelectUnavailable && st === 'UNAVAILABLE';
              const isHoldButSelectable = canSelectHold && st === 'HOLD';

              if (st !== 'SOLD' && (st !== 'UNAVAILABLE' || isBlockedButSelectable) && (st !== 'HOLD' || isHoldButSelectable)) {
                  selectedIds.push(seat.id);
              }
          }
      });

      if (selectedIds.length > 0) {
          onBulkSelect(selectedIds);
      }

      setIsDragging(false);
      setSelectionBox(null);
  };

  return (
        <div 
                className="inline-block max-w-full overflow-visible bg-slate-50 rounded-xl border border-slate-200 shadow-inner relative align-middle" 
                style={{ minHeight: '400px', cursor: allowDragSelect ? 'crosshair' : 'default' }}
        onMouseLeave={() => { setIsDragging(false); setSelectionBox(null); }}
    >
      {/* Spacer to force scrollbars based on scaled size */}
            <div style={{ width: width * scale + 40, height: height * scale + 40, position: 'relative' }}>
          <div 
            ref={containerRef}
            className="bg-white shadow-xl transition-transform duration-150 ease-linear origin-top-left"
            style={{ 
                width: width, 
                height: height, 
                position: 'absolute', 
                top: 0,
                left: 0,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
                backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            
            {/* Selection Box */}
            {selectionBox && (
                <div 
                    className="absolute bg-indigo-500/20 border-2 border-indigo-500 z-50 pointer-events-none"
                    style={{
                        left: Math.min(selectionBox.start.x, selectionBox.end.x),
                        top: Math.min(selectionBox.start.y, selectionBox.end.y),
                        width: Math.abs(selectionBox.end.x - selectionBox.start.x),
                        height: Math.abs(selectionBox.end.y - selectionBox.start.y)
                    }}
                />
            )}

            {/* Stage */}
            {stage && (
                <div 
                    className="absolute bg-slate-800 text-slate-400 flex items-center justify-center font-bold tracking-widest uppercase shadow-md border-b-4 border-slate-900"
                    style={{
                        left: stage.x * CELL_SIZE,
                        top: stage.y * CELL_SIZE,
                        width: stage.width * CELL_SIZE,
                        height: stage.height * CELL_SIZE,
                        fontSize: `${stage.textSize ? stage.textSize + 'px' : Math.max(10, Math.min(24, stage.height * 4))}`,
                        borderRadius: stage.borderRadius ? `${stage.borderRadius}px` : undefined,
                        zIndex: 0
                    }}
                >
                    {stage.label}
                </div>
            )}

            {/* Row Labels */}
            {Object.entries(rowLabels).map(([label, coords]: [string, {x:number, y:number, r:number}]) => (
                <button
                    key={`lbl-${label}`}
                    onClick={() => onRowClick && onRowClick(label)}
                    type="button"
                    className={clsx(
                        "absolute flex items-center justify-end pr-3 text-sm md:text-base font-bold font-mono transition-colors",
                        onRowClick ? "text-slate-800 hover:text-indigo-700 cursor-pointer hover:font-extrabold" : "text-slate-700 cursor-default"
                    )}
                    style={{
                        left: coords.x - 60,
                        top: coords.y,
                        width: 60,
                        height: CELL_SIZE,
                        lineHeight: `${CELL_SIZE}px`
                    }}
                    title={onRowClick ? `Select Row ${label}` : undefined}
                >
                    {label}
                </button>
            ))}

            {/* Seats */}
            {seats.map(seat => {
                const isSelected = selectedSeatIds.includes(seat.id);
                const colorClass = seatColorizer ? seatColorizer(seat, isSelected) : defaultGetSeatColor(seat, isSelected);
                const st = normalizeSeatStatus(seat.status);

                const isBlockedButSelectable = canSelectUnavailable && st === 'UNAVAILABLE';
                const isHoldButSelectable = canSelectHold && st === 'HOLD';
                const isDisabled =
                  !onSeatClick ||
                  st === 'SOLD' ||
                  st === 'BOOKING_IN_PROGRESS' ||
                  (st === 'UNAVAILABLE' && !canSelectUnavailable) ||
                  (st === 'HOLD' && !canSelectHold);

                const styleObj: React.CSSProperties = {
                    left: seat.x !== undefined ? seat.x : seat.col * CELL_SIZE,
                    top: seat.y !== undefined ? seat.y : seat.row * CELL_SIZE,
                    width: CELL_SIZE - 6,
                    height: CELL_SIZE - 6
                };
                
                // Inject dynamic color if not selected and valid
                if (!isSelected && st === 'AVAILABLE' && seat.color) {
                    styleObj.backgroundColor = seat.color;
                    // Use a darker border variant for contrast (overrides very light colors)
                    styleObj.borderColor = darkenHex(seat.color, 0.45);
                    styleObj.borderWidth = 2;
                    styleObj.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
                }

                return (
                    <button
                        key={seat.id}
                        type="button"
                        // Updated Logic: Allow click if status is UNAVAILABLE but canSelectUnavailable is true
                        onClick={() => onSeatClick && !isDisabled && onSeatClick(seat)}
                        disabled={isDisabled}
                        className={clsx(
                                "absolute rounded-t-md border-2 flex items-center justify-center text-[10px] font-bold transition-all duration-200",
                                colorClass
                            )}
                        style={styleObj}
                        title={`${seat.tier || 'Seat'} - Row ${seat.rowLabel} Seat ${seat.seatNumber} ${seat.price ? `($${seat.price})` : ''} - ${seat.status}`}
                    >
                        {seat.seatNumber}
                        {/* Add clear 'X' for blocked seats (hidden on public booking when unified with sold) */}
                        {st === 'UNAVAILABLE' && !publicBookingUnifiedTakenSeats && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-3/4 h-0.5 bg-slate-500 rotate-45 transform absolute"></div>
                                <div className="w-3/4 h-0.5 bg-slate-500 -rotate-45 transform absolute"></div>
                            </div>
                        )}
                    </button>
                )
            })}

          </div>
      </div>
    </div>
  );
};

export default SeatGrid;
