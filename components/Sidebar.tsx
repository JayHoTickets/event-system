
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { 
  LayoutDashboard, 
  Building2, 
  Armchair, 
  Receipt, 
  Users, 
  Ticket, 
  LogOut, 
  PlusCircle, 
  Tag, 
  Menu,
  X,
  Scan
} from 'lucide-react';
import clsx from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const NavItem = ({ to, icon: Icon, label, end = false }: { to: string, icon: any, label: string, end?: boolean }) => (
    <NavLink
      to={to}
      end={end}
      onClick={() => setIsOpen(false)} // Close on mobile click
      className={({ isActive }) => clsx(
        "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors mb-1",
        isActive 
          ? "bg-indigo-600 text-white shadow-md" 
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      )}
    >
      <Icon className="w-5 h-5 mr-3" />
      {label}
    </NavLink>
  );

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={clsx(
          "fixed inset-0 bg-black/50 z-20 lg:hidden transition-opacity",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* Sidebar Container */}
      <div className={clsx(
        "fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out flex flex-col h-full border-r border-slate-800 shadow-xl lg:shadow-none lg:transform-none",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center cursor-pointer" onClick={() => navigate('/') }>
            <Ticket className="h-6 w-6 text-indigo-500" />
            <img src="https://events.jay-ho.com/wp-content/uploads/2026/01/white_logo-scaled.png" alt="Jay-Ho" className="ml-2 h-6 w-auto object-contain" />
          </div>
            <button onClick={() => setIsOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
            </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-3">
            <div className="mb-2 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                {user?.role} Menu
            </div>

            {user?.role === UserRole.ADMIN && (
                <>
                    <NavItem to="/admin" end icon={LayoutDashboard} label="Dashboard" />
                    <NavItem to="/admin/venues" icon={Building2} label="Venues" />
                    <NavItem to="/admin/theaters" icon={Armchair} label="Theaters" />
                    <NavItem to="/admin/charges" icon={Receipt} label="Service Charges" />
                    <NavItem to="/admin/organizers" icon={Users} label="Organizers" />
                </>
            )}

            {user?.role === UserRole.ORGANIZER && (
                <>
                    <NavItem to="/organizer" end icon={LayoutDashboard} label="Dashboard" />
                    <NavItem to="/organizer/scanner" icon={Scan} label="Scan Tickets" />
                    <NavItem to="/organizer/create-event" icon={PlusCircle} label="Create Event" />
                    <NavItem to="/organizer/coupons" icon={Tag} label="Coupons" />
                </>
            )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
            <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-400 hover:bg-slate-800 hover:text-red-300 rounded-lg transition"
            >
                <LogOut className="w-5 h-5 mr-3" />
                Logout
            </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
