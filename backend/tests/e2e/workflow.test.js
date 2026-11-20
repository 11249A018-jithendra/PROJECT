// Full workflow test against a running backend + the real database.
// Every record it creates is tagged "E2E TEST <timestamp>" and deleted in
// the `after` hook, even when a step fails.
//
//   npm run dev            (in one terminal)
//   npm run test:e2e       (in another)
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, tokenForRole, supabase, created, cleanup, STAMP, TAG } = require('./helpers');
const { runOverdueAlerts } = require('../../utils/outpassAlerts');
const { runAdminReminders } = require('../../utils/complaintEscalation');

const ctx = {};
const hours = (h) => new Date(Date.now() + h * 3600000).toISOString();

before(async () => {
  ctx.admin = await tokenForRole('admin');
  ctx.security = await tokenForRole('security');
});

after(async () => {
  const left = await cleanup();
  assert.equal(left, 0, 'all test users removed');
});

test('hostel, rooms and capacity', async () => {
  let r = await api('POST', '/admin/hostels', ctx.admin, { name: `${TAG} Hostel`, capacity: 10 });
  assert.equal(r.status, 201);
  ctx.hostel = r.data._id;
  created.hostels.push(ctx.hostel);

  r = await api('POST', '/admin/rooms/bulk', ctx.admin, { hostel_id: ctx.hostel, prefix: 'T-', from: 1, to: 3, capacity: 1 });
  assert.equal(r.status, 201);
  assert.equal(r.data.created, 3);
  r = await api('POST', '/admin/rooms/bulk', ctx.admin, { hostel_id: ctx.hostel, prefix: 'T-', from: 1, to: 3, capacity: 1 });
  assert.equal(r.data.skipped, 3, 'existing rooms are skipped, not duplicated');

  r = await api('GET', `/admin/rooms?hostel_id=${ctx.hostel}`, ctx.admin);
  assert.equal(r.data.totals.beds, 3);
  ctx.rooms = r.data.rooms;
});

test('warden + student registration and room assignment', async () => {
  let r = await api('POST', '/admin/wardens', ctx.admin, { name: `${TAG} Warden`, email: `e2e.warden.${STAMP}@example.test`, password: 'Warden#2026x', hostel_id: ctx.hostel });
  assert.equal(r.status, 201);
  ctx.wardenId = r.data._id;
  created.users.push(ctx.wardenId);
  r = await api('POST', '/auth/login', null, { email: `e2e.warden.${STAMP}@example.test`, password: 'Warden#2026x' });
  ctx.warden = r.data.token;

  for (const n of [1, 2]) {
    r = await api('POST', '/auth/register', null, {
      name: `${TAG} Student ${n}`, email: `e2e.s${n}.${STAMP}@example.test`, password: 'Student#2026', roll_no: `E2E${STAMP}-${n}`,
      room_no: 'x', course_year: 'Test', phone: '9000000002', parent_contact: '9000000003', hostel_id: ctx.hostel, home_address: '1 Test Street',
    });
    assert.equal(r.status, 201);
    ctx[`s${n}`] = { id: r.data._id, token: r.data.token };
    created.users.push(r.data._id);
    await api('PUT', `/admin/students/${r.data._id}/warden`, ctx.admin, { assigned_warden: ctx.wardenId });
  }

  r = await api('PUT', `/admin/students/${ctx.s1.id}/hostel`, ctx.admin, { room_id: ctx.rooms[0]._id });
  assert.equal(r.status, 200);
  assert.equal(r.data.room_no, 'T-1');
  r = await api('PUT', `/admin/students/${ctx.s2.id}/hostel`, ctx.admin, { room_id: ctx.rooms[0]._id });
  assert.equal(r.status, 409, 'a full room rejects another student');
  r = await api('PUT', `/admin/students/${ctx.s2.id}/hostel`, ctx.admin, { room_id: ctx.rooms[1]._id });
  assert.equal(r.status, 200);

  r = await api('PUT', '/students/profile', ctx.s1.token, { room_no: 'HACKED' });
  r = await api('GET', '/auth/me', ctx.s1.token);
  assert.equal(r.data.room_no, 'T-1', 'students cannot change their own room');
});

test('attendance: marking, bulk, history and monthly report', async () => {
  let r = await api('PUT', `/warden/attendance/${ctx.s1.id}`, ctx.warden, { status: 'Present' });
  assert.equal(r.status, 200);
  r = await api('PUT', '/warden/attendance', ctx.warden, { student_ids: [ctx.s2.id], status: 'Present' });
  assert.equal(r.data.updated, 1);

  const yesterday = new Date(Date.now() + 5.5 * 3600000 - 86400000).toISOString().slice(0, 10);
  r = await api('PUT', `/warden/attendance/${ctx.s1.id}`, ctx.warden, { status: 'Absent', date: yesterday });
  assert.equal(r.status, 403, 'wardens can only mark today');

  r = await api('GET', `/admin/attendance?hostel_id=${ctx.hostel}`, ctx.admin);
  const row = r.data.students.find((s) => s._id === ctx.s1.id);
  assert.equal(row.status, 'Present');
  assert.ok(row.marked_by_name, 'records who marked it');

  r = await api('GET', `/admin/attendance/report?hostel_id=${ctx.hostel}`, ctx.admin);
  assert.equal(r.status, 200);
  assert.equal(r.data.students.length, 2);
  assert.equal(r.data.students.find((s) => s._id === ctx.s1.id).percentage, 100);
});

test('home visit: exit auto-marks Absent, overdue alert, manual return', async () => {
  // A student nobody has marked today: the home-visit exit marks them Absent.
  let r = await api('POST', '/auth/register', null, {
    name: `${TAG} Home Student`, email: `e2e.home.${STAMP}@example.test`, password: 'Student#2026', roll_no: `E2E${STAMP}-H`,
    room_no: 'x', course_year: 'Test', phone: '9000000030', parent_contact: '9000000031', hostel_id: ctx.hostel, home_address: '2 Test St',
  });
  created.users.push(r.data._id);
  const home = { id: r.data._id, token: r.data.token };
  await api('PUT', `/admin/students/${home.id}/warden`, ctx.admin, { assigned_warden: ctx.wardenId });

  const goHome = async (student) => {
    const res = await api('POST', '/outpasses', student.token, { reason: `${TAG} home`, destination: 'Home', leave_datetime: hours(-1), return_datetime: hours(48), parent_consent: true, pass_type: 'Home' });
    assert.equal(res.status, 201);
    const approved = await api('PUT', `/outpasses/${res.data._id}/approve`, ctx.warden);
    const scan = await api('POST', '/outpasses/scan', ctx.security, { action: 'EXIT', qr_token: approved.data.qr_token });
    assert.equal(scan.data.action, 'EXIT');
    return res.data;
  };

  await goHome(home);
  const op = await goHome(ctx.s1); // s1 was hand-marked Present earlier today

  r = await api('GET', `/admin/attendance?hostel_id=${ctx.hostel}`, ctx.admin);
  const autoRow = r.data.students.find((s) => s._id === home.id);
  assert.equal(autoRow.status, 'Absent', 'unmarked student auto-marked Absent');
  assert.equal(autoRow.auto_marked, true);
  const handRow = r.data.students.find((s) => s._id === ctx.s1.id);
  assert.equal(handRow.status, 'Present', 'a hand-marked status is final and never overwritten');

  // Make it overdue and run the alert job once.
  await supabase.from('outpasses').update({ return_datetime: hours(-5) }).eq('_id', op._id);
  await runOverdueAlerts();
  const { data: alerts } = await supabase.from('notifications').select('user_id').eq('type', 'OUTPASS_OVERDUE').in('user_id', [ctx.wardenId, ctx.s1.id]);
  assert.equal(alerts.length, 2, 'warden and student were alerted');
  await runOverdueAlerts();
  const { data: again } = await supabase.from('notifications').select('_id').eq('type', 'OUTPASS_OVERDUE').eq('user_id', ctx.s1.id);
  assert.equal(again.length, 1, 'alert is sent only once');

  // Dead phone: find them at the gate and record the return manually.
  r = await api('GET', `/outpasses/gate-lookup?q=E2E${STAMP}-1`, ctx.security);
  assert.equal(r.data[0].action, 'RETURN');
  r = await api('POST', `/outpasses/${op._id}/manual`, ctx.security, { action: 'EXIT', reason: 'phone dead at gate' });
  assert.equal(r.status, 409, 'wrong direction is refused');
  r = await api('POST', `/outpasses/${op._id}/manual`, ctx.security, { action: 'RETURN', reason: 'no' });
  assert.equal(r.status, 400, 'a reason is required');
  r = await api('POST', `/outpasses/${op._id}/manual`, ctx.security, { action: 'RETURN', reason: 'phone dead at gate' });
  assert.equal(r.status, 200);
  assert.equal(r.data.outpass.return_method, 'MANUAL');

  r = await api('GET', '/security/scan-history?page=1&method=MANUAL', ctx.security);
  assert.ok(r.data.items.some((l) => l.outpass_id === op._id), 'manual entry is in the audit log');
});

test('complaints: assign staff, resolve, rate, reopen, cancel, admin reminder', async () => {
  let r = await api('POST', '/staff', ctx.admin, { name: `${TAG} Electrician`, trade: 'Electrician', phone: '9000000009' });
  assert.equal(r.status, 201);
  const staffId = r.data._id;
  created.staff.push(staffId);

  r = await api('POST', '/complaints', ctx.s1.token, { category: 'electrical', description: `${TAG} fan broken` });
  assert.equal(r.status, 201);
  const c = r.data._id;
  created.complaints.push(c);

  r = await api('PUT', `/complaints/${c}/assign`, ctx.warden, { staff_id: staffId });
  assert.equal(r.data.status, 'In Progress');
  assert.equal(r.data.staff.name, `${TAG} Electrician`);

  r = await api('PUT', `/complaints/${c}/rate`, ctx.s1.token, { rating: 5 });
  assert.equal(r.status, 400, 'cannot rate before it is resolved');
  await api('PUT', `/complaints/${c}`, ctx.warden, { status: 'Resolved', admin_remarks: 'fixed' });
  r = await api('PUT', `/complaints/${c}/reopen`, ctx.s1.token, { reason: 'still broken at night' });
  assert.equal(r.data.status, 'Pending');
  assert.equal(r.data.reopened_count, 1);
  assert.ok(r.data.escalation_due_at, '24h clock restarted');

  await api('PUT', `/complaints/${c}`, ctx.warden, { status: 'Resolved' });
  r = await api('PUT', `/complaints/${c}/rate`, ctx.s1.token, { rating: 4, feedback: 'ok now' });
  assert.equal(r.data.rating, 4);
  r = await api('PUT', `/complaints/${c}/rate`, ctx.s1.token, { rating: 1 });
  assert.equal(r.status, 400, 'rating only once');

  r = await api('POST', '/complaints', ctx.s2.token, { category: 'plumbing', description: `${TAG} tap` });
  const c2 = r.data._id;
  created.complaints.push(c2);
  r = await api('PUT', `/complaints/${c2}/cancel`, ctx.s1.token, {});
  assert.equal(r.status, 403, "students can't cancel someone else's complaint");
  r = await api('PUT', `/complaints/${c2}/cancel`, ctx.s2.token, { reason: 'fixed it myself' });
  assert.equal(r.data.status, 'Cancelled');

  // Level-2 escalation: escalated 2 days ago, never resolved -> admins reminded.
  r = await api('POST', '/complaints', ctx.s2.token, { category: 'internet', description: `${TAG} wifi` });
  const c3 = r.data._id;
  created.complaints.push(c3);
  await supabase.from('complaints').update({ escalated: true, escalated_at: hours(-48) }).eq('_id', c3);
  await runAdminReminders();
  const { data: c3row } = await supabase.from('complaints').select('admin_reminder_count').eq('_id', c3).single();
  assert.equal(c3row.admin_reminder_count, 1);

  r = await api('GET', '/complaints?page=1&limit=5&view=cancelled', ctx.admin);
  assert.ok(r.data.counts.cancelled >= 1);
  assert.ok(r.data.items.length <= 5, 'paged');
});

test('announcements: hostel targeting, expiry, warden posting', async () => {
  let r = await api('POST', '/announcements', ctx.warden, { title: `${TAG} water cut`, message: 'No water 2-4 PM', priority: 'Important', hostel_id: null });
  assert.equal(r.status, 201);
  assert.equal(r.data.hostel_id, ctx.hostel, 'warden posts are forced to their hostel');
  assert.equal(r.data.notified, 3); // s1, s2 and the home-visit student
  created.announcements.push(r.data._id);

  r = await api('POST', '/announcements', ctx.admin, { title: `${TAG} expired`, message: 'old', expires_at: hours(-1) });
  assert.equal(r.status, 400, 'expiry must be in the future');

  r = await api('GET', '/announcements', ctx.s1.token);
  assert.ok(r.data.some((a) => a.title === `${TAG} water cut`), 'student in hostel sees it');
  // A real active student who is NOT in the test hostel.
  const { data: outsiders } = await supabase.from('users').select('_id').eq('role', 'student').eq('is_active', true)
    .or(`hostel_id.is.null,hostel_id.neq.${ctx.hostel}`).not('email', 'like', `%.${STAMP}@example.test`).limit(1);
  assert.ok(outsiders?.length, 'needs one active student outside the test hostel');
  const other = require('jsonwebtoken').sign({ id: outsiders[0]._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
  r = await api('GET', '/announcements', other);
  assert.ok(!r.data.some((a) => a.title === `${TAG} water cut`), 'students in other hostels do not');
});

test('visitor log', async () => {
  let r = await api('POST', '/visitors', ctx.security, { visitor_name: `${TAG} Visitor`, relation: 'Father', phone: '9000000010', student_id: ctx.s2.id });
  assert.equal(r.status, 201);
  created.visitors.push(r.data._id);
  assert.equal(r.data.hostel_id, ctx.hostel);
  r = await api('GET', '/visitors?inside=true', ctx.security);
  assert.ok(r.data.some((v) => v.visitor_name === `${TAG} Visitor`));
  r = await api('PUT', `/visitors/${created.visitors[0]}/checkout`, ctx.security);
  assert.ok(r.data.check_out_at);
  r = await api('PUT', `/visitors/${created.visitors[0]}/checkout`, ctx.security);
  assert.equal(r.status, 409, 'cannot check out twice');
});

test('student check-out archives the account and frees the room', async () => {
  let r = await api('POST', `/admin/students/${ctx.s2.id}/checkout`, ctx.admin, { reason: 'Course completed' });
  assert.equal(r.status, 200);
  assert.equal(r.data.is_active, false);
  assert.equal(r.data.room_id, null);

  r = await api('GET', '/auth/me', ctx.s2.token);
  assert.equal(r.status, 401, 'checked-out student is signed out');
  r = await api('GET', `/admin/rooms?hostel_id=${ctx.hostel}`, ctx.admin);
  assert.equal(r.data.rooms.find((x) => x.room_no === 'T-2').occupied, 0, 'room freed');
  r = await api('GET', `/admin/students?status=checked_out&search=E2E${STAMP}`, ctx.admin);
  assert.equal(r.data.length, 1, 'listed under checked out');

  r = await api('POST', `/admin/students/${ctx.s2.id}/readmit`, ctx.admin);
  assert.equal(r.data.is_active, true);
});
