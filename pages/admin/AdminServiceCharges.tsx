
import React, { useEffect, useState } from 'react';
import { ServiceCharge } from '../../types';
import { fetchServiceCharges, createServiceCharge, updateServiceCharge, deleteServiceCharge } from '../../services/mockBackend';
import { Receipt, Plus, Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react';

const AdminServiceCharges: React.FC = () => {
    const [charges, setCharges] = useState<ServiceCharge[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    
    // Edit State
    const [editingCharge, setEditingCharge] = useState<ServiceCharge | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [type, setType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
    const [value, setValue] = useState(0);
    const [active, setActive] = useState(true);

    useEffect(() => {
        loadCharges();
    }, []);

    const loadCharges = async () => {
        const data = await fetchServiceCharges();
        setCharges(data);
        setLoading(false);
    };

    const openCreateModal = () => {
        setEditingCharge(null);
        setName('');
        setType('FIXED');
        setValue(0);
        setActive(true);
        setShowModal(true);
    };

    const openEditModal = (charge: ServiceCharge) => {
        setEditingCharge(charge);
        setName(charge.name);
        setType(charge.type);
        setValue(charge.value);
        setActive(charge.active);
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (editingCharge) {
                await updateServiceCharge(editingCharge.id, { name, type, value, active });
            } else {
                await createServiceCharge({ name, type, value, active });
            }
            await loadCharges();
            setShowModal(false);
        } catch (err) {
            alert('Failed to save service charge');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if(window.confirm('Are you sure you want to delete this service charge?')) {
            await deleteServiceCharge(id);
            await loadCharges();
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Service Charges</h1>
                    <p className="text-slate-500 mt-1">Manage platform fees applied to customer orders.</p>
                </div>
                <button 
                    onClick={openCreateModal}
                    className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center hover:bg-slate-800 transition shadow-md"
                >
                    <Plus className="w-4 h-4 mr-2" /> Add Charge
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading charges...</div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Name</th>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Type</th>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Value</th>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Status</th>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {charges.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        No service charges defined.
                                    </td>
                                </tr>
                            ) : (
                                charges.map(charge => (
                                    <tr key={charge.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center font-medium text-slate-900">
                                                <Receipt className="w-4 h-4 mr-2 text-slate-400" />
                                                {charge.name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${charge.type === 'PERCENTAGE' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                                                {charge.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-900">
                                            {charge.type === 'PERCENTAGE' ? `${charge.value}%` : `$${charge.value.toFixed(2)}`}
                                        </td>
                                        <td className="px-6 py-4">
                                            {charge.active ? (
                                                <span className="flex items-center text-green-600 text-xs font-bold">
                                                    <CheckCircle className="w-3 h-3 mr-1" /> Active
                                                </span>
                                            ) : (
                                                <span className="flex items-center text-slate-400 text-xs font-bold">
                                                    <XCircle className="w-3 h-3 mr-1" /> Inactive
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => openEditModal(charge)}
                                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(charge.id)}
                                                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">{editingCharge ? 'Edit Service Charge' : 'Add Service Charge'}</h2>
                        <form onSubmit={handleSave}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Charge Name</label>
                                <input 
                                    required 
                                    className="w-full border rounded-lg px-3 py-2" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    placeholder="e.g. Booking Fee"
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                                    <select 
                                        className="w-full border rounded-lg px-3 py-2"
                                        value={type}
                                        onChange={e => setType(e.target.value as any)}
                                    >
                                        <option value="FIXED">Fixed Amount ($)</option>
                                        <option value="PERCENTAGE">Percentage (%)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Value</label>
                                    <input 
                                        required
                                        type="number"
                                        step="0.01"
                                        className="w-full border rounded-lg px-3 py-2"
                                        value={value}
                                        onChange={e => setValue(Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={active}
                                        onChange={e => setActive(e.target.checked)}
                                        className="w-4 h-4 rounded text-indigo-600"
                                    />
                                    <span className="text-sm font-medium text-slate-700">Active</span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminServiceCharges;
