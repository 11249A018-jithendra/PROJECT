import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToReadableStream } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

// Render the actual React screens without effects or a database. These checks
// catch broken role menus, login forms, dashboard imports and access guards.
// Live API workflows remain covered by backend/tests/e2e.
let server;
let Context;
const priorWindow = globalThis.window;
const priorLocalStorage = globalThis.localStorage;
const priorSessionStorage = globalThis.sessionStorage;
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};

before(async () => {
  globalThis.window = { location: { hostname: 'localhost', pathname: '/student/dashboard' } };
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
  server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
    logLevel: 'error',
  });
  Context = (await server.ssrLoadModule('/src/context/AuthState.js')).default;
});

after(async () => {
  await server?.close();
  if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow;
  if (priorLocalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = priorLocalStorage;
  if (priorSessionStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = priorSessionStorage;
});

const userFor = role => ({ _id: 'test-user', role, name: 'Campus Tester', email: 'tester@example.test', room_no: 'A-101', roll_no: 'TEST001' });
const render = async (path, { role = 'student', route = '/', portal = 'student', props = {}, user = userFor(role) } = {}) => {
  window.location.pathname = `/${portal}${route}`;
  const Component = (await server.ssrLoadModule(path)).default;
  const context = { user, loading: false, logout() {}, updateUser() {}, login: async () => user, register: async () => user };
  const stream = await renderToReadableStream(React.createElement(MemoryRouter, { initialEntries: [route] }, React.createElement(Context.Provider, { value: context }, React.createElement(Component, props))));
  await stream.allReady;
  return new Response(stream).text();
};

const dashboards = [
  ['student', 'student', '/dashboard', '/src/pages/student/StudentDashboard.jsx', 'My Profile', 'Outpass Requests'],
  ['admin', 'staff', '/admin', '/src/pages/admin/AdminDashboard.jsx', 'Wardens', 'Total Students'],
  ['warden', 'staff', '/warden', '/src/pages/warden/WardenDashboard.jsx', 'My Students', 'Assigned Students'],
  ['security', 'gate', '/security', '/src/pages/security/SecurityDashboard.jsx', 'Scan QR', 'Today&#x27;s Exits'],
];

for (const [role, portal, route, path, menu, metric] of dashboards) {
  test(`${role}: dashboard renders the vector design, live-data placeholders and role-specific navigation`, async () => {
    const html = await render(path, { role, portal, route });
    assert.match(html, /class="vs-hero"/);
    assert.match(html, /class="vs-campus-art"/);
    assert.match(html, /vs-stat/);
    assert.ok(html.includes(menu));
    assert.ok(html.includes(metric));
    assert.match(html, /aria-label="Refresh dashboard"/);
    assert.match(html, /aria-label="Open navigation"/);
    assert.ok(html.includes(`data-role="${role}"`));
    if (role === 'student' || role === 'security') assert.doesNotMatch(html, /href="\/admin\/wardens"/);
  });
}

for (const [role, portal, initialRole, expected] of [
  ['student', 'student', 'student', 'Email or roll number'],
  ['admin', 'staff', 'staff', 'Admin sign in'],
  ['warden', 'staff', 'staff', 'Warden sign in'],
  ['security', 'gate', 'security', 'Security sign in'],
]) {
  test(`${role}: sign-in form has accessible credential fields and the shared illustration`, async () => {
    const html = await render('/src/pages/Login.jsx', { role, portal, route: `/login?as=${role}`, props: { initialRole }, user: null });
    assert.match(html, /vs-auth-art/);
    assert.match(html, /id="login-identifier"/);
    assert.match(html, /autoComplete="username"/);
    assert.match(html, /autoComplete="current-password"/);
    assert.ok(html.includes(expected));
    assert.match(html, /Forgot password/);
    assert.match(html, /Remember me/);
    if (portal === 'student') assert.match(html, /href="\/register"/);
  });
}

test('registration preserves all fields, hostel choice, privacy-safe password entry and sign-in link', async () => {
  const html = await render('/src/pages/Register.jsx', { route: '/register', user: null });
  assert.match(html, /vs-auth-form/);
  for (const field of ['name', 'email', 'roll_no', 'room_no', 'course_year', 'phone', 'parent_contact', 'home_address', 'password']) assert.ok(html.includes(`id="register-${field}"`), field);
  assert.match(html, /type="password"/);
  assert.match(html, /href="\/login"/);
});

test('portal chooser links to every correct portal and preselects admin/warden explicitly', async () => {
  const html = await render('/src/pages/PortalSelect.jsx');
  for (const url of ['/staff/login?as=admin', '/staff/login?as=warden', '/student/login', '/gate/login']) assert.ok(html.includes(`href="${url}"`));
  assert.match(html, /vs-portal-grid/);
});

test('the home page shows all roles; legacy dashboard and gate links retain their portal destination', async () => {
  const { portalRedirect } = await server.ssrLoadModule('/src/utils/portalRedirect.js');
  assert.equal(portalRedirect('/'), null);
  assert.equal(portalRedirect('/portals'), null);
  assert.equal(portalRedirect('/select-role'), null);
  assert.equal(portalRedirect('/admin/students'), '/staff/admin/students');
  assert.equal(portalRedirect('/warden/attendance'), '/staff/warden/attendance');
  assert.equal(portalRedirect('/security/scan'), '/gate/security/scan');
  assert.equal(portalRedirect('/outpasses'), '/student/outpasses');
});

test('stat cards distinguish real zero from loading and preserve their link destination', async () => {
  const html = await render('/src/components/ui/StatCard.jsx', { props: { label: 'Pending', value: 0, tone: 'amber', to: '/outpasses' } });
  assert.match(html, /vs-stat-amber/);
  assert.match(html, /href="\/outpasses"/);
  assert.match(html, /vs-stat-value">0</);
  assert.doesNotMatch(html, /aria-label="Loading"/);
});

test('the redesign keeps private-route role restrictions in place', async () => {
  const allowed = await render('/src/components/PrivateRoute.jsx', { role: 'warden', props: { role: 'warden', children: React.createElement('p', null, 'Protected content') } });
  assert.match(allowed, /Protected content/);
  const denied = await render('/src/components/PrivateRoute.jsx', { role: 'student', props: { role: 'admin', children: React.createElement('p', null, 'Protected content') } });
  assert.doesNotMatch(denied, /Protected content/);
});

test('the local developer console compiles with the same shared design', async () => {
  const module = await server.ssrLoadModule('/src/portals/developer/DevConsole.jsx');
  assert.equal(typeof module.default, 'function');
});

const workspaceScreens = [
  ['student', 'student', '/profile', 'student/Profile'],
  ['student', 'student', '/complaints', 'student/Complaints'],
  ['student', 'student', '/outpasses', 'student/Outpasses'],
  ['student', 'student', '/announcements', 'student/Announcements'],
  ['student', 'student', '/help', 'student/Help'],
  ['admin', 'staff', '/admin/students', 'admin/StudentManagement'],
  ['admin', 'staff', '/admin/wardens', 'admin/WardenManagement'],
  ['admin', 'staff', '/admin/hostels', 'admin/AdminHostels'],
  ['admin', 'staff', '/admin/rooms', 'admin/RoomManagement'],
  ['admin', 'staff', '/admin/tracking', 'admin/StudentTracking'],
  ['admin', 'staff', '/admin/attendance', 'admin/AdminAttendance'],
  ['admin', 'staff', '/admin/attendance/report', 'admin/AttendanceReport'],
  ['admin', 'staff', '/admin/complaints', 'admin/AdminComplaints'],
  ['admin', 'staff', '/admin/staff', 'admin/StaffManagement'],
  ['admin', 'staff', '/admin/outpasses', 'admin/AdminOutpasses'],
  ['admin', 'staff', '/admin/announcements', 'admin/AdminAnnouncements'],
  ['admin', 'staff', '/admin/mess-menu', 'admin/AdminMessMenu'],
  ['admin', 'staff', '/admin/exit-requests', 'admin/ExitRequests'],
  ['admin', 'staff', '/admin/past-students', 'admin/PastStudents'],
  ['warden', 'staff', '/warden/students', 'admin/StudentManagement'],
  ['warden', 'staff', '/warden/attendance', 'admin/AdminAttendance'],
  ['warden', 'staff', '/warden/complaints', 'admin/AdminComplaints'],
  ['warden', 'staff', '/warden/outpasses', 'warden/WardenOutpasses'],
  ['warden', 'staff', '/warden/announcements', 'admin/AdminAnnouncements'],
  ['warden', 'staff', '/warden/exit-requests', 'admin/ExitRequests'],
  ['security', 'gate', '/security/scan', 'security/ScanQr'],
  ['security', 'gate', '/security/manual', 'security/ManualGate'],
  ['security', 'gate', '/security/currently-outside', 'security/CurrentlyOutside'],
  ['security', 'gate', '/security/visitors', 'security/Visitors'],
  ['security', 'gate', '/security/scan-history', 'security/ScanHistory'],
  ['security', 'gate', '/emergency', 'shared/EmergencyCenter'],
  ['warden', 'staff', '/emergency', 'shared/EmergencyCenter'],
  ['admin', 'staff', '/emergency', 'shared/EmergencyCenter'],
];

for (const [role, portal, route, page] of workspaceScreens) {
  test(`${role}: ${route} renders inside its themed workspace`, async () => {
    const html = await render(`/src/pages/${page}.jsx`, { role, portal, route });
    assert.match(html, /id="main-content"/);
    assert.ok(html.includes(`data-role="${role}"`));
    assert.match(html, /vs-topbar/);
    assert.match(html, /Skip to main content/);
    assert.match(html, /<h1/);
  });
}
