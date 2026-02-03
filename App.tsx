
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import EventsList from './pages/EventsList';
import EventBooking from './pages/EventBooking';
import Checkout from './pages/Checkout';
import Confirmation from './pages/Confirmation';
import Login from './pages/Login';
import TermsAndConditions from './pages/TermsAndConditions';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminVenues from './pages/admin/AdminVenues';
import AdminTheaters from './pages/admin/AdminTheaters';
import AdminTheaterBuilder from './pages/admin/AdminTheaterBuilder';
import AdminOrganizers from './pages/admin/AdminOrganizers';
import AdminServiceCharges from './pages/admin/AdminServiceCharges';
import AdminEvents from './pages/admin/AdminEvents';
import OrganizerDashboard from './pages/organizer/OrganizerDashboard';
import CreateEvent from './pages/organizer/CreateEvent';
import OrganizerCoupons from './pages/organizer/OrganizerCoupons';
import EventAnalytics from './pages/organizer/EventAnalytics';
import OrganizerScanner from './pages/organizer/OrganizerScanner';
import PublicOrganizerGuide from './pages/PublicOrganizerGuide';
import { AuthProvider } from './context/AuthContext';
import { UserRole } from './types';
import PublicLayout from './components/PublicLayout';
import DashboardLayout from './components/DashboardLayout';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
            {/* PUBLIC ROUTES (With Navbar) */}
            <Route element={<PublicLayout />}>
                <Route path="/" element={<EventsList />} />
                <Route path="/organizer-guide" element={<PublicOrganizerGuide />} />
                <Route path="/login" element={<Login />} />
                <Route path="/event/:id" element={<EventBooking />} />
                <Route path="/terms" element={<TermsAndConditions />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/confirmation" element={<Confirmation />} />
            </Route>
            
            {/* ADMIN ROUTES (With Sidebar) */}
            <Route path="/admin" element={<DashboardLayout allowedRoles={[UserRole.ADMIN]} />}>
                <Route index element={<AdminDashboard />} />
                <Route path="venues" element={<AdminVenues />} />
                <Route path="events" element={<AdminEvents />} />
                <Route path="theaters" element={<AdminTheaters />} />
                <Route path="theaters/:id/builder" element={<AdminTheaterBuilder />} />
                <Route path="organizers" element={<AdminOrganizers />} />
                <Route path="charges" element={<AdminServiceCharges />} />
            </Route>

            {/* ORGANIZER ROUTES (With Sidebar) */}
            <Route path="/organizer" element={<DashboardLayout allowedRoles={[UserRole.ORGANIZER]} />}>
                <Route index element={<OrganizerDashboard />} />
                <Route path="create-event" element={<CreateEvent />} />
                <Route path="edit-event/:id" element={<CreateEvent />} />
                <Route path="event/:id/analytics" element={<EventAnalytics />} />
                <Route path="coupons" element={<OrganizerCoupons />} />
                <Route path="scanner" element={<OrganizerScanner />} />
            </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
