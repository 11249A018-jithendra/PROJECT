// Portal separation + local-only developer console.
// Runs against a running backend on THIS computer (loopback), like the
// other e2e tests; everything is tagged "E2E TEST <timestamp>" and removed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { api, tokenForRole, supabase, created, cleanup, STAMP, TAG } = require('./helpers');
const { hashPassword } = require('../../utils/password');

const BASE = process.env.E2E_BASE || 'http://localhost:5000/api';
const ctx = {};
const login = (email, password, portal) => api('POST', '/auth/login', null, { email, password, portal });

before(async () => {
  ctx.admin = await tokenForRole('admin');
  // Test accounts with known test passwords.
  const mk = async (role, n) => {
    const email = `e2e.p${role}${n}.${STAMP}@example.test`;
    const { data, error } = await supabase
      .from('users')
      .insert({ role, name: `${TAG} Portal ${role}`, email, password: await hashPassword('Portal#2026x'), roll_no: role === 'student' ? `PT${STAMP}` : null })
      .select('_id')
      .single();
    if (error) throw error;
    created.users.push(data._id);
    return { id: data._id, email };
  };
  ctx.student = await mk('student', 1);
  ctx.warden = await mk('warden', 1);
  ctx.security = await mk('security', 1);
  ctx.dev = await mk('developer', 1);
  ctx.locked = await mk('security', 2);
});

after(async () => {
  if (ctx.dev) await supabase.from('developer_audit_log').delete().eq('developer_id', ctx.dev.id);
  const left = await cleanup();
  assert.equal(left, 0, 'all test users removed');
});

test('each portal accepts only its own roles', async () => {
  const cases = [
    [ctx.student, 'student', 200], [ctx.student, 'staff', 403], [ctx.student, 'gate', 403],
    [ctx.warden, 'staff', 200], [ctx.warden, 'student', 403], [ctx.warden, 'gate', 403],
    [ctx.security, 'gate', 200], [ctx.security, 'staff', 403], [ctx.security, 'student', 403],
  ];
  for (const [who, portal, want] of cases) {
    const r = await login(who.email, 'Portal#2026x', portal);
    assert.equal(r.status, want, `${who.email} on ${portal}`);
    if (want === 200) assert.equal(jwt.decode(r.data.token).portal, portal, 'token is locked to the portal');
  }
  const wrong = await login(ctx.student.email, 'Portal#2026x', 'staff');
  assert.match(wrong.data.message, /Student portal/, 'tells the user where to go');
  assert.equal((await login(ctx.student.email, 'wrong-pass1', 'staff')).status, 401, 'wrong password still says invalid, not the role');
});

test('staff portal: choosing Admin vs Warden', async () => {
  const as = (role) => api('POST', '/auth/login', null, { email: ctx.warden.email, password: 'Portal#2026x', portal: 'staff', role });
  assert.equal((await as('warden')).status, 200);
  const wrong = await as('admin');
  assert.equal(wrong.status, 403);
  assert.match(wrong.data.message, /Warden account/);
  assert.equal((await api('POST', '/auth/login', null, { email: ctx.warden.email, password: 'wrong-pass1', portal: 'staff', role: 'admin' })).status, 401, 'wrong password never reveals the role');
});

test('only security/admin scan at the gate; outpasses are only for students', async () => {
  const warden = (await login(ctx.warden.email, 'Portal#2026x', 'staff')).data.token;
  const guard = (await login(ctx.security.email, 'Portal#2026x', 'gate')).data.token;
  assert.equal((await api('POST', '/outpasses/scan', warden, { action: 'EXIT', qr_token: 'not-a-real-token' })).status, 403, 'warden cannot scan');
  assert.notEqual((await api('POST', '/outpasses/scan', guard, { action: 'EXIT', qr_token: 'not-a-real-token' })).status, 403, 'security may scan');
  const own = await api('POST', '/outpasses', guard, { reason: 'x', destination: 'x', leave_datetime: '2030-01-01T10:00', return_datetime: '2030-01-01T12:00' });
  assert.equal(own.status, 403, 'security cannot request an outpass for themselves');
});

test('sign-in accepts a roll number or any-case email', async () => {
  assert.equal((await login(`pt${STAMP}`, 'Portal#2026x', 'student')).status, 200, 'roll number, lower case');
  assert.equal((await login(` ${ctx.warden.email.toUpperCase()} `, 'Portal#2026x', 'staff')).status, 200, 'email with caps and spaces');
  assert.equal((await login(`PT${STAMP}`, 'wrong-pass1', 'student')).status, 401);
});

test('registration stores the email in lower case and enforces password rules', async () => {
  const email = `E2E.Reg.${STAMP}@Example.TEST`;
  const body = { name: `${TAG} Reg`, email, roll_no: `RG${STAMP}` };
  assert.equal((await api('POST', '/auth/register', null, { ...body, password: 'short' })).status, 400, 'weak password refused');
  const ok = await api('POST', '/auth/register', null, { ...body, password: 'Portal#2026x' });
  assert.equal(ok.status, 201);
  created.users.push(ok.data._id);
  assert.equal(ok.data.email, email.toLowerCase());
  assert.equal((await api('POST', '/auth/register', null, { ...body, email: email.toLowerCase(), roll_no: `RH${STAMP}`, password: 'Portal#2026x' })).status, 400, 'same email in other case refused');
  assert.equal((await login(email.toLowerCase(), 'Portal#2026x', 'student')).status, 200);
});

test('"remember me" sign-ins last 30 days, others 12 hours', async () => {
  const life = (r) => { const t = jwt.decode(r.data.token); return (t.exp - t.iat) / 3600; };
  assert.equal(life(await login(ctx.warden.email, 'Portal#2026x', 'staff')), 720, 'default (API clients) = remembered');
  const short = await api('POST', '/auth/login', null, { email: ctx.warden.email, password: 'Portal#2026x', portal: 'staff', remember: false });
  assert.equal(life(short), 12);
  // A password change keeps the same kind of sign-in.
  const changed = await api('PUT', '/auth/password', short.data.token, { current_password: 'Portal#2026x', new_password: 'Portal#2026y' });
  assert.equal(changed.status, 200);
  assert.equal(life(changed), 12);
  assert.equal((await api('PUT', '/auth/password', changed.data.token, { current_password: 'Portal#2026y', new_password: 'Portal#2026x' })).status, 200);
});

test('5 wrong passwords lock that account for a while; others are unaffected', async () => {
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await login(ctx.locked.email, 'wrong-pass1', 'gate')).status);
  assert.deepEqual(statuses, [401, 401, 401, 401, 429]);
  const locked = await login(ctx.locked.email, 'Portal#2026x', 'gate');
  assert.equal(locked.status, 429, 'even the right password waits');
  assert.match(locked.data.message, /wait \d+ minute/);
  assert.equal((await login(ctx.security.email, 'Portal#2026x', 'gate')).status, 200, 'other accounts still sign in');
});

test('forgot password notifies the office without revealing whether the account exists', async () => {
  const known = await api('POST', '/auth/forgot-password', null, { identifier: ctx.student.email });
  const unknown = await api('POST', '/auth/forgot-password', null, { identifier: `nobody.${STAMP}@example.test` });
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.equal(known.data.message, unknown.data.message, 'same answer either way');
  const { data: notes } = await supabase.from('notifications').select('type').eq('type', 'PASSWORD_RESET').ilike('message', `%${TAG} Portal student%`);
  assert.ok(notes.length >= 1, 'admins were notified');

  await api('POST', '/auth/forgot-password', null, { identifier: ctx.dev.email });
  const { data: devNotes } = await supabase.from('notifications').select('_id').eq('type', 'PASSWORD_RESET').ilike('message', `%${TAG} Portal developer%`);
  assert.equal(devNotes.length, 0, 'developer accounts are never reset by staff');
});

test('a token minted for one portal is refused if the role no longer fits it', async () => {
  const forged = jwt.sign({ id: ctx.student.id, portal: 'staff' }, process.env.JWT_SECRET, { expiresIn: '5m' });
  assert.equal((await api('GET', '/auth/me', forged)).status, 401);
});

test('developer: console only, admin powers, every change audited', async () => {
  assert.equal((await login(ctx.dev.email, 'Portal#2026x', 'staff')).status, 403, 'developer cannot use public portals');
  const r = await login(ctx.dev.email, 'Portal#2026x', 'developer');
  assert.equal(r.status, 200);
  ctx.devToken = r.data.token;

  assert.equal((await api('GET', '/developer/overview', ctx.devToken)).status, 200);
  assert.equal((await api('GET', '/developer/overview', ctx.admin)).status, 403, 'admins are not developers');
  assert.equal((await api('GET', '/admin/students', ctx.devToken)).status, 200, 'full admin powers');

  const upd = await api('PATCH', `/developer/users/${ctx.security.id}`, ctx.devToken, { phone: '9000050001' });
  assert.equal(upd.status, 200);
  // The audit row is written just after the response; give it a few seconds.
  let audited = false;
  for (let i = 0; i < 20 && !audited; i++) {
    await new Promise((res) => setTimeout(res, 250));
    const { data: log } = await supabase.from('developer_audit_log').select('action, status').eq('developer_id', ctx.dev.id).eq('target', ctx.security.id);
    audited = (log || []).some((l) => l.action.startsWith('PATCH /api/developer/users/') && l.status === 200);
  }
  assert.ok(audited, 'change was audited');
});

test('developer access is refused when the request is not from this computer', async () => {
  const res = await fetch(`${BASE}/developer/overview`, { headers: { Authorization: `Bearer ${ctx.devToken}`, 'X-Forwarded-For': '203.0.113.9' } });
  assert.equal(res.status, 401, 'a proxied (outside) request cannot use developer powers');
});

test('impersonation: see a portal as that user; actions audited', async () => {
  let r = await api('POST', '/developer/impersonate', ctx.devToken, { user_id: ctx.warden.id });
  assert.equal(r.status, 200);
  assert.equal(r.data.portal, 'staff');
  const imp = r.data.token;
  r = await api('GET', '/auth/me', imp);
  assert.equal(r.data.role, 'warden');
  assert.equal(r.data.impersonated_by, ctx.dev.id);
  r = await api('POST', '/developer/impersonate', ctx.devToken, { user_id: ctx.dev.id });
  assert.equal(r.status, 400, 'developers cannot be impersonated');
  const outside = await fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${imp}`, 'X-Forwarded-For': '203.0.113.9' } });
  assert.equal(outside.status, 401, 'impersonation also works only locally');
});

test('CORS: only our own sites may call the API from a browser', async () => {
  const ok = await fetch(`${BASE}/health`, { headers: { Origin: 'http://localhost:5173' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const bad = await fetch(`${BASE}/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});
