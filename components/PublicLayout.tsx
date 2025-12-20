
import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const PublicLayout: React.FC = () => {
    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <Navbar />
            <main className="flex-grow">
                <Outlet />
            </main>
            <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm mt-auto">
                <p>&copy; 2023 EventHorizon EMS. All rights reserved.</p>
                <p className="mt-2 text-xs">Simulating Express/Mongo/Brevo integration.</p>
            </footer>
        </div>
    );
};

export default PublicLayout;
