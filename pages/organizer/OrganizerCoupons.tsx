
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCouponsByOrganizer, createCoupon, updateCoupon, deleteCoupon, fetchEventsByOrganizer } from '../../services/mockBackend';
import { Coupon, Event } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { ArrowLeft, Tag, Plus, Calendar, Ticket, Hash, Edit2, Trash2, XCircle } from 'lucide-react';
import clsx from 'clsx';

const OrganizerCoupons: React.FC = () => {
    const { user } = useAuth();
    const perms: string[] = (user as any)?.permissions || [];
    const isStaff = user?.role === 'STAFF';
    const canManageCoupons = !isStaff || perms.includes('coupons');
    const navigate = useNavigate();
    
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    
    // Edit State
    const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

    // Form State
    const initialForm = {
        code: '',
        discountType: 'PERCENTAGE',
        value: 10,
        eventId: '',
        maxUses: 100,
        expiryDate: '',
        ruleType: 'CODE',
        // explicit fields
        minAmount: 0,
        minSeats: 0,
    };

    const [formData, setFormData] = useState({ ...initialForm });

    useEffect(() => {
        loadData();
    }, [user]);

    const loadData = () => {
        if(user) {
            const organizerId = (user.role === 'STAFF') ? (user as any).organizerId : user.id;
            Promise.all([
                fetchCouponsByOrganizer(organizerId),
                fetchEventsByOrganizer(organizerId)
            ]).then(([cData, eData]) => {
                setCoupons(cData);
                setEvents(eData);
                setLoading(false);
            });
        }
    }

    const openCreateModal = () => {
        setEditingCoupon(null);
        setFormData({ ...initialForm });
        setShowModal(true);
    };

    const openEditModal = (coupon: Coupon) => {
        setEditingCoupon(coupon);
        // Normalize expiry date to `datetime-local` input format if available
        let expiry = '';
        try {
            if ((coupon as any).expiryDate) {
                const d = new Date((coupon as any).expiryDate);
                if (!isNaN(d.getTime())) expiry = d.toISOString().slice(0,16);
            }
        } catch (e) { expiry = ''; }

        setFormData({
            ...initialForm,
            code: coupon.code || initialForm.code,
            discountType: coupon.discountType || initialForm.discountType,
            value: typeof (coupon as any).value !== 'undefined' ? (coupon as any).value : initialForm.value,
            eventId: coupon.eventId || initialForm.eventId,
            maxUses: typeof (coupon as any).maxUses !== 'undefined' ? (coupon as any).maxUses : initialForm.maxUses,
            expiryDate: expiry || initialForm.expiryDate,
            ruleType: (coupon as any).ruleType || initialForm.ruleType,
            // explicit fields prefer top-level values, fall back to legacy ruleParams
            minAmount: (typeof (coupon as any).minAmount !== 'undefined' && (coupon as any).minAmount !== null) ? (coupon as any).minAmount : ((coupon as any).ruleParams && (coupon as any).ruleParams.minAmount) || initialForm.minAmount,
            minSeats: (typeof (coupon as any).minSeats !== 'undefined' && (coupon as any).minSeats !== null) ? (coupon as any).minSeats : ((coupon as any).ruleParams && (coupon as any).ruleParams.minSeats) || initialForm.minSeats
        });
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!user) return;
        setSubmitting(true);
        try {
            // Build payload including new rule fields
            const organizerId = (user.role === 'STAFF') ? (user as any).organizerId : user.id;
            const payload: any = {
                code: formData.code.toUpperCase(),
                discountType: formData.discountType as 'PERCENTAGE' | 'FIXED',
                value: Number(formData.value),
                eventId: formData.eventId || null,
                organizerId,
                maxUses: Number(formData.maxUses),
                expiryDate: formData.expiryDate,
                ruleType: formData.ruleType || 'CODE',
                    // Explicit fields preferred by backend; keep ruleParams for compatibility
                    minAmount: Number((formData as any).minAmount) || 0,
                    minSeats: Number((formData as any).minSeats) || 0,
                active: true
            };

            if (editingCoupon) {
                await updateCoupon(editingCoupon.id, payload);
            } else {
                await createCoupon(payload);
            }
            
            loadData();
            setShowModal(false);
            // reset form to defaults (ensure controlled inputs for next open)
            setFormData({
                code: '',
                discountType: 'PERCENTAGE',
                value: 10,
                eventId: '',
                maxUses: 100,
                expiryDate: '',
                ruleType: 'CODE',
                minAmount: 0,
                minSeats: 0
            });
        } catch (error) {
            alert('Failed to save coupon: ' + error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (coupon: Coupon) => {
        if (window.confirm(`Are you sure you want to delete coupon ${coupon.code}? This will soft delete it and prevent future use.`)) {
            try {
                await deleteCoupon(coupon.id);
                loadData();
            } catch (error) {
                alert("Failed to delete coupon: " + error);
            }
        }
    };

    const getEventName = (id: string | null) => {
        if (!id) return 'All Events';
        return events.find(e => e.id === id)?.title || 'Unknown Event';
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <button onClick={() => navigate('/organizer')} className="flex items-center text-slate-500 hover:text-slate-800 mb-6">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
            </button>

            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Manage Coupons</h1>
                    <p className="text-slate-500 mt-1">Create and manage discount codes for your events.</p>
                </div>
                <button 
                    onClick={openCreateModal}
                    className="bg-black text-white px-4 py-2 rounded-lg flex items-center hover:bg-[#d7ae4b] hover:text-black transition shadow-md"
                    disabled={!canManageCoupons}
                    title={!canManageCoupons ? 'You do not have permission to create coupons' : ''}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Coupon
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading coupons...</div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Code</th>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Discount</th>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Applied To</th>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Usage</th>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Expiry</th>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-700">Status</th>
                                <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {coupons.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                        No coupons created yet.
                                    </td>
                                </tr>
                            ) : (
                                coupons.map(coupon => (
                                    <tr key={coupon.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4">
                                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                                {coupon.code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-slate-700">
                                            {coupon.discountType === 'PERCENTAGE' ? `${coupon.value}% OFF` : `$${coupon.value} OFF`}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 flex items-center">
                                            <Ticket className="w-3 h-3 mr-1 text-slate-400" />
                                            {getEventName(coupon.eventId)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {coupon.usedCount} / {coupon.maxUses}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {new Date(coupon.expiryDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {new Date(coupon.expiryDate) < new Date() ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    Expired
                                                </span>
                                            ) : coupon.usedCount >= coupon.maxUses ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                    Depleted
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                    Active
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {canManageCoupons && (
                                                  <button 
                                                      onClick={() => openEditModal(coupon)}
                                                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                                                      title="Edit Coupon"
                                                  >
                                                      <Edit2 className="w-4 h-4" />
                                                  </button>
                                                )}
                                                {canManageCoupons && (
                                                  <button 
                                                      onClick={() => handleDelete(coupon)}
                                                      className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                      title="Delete Coupon"
                                                  >
                                                      <Trash2 className="w-4 h-4" />
                                                  </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 flex items-center">
                            <Tag className="w-5 h-5 mr-2 text-indigo-600" /> 
                            {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
                        </h2>
                        <form onSubmit={handleSave}>
                            
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Coupon Code</label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                    <input 
                                        required 
                                        className="w-full border rounded-lg pl-9 pr-3 py-2 uppercase font-mono" 
                                        placeholder="e.g. SUMMER25"
                                        value={formData.code}
                                        onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Rule Type</label>
                                <select className="w-full border rounded-lg px-3 py-2" value={(formData as any).ruleType} onChange={e => setFormData({...formData, ruleType: e.target.value})}>
                                    <option value="CODE">Code (manual apply)</option>
                                    <option value="THRESHOLD">Threshold (min amount)</option>
                                    {/* Early bird removed */}
                                    <option value="SEAT_COUNT">Seat Count (min seats)</option>
                                </select>
                                <p className="text-xs text-slate-500 mt-1">Choose how this coupon should be applied.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                                    <select 
                                        className="w-full border rounded-lg px-3 py-2"
                                        value={formData.discountType}
                                        onChange={e => setFormData({...formData, discountType: e.target.value})}
                                    >
                                        <option value="PERCENTAGE">Percentage (%)</option>
                                        <option value="FIXED">Fixed Amount ($)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Value</label>
                                    <input 
                                        required
                                        type="number"
                                        className="w-full border rounded-lg px-3 py-2"
                                        value={formData.value}
                                        onChange={e => setFormData({...formData, value: Number(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Apply To Event</label>
                                <select 
                                    className="w-full border rounded-lg px-3 py-2"
                                    value={formData.eventId}
                                    onChange={e => setFormData({...formData, eventId: e.target.value})}
                                >
                                    <option value="">All Events (Global)</option>
                                    {events.map(e => (
                                        <option key={e.id} value={e.id}>{e.title}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">Leave as "All Events" to apply to everything.</p>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Rule Parameters</label>

                                {/* Threshold */}
                                {(formData as any).ruleType === 'THRESHOLD' && (
                                    <div className="mb-3">
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Minimum Order Amount (for Threshold)</label>
                                        <input type="number" className="w-full border rounded-lg px-3 py-2" value={(formData as any).minAmount} onChange={e => setFormData({...formData, minAmount: Number(e.target.value)})} placeholder="0.00" />
                                    </div>
                                )}

                                {/* Early bird rule removed — no fields here anymore */}

                                {/* Seat Count */}
                                {(formData as any).ruleType === 'SEAT_COUNT' && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-600 mb-1">Minimum Seats Required (for Seat Count)</label>
                                        <input type="number" className="w-full border rounded-lg px-3 py-2" value={(formData as any).minSeats} onChange={e => setFormData({...formData, minSeats: Number(e.target.value)})} placeholder="e.g. 2" />
                                    </div>
                                )}

                                <p className="text-xs text-slate-500 mt-2">Tip: Set the fields relevant to the selected <strong>Rule Type</strong>. </p>
                                {/* Legacy JSON params removed — only explicit fields supported now */}
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Max Uses</label>
                                    <input 
                                        required
                                        type="number"
                                        className="w-full border rounded-lg px-3 py-2"
                                        value={formData.maxUses}
                                        onChange={e => setFormData({...formData, maxUses: Number(e.target.value)})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                                    <input 
                                        required
                                        type="datetime-local"
                                        className="w-full border rounded-lg px-3 py-2"
                                        value={formData.expiryDate}
                                        onChange={e => setFormData({...formData, expiryDate: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                                <button 
                                    type="submit" 
                                    disabled={submitting}
                                    className="px-4 py-2 bg-black text-white rounded-lg hover:bg-[#d7ae4b] hover:text-black disabled:opacity-70"
                                >
                                    {submitting ? 'Saving...' : (editingCoupon ? 'Update Coupon' : 'Create Coupon')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OrganizerCoupons;
