const crypto = require('crypto');
const supabase = require('../supabase');
const ai = require('../utils/chatAi');
const faq = require('../utils/chatFaq');
const { WELCOME, SUGGESTED, FAQS } = require('../utils/chatKnowledge');

// Hostel Assistant chatbot. Every route is for a signed-in student and only
// ever reads or writes that student's own rows (req.user._id from the token —
// never an id from the request body or the chat text).

const MAX_MESSAGE = 500;
const CONTEXT_TURNS = 10;       // earlier messages sent to the AI for context
const HISTORY_ROWS = 400;       // most recent stored messages loaded per student
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---- rate limit: 15 messages a minute per student (in memory) -------------
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 15;
const sent = new Map(); // student id -> timestamps
const rateLimited = (studentId) => {
  const now = Date.now();
  const recent = (sent.get(studentId) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    sent.set(studentId, recent);
    return Math.ceil((WINDOW_MS - (now - recent[0])) / 1000);
  }
  recent.push(now);
  sent.set(studentId, recent);
  if (sent.size > 5000) for (const [k, v] of sent) if (!v.some((t) => now - t < WINDOW_MS)) sent.delete(k);
  return 0;
};

// Conversations are stored in the existing chatbot_messages table (user_id,
// sender, message) plus conversation_id/source from the chatbot conversations
// migration. Until that has run, the assistant still answers — it just can't
// remember conversations.
const TABLE = 'chatbot_messages';
const isMissingTable = (error) => error && /(chatbot_messages|conversation_id|source)/.test(error.message || '') && /(schema cache|does not exist)/.test(error.message || '');

const loadRows = async (studentId) => {
  const { data, error } = await supabase
    .from(TABLE)
    .select('_id, conversation_id, role:sender, content:message, source, created_at')
    .eq('user_id', studentId)
    .in('sender', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(HISTORY_ROWS);
  if (error) {
    if (isMissingTable(error)) return { rows: [], available: false };
    throw error;
  }
  return { rows: (data || []).reverse(), available: true };
};

const publicMessage = (m) => ({ _id: m._id, role: m.role, content: m.content, source: m.source || null, created_at: m.created_at });

// @desc    Send a message, get the assistant's reply
// @route   POST /api/chatbot/message   body: { message, conversation_id? }
// @access  Private (student)
const sendMessage = async (req, res) => {
  try {
    const studentId = req.user._id;
    if (typeof req.body.message !== 'string') return res.status(400).json({ message: 'Type a message first.' });
    const message = req.body.message.replace(/\s+/g, ' ').trim();
    if (!message) return res.status(400).json({ message: 'Type a message first.' });
    if (message.length > MAX_MESSAGE) return res.status(400).json({ message: `Messages can be at most ${MAX_MESSAGE} characters.` });

    let conversationId = req.body.conversation_id;
    if (conversationId !== undefined && conversationId !== null && !UUID_RE.test(String(conversationId))) {
      return res.status(400).json({ message: 'Invalid conversation.' });
    }

    const wait = rateLimited(studentId);
    if (wait) return res.status(429).json({ message: `You're sending messages too quickly. Please wait ${wait} seconds.` });

    // Earlier turns of THIS student's conversation only. A conversation id
    // that isn't theirs simply has no rows, so it starts a fresh one.
    const { rows, available } = await loadRows(studentId);
    const history = conversationId ? rows.filter((r) => r.conversation_id === conversationId) : [];
    if (!history.length) conversationId = crypto.randomUUID();

    let reply;
    let source = 'faq';
    if (ai.isConfigured()) {
      try {
        reply = await ai.reply({ message, history: history.slice(-CONTEXT_TURNS), studentId });
        source = 'ai';
      } catch (err) {
        // AI unavailable (network, quota, bad key…): answer from the built-in FAQ instead.
        console.error('[chatbot] AI request failed, using FAQ fallback:', err.status || '', err.message);
      }
    }
    if (!reply) reply = await faq.answer(message, studentId);

    const now = Date.now();
    const userRow = { user_id: studentId, conversation_id: conversationId, sender: 'user', message, created_at: new Date(now).toISOString() };
    const botRow = { user_id: studentId, conversation_id: conversationId, sender: 'assistant', message: reply, source, created_at: new Date(now + 1).toISOString() };
    let saved = false;
    if (available) {
      const { error } = await supabase.from(TABLE).insert([userRow, botRow]);
      if (error) console.error('[chatbot] could not save the conversation:', error.message);
      else saved = true;
    }

    res.json({ conversation_id: conversationId, reply, source, created_at: botRow.created_at, saved });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    The student's conversations, and the messages of one of them
//          (the newest, unless ?conversation_id= picks another)
// @route   GET /api/chatbot/history?conversation_id=
// @access  Private (student)
const getHistory = async (req, res) => {
  try {
    const wanted = req.query.conversation_id;
    if (wanted !== undefined && !UUID_RE.test(String(wanted))) return res.status(400).json({ message: 'Invalid conversation.' });

    const { rows, available } = await loadRows(req.user._id);
    const byConversation = new Map();
    for (const r of rows) {
      if (!byConversation.has(r.conversation_id)) byConversation.set(r.conversation_id, []);
      byConversation.get(r.conversation_id).push(r);
    }
    const conversations = [...byConversation.entries()]
      .map(([id, list]) => ({
        conversation_id: id,
        started_at: list[0].created_at,
        last_message_at: list[list.length - 1].created_at,
        preview: (list.find((m) => m.role === 'user')?.content || '').slice(0, 60),
        messages: list.length,
      }))
      .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

    const current = wanted && byConversation.has(wanted) ? wanted : conversations[0]?.conversation_id || null;
    res.json({
      available,
      conversations,
      conversation_id: current,
      messages: current ? byConversation.get(current).map(publicMessage) : [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Clear the student's chat history (all of it, or one conversation)
// @route   DELETE /api/chatbot/history?conversation_id=
// @access  Private (student)
const clearHistory = async (req, res) => {
  try {
    const wanted = req.query.conversation_id;
    if (wanted !== undefined && !UUID_RE.test(String(wanted))) return res.status(400).json({ message: 'Invalid conversation.' });
    let q = supabase.from(TABLE).delete().eq('user_id', req.user._id);
    if (wanted) q = q.eq('conversation_id', wanted);
    const { data, error } = await q.select('_id');
    if (error && !isMissingTable(error)) throw error;
    res.json({ message: 'Chat history cleared.', deleted: data?.length || 0 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Welcome text, suggested questions and the FAQ list
// @route   GET /api/chatbot/faqs
// @access  Private (student)
const getFaqs = (req, res) => {
  res.json({ welcome: WELCOME, suggested: SUGGESTED, faqs: FAQS, ai_enabled: ai.isConfigured() });
};

module.exports = { sendMessage, getHistory, clearHistory, getFaqs };
