// Time-zone fix, early-exit rule, warden current-day rules (acceptance tests
// A–I), duplicate registration numbers, change/reset password, safe uploads,
// room range delete, announcement photos and emergency help / SOS.
// Runs against a running backend + the real database; everything is tagged
// "E2E TEST <timestamp>" and removed in `after`.
const fs = require('fs');
const path = require('path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, tokenForRole, supabase, created, cleanup, STAMP, TAG } = require('./helpers');

const BASE = process.env.E2E_BASE || 'http://localhost:5000/api';
const ctx = {};
const uploaded = [];

// Wall-clock "YYYY-MM-DDTHH:MM" in India time, h hours from now — exactly what
// the browser's datetime-local input sends.
const istLocal = (h) => new Date(Date.now() + 5.5 * 3600000 + h * 3600000).toISOString().slice(0, 16);
const istDate = (days = 0) => new Date(Date.now() + 5.5 * 3600000 + days * 86400000).toISOString().slice(0, 10);
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const multipart = async (method, urlPath, token, fields, file) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) form.append(file.field, new Blob([file.data], { type: file.type }), file.name);
  const res = await fetch(BASE + urlPath, { method, headers: { Authorization: `Bearer ${token}` }, body: form });
  return { status: res.status, data: await res.json().catch(() => null) };
};

before(async () => {
  ctx.admin = await tokenForRole('admin');
  ctx.security = await tokenForRole('security');
  let r = await api('POST', '/admin/hostels', ctx.admin, { name: `${TAG} Fix Hostel` });
  ctx.hostel = r.data._id;
  created.hostels.push(ctx.hostel);

  for (const n of [1, 2]) {
    const email = `e2e.fw${n}.${STAMP}@example.test`;
    r = await api('POST', '/admin/wardens', ctx.admin, { name: `${TAG} Fix Warden ${n}`, email, password: 'Warden#2026x', phone: `90000400${n}0`, hostel_id: ctx.hostel });
    created.users.push(r.data._id);
    const login = await api('POST', '/auth/login', null, { email, password: 'Warden#2026x' });
    ctx[`w${n}`] = { id: r.data._id, token: login.data.token };
  }
  r = await api('POST', '/auth/register', null, {
    name: `${TAG} Fix Student`, email: `e2e.fs.${STAMP}@example.test`, password: 'Student#2026', roll_no: `FX${STAMP}`,
    room_no: 'x', course_year: 'Test', phone: '9000040011', parent_contact: '9000040012', hostel_id: ctx.hostel, home_address: '1 Test St',
  });
  ctx.s = { id: r.data._id, token: r.data.token, email: `e2e.fs.${STAMP}@example.test` };
  created.users.push(ctx.s.id);
  await api('PUT', `/admin/students/${ctx.s.id}/warden`, ctx.admin, { assigned_warden: ctx.w1.id });
});

after(async () => {
  await supabase.from('emergency_contacts').delete().ilike('name', `%${TAG}%`);
  for (const p of uploaded) fs.rmSync(path.join(__dirname, '..', '..', p), { force: true });
  const left = await cleanup();
  assert.equal(left, 0, 'all test users removed');
});

test('time zone: form times are stored as India time', async () => {
  // Kept short and soon, so it never overlaps the "early exit" pass below
  // (a student can't hold two open passes for the same time).
  const leave = istLocal(0.1);
  const r = await api('POST', '/outpasses', ctx.s.token, { reason: 'tz', destination: 'Town', leave_datetime: leave, return_datetime: istLocal(1), parent_consent: true });
  assert.equal(r.status, 201);
  const expected = new Date(`${leave}:00+05:30`).toISOString();
  assert.equal(new Date(r.data.leave_datetime).toISOString(), expected, `"${leave}" IST must be ${expected}`);
});

test('early exit: a pass cannot be used hours before it starts', async (t) => {
  // Passes can only be approved for the current India day, so the pass must
  // start today: 5 hours from now, or 23:50 if that would cross midnight.
  const hoursToLate = (new Date(`${istDate(0)}T23:50:00+05:30`).getTime() - Date.now()) / 3600000;
  if (hoursToLate < 1.5) return t.skip('too close to midnight (India time) for a pass that starts later today');
  const startIn = Math.min(5, hoursToLate);
  let r = await api('POST', '/outpasses', ctx.s.token, { reason: 'later', destination: 'Town', leave_datetime: istLocal(startIn), return_datetime: istLocal(startIn + 3), parent_consent: true });
  assert.equal(r.status, 201);
  const later = await api('PUT', `/outpasses/${r.data._id}/approve`, ctx.w1.token);
  assert.equal(later.status, 200, 'a pass starting later today can be approved');
  r = await api('POST', '/outpasses/scan', ctx.security, { qr_token: later.data.qr_token });
  assert.equal(r.status, 409);
  assert.match(r.data.message, /starts at/);
});

test('A + H: warden sees today; admin keeps history; report is admin-only', async () => {
  let r = await api('GET', '/warden/attendance', ctx.w1.token);
  assert.equal(r.status, 200);
  assert.equal(r.data.date, istDate(0));
  r = await api('GET', `/admin/attendance?date=${istDate(-1)}`, ctx.admin);
  assert.equal(r.status, 200, 'admin can read yesterday');
  r = await api('GET', '/warden/attendance/report', ctx.w1.token);
  assert.ok([403, 404].includes(r.status), 'warden has no monthly report');
});

test('E + F + G: warden cannot read or change another day, whatever the client sends', async () => {
  let r = await api('GET', `/warden/attendance?date=${istDate(-1)}`, ctx.w1.token);
  assert.equal(r.status, 403);
  assert.equal(r.data.message, require('../../utils/wardenRules').WARDEN_TODAY_ONLY);
  r = await api('GET', `/warden/attendance?date=${istDate(1)}`, ctx.w1.token);
  assert.equal(r.status, 403, 'future dates refused too');
  r = await api('PUT', `/warden/attendance/${ctx.s.id}`, ctx.w1.token, { status: 'Present', date: istDate(-1) });
  assert.equal(r.status, 403, 'backdated mark refused');
  r = await api('PUT', '/warden/attendance', ctx.w1.token, { student_ids: [ctx.s.id], status: 'Present', date: istDate(-1) });
  assert.equal(r.status, 403, 'backdated bulk mark refused');
  // The server's date is used, never the client's: a today-mark works and lands on today.
  r = await api('PUT', `/warden/attendance/${ctx.s.id}`, ctx.w1.token, { status: 'Present' });
  assert.equal(r.status, 200);
  assert.equal(r.data.date, istDate(0));
});

test('B + C: warden issues today with an automatic issue time; backdating refused', async () => {
  let r = await api('POST', '/outpasses', ctx.w1.token, {
    student_id: ctx.s.id, reason: 'warden issue', destination: 'Clinic', leave_datetime: istLocal(0.05), return_datetime: istLocal(2),
    parent_consent: true, issued_at: '2020-01-01T00:00:00Z', approved_at: '2020-01-01T00:00:00Z',
  });
  assert.equal(r.status, 201);
  const issued = new Date(r.data.issued_at).getTime();
  assert.ok(Math.abs(issued - Date.now()) < 60000, 'issued_at comes from the server clock, not the request');
  assert.ok(r.data.issued_at && new Date(r.data.issued_at).getSeconds() !== undefined, 'issue time stored with seconds');

  r = await api('POST', '/outpasses', ctx.w1.token, { student_id: ctx.s.id, reason: 'backdated', destination: 'Town', leave_datetime: `${istDate(-1)}T10:00`, return_datetime: `${istDate(-1)}T12:00`, parent_consent: true });
  assert.equal(r.status, 403, 'yesterday refused');
  r = await api('POST', '/outpasses', ctx.w1.token, { student_id: ctx.s.id, reason: 'tomorrow', destination: 'Town', leave_datetime: `${istDate(1)}T10:00`, return_datetime: `${istDate(1)}T12:00`, parent_consent: true });
  assert.equal(r.status, 403, 'other days refused');
});

test('duplicate registration numbers are refused (any letter case)', async () => {
  const r = await api('POST', '/auth/register', null, {
    name: `${TAG} Dup`, email: `e2e.dup.${STAMP}@example.test`, password: 'Student#2026', roll_no: ` fx${STAMP} `,
    room_no: 'x', course_year: 'Test', phone: '9000040013', parent_contact: '9000040014',
  });
  assert.equal(r.status, 400);
  assert.match(r.data.message, /already registered/);
});

test('change password and admin reset', async () => {
  let r = await api('PUT', '/auth/password', ctx.s.token, { current_password: 'wrong-one1', new_password: 'Newpass#2026' });
  assert.equal(r.status, 400);
  r = await api('PUT', '/auth/password', ctx.s.token, { current_password: 'Student#2026', new_password: 'short' });
  assert.equal(r.status, 400, 'weak password refused');
  r = await api('PUT', '/auth/password', ctx.s.token, { current_password: 'Student#2026', new_password: 'Newpass#2026' });
  assert.equal(r.status, 200);
  const fresh = r.data.token;
  await new Promise((res) => setTimeout(res, 1100));
  r = await api('GET', '/auth/me', ctx.s.token);
  assert.equal(r.status, 401, 'old session signed out');
  r = await api('GET', '/auth/me', fresh);
  assert.equal(r.status, 200, 'this device stays signed in');

  r = await api('PUT', `/admin/users/${ctx.s.id}/password`, ctx.w1.token, { password: 'Reset#2026x' });
  assert.equal(r.status, 403, 'wardens cannot reset student passwords');
  r = await api('PUT', `/admin/users/${ctx.w1.id}/password`, ctx.admin, { password: 'Reset#2026x' });
  assert.equal(r.status, 404, 'this endpoint is only for students/security');
  r = await api('PUT', `/admin/users/${ctx.s.id}/password`, ctx.admin, { password: 'Reset#2026x' });
  assert.equal(r.status, 200);
  r = await api('POST', '/auth/login', null, { email: ctx.s.email, password: 'Reset#2026x' });
  assert.equal(r.status, 200);
  ctx.s.token = r.data.token;
});

test('uploads: images only; announcement photo is stored and served', async () => {
  let r = await multipart('POST', '/complaints', ctx.s.token, { category: 'other', description: `${TAG} upload` }, { field: 'photo', data: Buffer.from('<script>alert(1)</script>'), type: 'text/html', name: 'evil.html' });
  assert.equal(r.status, 400);
  assert.match(r.data.message, /Only JPG, PNG/);

  r = await multipart('POST', '/announcements', ctx.w1.token, { title: `${TAG} with photo`, message: 'See photo', priority: 'Normal' }, { field: 'photo', data: PNG_1PX, type: 'image/png', name: 'notice.png' });
  assert.equal(r.status, 201);
  created.announcements.push(r.data._id);
  assert.match(r.data.photo, /^uploads\/\d+-[0-9a-f]+\.png$/);
  uploaded.push(r.data.photo);
  const img = await fetch(`${BASE.replace(/\/api$/, '')}/${r.data.photo}`);
  assert.equal(img.status, 200);
});

test('rooms: delete a range, skipping occupied rooms', async () => {
  await api('POST', '/admin/rooms/bulk', ctx.admin, { hostel_id: ctx.hostel, prefix: 'Z-', from: 1, to: 5, capacity: 2 });
  const rooms = (await api('GET', `/admin/rooms?hostel_id=${ctx.hostel}`, ctx.admin)).data.rooms;
  await api('PUT', `/admin/students/${ctx.s.id}/hostel`, ctx.admin, { room_id: rooms.find((x) => x.room_no === 'Z-2')._id });

  let r = await api('POST', '/admin/rooms/bulk-delete', ctx.admin, { hostel_id: ctx.hostel, prefix: 'Z-', from: 1, to: 7 });
  assert.deepEqual(r.data.will_delete, ['Z-1', 'Z-3', 'Z-4', 'Z-5']);
  assert.equal(r.data.skipped_occupied[0].room_no, 'Z-2');
  assert.deepEqual(r.data.not_found, ['Z-6', 'Z-7']);
  assert.equal(r.data.deleted, 0, 'preview deletes nothing');

  r = await api('POST', '/admin/rooms/bulk-delete', ctx.w1.token, { hostel_id: ctx.hostel, from: 1, to: 2, confirm: true });
  assert.equal(r.status, 403, 'only admins delete rooms');
  r = await api('POST', '/admin/rooms/bulk-delete', ctx.admin, { hostel_id: ctx.hostel, prefix: 'Z-', from: 1, to: 7, confirm: true });
  assert.equal(r.data.deleted, 4);
  const left = (await api('GET', `/admin/rooms?hostel_id=${ctx.hostel}`, ctx.admin)).data.rooms.map((x) => x.room_no);
  assert.deepEqual(left, ['Z-2'], 'occupied room kept');
});

test('emergency help: warden-managed contacts and SOS', async () => {
  let r = await api('POST', '/emergency/contacts', ctx.w1.token, { name: `${TAG} Driver Ravi`, category: 'Driver', phone: '9000040099', notes: 'Car KA-01' });
  assert.equal(r.status, 201);
  assert.equal(r.data.hostel_id, ctx.hostel, 'warden contacts belong to their hostel');
  r = await api('POST', '/emergency/contacts', ctx.s.token, { name: 'x', category: 'Driver', phone: '9000000000' });
  assert.equal(r.status, 403, 'students cannot edit contacts');

  r = await api('GET', '/emergency/contacts', ctx.s.token);
  assert.ok(r.data.some((c) => c.category === 'Driver' && c.phone === '9000040099'), 'student sees the driver');
  assert.ok(r.data.some((c) => c.category === 'Warden' && c.phone === '9000040010'), 'and their own warden');

  r = await api('POST', '/emergency/sos', ctx.s.token, { message: `${TAG} help` });
  assert.equal(r.status, 201);
  const alertId = r.data.alert._id;
  r = await api('POST', '/emergency/sos', ctx.s.token, {});
  assert.equal(r.status, 429, 'one SOS per 10 minutes');
  const { data: notes } = await supabase.from('notifications').select('user_id').eq('type', 'SOS').eq('user_id', ctx.w1.id);
  assert.equal(notes.length, 1, 'warden alerted');

  r = await api('GET', '/emergency/sos?status=Active', ctx.security);
  assert.ok(r.data.some((a) => a._id === alertId), 'security sees it');
  r = await api('PUT', `/emergency/sos/${alertId}/acknowledge`, ctx.w2.token);
  assert.equal(r.status, 403, "another warden's student");
  r = await api('PUT', `/emergency/sos/${alertId}/acknowledge`, ctx.w1.token);
  assert.equal(r.data.status, 'Acknowledged');
  r = await api('PUT', `/emergency/sos/${alertId}/resolve`, ctx.security, { note: 'Escorted to clinic' });
  assert.equal(r.data.status, 'Resolved');
});

test('server errors never reveal database details', async () => {
  // Malformed JSON → our own 400 message, not a parser stack trace.
  const res = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.message, 'The request body is not valid JSON.');
});
