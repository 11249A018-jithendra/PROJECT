import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Flame, MessageSquare, AlertCircle, Inbox, Clock, BellRing, Megaphone, UserCheck, DoorClosed, Siren, KeyRound } from 'lucide-react';
import api from '../api/axios';
import { timeAgo } from '../utils/format';

const POLL_MS = 45 * 1000;

const TYPE_ICON = {
  COMPLAINT_ESCALATED: { icon: Flame, cls: 'bg-rose-50 text-rose-500' },
  COMPLAINT_NEW: { icon: AlertCircle, cls: 'bg-amber-50 text-amber-500' },
  COMPLAINT_UPDATED: { icon: MessageSquare, cls: 'bg-indigo-50 text-indigo-500' },
  COMPLAINT_REMINDER: { icon: BellRing, cls: 'bg-rose-50 text-rose-500' },
  OUTPASS_OVERDUE: { icon: Clock, cls: 'bg-red-50 text-red-500' },
  ANNOUNCEMENT: { icon: Megaphone, cls: 'bg-violet-50 text-violet-500' },
  VISITOR: { icon: UserCheck, cls: 'bg-emerald-50 text-emerald-600' },
  EXIT_REQUEST: { icon: DoorClosed, cls: 'bg-amber-50 text-amber-600' },
  EXIT_DECISION: { icon: DoorClosed, cls: 'bg-indigo-50 text-indigo-500' },
  SOS: { icon: Siren, cls: 'bg-red-100 text-red-600' },
  PASSWORD_RESET: { icon: KeyRound, cls: 'bg-amber-50 text-amber-600' },
};

const NotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setItems(res.data.notifications || []);
      setUnread(res.data.unread || 0);
    } catch {
      // Header widget: stay quiet on failure, the next poll retries.
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => wrapRef.current && !wrapRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = async (n) => {
    setOpen(false);
    if (!n.is_read) {
      setItems((prev) => prev.map((i) => (i._id === n._id ? { ...i, is_read: true } : i)));
      setUnread((u) => Math.max(0, u - 1));
      api.put(`/notifications/${n._id}/read`).catch(() => {});
    }
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, is_read: true })));
    setUnread(0);
    api.put('/notifications/read-all').catch(() => {});
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition flex items-center justify-center"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-slate-900">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute -left-44 lg:left-0 mt-2 w-[min(22rem,calc(100vw-2rem))] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="font-semibold text-slate-800 text-sm">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                <CheckCheck size={14} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
            {items.length === 0 ? (
              <div className="py-10 text-center">
                <Inbox size={26} className="mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">You're all caught up</p>
              </div>
            ) : (
              items.map((n) => {
                const { icon: Icon, cls } = TYPE_ICON[n.type] || { icon: Bell, cls: 'bg-slate-50 text-slate-500' };
                return (
                  <button
                    key={n._id}
                    onClick={() => openItem(n)}
                    className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-slate-50 transition ${n.is_read ? '' : 'bg-indigo-50/40'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cls}`}>
                      <Icon size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${n.is_read ? 'text-slate-600' : 'text-slate-900 font-semibold'}`}>{n.title}</p>
                      {n.message && <p className="text-xs text-slate-500 line-clamp-2">{n.message}</p>}
                      <p className="text-[11px] text-slate-500 mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
