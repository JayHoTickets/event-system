
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Theater, Venue } from '../../types';
import { fetchTheaters, fetchVenues, createTheater, updateTheaterInfo, deleteTheater } from '../../services/mockBackend';
import { Armchair, Plus, MapPin, LayoutGrid, Edit2, Trash2 } from 'lucide-react';

const AdminTheaters: React.FC = () => {
  const navigate = useNavigate();
  const [theaters, setTheaters] = useState<Theater[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Edit State
  const [editingTheater, setEditingTheater] = useState<Theater | null>(null);

  // Form
  const [newName, setNewName] = useState('');
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [rows, setRows] = useState(15);
  const [cols, setCols] = useState(20);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [tData, vData] = await Promise.all([fetchTheaters(), fetchVenues()]);
    setTheaters(tData);
    setVenues(vData);
    if (vData.length > 0) setSelectedVenueId(vData[0].id);
    setLoading(false);
  };

  const openCreateModal = () => {
      setEditingTheater(null);
      setNewName('');
      if(venues.length > 0) setSelectedVenueId(venues[0].id);
      setRows(15);
      setCols(20);
      setShowModal(true);
  };

  const openEditModal = (theater: Theater) => {
      setEditingTheater(theater);
      setNewName(theater.name);
      setSelectedVenueId(theater.venueId);
      // Rows/Cols are not editable in Info modal, only in Builder, so we don't set them
      setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
        if(editingTheater) {
            await updateTheaterInfo(editingTheater.id, {
                name: newName,
                venueId: selectedVenueId
            });
        } else {
            await createTheater({
                name: newName,
                venueId: selectedVenueId,
                rows: rows,
                cols: cols
            });
        }
        await loadData();
        setShowModal(false);
    } catch (err) {
        alert("Failed to save theater");
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
      if(window.confirm("Are you sure you want to delete this theater? This cannot be undone.")) {
          setLoading(true);
          try {
              await deleteTheater(id);
              await loadData();
          } catch (err) {
              alert("Failed to delete theater");
          } finally {
              setLoading(false);
          }
      }
  };

    const formatVenue = (v?: Venue) => {
        if (!v) return 'Unknown Venue';
        const parts = [v.address, v.city, v.state, v.zipCode].filter(Boolean).join(', ');
        return `${v.name}${parts ? ' — ' + parts : ''}${v.country ? ` (${v.country})` : ''}`;
    };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-bold text-slate-900">Theater Management</h1>
            <p className="text-slate-500 mt-1">Create halls, auditoriums, and design seating layouts.</p>
        </div>
        <button 
            onClick={openCreateModal}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition shadow-md"
        >
            <Plus className="w-4 h-4 mr-2" /> Add Theater
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {theaters.map(theater => (
            <div key={theater.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                    <div className="bg-indigo-50 p-3 rounded-lg">
                        <Armchair className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div className="flex gap-2 items-center">
                        <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 font-medium">
                            {theater.seats.length} Seats
                        </span>
                        <div className="flex gap-1 ml-2">
                             <button 
                                onClick={() => openEditModal(theater)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                title="Edit Info"
                             >
                                <Edit2 className="w-4 h-4" />
                             </button>
                             <button 
                                onClick={() => handleDelete(theater.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete"
                             >
                                <Trash2 className="w-4 h-4" />
                             </button>
                        </div>
                    </div>
                </div>
                
                <h3 className="text-lg font-bold text-slate-900 mb-1">{theater.name}</h3>
                <div className="flex flex-col text-sm text-slate-500 mb-6">
                    <div className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        <span className="font-medium text-slate-700">{venues.find(v => v.id === theater.venueId)?.name || 'Unknown Venue'}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        {formatVenue(venues.find(v => v.id === theater.venueId))}
                    </div>
                </div>

                <div className="mt-auto border-t pt-4">
                    <button 
                        onClick={() => navigate(`/admin/theaters/${theater.id}/builder`)}
                        className="w-full flex items-center justify-center bg-white border border-slate-300 text-slate-700 py-2 rounded-lg hover:bg-slate-50 transition font-medium"
                    >
                        <LayoutGrid className="w-4 h-4 mr-2" /> Open Builder
                    </button>
                </div>
            </div>
        ))}
      </div>

       {/* Create/Edit Modal */}
       {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-xl font-bold mb-4">{editingTheater ? 'Edit Theater Info' : 'Create New Theater'}</h2>
                <form onSubmit={handleSave}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Theater Name</label>
                        <input required className="w-full border rounded-lg px-3 py-2" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Hall A" />
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Associate with Venue</label>
                        <select className="w-full border rounded-lg px-3 py-2" value={selectedVenueId} onChange={e => setSelectedVenueId(e.target.value)}>
                            {venues.map(v => (
                                <option key={v.id} value={v.id}>
                                    {v.name} {v.city ? `(${v.city}${v.state ? `, ${v.state}` : ''}${v.zipCode ? ` ${v.zipCode}` : ''})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    {!editingTheater && (
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Grid Rows</label>
                                <input type="number" className="w-full border rounded-lg px-3 py-2" value={rows} onChange={e => setRows(Number(e.target.value))} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Grid Cols</label>
                                <input type="number" className="w-full border rounded-lg px-3 py-2" value={cols} onChange={e => setCols(Number(e.target.value))} />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                            {editingTheater ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminTheaters;
