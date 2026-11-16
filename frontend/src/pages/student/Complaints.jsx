import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import api, { API_ROOT_URL } from '../../api/axios';
import { Plus, AlertCircle, Send, MessageSquare, Flame, CheckCircle2, Clock, ImageIcon, Ban, RotateCcw, Star, Wrench } from 'lucide-react';
import Modal from '../../components/Modal';
import { EscalationTag } from '../../components/ui/ActivityRows';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';
import { formatDate, formatDateTime } from '../../utils/format';

const categories = ['electrical', 'plumbing', 'cleanliness', 'food/mess', 'internet', 'other'];
const FILTERS = ['All', 'Pending', 'In Progress', 'Resolved', 'Cancelled'];
const REOPEN_WINDOW_DAYS = 7;
const MAX_REOPENS = 3;

const canReopen = (c) =>
  c.status === 'Resolved' &&
  (c.reopened_count || 0) < MAX_REOPENS &&
  Date.now() - new Date(c.resolved_at || c.updated_at).getTime() < REOPEN_WINDOW_DAYS * 86400000;

// Progress steps derived from the complaint's tracking timestamps.
const buildTimeline = (c) => {
  const steps = [{ key: 'submitted', label: 'Submitted', at: c.created_at, done: true, icon: Send }];
  if (c.status === 'Cancelled') {
    steps.push({ key: 'cancelled', label: 'Cancelled by you', at: c.cancelled_at, done: true, icon: Ban, danger: true });
    return steps;
  }
  const responded = Boolean(c.first_response_at) || c.status !== 'Pending';
  steps.push({ key: 'responded', label: 'Staff responded', at: c.first_response_at, done: responded, icon: MessageSquare });
  if (c.escalated) {
    steps.push({ key: 'escalated', label: 'Escalated to Admin', at: c.escalated_at, done: true, icon: Flame, danger: true });
  }
  steps.push({ key: 'resolved', label: 'Resolved', at: c.resolved_at, done: c.status === 'Resolved', icon: CheckCircle2 });
  return steps;
};

const Timeline = ({ complaint }) => {
  const steps = buildTimeline(complaint);
  return (
    <ol className="flex items-start mt-4">
      {steps.map((st, i) => {
        const Icon = st.icon;
        const color = !st.done ? 'bg-slate-100 text-slate-300' : st.danger ? 'bg-rose-500 text-white' : 'bg-indigo-600 text-white';
        return (
          <li key={st.key} className="flex-1 flex flex-col items-center text-center relative min-w-0">
            {i > 0 && (
              <span className={`absolute top-3.5 right-1/2 w-full h-0.5 -z-0 ${st.done ? (st.danger ? 'bg-rose-300' : 'bg-indigo-300') : 'bg-slate-100'}`} />
            )}
            <span className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center ${color} ring-4 ring-white`}>
              <Icon size={13} />
            </span>
            <span className={`text-[11px] font-medium mt-1.5 leading-tight ${st.done ? 'text-slate-700' : 'text-slate-500'}`}>{st.label}</span>
            {st.done && st.at && <span className="text-[10px] text-slate-500 hidden sm:block">{formatDateTime(st.at)}</span>}
          </li>
        );
      })}
    </ol>
  );
};

const Complaints = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(searchParams.get('new') === '1');
  const [filter, setFilter] = useState('All');
  const [form, setForm] = useState({ category: 'electrical', title: '', description: '' });
  const [photoFile, setPhotoFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null); // { type: 'cancel'|'reopen', complaint }
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const replaceComplaint = (updated) => setComplaints((prev) => prev.map((c) => (c._id === updated._id ? updated : c)));

  const runAction = async () => {
    setActionBusy(true);
    setActionError('');
    try {
      const res = await api.put(`/complaints/${action.complaint._id}/${action.type}`, { reason: actionReason });
      replaceComplaint(res.data);
      setAction(null);
      setActionReason('');
    } catch (err) {
      setActionError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setActionBusy(false);
    }
  };

  const rate = async (complaint, rating, feedback) => {
    const res = await api.put(`/complaints/${complaint._id}/rate`, { rating, feedback });
    replaceComplaint(res.data);
  };

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const res = await api.get('/complaints');
      setComplaints(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComplaints(); }, []);

  const closeModal = () => {
    setShowModal(false);
    if (searchParams.get('new')) setSearchParams({}, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = new FormData();
      data.append('category', form.category);
      if (form.title.trim()) data.append('title', form.title.trim());
      data.append('description', form.description);
      if (photoFile) data.append('photo', photoFile);
      await api.post('/complaints', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      closeModal();
      setForm({ category: 'electrical', title: '', description: '' });
      setPhotoFile(null);
      fetchComplaints();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit complaint.');
    } finally {
      setSubmitting(false);
    }
  };

  const counts = Object.fromEntries(FILTERS.map((f) => [f, f === 'All' ? complaints.length : complaints.filter((c) => c.status === f).length]));
  const visible = filter === 'All' ? complaints : complaints.filter((c) => c.status === filter);

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Complaints</h1>
          <p className="text-slate-500 mt-1">Submit issues and track them until they're resolved</p>
        </div>
        <button
          id="new-complaint-btn"
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 px-4 rounded-xl transition shadow-md shadow-indigo-200"
        >
          <Plus size={18} /> New Complaint
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-5 flex items-start gap-3 bg-indigo-50 border-indigo-100">
        <Clock size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-slate-600">
          Your warden is notified as soon as you submit. If they don't respond within <span className="font-semibold">24 hours</span>,
          your complaint is <span className="font-semibold">automatically escalated to the Admin</span>.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${filter === f ? 'bg-slate-900 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'}`}
          >
            {f} <span className={`ml-1 tabular-nums ${filter === f ? 'text-slate-300' : 'text-slate-500'}`}>{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Complaints List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100"><SkeletonRows rows={3} /></div>
        ) : visible.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <EmptyState icon={AlertCircle} title={complaints.length ? 'No complaints in this view' : 'No complaints filed yet'} message="Use “New Complaint” to report an issue." />
          </div>
        ) : (
          visible.map((c, i) => (
            <div key={c._id} className="bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow p-5" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {c.category}
                    </span>
                    <span className="text-xs text-slate-500">{formatDate(c.created_at)}</span>
                    {c.photo && (
                      <a href={`${API_ROOT_URL}/${c.photo}`} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:text-indigo-600 flex items-center gap-1">
                        <ImageIcon size={12} /> Photo
                      </a>
                    )}
                  </div>
                  {c.title && c.title !== c.category && <p className="font-semibold text-slate-800 text-sm mb-0.5">{c.title}</p>}
                  <p className="text-slate-600 text-sm">{c.description}</p>
                  {c.admin_remarks && (
                    <p className="mt-3 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                      <span className="font-medium text-slate-700">Staff remark:</span> {c.admin_remarks}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <StatusBadge status={c.status} />
                  <EscalationTag complaint={c} />
                </div>
              </div>
              {c.staff && c.status !== 'Cancelled' && (
                <p className="mt-3 text-sm text-slate-600 flex items-center gap-1.5">
                  <Wrench size={14} className="text-slate-500" /> Assigned to <span className="font-medium">{c.staff.name}</span> ({c.staff.trade})
                </p>
              )}
              <Timeline complaint={c} />

              {/* Student actions */}
              {['Pending', 'In Progress'].includes(c.status) && (
                <div className="mt-4 flex justify-end">
                  <button onClick={() => { setAction({ type: 'cancel', complaint: c }); setActionReason(''); setActionError(''); }} className="text-xs font-medium text-slate-500 hover:text-red-600 flex items-center gap-1">
                    <Ban size={13} /> Cancel complaint
                  </button>
                </div>
              )}
              {c.status === 'Resolved' && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <RatingBox complaint={c} onRate={rate} />
                  {canReopen(c) && (
                    <button onClick={() => { setAction({ type: 'reopen', complaint: c }); setActionReason(''); setActionError(''); }} className="text-sm font-medium text-amber-700 border border-amber-200 hover:bg-amber-50 rounded-lg px-3 py-1.5 flex items-center gap-1.5 self-start sm:self-auto">
                      <RotateCcw size={14} /> Not fixed? Reopen
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* New Complaint Modal */}
      {showModal && (
        <Modal title="New Complaint" onClose={closeModal}>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-600 text-sm rounded-xl p-3">{error}</div>}
              <div>
                <label htmlFor="complaint-category" className="block text-sm font-medium text-slate-600 mb-1.5">Category</label>
                <select
                  id="complaint-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 capitalize"
                >
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="complaint-title" className="block text-sm font-medium text-slate-600 mb-1.5">Title <span className="text-slate-500 font-normal">(optional)</span></label>
                <input
                  id="complaint-title"
                  value={form.title}
                  maxLength={80}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Fan not working in Room 204"
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="complaint-description" className="block text-sm font-medium text-slate-600 mb-1.5">Description</label>
                <textarea
                  id="complaint-description"
                  required
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe the issue..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <div>
                <label htmlFor="complaint-photo" className="block text-sm font-medium text-slate-600 mb-1.5">Photo (optional)</label>
                <input
                  id="complaint-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files[0])}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button id="complaint-submit" type="submit" disabled={submitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition">
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
        </Modal>
      )}
      {action && (
        <Modal title={action.type === 'cancel' ? 'Cancel complaint' : 'Reopen complaint'} onClose={() => setAction(null)}>
          <div className="space-y-4">
            {actionError && <div role="alert" className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{actionError}</div>}
            <p className="text-sm text-slate-600">
              {action.type === 'cancel'
                ? 'Cancel this complaint if the problem is gone or was filed by mistake. Staff will be told.'
                : 'Tell us what is still wrong. Your warden gets 24 hours to respond again before it is escalated.'}
            </p>
            <textarea
              rows={3}
              maxLength={500}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder={action.type === 'cancel' ? 'Reason (optional)' : 'e.g. The fan stopped working again at night'}
              aria-label="Reason"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setAction(null)} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Back</button>
              <button
                onClick={runAction}
                disabled={actionBusy || (action.type === 'reopen' && actionReason.trim().length < 5)}
                className={`flex-1 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition ${action.type === 'cancel' ? 'bg-red-600 hover:bg-red-500' : 'bg-amber-600 hover:bg-amber-500'}`}
              >
                {actionBusy ? 'Saving...' : action.type === 'cancel' ? 'Cancel complaint' : 'Reopen'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
};

// 1–5 star rating for a resolved complaint (once), with optional feedback.
const RatingBox = ({ complaint, onRate }) => {
  const [hover, setHover] = useState(0);
  const [picked, setPicked] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  if (complaint.rating) {
    return (
      <div className="text-sm text-slate-600">
        <span className="flex items-center gap-0.5" aria-label={`Rated ${complaint.rating} of 5`}>
          {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={16} className={n <= complaint.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />)}
          <span className="ml-2 text-xs text-slate-500">Thanks for rating</span>
        </span>
        {complaint.feedback && <p className="text-xs text-slate-500 mt-1">"{complaint.feedback}"</p>}
      </div>
    );
  }

  const submit = async () => {
    setSaving(true);
    setErr('');
    try { await onRate(complaint, picked, feedback); }
    catch (e) { setErr(e.response?.data?.message || 'Could not save rating.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex-1">
      <p className="text-sm font-medium text-slate-700 mb-1">How well was this fixed?</p>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onMouseEnter={() => setHover(n)} onClick={() => setPicked(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
            <Star size={22} className={n <= (hover || picked) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'} />
          </button>
        ))}
      </div>
      {picked > 0 && (
        <div className="flex gap-2 mt-2">
          <input value={feedback} onChange={(e) => setFeedback(e.target.value)} maxLength={500} placeholder="Feedback (optional)" aria-label="Feedback" className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          <button onClick={submit} disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium px-3 py-1.5 rounded-lg">{saving ? '...' : 'Submit'}</button>
        </div>
      )}
      {err && <p role="alert" className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  );
};

export default Complaints;
