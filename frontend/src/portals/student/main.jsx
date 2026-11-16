import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { PortalApp, guarded, mount } from '../PortalShell';

// Student portal — served at /student.
const Login = lazy(() => import('../../pages/Login'));
const Register = lazy(() => import('../../pages/Register'));
const StudentDashboard = lazy(() => import('../../pages/student/StudentDashboard'));
const Profile = lazy(() => import('../../pages/student/Profile'));
const Complaints = lazy(() => import('../../pages/student/Complaints'));
const Outpasses = lazy(() => import('../../pages/student/Outpasses'));
const Announcements = lazy(() => import('../../pages/student/Announcements'));
const Help = lazy(() => import('../../pages/student/Help'));

mount(
  <PortalApp portal="student" home="/dashboard">
    <Route path="/login" element={<Login initialRole="student" />} />
    <Route path="/register" element={<Register />} />
    <Route path="/dashboard" element={guarded('student', <StudentDashboard />)} />
    <Route path="/profile" element={guarded('student', <Profile />)} />
    <Route path="/complaints" element={guarded('student', <Complaints />)} />
    <Route path="/outpasses" element={guarded('student', <Outpasses />)} />
    <Route path="/announcements" element={guarded('student', <Announcements />)} />
    <Route path="/help" element={guarded('student', <Help />)} />
  </PortalApp>
);
