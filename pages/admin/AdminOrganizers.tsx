import React, { useEffect, useState } from 'react';
import { User, UserRole } from '../../types';
import { fetchUsersByRole, createOrganizerUser } from '../../services/mockBackend';
import { Users, Plus, Mail, Lock, User as UserIcon, RefreshCw } from 'lucide-react';

const AdminOrganizers: React.FC = () => {
  const [organizers, setOrganizers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrganizers();
  }, []);

  const loadOrganizers = async () => {
    setLoading(true);
    const data = await fetchUsersByRole(UserRole.ORGANIZER);
    setOrganizers(data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
        await createOrganizerUser(name, email, password);
        setName('');
        setEmail('');
        setPassword('');
        setShowModal(false);
        await loadOrganizers();
    } catch (err: any) {
        setError(err.message || "Failed to create organizer");
    } finally {
        setSubmitting(false);
    }
  };

  const generateRandomPassword = () => {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
      let pass = "";
      for(let i=0; i<10; i++) {
          pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      setPassword(pass);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
            <h1 className="text-3xl font-bold text-slate-900">Organizer Management</h1>
            <p className="text-slate-500 mt-1">Create and manage event organizer accounts.</p>
        </div>
        <button 
            onClick={() => setShowModal(true)}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg flex items-center hover:bg-slate-800 transition shadow-md"
        >
            <Plus className="w-4 h-4 mr-2" /> Add Organizer
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading accounts...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-4 text-sm font-semibold text-slate-700">Name</th>
                        <th className="px-6 py-4 text-sm font-semibold text-slate-700">Email</th>
                        <th className="px-6 py-4 text-sm font-semibold text-slate-700">User ID</th>
                        <th className="px-6 py-4 text-sm font-semibold text-slate-700 text-right">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {organizers.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm">
                                No organizers found. Create one to get started.
                            </td>
                        </tr>
                    ) : (
                        organizers.map(org => (
                            <tr key={org.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4">
                                    <div className="flex items-center">
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mr-3">
                                            <Users className="w-4 h-4" />
                                        </div>
                                        <span className="font-medium text-slate-900">{org.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600">{org.email}</td>
                                <td className="px-6 py-4 text-xs font-mono text-slate-400">{org.id}</td>
                                <td className="px-6 py-4 text-right">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        Active
                                    </span>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                <h2 className="text-xl font-bold mb-4">Create Organizer</h2>
                
                {error && (
                    <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleCreate}>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input 
                                required 
                                type="text"
                                className="w-full border rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                value={name} 
                                onChange={e => setName(e.target.value)} 
                                placeholder="e.g. Jane Smith" 
                            />
                        </div>
                    </div>
                    
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                         <div className="relative">
                            <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input 
                                required 
                                type="email"
                                className="w-full border rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                value={email} 
                                onChange={e => setEmail(e.target.value)} 
                                placeholder="organizer@example.com"
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                         <label className="block text-sm font-medium text-slate-700 mb-1">Set Password</label>
                         <div className="relative flex items-center gap-2">
                            <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input 
                                required 
                                type="text"
                                className="w-full border rounded-lg pl-9 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                placeholder="Enter password"
                            />
                            <button 
                                type="button" 
                                onClick={generateRandomPassword}
                                className="p-2 border rounded-lg hover:bg-slate-50 text-slate-600"
                                title="Generate Random"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Make sure to share this password with the user.</p>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                        <button 
                            type="submit" 
                            disabled={submitting}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-70"
                        >
                            {submitting ? 'Creating...' : 'Create Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrganizers;
