// Dashboard Refresh: the Refresh button and automatic refresh call these same
// endpoints again, so this proves each role's dashboard data comes fresh from
// the database (not cached) after records change. Runs against a running
// backend + the real database; everything is tagged "E2E TEST <timestamp>" and
// removed in `after`.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, tokenForRole, supabase, created, cleanup, STAMP, TAG } = require('./helpers');

const ctx = {};
const istLocal = (h) => new Date(Date.now() + 5.5 * 3600000 + h * 3600000).toISOString().slice(0, 16);
const minutesToIstMidnight = () => {
  const ist = new Date(Date.now() + 5.5 * 3600000);
  return 24 * 60 - (ist.getUTCHours() * 60 + ist.getUTCMinutes());
};

// What each role's dashboard loads.
const adminView = async () => {
  const [dash, summary] = await Promise.all([api('GET', '/admin/dashboard', ctx.admin), api('GET', '/admin/hostel-summary', ctx.admin)]);
  return { dash: dash.data, summary: summary.data };
};
const wardenView = async () => {
  const [dash, today, pending, att] = await Promise.all([
    api('GET', '/warden/dashboard', ctx.w.token),
    api('GET', '/security/today', ctx.w.token),
    api('GET', '/outpasses/pending', ctx.w.token),
    api('GET', '/warden/attendance', ctx.w.token),
  ]);
  return { dash: dash.data, today: today.data, pending: pending.data, att: att.data };
};
const gateView = async () => {
  const [today, overdue] = await Promise.all([api('GET', '/security/today', ctx.security), api('GET', '/outpasses/overdue', ctx.security)]);
  return { today: today.data, overdue: overdue.data };
};
const studentView = async () => {
  const [complaints, outpasses, me] = await Promise.all([
    api('GET', '/complaints', ctx.s.token),
    api('GET', '/outpasses', ctx.s.token),
    api('GET', '/auth/me', ctx.s.token),
  ]);
  return { complaints: complaints.data, outpasses: outpasses.data, me: me.data };
};

before(async () => {
  ctx.admin = await tokenForRole('admin');
  ctx.security = await tokenForRole('security');
  let r = await api('POST', '/admin/hostels', ctx.admin, { name: `${TAG} Refresh Hostel` });
  ctx.hostel = r.data._id;
  created.hostels.push(ctx.hostel);

  const wEmail = `e2e.rw.${STAMP}@example.test`;
  r = await api('POST', '/admin/wardens', ctx.admin, { name: `${TAG} Refresh Warden`, email: wEmail, password: 'Warden#2026x', phone: '9000090010', hostel_id: ctx.hostel });
  created.users.push(r.data._id);
  ctx.w = { id: r.data._id, token: (await api('POST', '/auth/login', null, { email: wEmail, password: 'Warden#2026x' })).data.token };

  r = await api('POST', '/auth/register', null, {
    name: `${TAG} Refresh Student`, email: `e2e.rs.${STAMP}@example.test`, password: 'Student#2026', roll_no: `RF${STAMP}`,
    room_no: 'RF-1', course_year: 'Year 1', phone: '9000090011', parent_contact: '9000090012', hostel_id: ctx.hostel, home_address: '5 Test St',
  });
  assert.equal(r.status, 201);
  ctx.s = { id: r.data._id, token: r.data.token };
  created.users.push(ctx.s.id);
  await api('PUT', `/admin/students/${ctx.s.id}/warden`, ctx.admin, { assigned_warden: ctx.w.id });
});

after(async () => {
  await supabase.from('notifications').delete().in('user_id', created.users);
  const left = await cleanup();
  assert.equal(left, 0, 'all test users removed');
});

test('student: profile, complaints and outpasses are fresh on every load', async () => {
  const before = await studentView();
  assert.equal(before.complaints.length, 0);
  assert.equal(before.me.course_year, 'Year 1');

  let r = await api('POST', '/complaints', ctx.s.token, { category: 'electrical', title: `${TAG} fan`, description: 'Fan not working' });
  assert.equal(r.status, 201);
  created.complaints.push(r.data._id);
  r = await api('PUT', '/students/profile', ctx.s.token, { course_year: 'Year 2' });
  assert.equal(r.status, 200);

  const after = await studentView();
  assert.equal(after.complaints.length, 1, 'new complaint shows up');
  assert.equal(after.complaints[0].status, 'Pending');
  assert.equal(after.me.course_year, 'Year 2', 'profile change shows up in /auth/me');
});

test('warden: pending requests, gate numbers and roll call update after changes', async (t) => {
  if (minutesToIstMidnight() < 15) return t.skip('too close to midnight (India time) to approve a pass for today');
  const before = await wardenView();
  assert.equal(before.dash.totalStudents, 1);
  assert.equal(before.pending.length, 0);
  assert.equal(before.att.stats.total, 1);

  let r = await api('POST', '/outpasses', ctx.s.token, { reason: 'refresh test', destination: 'Town', leave_datetime: istLocal(0.05), return_datetime: istLocal(1.5), parent_consent: true });
  assert.equal(r.status, 201);
  ctx.outpass = r.data._id;
  let v = await wardenView();
  assert.equal(v.pending.length, 1, 'new request appears under pending');
  assert.equal(v.dash.pendingOutpasses, 1);

  r = await api('PUT', `/outpasses/${ctx.outpass}/approve`, ctx.w.token);
  assert.equal(r.status, 200);
  ctx.qr = r.data.qr_token;
  v = await wardenView();
  assert.equal(v.pending.length, 0, 'approved request leaves pending');

  r = await api('PUT', `/warden/attendance/${ctx.s.id}`, ctx.w.token, { status: 'Present' });
  assert.equal(r.status, 200);
  v = await wardenView();
  assert.equal(v.att.stats.present, 1, 'roll call count updates');
  assert.equal(v.att.stats.pending, 0);
});

test('security + warden: exit and return change the live gate numbers', async (t) => {
  if (!ctx.qr) return t.skip('no approved pass (skipped near midnight)');
  const gateBefore = await gateView();
  const wBefore = await wardenView();

  let r = await api('POST', '/outpasses/scan', ctx.security, { qr_token: ctx.qr });
  assert.equal(r.status, 200);
  assert.equal(r.data.action, 'EXIT');
  let g = await gateView();
  let w = await wardenView();
  assert.equal(w.dash.currentlyOutside, wBefore.dash.currentlyOutside + 1, "warden sees their student outside");
  assert.equal(w.today.todaysExits, wBefore.today.todaysExits + 1);
  assert.ok(g.today.currentlyOutside >= gateBefore.today.currentlyOutside + 1, 'gate dashboard counts them outside');
  assert.ok(g.today.todaysExits >= gateBefore.today.todaysExits + 1, "today's exits goes up");

  // Admin's location chart reads the same gate data.
  const adminOut = (await adminView()).summary.totals.outside;
  assert.ok(adminOut >= 1, 'admin dashboard counts them outside');

  r = await api('POST', '/outpasses/scan', ctx.security, { qr_token: ctx.qr });
  assert.equal(r.status, 200);
  assert.equal(r.data.action, 'RETURN');
  w = await wardenView();
  g = await gateView();
  assert.equal(w.dash.currentlyOutside, wBefore.dash.currentlyOutside, 'back inside after return');
  assert.equal(w.today.todaysReturns, wBefore.today.todaysReturns + 1);
  assert.ok(g.today.todaysReturns >= gateBefore.today.todaysReturns + 1, "today's returns goes up");
});

test('admin: totals and queues update after new records', async () => {
  const before = await adminView();
  const students = before.dash.totalStudents;
  const complaints = before.dash.totalComplaints;

  let r = await api('POST', '/auth/register', null, {
    name: `${TAG} Refresh Student 2`, email: `e2e.rs2.${STAMP}@example.test`, password: 'Student#2026', roll_no: `RG${STAMP}`,
    room_no: 'RF-2', course_year: 'Year 1', phone: '9000090013', parent_contact: '9000090014', hostel_id: ctx.hostel, home_address: '6 Test St',
  });
  assert.equal(r.status, 201);
  created.users.push(r.data._id);
  r = await api('POST', '/complaints', ctx.s.token, { category: 'plumbing', title: `${TAG} tap`, description: 'Tap leaking' });
  created.complaints.push(r.data._id);

  const after = await adminView();
  // Global numbers: other real activity could add to them, never take away these two records.
  assert.ok(after.dash.totalStudents >= students + 1, 'new student counted');
  assert.ok(after.dash.totalComplaints >= complaints + 1, 'new complaint counted');
  assert.equal(typeof after.dash.current_date, 'string');
});

test('roles stay separated: each dashboard only answers its own role', async () => {
  assert.equal((await api('GET', '/admin/dashboard', ctx.w.token)).status, 403, 'warden cannot read the admin dashboard');
  assert.equal((await api('GET', '/admin/dashboard', ctx.s.token)).status, 403, 'student cannot read the admin dashboard');
  assert.equal((await api('GET', '/warden/dashboard', ctx.s.token)).status, 403, 'student cannot read the warden dashboard');
  assert.equal((await api('GET', '/security/today', ctx.s.token)).status, 403, 'student cannot read gate numbers');
  assert.equal((await api('GET', '/admin/dashboard', null)).status, 401, 'no token, no data');
});
