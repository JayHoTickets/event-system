
import React, { useEffect, useState } from 'react';
import { Venue } from '../../types';
import { fetchVenues, createVenue, updateVenue, deleteVenue } from '../../services/mockBackend';
import { Building2, Plus, MapPin, Edit2, Trash2 } from 'lucide-react';

const AdminVenues: React.FC = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Edit State
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);

  // Form State
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');
    const [newState, setNewState] = useState('');
    const [newZipCode, setNewZipCode] = useState('');
    const [newCountry, setNewCountry] = useState('');

  useEffect(() => {
    loadVenues();
  }, []);

  const loadVenues = async () => {
    const data = await fetchVenues();
    setVenues(data);
    setLoading(false);
  };

  const openCreateModal = () => {
      setEditingVenue(null);
      setNewName('');
      setNewAddress('');
      setNewCity('');
      setNewState('');
      setNewZipCode('');
      setNewCountry('');
      setShowModal(true);
  };

  const openEditModal = (venue: Venue) => {
      setEditingVenue(venue);
      setNewName(venue.name);
      setNewAddress(venue.address);
      setNewCity(venue.city);
      setNewState(venue.state || '');
      setNewZipCode(venue.zipCode || '');
      setNewCountry(venue.country || '');
      setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
        if (editingVenue) {
            await updateVenue(editingVenue.id, {
                name: newName,
                address: newAddress,
                city: newCity,
                state: newState,
                zipCode: newZipCode,
                country: newCountry
            });
        } else {
            await createVenue({
                name: newName,
                address: newAddress,
                city: newCity,
                state: newState,
                zipCode: newZipCode,
                country: newCountry
            });
        }
        await loadVenues();
        setShowModal(false);
    } catch (err) {
        alert("Failed to save venue");
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
      if(window.confirm("Are you sure you want to delete this venue? This cannot be undone.")) {
          setLoading(true);
          try {
              await deleteVenue(id);
              await loadVenues();
          } catch (err) {
              alert("Failed to delete venue");
          } finally {
              setLoading(false);
          }
      }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-bold text-slate-900">Venue Management</h1>
            <p className="text-slate-500 mt-1">Manage physical locations (Buildings, Stadiums).</p>
        </div>
        <button 
            onClick={openCreateModal}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center hover:bg-slate-800 transition shadow-md"
        >
            <Plus className="w-4 h-4 mr-2" /> Add Venue
        </button>
      </div>

      {loading && venues.length === 0 ? (
        <div className="text-center py-12 text-slate-500">Loading venues...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {venues.map(venue => (
                <div key={venue.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition">
                    <div className="flex items-start justify-between mb-4">
                        <div className="bg-slate-100 p-3 rounded-lg">
                            <Building2 className="w-6 h-6 text-slate-600" />
                        </div>
                        <div className="flex gap-2">
                             <button 
                                onClick={() => openEditModal(venue)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                             >
                                <Edit2 className="w-4 h-4" />
                             </button>
                             <button 
                                onClick={() => handleDelete(venue.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                             >
                                <Trash2 className="w-4 h-4" />
                             </button>
                        </div>
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{venue.name}</h3>
                    <div className="flex items-center text-sm text-slate-500 mb-1">
                        <MapPin className="w-3 h-3 mr-1" />
                        {venue.address}, {venue.city}{venue.state ? `, ${venue.state}` : ''}{venue.zipCode ? ` ${venue.zipCode}` : ''}{venue.country ? ` - ${venue.country}` : ''}
                    </div>
                    <div className="mt-4 text-xs text-slate-400">
                        ID: {venue.id}
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-xl font-bold mb-4">{editingVenue ? 'Edit Venue' : 'Add New Venue'}</h2>
                <form onSubmit={handleSave}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Venue Name</label>
                        <input required className="w-full border rounded-lg px-3 py-2" value={newName} onChange={e => setNewName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                            <input required className="w-full border rounded-lg px-3 py-2" value={newAddress} onChange={e => setNewAddress(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                            <input required className="w-full border rounded-lg px-3 py-2" value={newCity} onChange={e => setNewCity(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                            <input required className="w-full border rounded-lg px-3 py-2" value={newState} onChange={e => setNewState(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Zip Code</label>
                            <input required className="w-full border rounded-lg px-3 py-2" value={newZipCode} onChange={e => setNewZipCode(e.target.value)} />
                        </div>
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                        <input required className="w-full border rounded-lg px-3 py-2" value={newCountry} onChange={e => setNewCountry(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                            {editingVenue ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminVenues;
