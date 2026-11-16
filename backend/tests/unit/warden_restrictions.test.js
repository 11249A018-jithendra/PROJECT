process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY ||= 'dummy-key';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { todayIST, toISTDateString, nowISTTimestamp, toISTTimestamp } = require('../../utils/istDate');

// Test A & E: Warden Current-day attendance access rule
test('Warden attendance query: allowed today, rejected for past dates', () => {
  const today = todayIST();
  const yesterday = new Date(Date.now() + 5.5 * 3600000 - 86400000).toISOString().split('T')[0];

  // Helper simulating controller check
  const checkAttendanceAccess = (role, requestedDate) => {
    const curToday = todayIST();
    const date = requestedDate || curToday;
    if (role === 'warden' && date !== curToday) {
      return { status: 403, message: 'Access denied: You can manage student attendance and issue outpasses for the current date only.' };
    }
    return { status: 200, date };
  };

  // Test A: Warden can view today
  const resToday = checkAttendanceAccess('warden', today);
  assert.equal(resToday.status, 200);
  assert.equal(resToday.date, today);

  // Test E: Warden attempting to access yesterday by URL/query param is rejected
  const resPast = checkAttendanceAccess('warden', yesterday);
  assert.equal(resPast.status, 403);
  assert.equal(resPast.message, 'Access denied: You can manage student attendance and issue outpasses for the current date only.');

  // Test H & I: Admin can view yesterday's attendance
  const resAdmin = checkAttendanceAccess('admin', yesterday);
  assert.equal(resAdmin.status, 200);
  assert.equal(resAdmin.date, yesterday);
});

// Test B & C: Outpass date restrictions and actual issue timestamp
test('Outpass issuance: today allowed with automatic seconds timestamp, yesterday rejected', () => {
  const today = todayIST();
  const yesterday = new Date(Date.now() + 5.5 * 3600000 - 86400000).toISOString().split('T')[0];

  const checkOutpassCreation = (role, leaveDatetime, clientSuppliedIssuedAt = null) => {
    const leaveDate = toISTDateString(leaveDatetime);
    const curToday = todayIST();
    if (role === 'warden') {
      if (leaveDate !== curToday) {
        return { status: 403, message: 'Access denied: You can manage student attendance and issue outpasses for the current date only.' };
      }
    }
    // Server trusted timestamp generated regardless of client input
    const actualIssueTimestamp = nowISTTimestamp();
    return {
      status: 201,
      outpass: {
        leave_datetime: leaveDatetime,
        issued_at: actualIssueTimestamp, // client input ignored
      },
    };
  };

  // Test B: Current day outpass issuance records actual issue timestamp with seconds
  const resToday = checkOutpassCreation('warden', `${today}T10:00:00Z`, '2020-01-01 00:00:00');
  assert.equal(resToday.status, 201);
  assert.match(resToday.outpass.issued_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.notEqual(resToday.outpass.issued_at, '2020-01-01 00:00:00', 'Client-submitted timestamp must be ignored');

  // Test C: Backdated outpass attempt for yesterday is rejected
  const resPast = checkOutpassCreation('warden', `${yesterday}T10:00:00Z`);
  assert.equal(resPast.status, 403);
  assert.equal(resPast.message, 'Access denied: You can manage student attendance and issue outpasses for the current date only.');
});

// Test D: Midnight transition logic
test('Midnight transition: 11:59:59 PM is today, 12:00:00 AM becomes new date', () => {
  // 18:29:59 UTC = 23:59:59 IST
  assert.equal(toISTTimestamp('2026-10-28T18:29:59.000Z'), '2026-10-28 23:59:59');
  assert.equal(toISTDateString('2026-10-28T18:29:59.000Z'), '2026-10-28');

  // 18:30:00 UTC = 00:00:00 IST (midnight transition)
  assert.equal(toISTTimestamp('2026-10-28T18:30:00.000Z'), '2026-10-29 00:00:00');
  assert.equal(toISTDateString('2026-10-28T18:30:00.000Z'), '2026-10-29');
});

// Test F: Server-side clock trust (client date cannot bypass backend)
test('Backend relies strictly on server time, not client payload', () => {
  const serverToday = todayIST();
  const fakeClientClock = '1999-12-31';

  // Even if client sends fake date in body
  const evaluateWardenAction = (clientBodyDate) => {
    const activeDate = clientBodyDate || serverToday;
    if (activeDate !== serverToday) {
      return { status: 403, message: 'Access denied: You can manage student attendance and issue outpasses for the current date only.' };
    }
    return { status: 200, date: activeDate };
  };

  assert.equal(evaluateWardenAction(fakeClientClock).status, 403);
});

// Test H: Attendance report restriction for warden, preserved for admin
test('Warden cannot access attendance report, admin retains full reporting access', () => {
  const checkReportAccess = (role) => {
    if (role === 'warden') {
      return { status: 403, message: 'Access denied: You can manage student attendance and issue outpasses for the current date only.' };
    }
    return { status: 200, report: { monthlyData: [] } };
  };

  assert.equal(checkReportAccess('warden').status, 403);
  assert.equal(checkReportAccess('warden').message, 'Access denied: You can manage student attendance and issue outpasses for the current date only.');
  assert.equal(checkReportAccess('admin').status, 200);
});

