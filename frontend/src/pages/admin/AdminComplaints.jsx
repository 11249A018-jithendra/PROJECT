import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import Pager from '../../components/Pager';
import api, { API_ROOT_URL } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import {
  AlertCircle, Filter, ImageIcon, Search, Flame, Timer, CheckCircle2, Inbox, Check, UserCog, Ban, Wrench, Star, RotateCcw,
} from 'lucide-react';
import { Avatar, EscalationTag } from '../../components/ui/ActivityRows';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';
import { formatDate, formatDateTime, timeAgo } from '../../utils/format';
import { toast } from '../../components/ui/Toast';

const categories = ['All', 'electrical', 'plumbing', 'cleanliness', 'food/mess', 'internet', 'other'];

const VIEWS = [
  { key: 'all', label: 'All', icon: Inbox },
  { key: 'escalated', label: 'Escalated', icon: Flame },
  { key: 'awaiting', label: 'Awaiting response', icon: Timer },
  { key: 'in-progress', label: 'In progress', icon: AlertCircle },
  { key: 'resolved', label: 'Resolved', icon: CheckCircle2 },
  { key: 'cancelled', label: 'Cancelled', icon: Ban },
];

const isOpenEscalation = (c) => c.escalated && ['Pending', 'In Progress'].includes(c.status);
const isOpen = (c) => ['Pending', 'In Progress'].includes(c.status);

const AdminComplaints = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const view = VIEWS.find((v) => v.key === searchParams.get('view'))?.key || 'all';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterCat, setFilterCat] = useState('All');
  const [search, setSearch] = useState('');
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ status: '', admin_remarks: '' });
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const fetchComplaints = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '20', view });
    if (filterCat !== 'All') params.set('category', filterCat);
    if (search.trim()) params.set('search', search.trim());
    try {
      const res = await api.get(`/complaints?${params}`);
      setData(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, view, filterCat, search]);

  useEffect(() => {
    const id = setTimeout(fetchComplaints, 250);
    return () => clearTimeout(id);
  }, [fetchComplaints]);

  useEffect(() => {
    api.get('/staff?active=true').then((r) => setStaff(r.data)).catch(() => {});
  }, []);

  const setView = (key) => { setPage(1); setSearchParams(key === 'all' ? {} : { view: key }, { replace: true }); };

  const handleSelect = (c) => {
    setSelected(c);
    setUpdateError('');
    setForm({ status: c.status, admin_remarks: c.admin_remarks || '' });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setUpdateError('');
    try {
      await api.put(`/complaints/${selected._id}`, form);
      setSelected(null);
      fetchComplaints();
    } catch (err) {
      setUpdateError(err.response?.data?.message || 'Could not save changes.');
    } finally { setUpdating(false); }
  };

  const quickResolve = async (c) => {
    setBusyId(c._id);
    try {
      await api.put(`/complaints/${c._id}`, { status: 'Resolved', admin_remarks: c.admin_remarks || '' });
      fetchComplaints();
    } catch (err) { toast.error(err.response?.data?.message || 'Could not resolve.'); }
    finally { setBusyId(null); }
  };

  const assign = async (c, staffId) => {
    setBusyId(c._id);
    try {
      await api.put(`/complaints/${c._id}/assign`, { staff_id: staffId || null });
      fetchComplaints();
    } catch (err) { toast.error(err.response?.data?.message || 'Could not assign.'); }
    finally { setBusyId(null); }
  };

  const items = data?.items || [];
  const counts = data?.counts || {};
  const summary = [
    { label: 'Total', value: counts.all, cls: 'text-slate-800' },
    { label: 'Awaiting response', value: counts.awaiting, cls: 'text-amber-600' },
    { label: 'Escalated', value: counts.escalated, cls: 'text-rose-600' },
    { label: 'Resolved', value: counts.resolved, cls: 'text-emerald-600' },
  ];

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">{isAdmin ? 'Complaint Management' : 'Student Complaints'}</h1>
        <p className="text-slate-500 mt-1">
          {isAdmin
            ? 'Assign, resolve and handle complaints escalated from wardens'
            : 'Respond within 24 hours — unanswered complaints are escalated to the Admin'}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {summary.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <p className={`text-2xl font-bold tabular-nums ${s.cls}`}>{loading ? '—' : (s.value ?? 0)}</p>
            <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {VIEWS.map(({ key, label, icon: Icon }) => {
          const count = counts[key] ?? 0;
          const active = view === key;
          const danger = key === 'escalated' && count > 0;
          return (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition
                ${active ? (danger ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25' : 'bg-slate-900 text-white shadow') : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'}`}
            >
              <Icon size={14} /> {label}
              <span className={`tabular-nums text-xs ${active ? 'opacity-80' : danger ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1 min-w-[200px] focus-within:ring-2 focus-within:ring-indigo-500">
          <Search size={14} className="text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search student, room or text…" aria-label="Search complaints" className="text-sm text-slate-700 bg-transparent focus:outline-none w-full" />
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
          <Filter size={14} className="text-slate-400" />
          <select id="filter-category" value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setPage(1); }} aria-label="Filter by category" className="text-sm text-slate-700 bg-transparent focus:outline-none capitalize">
            {categories.map((c) => <option key={c} className="capitalize">{c}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? <SkeletonRows rows={5} /> : items.length === 0 ? (
          <EmptyState
            icon={view === 'escalated' ? CheckCircle2 : AlertCircle}
            title={view === 'escalated' ? 'No escalated complaints' : 'No complaints match the current filter'}
            message={view === 'escalated' ? 'Every complaint received a warden response in time.' : undefined}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((c) => (
              <div key={c._id} className={`flex flex-col lg:flex-row lg:items-start gap-3 lg:gap-4 p-4 sm:px-5 transition hover:bg-slate-50/80 ${isOpenEscalation(c) ? 'bg-rose-50/40 border-l-4 border-l-rose-400' : ''}`}>
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Avatar name={c.student?.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm text-slate-800">{c.student?.name || 'Student'}</span>
                      <span className="text-xs text-slate-400">Room {c.student?.room_no || '—'}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{c.category}</span>
                      {c.reopened_count > 0 && <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded flex items-center gap-1"><RotateCcw size={10} /> Reopened ×{c.reopened_count}</span>}
                      {c.photo && (
                        <a href={`${API_ROOT_URL}/${c.photo}`} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:text-indigo-600 flex items-center gap-1"><ImageIcon size={12} /> Photo</a>
                      )}
                    </div>
                    {c.title && c.title !== c.category && <p className="text-sm font-medium text-slate-700">{c.title}</p>}
                    <p className="text-sm text-slate-600 line-clamp-2 whitespace-pre-line">{c.description}</p>
                    <p className="text-xs text-slate-400 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>Filed {formatDate(c.created_at, { day: 'numeric', month: 'short' })} · {timeAgo(c.created_at)}</span>
                      {isAdmin && <span className="inline-flex items-center gap-1"><UserCog size={12} /> {c.warden_name || 'No warden assigned'}</span>}
                      {c.escalated && c.escalated_at && <span className="text-rose-500 font-medium">Escalated {timeAgo(c.escalated_at)}{c.admin_reminder_count ? ` · ${c.admin_reminder_count} reminder(s)` : ''}</span>}
                      {c.status === 'Cancelled' && <span>Cancelled {timeAgo(c.cancelled_at)}{c.cancel_reason ? `: "${c.cancel_reason}"` : ''}</span>}
                    </p>
                    {c.rating && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={12} className={n <= c.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />)}
                        {c.feedback && <span className="ml-1">"{c.feedback}"</span>}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2 flex-shrink-0 pl-12 lg:pl-0">
                  <div className="flex items-center gap-1.5 flex-wrap lg:justify-end">
                    <StatusBadge status={c.status} />
                    <EscalationTag complaint={c} />
                  </div>
                  {isOpen(c) ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <label className="flex items-center gap-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1" title="Assign maintenance staff">
                        <Wrench size={12} className="text-slate-400" />
                        <select
                          value={c.assigned_staff_id || ''}
                          disabled={busyId === c._id}
                          onChange={(e) => assign(c, e.target.value)}
                          aria-label="Assign staff"
                          className="bg-transparent focus:outline-none max-w-[10rem]"
                        >
                          <option value="">Assign staff…</option>
                          {staff.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.trade}) · {s.open_jobs} open</option>)}
                        </select>
                      </label>
                      <button onClick={() => quickResolve(c)} disabled={busyId === c._id} className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2.5 py-1 transition inline-flex items-center gap-1 disabled:opacity-60">
                        <Check size={12} /> Resolve
                      </button>
                      <button onClick={() => handleSelect(c)} className="text-xs font-medium text-indigo-600 hover:text-indigo-500 border border-indigo-200 hover:border-indigo-400 rounded-lg px-2.5 py-1 transition">Update</button>
                    </div>
                  ) : (
                    c.staff && <span className="text-xs text-slate-500 flex items-center gap-1"><Wrench size={12} /> {c.staff.name}</span>
                  )}
                  {isOpen(c) && c.staff && <span className="text-[11px] text-slate-400">Assigned {timeAgo(c.assigned_at)}{c.staff.phone ? ` · ${c.staff.phone}` : ''}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {data && <Pager page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="complaints" />}
      </div>

      {selected && (
        <Modal title="Update Complaint" onClose={() => setSelected(null)}>
          {isOpenEscalation(selected) && (
            <div className="flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl p-3 mb-3">
              <Flame size={16} /> Escalated {formatDateTime(selected.escalated_at)} — no warden response in 24h.
            </div>
          )}
          <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3 mb-4 whitespace-pre-line">{selected.description}</p>
          {selected.photo && (
            <a href={`${API_ROOT_URL}/${selected.photo}`} target="_blank" rel="noreferrer" className="block mb-4">
              <img src={`${API_ROOT_URL}/${selected.photo}`} alt="Complaint attachment" className="w-full max-h-56 object-cover rounded-xl border border-slate-200" />
            </a>
          )}
          <form onSubmit={handleUpdate} className="space-y-4">
            {updateError && <div className="bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-3">{updateError}</div>}
            <div>
              <label htmlFor="update-status" className="block text-sm font-medium text-slate-600 mb-1.5">Status</label>
              <select id="update-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option>Pending</option>
                <option>In Progress</option>
                <option>Resolved</option>
              </select>
            </div>
            <div>
              <label htmlFor="update-remarks" className="block text-sm font-medium text-slate-600 mb-1.5">Remarks for the student</label>
              <textarea id="update-remarks" rows={3} maxLength={1000} value={form.admin_remarks} onChange={(e) => setForm({ ...form, admin_remarks: e.target.value })} placeholder="Add a remark or update for the student..." className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setSelected(null)} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
              <button id="update-complaint-submit" type="submit" disabled={updating} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition">
                {updating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
};

export default AdminComplaints;
