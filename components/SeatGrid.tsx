
import React, { useMemo, useState, useRef } from 'react';
import { Seat, SeatStatus, Stage } from '../types';
import clsx from 'clsx';

export const CELL_SIZE = 36; // px

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
    canSelectUnavailable = false
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

  const defaultGetSeatColor = (seat: Seat, isSelected: boolean) => {
    // 1. Selected state always wins (Green)
    if (isSelected) return 'bg-green-500 text-white ring-2 ring-green-300 z-10 shadow-lg scale-110';
    
    // 2. Sold state (Grey/Light)
    if (seat.status === SeatStatus.SOLD) return 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-200';
    
    // 3. Held state (Amber)
    if (seat.status === SeatStatus.HELD) return 'bg-amber-100 text-amber-600 cursor-not-allowed border-amber-200';
    
    // 4. Blocked/Unavailable state (Dark Grey/Black)
    if (seat.status === SeatStatus.UNAVAILABLE) {
        return 'bg-slate-800 text-slate-600 border-slate-800 ' + (canSelectUnavailable ? 'cursor-pointer hover:bg-slate-700 hover:text-slate-400' : 'cursor-not-allowed opacity-60');
    }
    
    // 5. Available (White or Ticket Type Color)
    if (seat.color) {
         return `text-white shadow-sm hover:brightness-90`;
    }
    return 'bg-white border-slate-300 text-slate-700 hover:border-indigo-400 hover:shadow-md';
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
              // Allow selection of UNAVAILABLE if prop is true
              const isBlockedButSelectable = canSelectUnavailable && seat.status === SeatStatus.UNAVAILABLE;
              
              if (seat.status !== SeatStatus.SOLD && seat.status !== SeatStatus.HELD && (seat.status !== SeatStatus.UNAVAILABLE || isBlockedButSelectable)) {
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
        className="w-full overflow-auto bg-slate-50 rounded-xl border border-slate-200 shadow-inner relative" 
        style={{ minHeight: '400px', maxHeight: '80vh', cursor: allowDragSelect ? 'crosshair' : 'default' }}
        onMouseLeave={() => { setIsDragging(false); setSelectionBox(null); }}
    >
      {/* Spacer to force scrollbars based on scaled size */}
      <div style={{ width: width * scale + 120, height: height * scale + 120, position: 'relative' }}>
          <div 
            ref={containerRef}
            className="bg-white shadow-xl transition-transform duration-150 ease-linear origin-top-left"
            style={{ 
                width: width, 
                height: height, 
                position: 'absolute', 
                top: 60,
                left: 60,
                transform: `scale(${scale})`,
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
                    className="absolute bg-slate-800 text-slate-400 rounded-b-xl flex items-center justify-center font-bold tracking-widest uppercase shadow-md border-b-4 border-slate-900"
                    style={{
                        left: stage.x * CELL_SIZE,
                        top: stage.y * CELL_SIZE,
                        width: stage.width * CELL_SIZE,
                        height: stage.height * CELL_SIZE,
                        fontSize: `${Math.max(10, Math.min(24, stage.height * 4))}px`,
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
                        "absolute flex items-center justify-end pr-3 text-xs font-bold font-mono transition-colors",
                        onRowClick ? "text-indigo-400 hover:text-indigo-600 cursor-pointer hover:font-extrabold" : "text-slate-300 cursor-default"
                    )}
                    style={{
                        left: coords.x - 50,
                        top: coords.y,
                        width: 50,
                        height: CELL_SIZE - 6,
                        lineHeight: `${CELL_SIZE - 6}px`
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
                
                // Allow clicking UNAVAILABLE if prop is enabled
                const isBlockedButSelectable = canSelectUnavailable && seat.status === SeatStatus.UNAVAILABLE;
                const isDisabled = !onSeatClick || seat.status === SeatStatus.SOLD || seat.status === SeatStatus.HELD || (seat.status === SeatStatus.UNAVAILABLE && !canSelectUnavailable);

                const styleObj: React.CSSProperties = {
                    left: seat.x !== undefined ? seat.x : seat.col * CELL_SIZE,
                    top: seat.y !== undefined ? seat.y : seat.row * CELL_SIZE,
                    width: CELL_SIZE - 6,
                    height: CELL_SIZE - 6
                };
                
                // Inject dynamic color if not selected and valid
                if (!isSelected && seat.status === SeatStatus.AVAILABLE && seat.color) {
                    styleObj.backgroundColor = seat.color;
                    styleObj.borderColor = seat.color;
                }

                return (
                    <button
                        key={seat.id}
                        type="button"
                        // Updated Logic: Allow click if status is UNAVAILABLE but canSelectUnavailable is true
                        onClick={() => onSeatClick && !isDisabled && onSeatClick(seat)}
                        disabled={isDisabled}
                        className={clsx(
                            "absolute rounded-t-md border flex items-center justify-center text-[10px] font-bold transition-all duration-200",
                            colorClass
                        )}
                        style={styleObj}
                        title={`${seat.tier || 'Seat'} - Row ${seat.rowLabel} Seat ${seat.seatNumber} ${seat.price ? `($${seat.price})` : ''} - ${seat.status}`}
                    >
                        {seat.seatNumber}
                        {/* Add clear 'X' for blocked seats */}
                        {seat.status === SeatStatus.UNAVAILABLE && (
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
