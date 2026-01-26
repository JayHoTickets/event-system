
import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { User, Bell, Search } from 'lucide-react';

interface DashboardLayoutProps {
    allowedRoles: UserRole[];
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ allowedRoles }) => {
    const { user, isAuthenticated } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (user && !allowedRoles.includes(user.role)) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="flex h-screen bg-slate-100 overflow-hidden">
            {/* Sidebar */}
            <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Dashboard Header */}
                <header className="bg-gradient-to-r from-blue-500 to-blue-400 text-white h-16 flex items-center px-4 sm:px-6 lg:px-8 shrink-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center cursor-pointer" onClick={() => { /* navigate to dashboard root */ }}>
                            <img src="https://events.jay-ho.com/wp-content/uploads/2026/01/white_logo-scaled.png" alt="Jay-Ho Logo" className="h-8 w-auto object-contain" />
                        </div>
                    </div>

                    <div className="flex-1 hidden sm:flex justify-center px-4">
                        <div className="w-full max-w-2xl">
                            <div className="relative">
                                <input placeholder="Search" className="w-full pl-10 pr-4 py-2 rounded-full bg-white/20 placeholder-white/80 text-white focus:outline-none focus:ring-2 focus:ring-white/30" />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white opacity-90">
                                    <Search className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="p-2 rounded-full hover:bg-white/10">
                            <Bell className="w-5 h-5 text-white/90" />
                        </button>
                        <div className="flex items-center gap-2 bg-white/10 py-1 px-3 rounded-full border border-white/20">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                                <User className="w-4 h-4" />
                            </div>
                            <div className="hidden md:block text-sm">
                                <p className="font-bold leading-none">{user?.name}</p>
                                <p className="text-xs leading-none opacity-90">{user?.email}</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
