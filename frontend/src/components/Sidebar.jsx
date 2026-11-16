import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginFor } from '../utils/roleRoutes';
import { currentPortal } from '../portal';
import NotificationBell from './NotificationBell';
import ChangePasswordModal from './ChangePasswordModal';
import {
  LayoutDashboard, User, AlertCircle, FileText,
  Users, LogOut, Menu, X, Shield, CheckCircle, Megaphone, LifeBuoy,
  ClipboardList, DoorOpen, QrCode, History, UserCog, Building2, MapPin, BedDouble, Wrench, UserCheck, Smartphone, DoorClosed, Archive, UtensilsCrossed, KeyRound, Siren
} from 'lucide-react';

const studentLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/profile', icon: User, label: 'My Profile' },
  { to: '/complaints', icon: AlertCircle, label: 'Complaints' },
  { to: '/outpasses', icon: FileText, label: 'Outpass' },
  { to: '/announcements', icon: Megaphone, label: 'Announcements' },
  { to: '/help', icon: LifeBuoy, label: 'Help' },
];

const adminLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/students', icon: Users, label: 'Students' },
  { to: '/admin/exit-requests', icon: DoorClosed, label: 'Exit Requests' },
  { to: '/admin/past-students', icon: Archive, label: 'Past Students' },
  { to: '/admin/wardens', icon: UserCog, label: 'Wardens' },
  { to: '/admin/hostels', icon: Building2, label: 'Hostels' },
  { to: '/admin/rooms', icon: BedDouble, label: 'Rooms' },
  { to: '/admin/tracking', icon: MapPin, label: 'Student Tracking' },
  { to: '/admin/attendance', icon: CheckCircle, label: 'Attendance' },
  { to: '/admin/complaints', icon: AlertCircle, label: 'Complaints' },
  { to: '/admin/staff', icon: Wrench, label: 'Maintenance Staff' },
  { to: '/admin/outpasses', icon: FileText, label: 'Outpasses' },
  { to: '/admin/announcements', icon: Megaphone, label: 'Announcements' },
  { to: '/emergency', icon: Siren, label: 'Emergency Help' },
  { to: '/security/visitors', icon: UserCheck, label: 'Visitors' },
  { to: '/admin/mess-menu', icon: UtensilsCrossed, label: 'Mess Menu' },
];

const wardenLinks = [
  { to: '/warden', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/warden/students', icon: Users, label: 'My Students' },
  { to: '/warden/exit-requests', icon: DoorClosed, label: 'Exit Requests' },
  { to: '/warden/attendance', icon: CheckCircle, label: 'Attendance' },
  { to: '/warden/complaints', icon: AlertCircle, label: 'Complaints' },
  { to: '/warden/outpasses', icon: ClipboardList, label: 'Outpass Requests' },
  { to: '/warden/announcements', icon: Megaphone, label: 'Announcements' },
  { to: '/emergency', icon: Siren, label: 'Emergency Help' },
  { to: '/security/visitors', icon: UserCheck, label: 'Visitors' },
];

const securityLinks = [
  { to: '/security', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/security/scan', icon: QrCode, label: 'Scan QR' },
  { to: '/security/manual', icon: Smartphone, label: 'Manual Entry' },
  { to: '/emergency', icon: Siren, label: 'SOS Alerts' },
  { to: '/security/visitors', icon: UserCheck, label: 'Visitors' },
  { to: '/security/currently-outside', icon: DoorOpen, label: 'Currently Outside' },
  { to: '/security/scan-history', icon: History, label: 'Scan History' },
];

const LINKS_BY_ROLE = {
  student: studentLinks,
  admin: adminLinks,
  warden: wardenLinks,
  security: securityLinks,
};

const HOME_PATHS = ['/admin', '/dashboard', '/warden', '/security'];
const PORTAL_VIEW_ROLE = { student: 'student', staff: 'admin', gate: 'security' };

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // The developer can open any portal: show that portal's menu, not admin's.
  const viewRole = user?.is_developer ? (PORTAL_VIEW_ROLE[currentPortal()] || 'admin') : user?.role;
  const links = LINKS_BY_ROLE[viewRole] || studentLinks;

  const handleLogout = () => {
    const loginPath = loginFor(user?.role);
    logout();
    navigate(loginPath);
  };

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-indigo-600 text-white p-2 rounded-lg shadow-lg"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-slate-900 text-white z-40 flex flex-col transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>

        {/* Logo */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Shield size={20} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg leading-tight">HostelMS</p>
              <p className="text-slate-400 text-xs capitalize">{viewRole} Portal{user?.is_developer ? ' · developer' : ''}</p>
            </div>
            <NotificationBell />
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={HOME_PATHS.includes(to)}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User & Logout */}
        <div className="p-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => { setShowPassword(true); setOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <KeyRound size={18} />
            Change Password
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
      {showPassword && <ChangePasswordModal onClose={() => setShowPassword(false)} />}
    </>
  );
};

export default Sidebar;
