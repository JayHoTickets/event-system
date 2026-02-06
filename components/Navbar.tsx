
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
    <nav className="bg-black text-white sticky  text-white sticky top-0 z-50 shadow h-20">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 justify-between">
          {/* Left: menu + logo */}
          <div className="flex items-center gap-4">
            <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}
            >
          <div className="flex-1 flex items-center justify-center cursor-pointer" style={{ paddingTop: "7%"}} onClick={() => navigate('/') }>
            <img src="https://events.jay-ho.com/wp-content/uploads/2026/02/Jay-Ho-Tickets.png" alt="Jay-Ho" className="h-12 w-auto object-contain" />
          </div>            </div>
          </div>

          {/* Center: tag line */}
          <div className="flex-1 hidden sm:flex justify-center px-4">
            <div className="w-full max-w-2xl">
              <div className="relative">

                <div className="absolute left-3 top-1 -translate-y-1/2 text-white">
                  <img src="https://events.jay-ho.com/wp-content/uploads/2026/02/Tagline_for_-2-scaled.png" className="h-15 w-auto object-contain" />
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
