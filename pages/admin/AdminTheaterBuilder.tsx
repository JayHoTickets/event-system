
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchTheaterById, saveTheaterLayout } from '../../services/mockBackend';
import { Theater, Seat, SeatStatus, Stage } from '../../types';
import { ArrowLeft, Save, MousePointer2, Edit2, Eraser, Grip, CheckSquare, ZoomIn, ZoomOut, Maximize, Square, Grid3x3, RotateCcw, Trash2, Spline, ArrowRight, ArrowLeft as ArrowLeftIcon, Hash } from 'lucide-react';
import clsx from 'clsx';

type Tool = 'SELECT' | 'DRAW' | 'GRID' | 'ERASE' | 'STAGE';

const CELL_SIZE = 36; // Matches SeatGrid

const AdminTheaterBuilder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [theater, setTheater] = useState<Theater | null>(null);
  
  // Canvas State
  const [zoom, setZoom] = useState(1);
  const [rows, setRows] = useState(40);
  const [cols, setCols] = useState(50);
  
  // Data State
  const [seats, setSeats] = useState<Seat[]>([]);
  const [stage, setStage] = useState<Stage>({ label: 'Stage', x: 2, y: 0, width: 10, height: 4 });
  
  // Interaction State
  const [tool, setTool] = useState<Tool>('SELECT');
  const [selectedSeatIds, setSelectedSeatIds] = useState<Set<string>>(new Set());
  const [previewSelection, setPreviewSelection] = useState<Set<string>>(new Set());
  
  const [isDragging, setIsDragging] = useState(false);
  
  // Dragging logic refined for absolute vs grid
  // We store the initial mouse pos and the initial seat positions
  const [dragStartMouse, setDragStartMouse] = useState<{x: number, y: number} | null>(null);
  const [seatMoveSnapshots, setSeatMoveSnapshots] = useState<Map<string, {r: number, c: number, x?: number, y?: number}>>(new Map());
  
  // Selection Box (visual)
  const [selectionBox, setSelectionBox] = useState<{start: {x:number,y:number}, end: {x:number,y:number}} | null>(null);
  
  // Dragging Objects
  const [isDraggingStage, setIsDraggingStage] = useState(false);
  const [isMovingSeats, setIsMovingSeats] = useState(false);

  // Bulk Edit State
  const [bulkLabel, setBulkLabel] = useState('A');
  const [bulkStartNum, setBulkStartNum] = useState(1);
  const [bulkIncrement, setBulkIncrement] = useState(1);
  const [bulkDirection, setBulkDirection] = useState<'LTR' | 'RTL'>('LTR');

  // Curve State
  const [curveIntensity, setCurveIntensity] = useState(0);

  useEffect(() => {
    if (id) {
        fetchTheaterById(id).then(t => {
            if (t) {
                setTheater(t);
                setSeats(t.seats);
                setRows(t.rows);
                setCols(t.cols);
                if (t.stage) setStage(t.stage);
            }
        });
    }
  }, [id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedSeatIds.size > 0) {
                 deleteSelectedSeats();
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSeatIds]); 

  // --- Logic Helpers ---

  // Get raw mouse coords relative to container, scaled
  const getMouseCoords = (e: React.MouseEvent) => {
    const container = e.currentTarget as HTMLDivElement;
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    return { x, y };
  };

  // Convert raw coords to grid cell
  const getCellCoords = (e: React.MouseEvent) => {
    const { x, y } = getMouseCoords(e);
    const c = Math.floor(x / CELL_SIZE);
    const r = Math.floor(y / CELL_SIZE);
    return { r, c };
  };

  // --- Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    // 1. Check Stage Click
    if ((e.target as HTMLElement).closest('[data-stage]')) {
        if(tool === 'STAGE' || tool === 'SELECT') {
            setIsDraggingStage(true);
            const { r, c } = getCellCoords(e);
            // Just track that we are dragging stage
            return; 
        }
    }

    const { x, y } = getMouseCoords(e);
    const { r, c } = getCellCoords(e);

    if (r < -5 || c < -5 || r > rows + 5 || c > cols + 5) return;

    // 2. Stage Teleport (Tool Active)
    if (tool === 'STAGE') {
        setStage(prev => ({ ...prev, x: c, y: r }));
        setIsDraggingStage(true);
        return;
    }

    // 3. Check Seat Click (for Move logic in SELECT mode)
    if (tool === 'SELECT') {
        // Find if clicked on a seat
        // Check both grid and absolute positions
        const clickedSeat = seats.find(s => {
            const sX = s.x !== undefined ? s.x : s.col * CELL_SIZE;
            const sY = s.y !== undefined ? s.y : s.row * CELL_SIZE;
            return x >= sX && x <= sX + CELL_SIZE && y >= sY && y <= sY + CELL_SIZE;
        });
        
        if (clickedSeat && selectedSeatIds.has(clickedSeat.id)) {
            setIsMovingSeats(true);
            setDragStartMouse({ x, y });
            
            // Snapshot all selected seats positions
            const snapshot = new Map<string, {r: number, c: number, x?: number, y?: number}>();
            seats.forEach(s => {
                if (selectedSeatIds.has(s.id)) {
                    snapshot.set(s.id, { 
                        r: s.row, 
                        c: s.col,
                        x: s.x,
                        y: s.y
                    });
                }
            });
            setSeatMoveSnapshots(snapshot);
            return;
        }
    }

    setIsDragging(true);
    setDragStartMouse({ x, y });

    // 4. Tool Actions
    if (tool === 'DRAW') {
        if (r >= 0 && c >= 0 && r < rows && c < cols) {
            addSeat(r, c);
        }
    } else if (tool === 'ERASE') {
        removeSeatAt(x, y);
    } else if (tool === 'SELECT' || tool === 'GRID') {
        if (tool === 'SELECT' && !e.shiftKey) {
            setSelectedSeatIds(new Set()); 
        }
        setSelectionBox({ start: { x, y }, end: { x, y } });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getMouseCoords(e);
    const { r, c } = getCellCoords(e);
    
    if (isDraggingStage && (tool === 'STAGE' || tool === 'SELECT')) {
        setStage(prev => ({ ...prev, x: c, y: r }));
        return;
    }

    if (isMovingSeats && dragStartMouse) {
        const deltaX = x - dragStartMouse.x;
        const deltaY = y - dragStartMouse.y;
        
        // Convert pixel delta to grid delta
        const deltaCols = Math.round(deltaX / CELL_SIZE);
        const deltaRows = Math.round(deltaY / CELL_SIZE);

        setSeats(prev => prev.map(s => {
            if (selectedSeatIds.has(s.id)) {
                const init = seatMoveSnapshots.get(s.id);
                if (init) {
                    const newSeat = { ...s };
                    
                    // If seat has absolute coords, move pixels
                    if (init.x !== undefined && init.y !== undefined) {
                        newSeat.x = init.x + deltaX;
                        newSeat.y = init.y + deltaY;
                        // Also update logical row/col for sorting/labeling if possible
                        newSeat.col = Math.round(newSeat.x / CELL_SIZE);
                        newSeat.row = Math.round(newSeat.y / CELL_SIZE);
                    } else {
                        // Grid movement
                        newSeat.row = init.r + deltaRows;
                        newSeat.col = init.c + deltaCols;
                    }
                    return newSeat;
                }
            }
            return s;
        }));
        return;
    }

    if (!isDragging) return;

    if (tool === 'DRAW') {
        if (r >= 0 && c >= 0 && r < rows && c < cols) {
            addSeat(r, c);
        }
    } else if (tool === 'ERASE') {
        removeSeatAt(x, y);
    } else if ((tool === 'SELECT' || tool === 'GRID') && selectionBox) {
        setSelectionBox(prev => prev ? ({ ...prev, end: { x, y } }) : null);

        // LIVE PREVIEW SELECTION LOGIC
        if (tool === 'SELECT') {
            const xMin = Math.min(selectionBox.start.x, x);
            const xMax = Math.max(selectionBox.start.x, x);
            const yMin = Math.min(selectionBox.start.y, y);
            const yMax = Math.max(selectionBox.start.y, y);

            const newPreview = new Set<string>();
            seats.forEach(s => {
                 const sX = s.x !== undefined ? s.x : s.col * CELL_SIZE;
                 const sY = s.y !== undefined ? s.y : s.row * CELL_SIZE;
                 // Box intersection
                 if (sX < xMax && sX + CELL_SIZE > xMin && sY < yMax && sY + CELL_SIZE > yMin) {
                     newPreview.add(s.id);
                 }
            });
            setPreviewSelection(newPreview);
        }
    }
  };

  const handleMouseUp = () => {
    if (selectionBox) {
        const xMin = Math.min(selectionBox.start.x, selectionBox.end.x);
        const xMax = Math.max(selectionBox.start.x, selectionBox.end.x);
        const yMin = Math.min(selectionBox.start.y, selectionBox.end.y);
        const yMax = Math.max(selectionBox.start.y, selectionBox.end.y);

        if (tool === 'SELECT') {
            const newSelection = new Set(selectedSeatIds);
            seats.forEach(s => {
                const sX = s.x !== undefined ? s.x : s.col * CELL_SIZE;
                const sY = s.y !== undefined ? s.y : s.row * CELL_SIZE;
                // Check intersection
                if (sX < xMax && sX + CELL_SIZE > xMin && sY < yMax && sY + CELL_SIZE > yMin) {
                    newSelection.add(s.id);
                }
            });
            setSelectedSeatIds(newSelection);
        } else if (tool === 'GRID') {
            // Grid draw logic uses grid cells
            const cMin = Math.floor(xMin / CELL_SIZE);
            const cMax = Math.floor(xMax / CELL_SIZE);
            const rMin = Math.floor(yMin / CELL_SIZE);
            const rMax = Math.floor(yMax / CELL_SIZE);

            const newSeats: Seat[] = [];
            let counter = 0;
            const timestamp = Date.now();
            
            for(let r = rMin; r <= rMax; r++) {
                for(let c = cMin; c <= cMax; c++) {
                    if (r >= 0 && c >= 0 && r < rows && c < cols) {
                        if (!seats.some(s => s.row === r && s.col === c)) {
                             counter++;
                             newSeats.push({
                                id: `s-${timestamp}-${counter}-${Math.random().toString(36).substr(2, 5)}`,
                                row: r,
                                col: c,
                                rowLabel: '?',
                                seatNumber: '?',
                                status: SeatStatus.AVAILABLE
                             });
                        }
                    }
                }
            }
            setSeats(prev => [...prev, ...newSeats]);
        }
        setSelectionBox(null);
        setPreviewSelection(new Set());
    }

    setIsDragging(false);
    setIsDraggingStage(false);
    setIsMovingSeats(false);
    setDragStartMouse(null);
  };

  const generateId = () => `s-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addSeat = (r: number, c: number) => {
    setSeats(prev => {
        if (prev.some(s => s.row === r && s.col === c)) return prev;
        return [...prev, {
            id: generateId(),
            row: r,
            col: c,
            rowLabel: '?',
            seatNumber: '?',
            status: SeatStatus.AVAILABLE
        }];
    });
  };

  const removeSeatAt = (x: number, y: number) => {
      setSeats(prev => prev.filter(s => {
          const sX = s.x !== undefined ? s.x : s.col * CELL_SIZE;
          const sY = s.y !== undefined ? s.y : s.row * CELL_SIZE;
          return !(x >= sX && x <= sX + CELL_SIZE && y >= sY && y <= sY + CELL_SIZE);
      }));
  };

  const deleteSelectedSeats = () => {
    if (selectedSeatIds.size === 0) return;
    setSeats(prev => prev.filter(s => !selectedSeatIds.has(s.id)));
    setSelectedSeatIds(new Set());
  };

  const clearAllSeats = () => {
      if (window.confirm("Are you sure you want to clear ALL seats? This cannot be undone.")) {
          setSeats([]);
          setSelectedSeatIds(new Set());
      }
  };

  // Smart incrementor that handles A->B, AA->BB, Row 1->Row 2
  const calculateRowLabel = (startLabel: string, rowIndex: number): string => {
     // Check for Repeater Pattern (AA -> BB)
     if (/^([a-zA-Z])\1+$/.test(startLabel)) {
         const charCode = startLabel.charCodeAt(0);
         const nextChar = String.fromCharCode(charCode + rowIndex);
         return nextChar.repeat(startLabel.length);
     }

     // Check for Number Pattern (Row 1 -> Row 2)
     const match = startLabel.match(/^(.*?)(\d+)$/);
     if (match) {
         const prefix = match[1];
         const num = parseInt(match[2]);
         return `${prefix}${num + rowIndex}`;
     }

     // Default Single Character Increment (A -> B)
     if (startLabel.length === 1) {
         return String.fromCharCode(startLabel.charCodeAt(0) + rowIndex);
     }

     // Fallback: just return start + index
     return `${startLabel}${rowIndex}`;
  };

  const applyBulkEdit = () => {
    setSeats(prev => {
        // Only process selected seats
        const selectedSeats = prev.filter(s => selectedSeatIds.has(s.id));
        const updateMap = new Map<string, Partial<Seat>>();
        
        // Group by Row (Row Coordinate)
        const rowsMap = new Map<number, Seat[]>();
        selectedSeats.forEach(s => {
            if (!rowsMap.has(s.row)) rowsMap.set(s.row, []);
            rowsMap.get(s.row)?.push(s);
        });

        const sortedRowKeys = Array.from(rowsMap.keys()).sort((a, b) => a - b);
        
        sortedRowKeys.forEach((rIndex, idx) => {
            // Determine Label for this row based on smart increment
            const rowLabelStr = calculateRowLabel(bulkLabel, idx);
            
            const rowSeats = rowsMap.get(rIndex);
            if(rowSeats) {
                // Sort seats based on direction
                rowSeats.sort((a, b) => bulkDirection === 'LTR' ? a.col - b.col : b.col - a.col);

                rowSeats.forEach((s, seatIdx) => {
                    updateMap.set(s.id, {
                        rowLabel: rowLabelStr,
                        seatNumber: (bulkStartNum + (seatIdx * bulkIncrement)).toString()
                    });
                });
            }
        });

        return prev.map(s => updateMap.has(s.id) ? { ...s, ...updateMap.get(s.id) } : s);
    });
    alert('Bulk update applied!');
  };

  const handleCurveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const intensity = Number(e.target.value);
      setCurveIntensity(intensity);

      // We only apply visual curve if we have selection
      if (selectedSeatIds.size === 0) return;

      setSeats(prev => {
          // Identify the rows involved in selection
          const selected = prev.filter(s => selectedSeatIds.has(s.id));
          const rowsMap = new Map<number, Seat[]>();
          selected.forEach(s => {
              if (!rowsMap.has(s.row)) rowsMap.set(s.row, []);
              rowsMap.get(s.row)?.push(s);
          });

          const updateMap = new Map<string, {x: number, y: number}>();

          rowsMap.forEach((rowSeats, rowIdx) => {
               // Find center of this row group
               const minCol = Math.min(...rowSeats.map(s => s.col));
               const maxCol = Math.max(...rowSeats.map(s => s.col));
               const centerCol = (minCol + maxCol) / 2;

               rowSeats.forEach(s => {
                   // Baseline positions
                   const baseX = s.col * CELL_SIZE;
                   const baseY = s.row * CELL_SIZE;

                   // Curve Logic: Y offset based on distance from center
                   // Quadratic: y = x^2
                   // If intensity is positive: ends move down (convex/frown)
                   // If intensity is negative: ends move up (concave/smile)
                   const dist = s.col - centerCol;
                   const offset = (Math.abs(dist) * Math.abs(dist)) * (intensity / 10);
                   
                   updateMap.set(s.id, {
                       x: baseX,
                       y: baseY + offset
                   });
               });
          });

          return prev.map(s => {
              if (updateMap.has(s.id)) {
                  const updates = updateMap.get(s.id)!;
                  
                  if (intensity === 0) {
                      const { x, y, ...rest } = s;
                      return rest;
                  }
                  return { ...s, x: updates.x, y: updates.y };
              }
              return s;
          });
      });
  };

  const handleResetCurve = () => {
      setCurveIntensity(0);
      if (selectedSeatIds.size === 0) return;

      setSeats(prev => prev.map(s => {
          if (selectedSeatIds.has(s.id)) {
              // Remove absolute coordinates to fallback to grid logic
              const { x, y, ...rest } = s;
              return rest;
          }
          return s;
      }));
  };

  const handleSave = async () => {
    if(!theater) return;
    await saveTheaterLayout(theater.id, seats, stage, rows, cols);
    alert('Layout saved!');
  };

  if (!theater) return <div>Loading...</div>;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Top Bar */}
      <div className="bg-white border-b px-4 py-3 flex justify-between items-center z-20 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin/theaters')} className="text-slate-500 hover:text-slate-800">
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h1 className="text-lg font-bold text-slate-900">{theater.name} <span className="text-slate-400 font-normal">| Editor</span></h1>
            </div>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="p-1 hover:bg-white rounded"><ZoomOut className="w-4 h-4 text-slate-600"/></button>
            <span className="text-xs font-bold text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1 hover:bg-white rounded"><ZoomIn className="w-4 h-4 text-slate-600"/></button>
            <button onClick={() => setZoom(1)} className="p-1 hover:bg-white rounded ml-2" title="Reset"><Maximize className="w-4 h-4 text-slate-600"/></button>
        </div>

        <div className="flex items-center gap-2">
            <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded shadow-sm hover:bg-indigo-700 flex items-center gap-2 text-sm font-medium">
                <Save className="w-4 h-4" /> Save Layout
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <div className="w-16 bg-white border-r flex flex-col items-center py-4 gap-4 z-10 shrink-0">
            <ToolButton icon={MousePointer2} label="Select & Move" active={tool === 'SELECT'} onClick={() => setTool('SELECT')} />
            <ToolButton icon={Edit2} label="Draw Seats" active={tool === 'DRAW'} onClick={() => setTool('DRAW')} />
            <ToolButton icon={Grid3x3} label="Draw Grid" active={tool === 'GRID'} onClick={() => setTool('GRID')} />
            <ToolButton icon={Eraser} label="Erase Seats" active={tool === 'ERASE'} onClick={() => setTool('ERASE')} />
            <div className="w-8 border-b border-slate-200 my-2"></div>
            <ToolButton icon={Square} label="Move Stage" active={tool === 'STAGE'} onClick={() => setTool('STAGE')} />
        </div>

        {/* Center Canvas */}
        <div 
            className="flex-1 overflow-auto bg-slate-200 p-8 relative"
            style={{ cursor: tool === 'SELECT' ? 'default' : tool === 'DRAW' || tool === 'ERASE' || tool === 'GRID' ? 'crosshair' : 'move' }}
        >
             <div 
                className="bg-white shadow-xl relative select-none origin-top-left transition-transform duration-75 ease-linear"
                style={{
                    width: cols * CELL_SIZE,
                    height: rows * CELL_SIZE,
                    transform: `scale(${zoom})`,
                    marginBottom: '400px', 
                    marginRight: '400px',
                    backgroundImage: 'radial-gradient(#e2e8f0 1px, transparent 1px)',
                    backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`
                }}
                onMouseUp={handleMouseUp}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
             >
                {/* Stage Object */}
                <div 
                    data-stage
                    className={clsx(
                        "absolute bg-slate-800 text-slate-300 rounded flex items-center justify-center font-bold tracking-widest uppercase shadow-lg border-2 z-20",
                        tool === 'STAGE' || tool === 'SELECT' ? "cursor-move hover:border-indigo-400" : "border-transparent"
                    )}
                    style={{
                        left: stage.x * CELL_SIZE,
                        top: stage.y * CELL_SIZE,
                        width: stage.width * CELL_SIZE,
                        height: stage.height * CELL_SIZE,
                        fontSize: `${Math.min(24, Math.max(10, 8 + stage.height * 2))}px`
                    }}
                >
                    {stage.label}
                    {(tool === 'STAGE' || isDraggingStage) && <div className="absolute top-0 right-0 p-1 bg-indigo-500 rounded-bl text-[8px] text-white leading-none">DRAG</div>}
                </div>

                {/* Render Seats */}
                {seats.map(seat => {
                    const posX = seat.x !== undefined ? seat.x : seat.col * CELL_SIZE;
                    const posY = seat.y !== undefined ? seat.y : seat.row * CELL_SIZE;
                    
                    const isPreviewSelected = previewSelection.has(seat.id);
                    const isSelected = selectedSeatIds.has(seat.id) || isPreviewSelected;

                    return (
                        <div
                            key={seat.id}
                            className={clsx(
                                "absolute rounded-t-sm border flex items-center justify-center text-[6px] font-bold transition-all",
                                // Added preview logic and hover states
                                isSelected
                                    ? "ring-2 ring-indigo-500 z-10 bg-indigo-50" 
                                    : "bg-white border-slate-300 text-slate-500 hover:bg-slate-50 hover:border-indigo-400 hover:shadow-md cursor-pointer"
                            )}
                            style={{
                                left: posX + 2,
                                top: posY + 2,
                                width: CELL_SIZE - 4,
                                height: CELL_SIZE - 4
                            }}
                            title={`Row: ${seat.rowLabel}, Seat: ${seat.seatNumber}`}
                        >
                            {seat.rowLabel}{seat.seatNumber}
                        </div>
                    );
                })}

                {/* Render Selection Box */}
                {selectionBox && (
                    <div 
                        className={clsx(
                            "absolute border-2 pointer-events-none z-30",
                            // Changed GRID style to match request for "blue hover effect"
                            tool === 'GRID' ? "border-indigo-500 bg-indigo-500/20" : "border-indigo-500 bg-indigo-500/20"
                        )}
                        style={{
                            left: Math.min(selectionBox.start.x, selectionBox.end.x) * CELL_SIZE, 
                            top: Math.min(selectionBox.start.y, selectionBox.end.y) * CELL_SIZE,
                            width: (Math.abs(selectionBox.end.x - selectionBox.start.x)) * CELL_SIZE,
                            height: (Math.abs(selectionBox.end.y - selectionBox.start.y)) * CELL_SIZE,
                        }}
                    />
                )}
             </div>
        </div>

        {/* Right Properties Panel */}
        <div className="w-80 bg-white border-l p-6 overflow-y-auto shrink-0 z-20 shadow-xl">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">Properties</h2>
            
            {/* Canvas Settings */}
            <div className="mb-8 border-b pb-4">
                 <h3 className="text-xs font-bold text-slate-900 mb-2">Canvas Size</h3>
                 <div className="flex gap-2">
                    <div>
                        <label className="text-[10px] text-slate-500">Cols</label>
                        <input type="number" className="w-full border rounded px-2 py-1 text-sm" value={cols} onChange={e => setCols(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500">Rows</label>
                        <input type="number" className="w-full border rounded px-2 py-1 text-sm" value={rows} onChange={e => setRows(Number(e.target.value))} />
                    </div>
                 </div>
                 <div className="mt-4">
                    <button onClick={clearAllSeats} className="w-full text-red-500 text-xs flex items-center hover:bg-red-50 p-2 rounded transition">
                        <RotateCcw className="w-3 h-3 mr-2" /> Clear All Seats
                    </button>
                 </div>
            </div>

            {selectedSeatIds.size === 0 ? (
                <div className="text-center py-10 text-slate-400">
                    <Grip className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Select seats to edit labels or curve</p>
                </div>
            ) : (
                <div className="space-y-8">
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 flex justify-between items-center">
                        <div>
                            <p className="text-indigo-900 font-bold text-lg">{selectedSeatIds.size}</p>
                            <p className="text-indigo-600 text-xs">Seats Selected</p>
                        </div>
                        <button 
                            type="button"
                            onClick={deleteSelectedSeats}
                            className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                            title="Delete Selected Seats"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </div>

                    {/* CURVE TOOL */}
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center">
                                <Spline className="w-4 h-4 mr-2 text-indigo-500" /> Curve Row
                            </h3>
                            <button 
                                onClick={handleResetCurve}
                                className="text-[10px] text-slate-500 hover:text-indigo-600 flex items-center gap-1 hover:bg-slate-100 px-2 py-1 rounded transition"
                                title="Flatten Selection"
                            >
                                <RotateCcw className="w-3 h-3" /> Reset
                            </button>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>Concave</span>
                                <span>Flat</span>
                                <span>Convex</span>
                            </div>
                            <input 
                                type="range" 
                                min="-20" 
                                max="20" 
                                step="1"
                                value={curveIntensity}
                                onChange={handleCurveChange}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <p className="text-[10px] text-slate-400 mt-2 text-center">
                                Select a full row to apply curvature effect.
                            </p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center"><CheckSquare className="w-4 h-4 mr-2"/> Bulk Assign Labels</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Start Row Label</label>
                                <input 
                                    type="text" 
                                    className="w-full border rounded px-3 py-2"
                                    placeholder="e.g. A, AA, Row 1"
                                    value={bulkLabel}
                                    onChange={e => setBulkLabel(e.target.value)}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Supports: A&rarr;B, AA&rarr;BB, Row 1&rarr;Row 2</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Start #</label>
                                    <input 
                                        type="number" 
                                        className="w-full border rounded px-2 py-2"
                                        value={bulkStartNum}
                                        onChange={e => setBulkStartNum(parseInt(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Incr By</label>
                                    <input 
                                        type="number" 
                                        className="w-full border rounded px-2 py-2"
                                        value={bulkIncrement}
                                        onChange={e => setBulkIncrement(parseInt(e.target.value))}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-2">Numbering Direction</label>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => setBulkDirection('LTR')}
                                        className={clsx(
                                            "flex-1 flex items-center justify-center py-2 rounded text-xs border transition",
                                            bulkDirection === 'LTR' ? "bg-indigo-100 border-indigo-300 text-indigo-700 font-bold" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                        )}
                                    >
                                        <ArrowRight className="w-3 h-3 mr-1" /> Left to Right
                                    </button>
                                    <button 
                                        onClick={() => setBulkDirection('RTL')}
                                        className={clsx(
                                            "flex-1 flex items-center justify-center py-2 rounded text-xs border transition",
                                            bulkDirection === 'RTL' ? "bg-indigo-100 border-indigo-300 text-indigo-700 font-bold" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                        )}
                                    >
                                        <ArrowLeftIcon className="w-3 h-3 mr-1" /> Right to Left
                                    </button>
                                </div>
                            </div>

                            <button 
                                onClick={applyBulkEdit}
                                className="w-full bg-slate-800 text-white py-2 rounded hover:bg-slate-900 transition text-sm shadow-sm"
                            >
                                Apply Labels
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

const ToolButton: React.FC<{ icon: any, label: string, active: boolean, onClick: () => void }> = ({ icon: Icon, active, onClick, label }) => (
    <button 
        onClick={onClick}
        title={label}
        className={clsx(
            "p-3 rounded-lg transition-all",
            active ? "bg-indigo-100 text-indigo-700 shadow-inner" : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        )}
    >
        <Icon className="w-6 h-6" />
    </button>
);

export default AdminTheaterBuilder;
