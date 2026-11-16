import { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';
import { PortalApp, guarded, mount } from '../PortalShell';
import { useAuth } from '../../context/AuthContext';
import { homeFor } from '../../utils/roleRoutes';

// Staff portal (admins + wardens) — served at /staff.
const Login = lazy(() => import('../../pages/Login'));

const AdminDashboard = lazy(() => import('../../pages/admin/AdminDashboard'));
const StudentManagement = lazy(() => import('../../pages/admin/StudentManagement'));
const WardenManagement = lazy(() => import('../../pages/admin/WardenManagement'));
const AdminComplaints = lazy(() => import('../../pages/admin/AdminComplaints'));
const AdminOutpasses = lazy(() => import('../../pages/admin/AdminOutpasses'));
const AdminAttendance = lazy(() => import('../../pages/admin/AdminAttendance'));
const AttendanceReport = lazy(() => import('../../pages/admin/AttendanceReport'));
const AdminAnnouncements = lazy(() => import('../../pages/admin/AdminAnnouncements'));
const AdminHostels = lazy(() => import('../../pages/admin/AdminHostels'));
const RoomManagement = lazy(() => import('../../pages/admin/RoomManagement'));
const StaffManagement = lazy(() => import('../../pages/admin/StaffManagement'));
const StudentTracking = lazy(() => import('../../pages/admin/StudentTracking'));
const ExitRequests = lazy(() => import('../../pages/admin/ExitRequests'));
const PastStudents = lazy(() => import('../../pages/admin/PastStudents'));
const AdminMessMenu = lazy(() => import('../../pages/admin/AdminMessMenu'));

const WardenDashboard = lazy(() => import('../../pages/warden/WardenDashboard'));
const WardenOutpasses = lazy(() => import('../../pages/warden/WardenOutpasses'));

// Gate views that admins and wardens can also open.
const ManualGate = lazy(() => import('../../pages/security/ManualGate'));
const Visitors = lazy(() => import('../../pages/security/Visitors'));
const CurrentlyOutside = lazy(() => import('../../pages/security/CurrentlyOutside'));
const ScanHistory = lazy(() => import('../../pages/security/ScanHistory'));
const EmergencyCenter = lazy(() => import('../../pages/shared/EmergencyCenter'));

// /staff/ opens the admin or warden dashboard depending on who signed in.
const StaffHome = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
};

mount(
  <PortalApp portal="staff" home="/home">
    <Route path="/login" element={<Login initialRole="staff" />} />
    <Route path="/home" element={<StaffHome />} />

    <Route path="/admin" element={guarded('admin', <AdminDashboard />)} />
    <Route path="/admin/students" element={guarded('admin', <StudentManagement />)} />
    <Route path="/admin/wardens" element={guarded('admin', <WardenManagement />)} />
    <Route path="/admin/hostels" element={guarded('admin', <AdminHostels />)} />
    <Route path="/admin/rooms" element={guarded('admin', <RoomManagement />)} />
    <Route path="/admin/tracking" element={guarded('admin', <StudentTracking />)} />
    <Route path="/admin/exit-requests" element={guarded('admin', <ExitRequests />)} />
    <Route path="/admin/past-students" element={guarded('admin', <PastStudents />)} />
    <Route path="/admin/attendance" element={guarded('admin', <AdminAttendance />)} />
    <Route path="/admin/attendance/report" element={guarded('admin', <AttendanceReport />)} />
    <Route path="/admin/complaints" element={guarded('admin', <AdminComplaints />)} />
    <Route path="/admin/staff" element={guarded('admin', <StaffManagement />)} />
    <Route path="/admin/outpasses" element={guarded('admin', <AdminOutpasses />)} />
    <Route path="/admin/announcements" element={guarded('admin', <AdminAnnouncements />)} />
    <Route path="/admin/mess-menu" element={guarded('admin', <AdminMessMenu />)} />

    <Route path="/warden" element={guarded('warden', <WardenDashboard />)} />
    <Route path="/warden/students" element={guarded('warden', <StudentManagement />)} />
    <Route path="/warden/exit-requests" element={guarded('warden', <ExitRequests />)} />
    <Route path="/warden/attendance" element={guarded('warden', <AdminAttendance />)} />
    <Route path="/warden/complaints" element={guarded('warden', <AdminComplaints />)} />
    <Route path="/warden/outpasses" element={guarded('warden', <WardenOutpasses />)} />
    <Route path="/warden/announcements" element={guarded('warden', <AdminAnnouncements />)} />

    <Route path="/security/manual" element={guarded('admin', <ManualGate />)} />
    <Route path="/security/visitors" element={guarded(['warden', 'admin'], <Visitors />)} />
    <Route path="/security/currently-outside" element={guarded(['warden', 'admin'], <CurrentlyOutside />)} />
    <Route path="/security/scan-history" element={guarded(['warden', 'admin'], <ScanHistory />)} />
    <Route path="/emergency" element={guarded(['warden', 'admin'], <EmergencyCenter />)} />
  </PortalApp>
);
