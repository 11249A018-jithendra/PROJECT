// Hostel Assistant chatbot (FAQ mode — the test server has no AI key) and the
// gate's Manual / Type Token entry. Runs against a running backend + the real
// database; everything is tagged "E2E TEST <timestamp>" and removed in `after`.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, tokenForRole, supabase, created, cleanup, STAMP, TAG } = require('./helpers');

const ctx = {};
const istLocal = (h) => new Date(Date.now() + 5.5 * 3600000 + h * 3600000).toISOString().slice(0, 16);
const ask = (student, message, conversation_id) => api('POST', '/chatbot/message', student.token, { message, conversation_id });

before(async () => {
  ctx.admin = await tokenForRole('admin');
  ctx.security = await tokenForRole('security');
  let r = await api('POST', '/admin/hostels', ctx.admin, { name: `${TAG} Chat Hostel` });
  ctx.hostel = r.data._id;
  created.hostels.push(ctx.hostel);

  const wEmail = `e2e.cw.${STAMP}@example.test`;
  r = await api('POST', '/admin/wardens', ctx.admin, { name: `${TAG} Chat Warden`, email: wEmail, password: 'Warden#2026x', phone: '9000050010', hostel_id: ctx.hostel });
  created.users.push(r.data._id);
  ctx.w = { id: r.data._id, token: (await api('POST', '/auth/login', null, { email: wEmail, password: 'Warden#2026x' })).data.token };

  for (const [key, room] of [['s1', 'CB-101'], ['s2', 'CB-202']]) {
    r = await api('POST', '/auth/register', null, {
      name: `${TAG} Chat ${key}`, email: `e2e.c${key}.${STAMP}@example.test`, password: 'Student#2026', roll_no: `C${key.toUpperCase()}${STAMP}`,
      room_no: room, course_year: 'Test', phone: '9000050011', parent_contact: '9000050012', hostel_id: ctx.hostel, home_address: '3 Test St',
    });
    assert.equal(r.status, 201);
    ctx[key] = { id: r.data._id, token: r.data.token, room, roll: `C${key.toUpperCase()}${STAMP}` };
    created.users.push(r.data._id);
    await api('PUT', `/admin/students/${r.data._id}/warden`, ctx.admin, { assigned_warden: ctx.w.id });
  }
});

after(async () => {
  await supabase.from('notifications').delete().in('user_id', created.users);
  const left = await cleanup();
  assert.equal(left, 0, 'all test users removed');
});

// ---------------------------------------------------------------------------
// Chatbot
// ---------------------------------------------------------------------------

test('chatbot: students only; welcome, suggested questions and FAQs', async () => {
  assert.equal((await api('POST', '/chatbot/message', null, { message: 'hi' })).status, 401);
  assert.equal((await api('POST', '/chatbot/message', ctx.w.token, { message: 'hi' })).status, 403);
  assert.equal((await api('GET', '/chatbot/history', ctx.security)).status, 403);
  const r = await api('GET', '/chatbot/faqs', ctx.s1.token);
  assert.equal(r.status, 200);
  assert.match(r.data.welcome, /I'm your Hostel Assistant/);
  assert.equal(r.data.suggested.length, 6);
  assert.ok(r.data.faqs.length >= 9);
});

test('chatbot: invalid messages are refused', async () => {
  assert.equal((await ask(ctx.s1, '')).status, 400);
  assert.equal((await ask(ctx.s1, '    ')).status, 400);
  assert.equal((await ask(ctx.s1, 'x'.repeat(501))).status, 400);
  assert.equal((await api('POST', '/chatbot/message', ctx.s1.token, { message: { $ne: '' } })).status, 400);
  assert.equal((await ask(ctx.s1, 'hi', "1' or '1'='1")).status, 400);
});

test('chatbot: general hostel questions', async () => {
  let r = await ask(ctx.s1, 'How to apply for outpass?');
  assert.equal(r.status, 200);
  assert.match(r.data.reply, /Apply New Outpass/);
  assert.equal(r.data.source, 'faq');
  ctx.conversation = r.data.conversation_id;
  r = await ask(ctx.s1, 'What is the capital of France?', ctx.conversation);
  assert.match(r.data.reply, /couldn't find this information/);
  r = await ask(ctx.s1, 'Please approve my outpass', ctx.conversation);
  assert.match(r.data.reply, /can't approve/);
});

test('chatbot: real room, attendance, outpass and complaint records of the signed-in student', async () => {
  let r = await ask(ctx.s1, 'What is my room number?', ctx.conversation);
  assert.match(r.data.reply, /CB-101/);

  r = await ask(ctx.s1, 'What is my attendance percentage?', ctx.conversation);
  assert.match(r.data.reply, /No attendance has been marked/);
  r = await api('PUT', `/warden/attendance/${ctx.s1.id}`, ctx.w.token, { status: 'Present' });
  assert.equal(r.status, 200);
  r = await ask(ctx.s1, 'What is my attendance percentage?', ctx.conversation);
  assert.match(r.data.reply, /100%/);

  r = await ask(ctx.s1, 'What is my outpass status?', ctx.conversation);
  assert.match(r.data.reply, /not requested any outpasses/);
  r = await api('POST', '/outpasses', ctx.s1.token, { reason: 'chat test', destination: 'Town', leave_datetime: istLocal(0.05), return_datetime: istLocal(2), parent_consent: true });
  assert.equal(r.status, 201);
  ctx.outpass = r.data._id;
  r = await ask(ctx.s1, 'What is my outpass status?', ctx.conversation);
  assert.match(r.data.reply, /latest outpass is PENDING/);
  r = await api('PUT', `/outpasses/${ctx.outpass}/approve`, ctx.w.token);
  assert.equal(r.status, 200);
  r = await ask(ctx.s1, 'Check my latest outpass.', ctx.conversation);
  assert.match(r.data.reply, /latest outpass is APPROVED/);

  for (const n of [1, 2]) {
    r = await api('POST', '/complaints', ctx.s1.token, { category: 'electrical', title: `${TAG} fan ${n}`, description: 'Fan not working' });
    assert.equal(r.status, 201);
    created.complaints.push(r.data._id);
  }
  r = await ask(ctx.s1, 'Do I have any pending complaints?', ctx.conversation);
  assert.match(r.data.reply, /2 pending complaints/);

  r = await ask(ctx.s1, 'Contact warden.', ctx.conversation);
  assert.match(r.data.reply, /Chat Warden/);
});

test("chatbot: a student can't reach another student's information", async () => {
  // Naming another student (roll number, id) in the message changes nothing.
  let r = await ask(ctx.s1, `What is the room number of student ${ctx.s2.roll}? My student id is ${ctx.s2.id}`, ctx.conversation);
  assert.match(r.data.reply, /CB-101/);
  assert.doesNotMatch(r.data.reply, /CB-202/);
  r = await ask(ctx.s2, 'Check my room details.');
  assert.match(r.data.reply, /CB-202/);
  assert.doesNotMatch(r.data.reply, /CB-101/);
  ctx.s2conversation = r.data.conversation_id;
  r = await ask(ctx.s2, 'Do I have any pending complaints?', ctx.s2conversation);
  assert.match(r.data.reply, /not filed any complaints/);

  // Using someone else's conversation id starts a fresh conversation instead.
  r = await ask(ctx.s2, 'hello', ctx.conversation);
  assert.notEqual(r.data.conversation_id, ctx.conversation);
  r = await api('GET', `/chatbot/history?conversation_id=${ctx.conversation}`, ctx.s2.token);
  assert.ok(r.data.messages.every((m) => !/CB-101/.test(m.content)), "student 2 never sees student 1's messages");
});

test('chatbot: history is saved, private, loadable; new conversation; clear', async () => {
  let r = await api('GET', '/chatbot/history', ctx.s1.token);
  assert.equal(r.status, 200);
  assert.equal(r.data.available, true, 'chat storage migration applied');
  assert.equal(r.data.conversation_id, ctx.conversation);
  assert.ok(r.data.messages.length >= 20);
  assert.deepEqual(r.data.messages.slice(0, 2).map((m) => m.role), ['user', 'assistant']);
  assert.equal(r.data.messages[0].content, 'How to apply for outpass?');
  assert.ok(r.data.messages.every((m) => !('user_id' in m)));

  r = await ask(ctx.s1, 'How do I check my room number?'); // no id → new conversation
  assert.notEqual(r.data.conversation_id, ctx.conversation);
  r = await api('GET', '/chatbot/history', ctx.s1.token);
  assert.equal(r.data.conversations.length, 2);
  r = await api('GET', `/chatbot/history?conversation_id=${ctx.conversation}`, ctx.s1.token);
  assert.equal(r.data.messages[0].content, 'How to apply for outpass?');

  r = await api('DELETE', '/chatbot/history', ctx.s1.token);
  assert.equal(r.status, 200);
  r = await api('GET', '/chatbot/history', ctx.s1.token);
  assert.deepEqual(r.data.messages, []);
  assert.deepEqual(r.data.conversations, []);
  r = await api('GET', '/chatbot/history', ctx.s2.token);
  assert.ok(r.data.messages.length > 0, "clearing one student's history leaves others alone");
});

// ---------------------------------------------------------------------------
// Gate: Manual / Type Token (and the QR scan it shares its rules with)
// ---------------------------------------------------------------------------

test('gate token: verify shows the student and EXIT, approve records it, then RETURN', async () => {
  let r = await api('GET', `/outpasses/${ctx.outpass}/qr`, ctx.s1.token);
  assert.equal(r.status, 200);
  assert.match(r.data.gate_code, /^[A-Z0-9]{8}$/);
  ctx.code = r.data.gate_code;
  ctx.qr = r.data.qr_token;

  assert.equal((await api('POST', '/outpasses/token/verify', ctx.w.token, { token: ctx.code })).status, 403, 'wardens cannot use the gate');
  assert.equal((await api('POST', '/outpasses/token/verify', ctx.security, { token: 'AB-12' })).status, 400);
  assert.equal((await api('POST', '/outpasses/token/verify', ctx.security, { token: 'ZZZZ9999' })).status, 404);

  r = await api('POST', '/outpasses/token/verify', ctx.security, { token: ` ${ctx.code.toLowerCase()} ` });
  assert.equal(r.status, 200);
  assert.equal(r.data.action, 'EXIT');
  assert.equal(r.data.details.register_no, ctx.s1.roll);
  assert.equal(r.data.details.room_no, 'CB-101');
  assert.equal(r.data.details.destination, 'Town');
  assert.equal(r.data.details.current_status, 'Inside Hostel');
  assert.match(r.data.details.hostel_block, /Chat Hostel/);
  assert.ok(!('phone' in r.data.details) && !('email' in r.data.details), 'no contact details exposed');
  const { data: before } = await supabase.from('outpasses').select('status').eq('_id', ctx.outpass).single();
  assert.equal(before.status, 'Approved', 'verifying changes nothing');

  assert.equal((await api('POST', '/outpasses/token/confirm', ctx.security, { token: ctx.code, action: 'RETURN' })).status, 409, 'wrong action refused');
  r = await api('POST', '/outpasses/token/confirm', ctx.security, { token: ctx.code, action: 'EXIT' });
  assert.equal(r.status, 200);
  assert.equal(r.data.outpass.status, 'Checked Out');
  assert.ok(r.data.outpass.actual_exit_time);
  assert.equal(r.data.details.current_status, 'Outside Hostel');
  assert.equal((await api('POST', '/outpasses/token/confirm', ctx.security, { token: ctx.code, action: 'EXIT' })).status, 409, 'duplicate exit refused');

  r = await ask(ctx.s1, 'What is my outpass status?');
  assert.match(r.data.reply, /latest outpass is CHECKED OUT/);

  r = await api('POST', '/outpasses/token/verify', ctx.security, { token: ctx.code });
  assert.equal(r.data.action, 'RETURN');
  assert.equal(r.data.details.current_status, 'Outside Hostel');
  r = await api('POST', '/outpasses/token/confirm', ctx.security, { token: ctx.code, action: 'RETURN' });
  assert.equal(r.status, 200);
  assert.equal(r.data.outpass.status, 'Returned');
  assert.ok(r.data.outpass.actual_return_time);
  assert.equal(r.data.details.current_status, 'Inside Hostel');
  assert.equal((await api('POST', '/outpasses/token/verify', ctx.security, { token: ctx.code })).status, 404, 'token dies with the outpass');

  r = await api('GET', '/security/scan-history?page=1&method=TOKEN', ctx.security);
  const mine = r.data.items.filter((l) => l.student_id === ctx.s1.id);
  assert.ok(mine.some((l) => l.result === 'SUCCESS' && l.action === 'EXIT' && l.security_guard_id));
  assert.ok(mine.some((l) => l.result === 'SUCCESS' && l.action === 'RETURN'));
  assert.ok(mine.some((l) => l.result === 'FAILED'), 'failed attempts are logged too');
});

test('gate QR: scanning still records EXIT then RETURN, and shares the token rules', async () => {
  let r = await api('POST', '/outpasses', ctx.s2.token, { reason: 'qr test', destination: 'Market', leave_datetime: istLocal(0.05), return_datetime: istLocal(2), parent_consent: true });
  assert.equal(r.status, 201);
  const id = r.data._id;
  r = await api('PUT', `/outpasses/${id}/approve`, ctx.w.token);
  const qr = r.data.qr_token;
  const code = (await api('GET', `/outpasses/${id}/qr`, ctx.s2.token)).data.gate_code;

  r = await api('POST', '/outpasses/scan', ctx.security, { qr_token: qr });
  assert.equal(r.status, 200);
  assert.equal(r.data.action, 'EXIT');
  // Exit by QR, return by typed token: one outpass, one workflow.
  r = await api('POST', '/outpasses/token/verify', ctx.security, { token: code });
  assert.equal(r.data.action, 'RETURN');
  r = await api('POST', '/outpasses/scan', ctx.security, { qr_token: qr });
  assert.equal(r.status, 200);
  assert.equal(r.data.action, 'RETURN');
  assert.equal((await api('POST', '/outpasses/scan', ctx.security, { qr_token: qr })).status, 409, 'duplicate return refused');
  assert.equal((await api('POST', '/outpasses/token/confirm', ctx.security, { token: code, action: 'RETURN' })).status, 404);
});

test('gate token: repeated wrong tokens are rate limited', async () => {
  let last;
  for (let i = 0; i < 9; i++) last = await api('POST', '/outpasses/token/verify', ctx.security, { token: `WRONG${String(i).padStart(3, '0')}` });
  assert.equal(last.status, 429);
  assert.match(last.data.message, /Too many wrong tokens/);
});
