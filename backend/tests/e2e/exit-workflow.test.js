// Permanent hostel exit: warden request -> admin approve/reject -> Past Students.
// Runs against a running backend + the real database; every record is tagged
// "E2E TEST <timestamp>" and removed in `after`.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, tokenForRole, supabase, created, cleanup, STAMP, TAG } = require('./helpers');

const ctx = {};
const hours = (h) => new Date(Date.now() + h * 3600000).toISOString();

const makeWarden = async (n) => {
  const email = `e2e.xw${n}.${STAMP}@example.test`;
  const r = await api('POST', '/admin/wardens', ctx.admin, { name: `${TAG} Exit Warden ${n}`, email, password: 'Warden#2026x', hostel_id: ctx.hostel });
  assert.equal(r.status, 201);
  created.users.push(r.data._id);
  const login = await api('POST', '/auth/login', null, { email, password: 'Warden#2026x' });
  return { id: r.data._id, token: login.data.token };
};

const makeStudent = async (n) => {
  const r = await api('POST', '/auth/register', null, {
    name: `${TAG} Exit Student ${n}`, email: `e2e.xs${n}.${STAMP}@example.test`, password: 'Student#2026', roll_no: `X${STAMP}-${n}`,
    room_no: 'x', course_year: 'B.Tech 4th Year', phone: '9000000020', parent_contact: '9000000021', hostel_id: ctx.hostel, home_address: '7 Exit Lane',
  });
  assert.equal(r.status, 201);
  created.users.push(r.data._id);
  await api('PUT', `/admin/students/${r.data._id}/warden`, ctx.admin, { assigned_warden: ctx.w1.id });
  return { id: r.data._id, token: r.data.token };
};

const inList = (rows, id) => rows.some((s) => s._id === id);

before(async () => {
  ctx.admin = await tokenForRole('admin');
  const r = await api('POST', '/admin/hostels', ctx.admin, { name: `${TAG} Exit Hostel` });
  ctx.hostel = r.data._id;
  created.hostels.push(ctx.hostel);
  await api('POST', '/admin/rooms', ctx.admin, { hostel_id: ctx.hostel, room_no: 'X-1', capacity: 2 });
  ctx.room = (await api('GET', `/admin/rooms?hostel_id=${ctx.hostel}`, ctx.admin)).data.rooms[0];

  ctx.w1 = await makeWarden(1);
  ctx.w2 = await makeWarden(2); // not this student's warden
  ctx.s1 = await makeStudent(1); // will be approved
  ctx.s2 = await makeStudent(2); // will be rejected
  ctx.s3 = await makeStudent(3); // used for the failure/atomicity checks
  await api('PUT', `/admin/students/${ctx.s1.id}/hostel`, ctx.admin, { room_id: ctx.room._id });
  // Some history to preserve.
  await api('PUT', `/warden/attendance/${ctx.s1.id}`, ctx.w1.token, { status: 'Present' });
  await api('POST', '/complaints', ctx.s1.token, { category: 'electrical', description: `${TAG} exit test complaint` });
});

after(async () => {
  const left = await cleanup();
  assert.equal(left, 0, 'all test users removed');
});

test('1. warden submits a request; only one pending per student', async () => {
  let r = await api('POST', '/exit-requests', ctx.w1.token, { student_id: ctx.s1.id, reason: 'Course completed', exit_date: '2026-10-20' });
  assert.equal(r.status, 201);
  assert.equal(r.data.status, 'Pending');
  ctx.req1 = r.data._id;

  r = await api('POST', '/exit-requests', ctx.w1.token, { student_id: ctx.s1.id, reason: 'Duplicate attempt' });
  assert.equal(r.status, 409, 'duplicate pending request refused');

  r = await api('POST', '/exit-requests', ctx.w1.token, { student_id: ctx.s1.id, reason: 'no' });
  assert.equal(r.status, 400, 'reason is validated');
});

test('9a. unauthorized users cannot submit or decide', async () => {
  let r = await api('POST', '/exit-requests', ctx.w2.token, { student_id: ctx.s2.id, reason: 'Not my student at all' });
  assert.equal(r.status, 403, "warden can't request for another warden's student");
  r = await api('POST', '/exit-requests', ctx.s2.token, { student_id: ctx.s2.id, reason: 'I want to leave now' });
  assert.equal(r.status, 403, "students can't submit");
  r = await api('PUT', `/exit-requests/${ctx.req1}/approve`, ctx.w1.token, {});
  assert.equal(r.status, 403, "warden can't approve their own request");
  r = await api('PUT', `/exit-requests/${ctx.req1}/reject`, ctx.w1.token, { reason: 'trying to reject' });
  assert.equal(r.status, 403);
  r = await api('PUT', '/exit-requests/not-a-uuid/approve', ctx.admin, {});
  assert.equal(r.status, 400, 'ids validated server-side');
  r = await api('GET', `/exit-requests/${ctx.req1}`, ctx.w2.token);
  assert.equal(r.status, 403, "other wardens can't read the request");
});

test('2-3. request reaches the admin; student stays active while pending', async () => {
  let r = await api('GET', '/exit-requests?status=Pending&page=1', ctx.admin);
  assert.ok(r.data.items.some((x) => x._id === ctx.req1));
  r = await api('GET', `/exit-requests/${ctx.req1}`, ctx.admin);
  assert.equal(r.data.student_profile.home_address, '7 Exit Lane', 'admin sees full student details');
  assert.equal(r.data.requester._id, ctx.w1.id, 'and the requesting warden');
  assert.ok(!('password' in r.data.student_profile));

  r = await api('GET', '/warden/students', ctx.w1.token);
  const row = r.data.find((s) => s._id === ctx.s1.id);
  assert.ok(row && row.exit_request_pending, 'still listed for the warden, flagged pending');
  r = await api('GET', '/auth/me', ctx.s1.token);
  assert.equal(r.status, 200, 'student can still log in');
});

test('10. a failed approval changes nothing (atomic)', async () => {
  // a) Business-rule failure: student is outside on an outpass.
  let r = await api('POST', '/exit-requests', ctx.w1.token, { student_id: ctx.s3.id, reason: 'Transferring to another campus' });
  ctx.req3 = r.data._id;
  r = await api('POST', '/outpasses', ctx.s3.token, { reason: 'home', destination: 'Home', leave_datetime: hours(-1), return_datetime: hours(24), parent_consent: true, pass_type: 'Home' });
  const op = await api('PUT', `/outpasses/${r.data._id}/approve`, ctx.w1.token);
  await api('POST', '/outpasses/scan', await tokenForRole('security'), { action: 'EXIT', qr_token: op.data.qr_token });

  r = await api('PUT', `/exit-requests/${ctx.req3}/approve`, ctx.admin, {});
  assert.equal(r.status, 409);
  assert.equal(r.data.needs_confirmation, true);

  // b) Unauthorized caller reaching the database function directly.
  const call = (adminId) => supabase.rpc('archive_student', {
    p_student_id: null, p_admin_id: adminId, p_request_id: ctx.req3, p_reason: null, p_exit_date: null, p_force: true,
  });
  const { error } = await call(ctx.w1.id);
  assert.match(error.message, /ADMIN_NOT_FOUND/);
  // (archive_student is a single plpgsql call, i.e. one transaction: any
  // error inside it rolls back every statement. Since 2026-10-28 it also
  // closes stale past_students rows itself, so a conflicting row no longer
  // makes it fail — that injection was removed from this test.)

  const { data: st } = await supabase.from('users').select('is_active, hostel_id, assigned_warden').eq('_id', ctx.s3.id).single();
  assert.equal(st.is_active, true, 'student untouched');
  assert.equal(st.hostel_id, ctx.hostel);
  const { data: rq } = await supabase.from('student_exit_requests').select('status').eq('_id', ctx.req3).single();
  assert.equal(rq.status, 'Pending', 'request untouched');
  const { count } = await supabase.from('past_students').select('*', { count: 'exact', head: true }).eq('student_id', ctx.s3.id);
  assert.equal(count, 0, 'no partial history row');
});

test('4-7. admin approves: history preserved, student gone from active lists', async () => {
  let r = await api('PUT', `/exit-requests/${ctx.req1}/approve`, ctx.admin, {});
  assert.equal(r.status, 200);
  assert.equal(r.data.request.status, 'Approved');
  const past = r.data.past_student;
  assert.equal(past.student_id, ctx.s1.id, 'traceable to the original student id');
  assert.equal(past.hostel_name, `${TAG} Exit Hostel`);
  assert.equal(past.room_no, 'X-1');
  assert.equal(past.warden_name, `${TAG} Exit Warden 1`);
  assert.equal(past.exit_reason, 'Course completed');
  assert.equal(past.exit_date, '2026-10-20');
  assert.equal(past.source, 'Warden request');
  assert.equal(past.stats.attendance_present, 1);
  assert.equal(past.stats.complaints_total, 1);
  assert.ok(!('password' in past.profile), 'password hash never archived');

  r = await api('PUT', `/exit-requests/${ctx.req1}/approve`, ctx.admin, {});
  assert.equal(r.status, 409, 'cannot be approved twice');
  r = await api('PUT', `/exit-requests/${ctx.req1}/reject`, ctx.admin, { reason: 'too late to reject' });
  assert.equal(r.status, 409, 'cannot be rejected after approval');

  r = await api('GET', '/admin/students', ctx.admin);
  assert.ok(!inList(r.data, ctx.s1.id), 'gone from admin active list');
  r = await api('GET', '/warden/students', ctx.w1.token);
  assert.ok(!inList(r.data, ctx.s1.id), 'gone from warden list');
  r = await api('GET', `/admin/rooms?hostel_id=${ctx.hostel}`, ctx.admin);
  assert.equal(r.data.rooms[0].occupied, 0, 'bed freed');
  r = await api('GET', '/auth/me', ctx.s1.token);
  assert.equal(r.status, 401, 'student signed out');

  // History rows were kept, not deleted.
  const { count: complaints } = await supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('student_id', ctx.s1.id);
  assert.equal(complaints, 1);

  r = await api('GET', `/admin/past-students?search=X${STAMP}-1&page=1`, ctx.admin);
  assert.equal(r.data.items.length, 1, 'listed in Past Students');
  ctx.past1 = r.data.items[0]._id;
  r = await api('GET', `/admin/past-students/${ctx.past1}`, ctx.admin);
  assert.equal(r.data.exit_request.requested_by, ctx.w1.id);
  assert.equal(r.data.history.complaints.length, 1);
  assert.equal(r.data.history.attendance.length, 1);
});

test('8. admin rejects: student stays active, warden sees the reason', async () => {
  let r = await api('POST', '/exit-requests', ctx.w1.token, { student_id: ctx.s2.id, reason: 'Student asked to leave' });
  const req2 = r.data._id;
  r = await api('PUT', `/exit-requests/${req2}/reject`, ctx.admin, { reason: 'Fees and room clearance pending' });
  assert.equal(r.status, 200);
  r = await api('GET', '/exit-requests?status=Rejected', ctx.w1.token);
  const seen = r.data.find((x) => x._id === req2);
  assert.equal(seen.rejection_reason, 'Fees and room clearance pending');
  r = await api('GET', '/warden/students', ctx.w1.token);
  assert.ok(inList(r.data, ctx.s2.id), 'still active for the warden');
  const { count } = await supabase.from('past_students').select('*', { count: 'exact', head: true }).eq('student_id', ctx.s2.id);
  assert.equal(count, 0, 'no history record on rejection');

  r = await api('POST', '/exit-requests', ctx.w1.token, { student_id: ctx.s2.id, reason: 'Second request after rejection' });
  assert.equal(r.status, 201, 'a new request is allowed after a rejection');
  r = await api('PUT', `/exit-requests/${r.data._id}/cancel`, ctx.w1.token);
  assert.equal(r.data.status, 'Cancelled', 'warden can withdraw');
});

test('9b. past students are admin-only', async () => {
  let r = await api('GET', '/admin/past-students', ctx.w1.token);
  assert.equal(r.status, 403);
  r = await api('GET', `/admin/past-students/${ctx.past1}`, ctx.s2.token);
  assert.equal(r.status, 403);
  r = await api('GET', '/admin/past-students', null);
  assert.equal(r.status, 401);
});

test('readmit keeps the history record, marked readmitted', async () => {
  let r = await api('POST', `/admin/students/${ctx.s1.id}/readmit`, ctx.admin);
  assert.equal(r.status, 200);
  assert.equal(r.data.is_active, true);
  r = await api('GET', `/admin/past-students?search=X${STAMP}-1`, ctx.admin);
  assert.equal(r.data.items.length, 0, 'hidden from current past students');
  r = await api('GET', `/admin/past-students?search=X${STAMP}-1&include_readmitted=true`, ctx.admin);
  assert.ok(r.data.items[0].readmitted_at, 'but kept with readmitted date');
});
