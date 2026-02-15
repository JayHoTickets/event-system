import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '../../types';

const Badge = ({ children }: any) => (
  <span className="inline-block bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full mr-2">{children}</span>
);

const OrganizerProfile: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const initials = (user.name || '').split(' ').map(s => s[0]).join('').slice(0,2).toUpperCase();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white border rounded-lg shadow-sm p-6 flex gap-6 items-center">
        <div className="w-28 h-28 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-2xl font-bold">
          {initials || 'U'}
        </div>

        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900">{user.name}</h2>
          <p className="text-sm text-slate-500 mt-1">{user.email}</p>
          <div className="mt-3 flex items-center gap-2">
            <Badge>{user.role}</Badge>
            {user.role === UserRole.STAFF && (user as any).organizerId && <Badge>Organizer: {(user as any).organizerId}</Badge>}
          </div>

          <div className="mt-4 text-sm text-slate-600">
            <p><strong className="text-slate-800">Profile</strong></p>
            <p className="mt-2">Use this dashboard to quickly access your organizer tools. Your access and available modules depend on your role and assigned permissions.</p>
          </div>

          {/* <div className="mt-4 flex gap-3">
            <button onClick={() => navigate('/organizer/events')} className="px-4 py-2 rounded bg-slate-900 text-white">Go to Events</button>
            <button onClick={() => navigate('/organizer/staff')} className="px-4 py-2 rounded border">Manage Staff</button>
            <button onClick={() => navigate('/organizer/coupons')} className="px-4 py-2 rounded border">Coupons</button>
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default OrganizerProfile;
