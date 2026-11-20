const { test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { generateToken, sessionInvalidated } = require('../../utils/sessionToken');

process.env.JWT_SECRET ||= 'unit-test-session-secret';
const decode = (token) => jwt.verify(token, process.env.JWT_SECRET);

test('password changes invalidate older sessions within the same second', () => {
  const previous = '2026-11-20T10:00:00.100Z';
  const changed = '2026-11-20T10:00:00.900Z';
  const old = decode(generateToken('student', 'student', false, previous));
  assert.equal(sessionInvalidated(old, previous), false);
  assert.equal(sessionInvalidated(old, changed), true);
  const fresh = decode(generateToken('student', 'student', false, changed));
  assert.equal(sessionInvalidated(fresh, changed), false);
  assert.equal(sessionInvalidated(fresh, '2026-11-20T15:30:00.900+05:30'), false);
  assert.equal(fresh.portal, 'student');
  assert.equal(fresh.exp - fresh.iat, 12 * 3600);
});

test('initial sessions are revoked by the first reset; remembered sessions keep their lifetime', () => {
  const fresh = decode(generateToken('student', 'student'));
  assert.equal(sessionInvalidated(fresh, null), false);
  assert.equal(sessionInvalidated(fresh, '2026-11-20T10:00:00.001Z'), true);
  assert.equal(fresh.exp - fresh.iat, 30 * 86400);
});

test('legacy sessions in the reset second are rejected; later sessions remain compatible', () => {
  const changed = '2026-11-20T10:00:00.900Z';
  const second = Math.floor(Date.parse(changed) / 1000);
  assert.equal(sessionInvalidated({ iat: second }, changed), true);
  assert.equal(sessionInvalidated({ iat: second }, '2026-11-20T10:00:00.000Z'), true);
  assert.equal(sessionInvalidated({ iat: second + 1 }, changed), false);
  assert.equal(sessionInvalidated({}, changed), true);
  assert.equal(sessionInvalidated({ iat: second }, null), false);
});
