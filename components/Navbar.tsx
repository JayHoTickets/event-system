
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { LogOut, LogIn, LayoutDashboard, Search } from 'lucide-react';

const Navbar: React.FC = () => {
  const { user, login, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-gradient-to-r from-blue-500 to-blue-400 text-white sticky top-0 z-50 shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 justify-between">
          {/* Left: menu + logo */}
          <div className="flex items-center gap-4">
            <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}
            >
              <img src="https://events.jay-ho.com/wp-content/uploads/2026/01/white_logo-scaled.png" alt="Jay-Ho Logo" className="h-8 w-auto object-contain" />
            </div>
          </div>

          {/* Center: search (hidden on mobile) */}
          <div className="flex-1 hidden sm:flex justify-center px-4">
            <div className="w-full max-w-2xl">
              <div className="relative">
                <input
                  placeholder="Search"
                  className="w-full pl-10 pr-4 py-2 rounded-full bg-white/20 placeholder-white/80 text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white opacity-90">
                  <Search className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Right: auth/actions */}
          <div className="flex items-center gap-4">
            {!isAuthenticated ? (
              <Link to="/login" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-md text-sm font-semibold">
                <LogIn className="inline-block w-4 h-4 mr-2 align-text-bottom" /> Login
              </Link>
            ) : (
              <div className="flex items-center gap-4">
                <span className="hidden md:block text-sm opacity-90">
                  {user?.role === UserRole.ADMIN ? 'Administrator' : user?.role === UserRole.ORGANIZER ? 'Organizer' : `Welcome, ${user?.name}`}
                </span>
                {(user?.role === UserRole.ADMIN || user?.role === UserRole.ORGANIZER) && (
                  <Link to={user?.role === UserRole.ADMIN ? '/admin' : '/organizer'} className="text-sm font-medium hover:underline">
                    <LayoutDashboard className="inline-block w-4 h-4 mr-1" /> Dashboard
                  </Link>
                )}
                <button onClick={handleLogout} className="text-sm text-white/90 hover:underline flex items-center">
                  <LogOut className="w-4 h-4 mr-1" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
