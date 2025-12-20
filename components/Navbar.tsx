
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { Ticket, LogOut, LogIn, LayoutDashboard } from 'lucide-react';

const Navbar: React.FC = () => {
  const { user, login, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
            <Ticket className="h-8 w-8 text-indigo-400" />
            <span className="ml-2 text-xl font-bold tracking-tight">EventHorizon</span>
          </div>

          <div className="flex items-center space-x-4">
            {!isAuthenticated ? (
              <div className="flex space-x-3">
                <button
                  onClick={() => login(UserRole.USER)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition hidden sm:block"
                >
                  Demo User
                </button>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 rounded-md transition flex items-center"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Login
                </Link>
              </div>
            ) : (
              <div className="flex items-center space-x-6">
                <span className="text-sm text-slate-400 hidden md:block">
                  {user?.role === UserRole.ADMIN ? 'Administrator' : 
                   user?.role === UserRole.ORGANIZER ? 'Organizer' : 
                   `Welcome, ${user?.name}`}
                </span>
                
                {/* Contextual Link to Dashboard if on Public pages but logged in as Admin/Org */}
                {(user?.role === UserRole.ADMIN) && (
                   <Link to="/admin" className="flex items-center text-sm font-medium hover:text-indigo-400">
                     <LayoutDashboard className="h-4 w-4 mr-1" />
                     Dashboard
                   </Link>
                )}
                
                {(user?.role === UserRole.ORGANIZER) && (
                   <Link to="/organizer" className="flex items-center text-sm font-medium hover:text-indigo-400">
                        <LayoutDashboard className="h-4 w-4 mr-1" />
                        Dashboard
                   </Link>
                )}

                <button
                  onClick={handleLogout}
                  className="flex items-center text-sm font-medium text-red-400 hover:text-red-300"
                >
                  <LogOut className="h-4 w-4 mr-1" />
                  Logout
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
