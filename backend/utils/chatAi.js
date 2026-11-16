const data = require('./chatStudentData');
const { SYSTEM_PROMPT, NOT_FOUND } = require('./chatKnowledge');

// AI replies for the Hostel Assistant, using the Claude API (Anthropic SDK).
// The key lives only in the backend's environment (ANTHROPIC_API_KEY) and is
// never sent to the browser. With no key, isConfigured() is false and the
// controller answers from the built-in FAQ instead.

const MODEL = process.env.CHATBOT_MODEL || 'claude-opus-5-5';
const MAX_TOOL_ROUNDS = 4;

let client = null;
const getClient = () => {
  if (!client) {
    const sdk = require('@anthropic-ai/sdk');
    const Anthropic = sdk.default || sdk.Anthropic || sdk;
    // 30 s per attempt, one retry: a chat window can't wait minutes.
    client = new Anthropic({ timeout: 30_000, maxRetries: 1 });
  }
  return client;
};

const isConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

// Tools take NO arguments: whose records to read is decided by the server
// from the login token, so nothing the student (or the model) writes can
// point a lookup at another student.
const noInput = { type: 'object', properties: {}, required: [], additionalProperties: false };
const tool = (name, description) => ({ name, description, input_schema: noInput, strict: true });

const TOOLS = [
  tool('get_my_room', "The signed-in student's room number, hostel, floor, room size and warden's name. Call for any question about their room or hostel block."),
  tool('get_my_attendance', "The signed-in student's attendance: today's status, this month's and overall present/absent counts and percentages. Call for any attendance question about them."),
  tool('get_my_outpasses', "The signed-in student's outpasses: the latest one with its status, times and rejection reason, the three most recent, and a count per status. Call for any question about their outpass status, return or overdue state."),
  tool('get_my_complaints', "The signed-in student's complaints: counts per status and the five most recent with status and staff remark. Call for any question about their complaints."),
  tool('get_my_warden_contact', "Name and phone number of the signed-in student's own warden. Call when they ask how to contact or who their warden is."),
  tool('get_announcements', 'Current hostel announcements visible to the signed-in student (latest five). Call when they ask what the latest notices are.'),
  tool('get_todays_mess_menu', "Today's mess menu. Call for questions about today's food."),
];

const RUNNERS = {
  get_my_room: (id) => data.getRoom(id),
  get_my_attendance: (id) => data.getAttendance(id),
  get_my_outpasses: (id) => data.getOutpasses(id),
  get_my_complaints: (id) => data.getComplaints(id),
  get_my_warden_contact: (id) => data.getWardenContact(id),
  get_announcements: (id) => data.getAnnouncements(id),
  get_todays_mess_menu: () => data.getMessMenu(),
};

const runTool = async (name, studentId) => {
  const run = RUNNERS[name];
  if (!run) return { content: 'Unknown tool.', is_error: true };
  try {
    return { content: JSON.stringify(await run(studentId)) };
  } catch (err) {
    console.error(`[chatbot] tool ${name} failed:`, err.message);
    return { content: 'This information could not be loaded right now.', is_error: true };
  }
};

// history: earlier turns of this conversation as [{ role, content }] (text only).
// Returns the reply text. Throws on API failure — the caller falls back to the FAQ.
const reply = async ({ message, history = [], studentId, api = getClient() }) => {
  const messages = [...history.map((h) => ({ role: h.role, content: h.content })), { role: 'user', content: message }];

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const response = await api.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // The instructions never change, so they are cached between requests.
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      // Short answers to simple questions: low effort keeps replies quick.
      output_config: { effort: 'low' },
      // If a safety check declines a request, let the API retry on its default fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === 'refusal') return NOT_FOUND;

    const toolUses = response.content.filter((b) => b.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || !toolUses.length) {
      const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      return text || NOT_FOUND;
    }

    // Keep the assistant turn exactly as returned, then answer every tool call in one message.
    messages.push({ role: 'assistant', content: response.content });
    const results = await Promise.all(
      toolUses.map(async (t) => ({ type: 'tool_result', tool_use_id: t.id, ...(await runTool(t.name, studentId)) }))
    );
    messages.push({ role: 'user', content: results });
  }
  return NOT_FOUND;
};

module.exports = { isConfigured, reply, MODEL, TOOLS };
