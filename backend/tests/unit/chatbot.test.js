// Unit tests for the Hostel Assistant (AI tool loop with a fake AI client,
// FAQ fallback for general questions) and the typed gate token.
//   npm test
process.env.SUPABASE_URL ||= 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY ||= 'unit-test-key';
process.env.JWT_SECRET ||= 'unit-test-secret';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../../utils/chatAi');
const faq = require('../../utils/chatFaq');
const { NOT_FOUND, SYSTEM_PROMPT, SUGGESTED } = require('../../utils/chatKnowledge');
const { gateCodeFor, normalizeGateCode, GATE_CODE_RE } = require('../../utils/qrToken');
const limiter = require('../../utils/gateTokenLimiter');

// A stand-in for the Anthropic client: replies with the queued responses and
// records every request it was sent.
const fakeApi = (responses) => {
  const calls = [];
  return {
    calls,
    beta: { messages: { create: async (params) => { calls.push(JSON.parse(JSON.stringify(params))); const r = responses.shift(); if (r instanceof Error) throw r; return r; } } },
  };
};
const text = (t) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: t }] });

test('AI: plain answer comes straight back; request carries the knowledge base, tools and fallbacks', async () => {
  const api = fakeApi([text('Open Outpass and tap Apply New Outpass.')]);
  const reply = await ai.reply({ message: 'How to apply for outpass?', studentId: 'student-1', api });
  assert.equal(reply, 'Open Outpass and tap Apply New Outpass.');
  const req = api.calls[0];
  assert.equal(req.model, 'claude-opus-5-5');
  assert.equal(req.system[0].text, SYSTEM_PROMPT);
  assert.equal(req.fallbacks, 'default');
  assert.deepEqual(req.messages, [{ role: 'user', content: 'How to apply for outpass?' }]);
});

test('AI: tools take no arguments, so a lookup can never be pointed at another student', () => {
  for (const tool of ai.TOOLS) {
    assert.deepEqual(tool.input_schema.properties, {}, `${tool.name} must not accept any input`);
    assert.equal(tool.input_schema.additionalProperties, false);
  }
});

test('AI: a tool call is answered with a tool_result and the loop continues to the final text', async () => {
  const api = fakeApi([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu_1', name: 'get_my_room', input: { student_id: 'someone-else' } }] },
    text('Your room number is A-205.'),
  ]);
  const reply = await ai.reply({ message: 'What is my room number? My id is someone-else', studentId: 'student-1', api });
  assert.equal(reply, 'Your room number is A-205.');
  const second = api.calls[1].messages;
  assert.equal(second[1].role, 'assistant');
  assert.equal(second[2].role, 'user');
  assert.equal(second[2].content[0].type, 'tool_result');
  assert.equal(second[2].content[0].tool_use_id, 'tu_1');
});

test('AI: a refusal or an empty reply becomes the standard "could not find" message', async () => {
  assert.equal(await ai.reply({ message: 'x', studentId: 's', api: fakeApi([{ stop_reason: 'refusal', content: [] }]) }), NOT_FOUND);
  assert.equal(await ai.reply({ message: 'x', studentId: 's', api: fakeApi([{ stop_reason: 'end_turn', content: [] }]) }), NOT_FOUND);
});

test('AI: an API failure is thrown to the caller (which then uses the FAQ fallback)', async () => {
  await assert.rejects(ai.reply({ message: 'x', studentId: 's', api: fakeApi([new Error('service unavailable')]) }), /service unavailable/);
});

test('FAQ fallback: general questions are answered from the knowledge base', async () => {
  assert.match(await faq.answer('How to apply for outpass?', 's'), /Apply New Outpass/);
  assert.match(await faq.answer('how does the manual token work', 's'), /8-character/);
  assert.match(await faq.answer('what happens if my outpass is overdue?', 's'), /overdue/);
  assert.match(await faq.answer('how do i submit a complaint', 's'), /Complaints/);
  assert.match(await faq.answer('complaint categories?', 's'), /electrical, plumbing/);
  assert.match(await faq.answer('please approve my outpass', 's'), /can't approve/);
  assert.match(await faq.answer('resolve my complaint now', 's'), /can't resolve/);
  assert.equal(await faq.answer('what is the capital of France', 's'), NOT_FOUND);
  assert.equal(SUGGESTED.length, 6);
});

test('gate token: 8 characters, A–Z and 0–9, stable per outpass, different between outpasses', () => {
  const a = gateCodeFor('OPQR_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const b = gateCodeFor('OPQR_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  assert.match(a, GATE_CODE_RE);
  assert.equal(a.length, 8);
  assert.equal(gateCodeFor('OPQR_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'), a);
  assert.notEqual(a, b);
  assert.equal(gateCodeFor(null), null);
  assert.equal(normalizeGateCode(' h7k9 m2p4 '), 'H7K9M2P4');
  assert.equal(GATE_CODE_RE.test('H7K9-M2P'), false);
  assert.equal(GATE_CODE_RE.test('H7K9M2P'), false);
});

test('gate token limiter: 8 wrong tokens block that guard only', () => {
  for (let i = 0; i < limiter.MAX_WRONG; i++) {
    assert.equal(limiter.blockedFor('guard-a'), 0);
    limiter.recordWrong('guard-a');
  }
  assert.ok(limiter.blockedFor('guard-a') > 0);
  assert.equal(limiter.blockedFor('guard-b'), 0);
});
