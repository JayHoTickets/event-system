import React from 'react';
import SeatGrid from '../../../components/SeatGrid';
import { ZoomIn, ZoomOut, Maximize, Ban, CheckCircle, Ticket } from 'lucide-react';

const EventAnalyticsMap: React.FC<any> = (props) => {
  const {
    event,
    selectedSeatIds,
    setSelectedSeatIds,
    selectedSeatObjs,
    selectionTotal,
    zoom,
    setZoom,
    mapContainerRef,
    handleSeatClick,
    handleBulkSelect,
    handleBlockSeats,
    handleUnblockSeats,
    handleOpenBoxOffice,
    handleOpenHoldOrder,
    isReserved,
  } = props;

  if (!event) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-[600px] relative">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-xl">
        <div className="flex items-center gap-4">
          <h2 className="font-bold text-slate-900">Seating Status</h2>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-200 border border-slate-300 rounded"></div><span>Sold</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-amber-200 border border-amber-300 rounded animate-pulse"></div><span>Booking (In-progress)</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-800 border border-slate-800 flex items-center justify-center rounded"></div><span>Blocked</span></div>
            {event.ticketTypes.map((tt:any) => (
              <div key={tt.id} className="flex items-center gap-1"><div className="w-3 h-3 rounded" style={{ backgroundColor: tt.color }}></div><span>{tt.name} (Avail)</span></div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1 bg-white p-1 rounded border shadow-sm">
          <button onClick={() => setZoom((z:any) => Math.max(0.2, z - 0.1))} className="p-1.5 hover:bg-slate-100 rounded text-slate-600"><ZoomOut className="w-4 h-4"/></button>
          <span className="text-xs font-bold text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z:any) => Math.min(2, z + 0.1))} className="p-1.5 hover:bg-slate-100 rounded text-slate-600"><ZoomIn className="w-4 h-4"/></button>
          <button onClick={() => setZoom(1)} className="p-1.5 hover:bg-slate-100 rounded text-slate-600 border-l ml-1" title="Reset"><Maximize className="w-4 h-4"/></button>
        </div>
      </div>

      <div ref={mapContainerRef} className="flex-1 bg-slate-100 overflow-hidden flex items-center justify-center p-4">
        <SeatGrid seats={event.seats} stage={event.stage} selectedSeatIds={selectedSeatIds} totalRows={event.rows} totalCols={event.cols} scale={zoom} onSeatClick={handleSeatClick} allowDragSelect={true} onBulkSelect={handleBulkSelect} canSelectUnavailable={true} />
      </div>

      {selectedSeatIds.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-2xl border border-slate-200 p-2 flex gap-2 animate-in slide-in-from-bottom-4 duration-200 z-10">
          <div className="flex items-center px-4 border-r border-slate-200 mr-2"><span className="font-bold text-indigo-600">{selectedSeatIds.length}</span><span className="text-sm text-slate-500 ml-1">selected</span></div>
          <button onClick={handleBlockSeats} className="flex items-center px-4 py-2 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition"><Ban className="w-4 h-4 mr-2 text-red-500"/> Block</button>
          <button onClick={handleUnblockSeats} className="flex items-center px-4 py-2 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition"><CheckCircle className="w-4 h-4 mr-2 text-green-500"/> Unblock</button>
          <div className="w-px bg-slate-200 mx-1"></div>
          <button onClick={handleOpenBoxOffice} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition shadow-sm"><Ticket className="w-4 h-4 mr-2"/> Book</button>
          <button onClick={handleOpenHoldOrder} className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-bold hover:bg-yellow-600 transition shadow-sm"><Ticket className="w-4 h-4 mr-2"/> Held</button>
        </div>
      )}
    </div>
  );
};

export default EventAnalyticsMap;
