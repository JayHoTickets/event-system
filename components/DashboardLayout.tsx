import React, { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../context/AuthContext";
import { UserRole } from "../types";
import { Menu, User, Bell } from "lucide-react";

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
        <header className="bg-black  text-white  border-b  h-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 z-10">
          {/* Center: tag line */}
          <div className="flex-1 hidden sm:flex justify-center px-4">
            <div className="w-full max-w-2xl">
              <div className="relative">
                <div className="absolute left-3 top-1 -translate-y-1/2 text-white">
                  <img
                    src="https://events.jay-ho.com/wp-content/uploads/2026/02/Tagline_for_-2-scaled.png"
                    className="h-15 w-auto object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="mr-4 text-slate-500 hover:text-slate-700 lg:hidden p-1 rounded-md hover:bg-slate-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            {/* <h2 className="text-lg font-bold text-slate-800 hidden sm:block">
                            {user?.role === UserRole.ADMIN ? 'Administration' : 'Organizer Portal'}
                        </h2> */}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-2 bg-slate-50 py-1.5 px-3 rounded-full border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden md:block text-sm">
                <p className="font-bold text-slate-800 leading-none">
                  {user?.name}
                </p>
                <p className="text-xs text-slate-500 leading-none mt-1">
                  {user?.email}
                </p>
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
