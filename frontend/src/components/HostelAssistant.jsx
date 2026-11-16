import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { MessageCircle, X, Minus, Send, Bot, History, Plus, Trash2, ChevronUp } from 'lucide-react';

// Floating Hostel Assistant chat for students (bottom-right of every student
// page). All answers come from the backend (/api/chatbot/*): it reads the
// signed-in student's own records and never trusts anything typed here.

const DEFAULT_WELCOME = "Hello! Welcome to the Hostel Management System. I'm your Hostel Assistant. How can I help you today?";
const MAX_LENGTH = 500;

const timeOf = (value) => new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const dayOf = (value) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const HostelAssistant = () => {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef(null);
  const reopenFocus = useRef(false);
  const [minimized, setMinimized] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [welcome, setWelcome] = useState(DEFAULT_WELCOME);
  const [suggested, setSuggested] = useState([]);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [openedAt] = useState(() => new Date().toISOString());
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const loadHistory = async (id) => {
    const res = await api.get('/chatbot/history', { params: id ? { conversation_id: id } : undefined });
    setConversations(res.data.conversations || []);
    setConversationId(res.data.conversation_id);
    setMessages(res.data.messages || []);
  };

  // First open: welcome text, suggested questions and the latest conversation.
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;
    (async () => {
      try {
        const faqs = await api.get('/chatbot/faqs');
        if (cancelled) return;
        setWelcome(faqs.data.welcome || DEFAULT_WELCOME);
        setSuggested(faqs.data.suggested || []);
        await loadHistory();
      } catch {
        if (!cancelled) setError('Could not load your earlier chats. You can still ask a question.');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [open, loaded]);

  useEffect(() => {
    if (open && !minimized) endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, sending, open, minimized, error]);

  useEffect(() => {
    if (open && !minimized) inputRef.current?.focus();
  }, [open, minimized]);

  const send = async (raw) => {
    const message = String(raw ?? text).replace(/\s+/g, ' ').trim();
    if (!message || sending) return;
    setError('');
    setShowHistory(false);
    setText('');
    setMessages((prev) => [...prev, { _id: `local-${Date.now()}`, role: 'user', content: message, created_at: new Date().toISOString() }]);
    setSending(true);
    try {
      const res = await api.post('/chatbot/message', { message, conversation_id: conversationId || undefined });
      setConversationId(res.data.conversation_id);
      setMessages((prev) => [...prev, { _id: `reply-${Date.now()}`, role: 'assistant', content: res.data.reply, created_at: res.data.created_at }]);
    } catch (err) {
      setError(err.response?.data?.message || 'The assistant could not reply. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const newConversation = () => {
    setConversationId(null);
    setMessages([]);
    setError('');
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const openHistory = async () => {
    if (showHistory) return setShowHistory(false);
    try {
      const res = await api.get('/chatbot/history', { params: conversationId ? { conversation_id: conversationId } : undefined });
      setConversations(res.data.conversations || []);
    } catch { /* keep the list we have */ }
    setShowHistory(true);
  };

  const pickConversation = async (id) => {
    setShowHistory(false);
    setError('');
    try {
      await loadHistory(id);
    } catch {
      setError('Could not open that conversation.');
    }
  };

  const clearHistory = async () => {
    setConfirmClear(false);
    try {
      await api.delete('/chatbot/history');
      setConversations([]);
      newConversation();
    } catch {
      setError('Could not clear your chat history. Please try again.');
    }
  };

  const closeChat = () => {
    setOpen(false);
    setShowHistory(false);
    reopenFocus.current = true;
  };

  if (!open) {
    return (
      <button
        type="button"
        ref={(el) => {
          launcherRef.current = el;
          if (el && reopenFocus.current) { reopenFocus.current = false; el.focus(); }
        }}
        onClick={() => { setOpen(true); setMinimized(false); }}
        aria-label="Open Hostel Assistant chat"
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-300 flex items-center justify-center transition focus:outline-none focus:ring-4 focus:ring-indigo-200"
      >
        <MessageCircle size={26} />
      </button>
    );
  }

  const iconBtn = 'p-1.5 rounded-lg text-indigo-100 hover:text-white hover:bg-white/15 transition focus:outline-none focus:ring-2 focus:ring-white/60';

  return (
    <section
      aria-label="Hostel Assistant chat"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); if (confirmClear) setConfirmClear(false); else closeChat(); } }}
      className={`fixed z-[60] bottom-3 right-3 left-3 sm:left-auto sm:bottom-5 sm:right-5 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden ${
        minimized ? '' : 'h-[min(600px,calc(100dvh-1.5rem))]'
      }`}
    >
      {/* Header */}
      <header className="bg-indigo-600 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Bot size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm leading-tight">Hostel Assistant</h2>
          <p className="text-xs text-indigo-100 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Online
          </p>
        </div>
        {!minimized && (
          <>
            <button type="button" onClick={newConversation} className={iconBtn} aria-label="Start a new conversation" title="New conversation"><Plus size={17} /></button>
            <button type="button" onClick={openHistory} className={iconBtn} aria-label="Previous conversations" aria-expanded={showHistory} title="Previous conversations"><History size={17} /></button>
          </>
        )}
        <button type="button" onClick={() => { setMinimized((m) => !m); setShowHistory(false); }} className={iconBtn} aria-label={minimized ? 'Expand chat' : 'Minimize chat'} title={minimized ? 'Expand' : 'Minimize'}>
          {minimized ? <ChevronUp size={17} /> : <Minus size={17} />}
        </button>
        <button type="button" onClick={closeChat} className={iconBtn} aria-label="Close chat" title="Close"><X size={17} /></button>
      </header>

      {!minimized && (
        <>
          {/* Previous conversations */}
          {showHistory && (
            <div className="border-b border-slate-200 bg-slate-50 max-h-56 overflow-y-auto flex-shrink-0">
              {conversations.length === 0 ? (
                <p className="text-sm text-slate-500 p-4 text-center">No saved conversations yet.</p>
              ) : (
                <ul>
                  {conversations.map((c) => (
                    <li key={c.conversation_id}>
                      <button
                        type="button"
                        onClick={() => pickConversation(c.conversation_id)}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 transition flex items-center justify-between gap-3 ${c.conversation_id === conversationId ? 'bg-indigo-50' : ''}`}
                      >
                        <span className="truncate text-slate-700">{c.preview || 'Conversation'}</span>
                        <span className="text-xs text-slate-500 flex-shrink-0">{dayOf(c.last_message_at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {conversations.length > 0 && (
                <div className="p-2 border-t border-slate-200">
                  {confirmClear ? (
                    <div className="flex items-center justify-between gap-2 px-2 py-1">
                      <span className="text-xs text-slate-600">Delete all your chats?</span>
                      <span className="flex gap-2">
                        <button type="button" onClick={() => setConfirmClear(false)} className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-white">Cancel</button>
                        <button type="button" onClick={clearHistory} className="text-xs px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium">Delete</button>
                      </span>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmClear(true)} className="w-full flex items-center justify-center gap-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg py-1.5 transition">
                      <Trash2 size={13} /> Clear chat history
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50" aria-live="polite">
            <Bubble role="assistant" content={welcome} time={messages[0]?.created_at || openedAt} />
            {messages.map((m) => (
              <Bubble key={m._id} role={m.role} content={m.content} time={m.created_at} />
            ))}
            {sending && (
              <div className="flex items-center gap-2" role="status" aria-label="Hostel Assistant is typing">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            {error && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{error}</p>}
            {messages.length === 0 && !sending && suggested.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {suggested.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="text-xs text-indigo-700 bg-white border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 rounded-full px-3 py-1.5 transition"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(); }}
            className="border-t border-slate-200 p-3 flex items-center gap-2 bg-white flex-shrink-0"
          >
            <label htmlFor="assistant-message" className="sr-only">Message to Hostel Assistant</label>
            <input
              id="assistant-message"
              ref={inputRef}
              type="text"
              value={text}
              maxLength={MAX_LENGTH}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your question…"
              autoComplete="off"
              className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              aria-label="Send message"
              className="w-10 h-10 flex-shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center justify-center transition"
            >
              <Send size={17} />
            </button>
          </form>
        </>
      )}
    </section>
  );
};

const Bubble = ({ role, content, time }) => {
  const mine = role === 'user';
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words rounded-2xl ${
          mine ? 'bg-indigo-600 text-white rounded-br-md' : 'bg-white text-slate-700 border border-slate-200 rounded-bl-md'
        }`}
      >
        {content}
      </div>
      {time && <span className="text-[11px] text-slate-500 mt-1 px-1">{timeOf(time)}</span>}
    </div>
  );
};

export default HostelAssistant;
