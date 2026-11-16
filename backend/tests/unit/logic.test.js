// Fast unit tests for pure logic — no server or database needed.
//   npm test
process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY ||= 'unit-test-key';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { passwordProblem, withoutPassword } = require('../../utils/password');
const { parsePage, pageResponse } = require('../../utils/paginate');
const { todayIST, toISTDateString, nowISTTimestamp, toISTTimestamp } = require('../../utils/istDate');
const { presenceByStudent, presenceFor } = require('../../utils/hostelPresence');
const { escalationDueAt } = require('../../utils/complaintEscalation');

const hoursFromNow = (h) => new Date(Date.now() + h * 3600000).toISOString();

test('password policy', () => {
  assert.match(passwordProblem('short1'), /8 characters/);
  assert.match(passwordProblem('longpassword'), /letter and one number/);
  assert.match(passwordProblem('12345678'), /letter and one number/);
  assert.match(passwordProblem('a1' + 'x'.repeat(80)), /72 bytes/);
  assert.equal(passwordProblem('Warden#2026'), null);
});

test('password hash never leaves the server', () => {
  assert.deepEqual(withoutPassword({ _id: 1, name: 'A', password: 'hash' }), { _id: 1, name: 'A' });
});

test('pagination is opt-in and clamped', () => {
  assert.equal(parsePage({ query: {} }), null);
  assert.deepEqual(parsePage({ query: { page: '2', limit: '10' } }), { page: 2, limit: 10, from: 10, to: 19 });
  assert.equal(parsePage({ query: { page: '1', limit: '5000' } }).limit, 100);
  assert.equal(parsePage({ query: { page: '-3' } }).page, 1);
  assert.equal(pageResponse([], 41, { page: 1, limit: 20 }).pages, 3);
});

test('IST dates roll over at IST midnight, not UTC', () => {
  assert.equal(toISTDateString('2026-10-14T18:29:59Z'), '2026-10-14');
  assert.equal(toISTDateString('2026-10-14T18:30:00Z'), '2026-10-15');
  assert.match(todayIST(), /^\d{4}-\d{2}-\d{2}$/);
});

test('IST timestamps include seconds and format correctly', () => {
  assert.match(nowISTTimestamp(), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(toISTTimestamp('2026-10-28T17:05:42.000Z'), '2026-10-28 22:35:42');
  // Midnight rollover in timestamp
  assert.equal(toISTTimestamp('2026-10-28T18:29:59.000Z'), '2026-10-28 23:59:59');
  assert.equal(toISTTimestamp('2026-10-28T18:30:00.000Z'), '2026-10-29 00:00:00');
});

test('live presence comes from gate scans', () => {
  const map = presenceByStudent([
    { _id: 'a', student_id: 's1', status: 'Checked Out', pass_type: 'Home', return_datetime: hoursFromNow(24), actual_exit_time: hoursFromNow(-2) },
    { _id: 'b', student_id: 's2', status: 'Checked Out', pass_type: 'Outing', return_datetime: hoursFromNow(-3), actual_exit_time: hoursFromNow(-5) },
    { _id: 'c', student_id: 's3', status: 'Returned', return_datetime: hoursFromNow(-30), actual_exit_time: hoursFromNow(-40), actual_return_time: hoursFromNow(-31) },
    { _id: 'd', student_id: 's3', status: 'Pending', return_datetime: hoursFromNow(30) },
  ]);
  assert.equal(map.s1.location, 'Gone Home');
  assert.equal(map.s1.is_overdue, false);
  assert.equal(map.s2.location, 'Outside Hostel');
  assert.equal(map.s2.is_overdue, true, 'past return time + grace');
  assert.equal(map.s3.location, 'Inside Hostel');
  assert.equal(map.s3.pending_outpasses, 1);
  assert.ok(map.s3.last_entry);
  assert.equal(presenceFor(map, 'nobody').location, 'Inside Hostel', 'no history = inside');
});

test('form date-times are read as India time, whatever the server/browser zone', () => {
  const { parseHostelDateTime } = require('../../utils/istDate');
  assert.equal(parseHostelDateTime('2026-10-28T19:32').toISOString(), '2026-10-28T14:02:00.000Z');
  assert.equal(parseHostelDateTime('2026-10-28 19:32:05').toISOString(), '2026-10-28T14:02:05.000Z');
  assert.equal(parseHostelDateTime('2026-10-28T14:02:00.000Z').toISOString(), '2026-10-28T14:02:00.000Z', 'explicit UTC kept');
  assert.equal(parseHostelDateTime('2026-10-28T19:32+05:30').toISOString(), '2026-10-28T14:02:00.000Z', 'explicit offset kept');
  // 23:59 IST is still "today"; 00:00 IST is the next day.
  assert.equal(toISTDateString(parseHostelDateTime('2026-10-28T23:59')), '2026-10-28');
  assert.equal(toISTDateString(parseHostelDateTime('2026-10-29T00:00')), '2026-10-29');
  for (const bad of ['', null, 'garbage', '2026-10-28', '28/10/2026 10:00']) assert.equal(parseHostelDateTime(bad), null, String(bad));
});

test('server errors are hidden from users but logged', () => {
  const { sanitizeServerErrors } = require('../../middleware/safeErrors');
  const run = (status, body) => {
    let sent;
    const res = { statusCode: status, json: (b) => { sent = b; return b; } };
    sanitizeServerErrors({ method: 'GET', originalUrl: '/x' }, res, () => {});
    res.json(body);
    return sent;
  };
  const original = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.join(' '));
  try {
    const hidden = run(500, { message: 'column users.secret_col does not exist' });
    assert.doesNotMatch(hidden.message, /secret_col/);
    assert.match(hidden.message, /Something went wrong/);
    assert.ok(logged.some((l) => l.includes('secret_col')), 'real error logged on the server');
    assert.equal(run(409, { message: 'Room A-1 is full.' }).message, 'Room A-1 is full.', 'our 4xx messages pass through');
    assert.equal(run(500, { valid: false, message: 'db down' }).valid, false, 'QR scanner flag kept');
  } finally {
    console.error = original;
  }
});

test('escalation clock restarts when a complaint is reopened', () => {
  const created = '2026-10-01T00:00:00.000Z';
  assert.equal(escalationDueAt({ created_at: created }), '2026-10-02T00:00:00.000Z');
  assert.equal(escalationDueAt({ created_at: created, reopened_at: '2026-10-10T06:00:00.000Z' }), '2026-10-11T06:00:00.000Z');
});
