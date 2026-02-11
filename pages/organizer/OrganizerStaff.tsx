import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchStaffByOrganizer, createStaff, updateStaff, deleteStaff } from '../../services/mockBackend';

const AVAILABLE_PERMISSIONS = [
  { key: 'scanner', label: 'Scanner' },
  { key: 'events', label: 'Events' },
  { key: 'coupons', label: 'Coupons' },
  { key: 'orders', label: 'Orders' }
];

const Input = ({ label, value, onChange, type = 'text', placeholder = '' }: any) => (
  <label className="block">
    <div className="text-sm text-slate-600 mb-1">{label}</div>
    <input
      className="w-full border border-slate-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-300"
      value={value}
      onChange={e => onChange(e.target.value)}
      type={type}
      placeholder={placeholder}
    />
  </label>
);

const Badge = ({ children }: any) => (
  <span className="inline-block bg-sky-100 text-sky-800 text-xs px-2 py-1 rounded-full mr-2">{children}</span>
);

const OrganizerStaff: React.FC = () => {
  const { user } = useAuth();
  const organizerId = (user as any)?.id || (user as any)?.organizerId;
  const [staff, setStaff] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', permissions: [] as string[] });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    if (!organizerId) return;
    try {
      setLoading(true);
      const s = await fetchStaffByOrganizer(organizerId);
      setStaff(s || []);
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [organizerId]);

  const togglePermission = (key: string) => {
    setForm(f => ({ ...f, permissions: f.permissions.includes(key) ? f.permissions.filter(p => p !== key) : [...f.permissions, key] }));
  };

  const handleCreate = async () => {
    if (!organizerId) return;
    if (!form.name || !form.email || !form.password) { alert('Name, email and password are required'); return; }
    try {
      const payload = { ...form, organizerId };
      await createStaff(payload);
      setForm({ name: '', email: '', password: '', permissions: [] });
      await load();
    } catch (err) { console.error(err); alert('Failed to create staff'); }
  };

  const handleEdit = (s: any) => {
    setEditingId(s.id);
    setForm({ name: s.name || '', email: s.email || '', password: '', permissions: s.permissions || [] });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    try {
      if (!editingId) return handleCreate();
      const updates: any = { name: form.name, permissions: form.permissions };
      if (form.password) updates.password = form.password; // allow password update
      await updateStaff(editingId, updates);
      setEditingId(null);
      setForm({ name: '', email: '', password: '', permissions: [] });
      await load();
    } catch (err) { console.error(err); alert('Save failed'); }
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({ name: '', email: '', password: '', permissions: [] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this staff member?')) return;
    try {
      await deleteStaff(id);
      await load();
    } catch (err) { console.error(err); alert('Delete failed'); }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border rounded-lg shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{editingId ? 'Edit Staff' : 'Create Staff'}</h2>
            {editingId && <button onClick={handleCancel} className="text-sm text-slate-500">Cancel Edit</button>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Name" value={form.name} onChange={(v: string) => setForm({ ...form, name: v })} placeholder="Full name" />
            <Input label="Email" value={form.email} onChange={(v: string) => setForm({ ...form, email: v })} placeholder="Email address" />
            <Input label="Password" value={form.password} onChange={(v: string) => setForm({ ...form, password: v })} placeholder={editingId ? 'Leave blank to keep' : 'Password'} type="password" />
          </div>

          <div className="mt-4">
            <div className="text-sm text-slate-600 mb-2">Permissions</div>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_PERMISSIONS.map(p => (
                <label key={p.key} className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1 rounded border">
                  <input type="checkbox" checked={form.permissions.includes(p.key)} onChange={() => togglePermission(p.key)} />
                  <span className="text-sm text-slate-700">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} className="bg-black text-white px-4 py-2 rounded hover:bg-[#d7ae4b] hover:text-black">{editingId ? 'Save Changes' : 'Create Staff'}</button>
            {editingId ? <button onClick={handleCancel} className="px-4 py-2 rounded border">Cancel</button> : null}
          </div>
        </div>

        <div className="bg-white border rounded-lg shadow-sm p-5">
          <h3 className="text-md font-medium mb-4">Existing Staff</h3>
          {loading ? <div>Loading...</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-slate-600">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Email</th>
                    <th className="pb-2">Permissions</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map(s => (
                    <tr key={s.id} className="border-t">
                      <td className="py-3 align-top">{s.name}</td>
                      <td className="py-3 align-top text-slate-600">{s.email}</td>
                      <td className="py-3 align-top">
                        {((s.permissions || []) as string[]).length === 0 ? <span className="text-slate-400">No permissions</span> : ((s.permissions || []) as string[]).map(p => <Badge key={p}>{p}</Badge>)}
                      </td>
                      <td className="py-3 align-top">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEdit(s)} className="px-3 py-1 rounded border  bg-black text-white text-sm hover:bg-[#d7ae4b] hover:text-black">Edit</button>
                          <button onClick={() => handleDelete(s.id)} className="px-3 py-1 rounded border text-sm text-red-600">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizerStaff;
