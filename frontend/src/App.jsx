import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

// Every page is its own chunk, downloaded only when first opened, so a
// student never downloads the admin screens (and vice versa).
const PortalSelect = lazy(() => import('./pages/PortalSelect'));
const Login = lazy(() => import('./pages/Login'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const WardenLogin = lazy(() => import('./pages/WardenLogin'));
const SecurityLogin = lazy(() => import('./pages/SecurityLogin'));
const Register = lazy(() => import('./pages/Register'));

const StudentDashboard = lazy(() => import('./pages/student/StudentDashboard'));
const Profile = lazy(() => import('./pages/student/Profile'));
const Complaints = lazy(() => import('./pages/student/Complaints'));
const Outpasses = lazy(() => import('./pages/student/Outpasses'));
const Announcements = lazy(() => import('./pages/student/Announcements'));
const Help = lazy(() => import('./pages/student/Help'));

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const StudentManagement = lazy(() => import('./pages/admin/StudentManagement'));
const WardenManagement = lazy(() => import('./pages/admin/WardenManagement'));
const AdminComplaints = lazy(() => import('./pages/admin/AdminComplaints'));
const AdminOutpasses = lazy(() => import('./pages/admin/AdminOutpasses'));
const AdminAttendance = lazy(() => import('./pages/admin/AdminAttendance'));
const AttendanceReport = lazy(() => import('./pages/admin/AttendanceReport'));
const AdminAnnouncements = lazy(() => import('./pages/admin/AdminAnnouncements'));
const AdminHostels = lazy(() => import('./pages/admin/AdminHostels'));
const RoomManagement = lazy(() => import('./pages/admin/RoomManagement'));
const StaffManagement = lazy(() => import('./pages/admin/StaffManagement'));
const StudentTracking = lazy(() => import('./pages/admin/StudentTracking'));
const ExitRequests = lazy(() => import('./pages/admin/ExitRequests'));
const PastStudents = lazy(() => import('./pages/admin/PastStudents'));
const AdminMessMenu = lazy(() => import('./pages/admin/AdminMessMenu'));

const WardenDashboard = lazy(() => import('./pages/warden/WardenDashboard'));
const WardenOutpasses = lazy(() => import('./pages/warden/WardenOutpasses'));

const SecurityDashboard = lazy(() => import('./pages/security/SecurityDashboard'));
const ScanQr = lazy(() => import('./pages/security/ScanQr'));
const ManualGate = lazy(() => import('./pages/security/ManualGate'));
const Visitors = lazy(() => import('./pages/security/Visitors'));
const CurrentlyOutside = lazy(() => import('./pages/security/CurrentlyOutside'));
const ScanHistory = lazy(() => import('./pages/security/ScanHistory'));
const EmergencyCenter = lazy(() => import('./pages/shared/EmergencyCenter'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50" role="status" aria-label="Loading">
    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// role: one role or a list of roles allowed on the page.
const guarded = (role, element) => <PrivateRoute role={role}>{element}</PrivateRoute>;

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/warden/login" element={<WardenLogin />} />
            <Route path="/security/login" element={<SecurityLogin />} />
            <Route path="/register" element={<Register />} />

            {/* Student */}
            <Route path="/dashboard" element={guarded('student', <StudentDashboard />)} />
            <Route path="/profile" element={guarded('student', <Profile />)} />
            <Route path="/complaints" element={guarded('student', <Complaints />)} />
            <Route path="/outpasses" element={guarded('student', <Outpasses />)} />
            <Route path="/announcements" element={guarded('student', <Announcements />)} />
            <Route path="/help" element={guarded('student', <Help />)} />

            {/* Admin */}
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

            {/* Warden */}
            <Route path="/warden" element={guarded('warden', <WardenDashboard />)} />
            <Route path="/warden/students" element={guarded('warden', <StudentManagement />)} />
            <Route path="/warden/exit-requests" element={guarded('warden', <ExitRequests />)} />
            <Route path="/warden/attendance" element={guarded('warden', <AdminAttendance />)} />
            <Route path="/warden/complaints" element={guarded('warden', <AdminComplaints />)} />
            <Route path="/warden/outpasses" element={guarded('warden', <WardenOutpasses />)} />
            <Route path="/warden/announcements" element={guarded('warden', <AdminAnnouncements />)} />

            {/* Security (some views shared with warden/admin) */}
            <Route path="/security" element={guarded('security', <SecurityDashboard />)} />
            <Route path="/security/scan" element={guarded('security', <ScanQr />)} />
            <Route path="/security/manual" element={guarded(['security', 'admin'], <ManualGate />)} />
            <Route path="/security/visitors" element={guarded(['security', 'warden', 'admin'], <Visitors />)} />
            <Route path="/security/currently-outside" element={guarded(['security', 'warden', 'admin'], <CurrentlyOutside />)} />
            <Route path="/security/scan-history" element={guarded(['security', 'warden', 'admin'], <ScanHistory />)} />

            {/* Emergency help: SOS alerts (warden, security, admin); contacts managed by warden/admin */}
            <Route path="/emergency" element={guarded(['warden', 'security', 'admin'], <EmergencyCenter />)} />

            {/* Default redirect */}
            <Route path="/" element={<PortalSelect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
