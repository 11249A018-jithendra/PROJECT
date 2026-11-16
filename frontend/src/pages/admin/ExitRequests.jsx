import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import Pager from '../../components/Pager';
import StatusBadge from '../../components/StatusBadge';
import api, { API_ROOT_URL } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { DoorClosed, Search, AlertTriangle, CheckCircle2, XCircle, UserCog, Calendar, History } from 'lucide-react';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';
import { formatDate, formatDateTime } from '../../utils/format';
import { confirmAction } from '../../components/ui/ConfirmDialog';

const TABS = ['Pending', 'Approved', 'Rejected', 'Cancelled', 'All'];
const fmtDate = (d) => formatDate(d ? String(d).slice(0, 10) : d);
const fmtDateTime = formatDateTime;
const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

// Admin: review and decide. Warden: track their own requests and withdraw pending ones.
const ExitRequests = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('Pending');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null); // { type, text }

  const [review, setReview] = useState(null);      // full request detail
  const [reviewLoading, setReviewLoading] = useState(false);
  const [decision, setDecision] = useState(null);  // { type: 'approve'|'reject', exitDate, reason, error, busy, needsConfirm }

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '20', status: tab });
    if (search.trim()) params.set('search', search.trim());
    try {
      const res = await api.get(`/exit-requests?${params}`);
      setData(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [page, tab, search]);

  useEffect(() => {
    const id = setTimeout(load, 200);
    return () => clearTimeout(id);
  }, [load]);

  const flash = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 5000);
  };

  const openReview = async (r) => {
    setReviewLoading(true);
    setReview({ ...r });
    try {
      const res = await api.get(`/exit-requests/${r._id}`);
      setReview(res.data);
    } catch (e) {
      flash('error', e.response?.data?.message || 'Could not load the request.');
      setReview(null);
    } finally { setReviewLoading(false); }
  };

  const startDecision = (type) => setDecision({
    type,
    exitDate: review.exit_date || istToday(),
    reason: '',
    error: '',
    busy: false,
    needsConfirm: review.history?.currently_outside || false,
  });

  const submitDecision = async () => {
    setDecision((d) => ({ ...d, busy: true, error: '' }));
    try {
      const res = decision.type === 'approve'
        ? await api.put(`/exit-requests/${review._id}/approve`, { exit_date: decision.exitDate, force: decision.needsConfirm })
        : await api.put(`/exit-requests/${review._id}/reject`, { reason: decision.reason });
      flash('success', res.data.message);
      setDecision(null);
      setReview(null);
      load();
    } catch (e) {
      setDecision((d) => ({
        ...d,
        busy: false,
        error: e.response?.data?.message || 'Something went wrong. Nothing was changed.',
        needsConfirm: d.needsConfirm || Boolean(e.response?.data?.needs_confirmation),
      }));
    }
  };

  const withdraw = async (r) => {
    if (!(await confirmAction({ title: 'Withdraw this exit request?', message: `The request for ${r.student?.name} will be cancelled.`, confirmLabel: 'Withdraw', danger: true }))) return;
    try {
      await api.put(`/exit-requests/${r._id}/cancel`);
      flash('success', 'Request withdrawn. The student stays active.');
      load();
    } catch (e) { flash('error', e.response?.data?.message || 'Could not withdraw.'); }
  };

  const rows = data?.items || [];
  const sp = review?.student_profile;

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Student Exit Requests</h1>
          <p className="text-slate-500 mt-1">
            {isAdmin
              ? 'Wardens request permanent exits; approve to move the student to Past Students'
              : 'Your permanent exit requests and the admin’s decisions'}
          </p>
        </div>
        {isAdmin ? (
          <Link to="/admin/past-students" className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition text-sm">
            <History size={16} /> Past Students History
          </Link>
        ) : (
          <Link to="/warden/students" className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-200 text-sm">
            <DoorClosed size={16} /> New request (from My Students)
          </Link>
        )}
      </div>

      {notice && (
        <div className={`text-sm rounded-xl p-3 mb-5 border ${notice.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'}`}>{notice.text}</div>
      )}

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); }}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'}`}
            >
              {t}
              {t === 'Pending' && data?.pending ? <span className={`ml-1.5 text-xs rounded-full px-1.5 ${tab === t ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}>{data.pending}</span> : null}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search student, reg no or warden..." aria-label="Search requests" className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState icon={DoorClosed} title={tab === 'Pending' ? 'No requests waiting for a decision' : 'No requests here'} />
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((r) => (
              <div key={r._id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:px-5 hover:bg-slate-50 transition">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold flex-shrink-0">{r.student?.name?.[0]?.toUpperCase()}</div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{r.student?.name} <span className="font-normal text-slate-400">· {r.student?.roll_no || '—'}{r.hostel_name ? ` · ${r.hostel_name}` : ''}</span></p>
                    <p className="text-sm text-slate-600 truncate">{r.reason}</p>
                    <p className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-x-3">
                      <span>Requested {fmtDateTime(r.created_at)}{isAdmin ? ` by ${r.requester?.name}` : ''}</span>
                      {r.exit_date && <span>Leaving {fmtDate(r.exit_date)}</span>}
                      {r.decided_at && <span>{r.status} {fmtDateTime(r.decided_at)}{r.decider ? ` by ${r.decider.name}` : ''}</span>}
                    </p>
                    {r.status === 'Rejected' && r.rejection_reason && (
                      <p className="text-xs text-red-600 mt-1">Reason: {r.rejection_reason}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 pl-[3.25rem] sm:pl-0">
                  <StatusBadge status={r.status} />
                  {isAdmin ? (
                    <button onClick={() => openReview(r)} className="text-xs font-medium text-indigo-600 border border-indigo-200 hover:border-indigo-400 rounded-lg px-3 py-1.5 transition">
                      {r.status === 'Pending' ? 'Review' : 'View'}
                    </button>
                  ) : r.status === 'Pending' && (
                    <button onClick={() => withdraw(r)} className="text-xs font-medium text-slate-500 hover:text-red-600 border border-slate-200 rounded-lg px-3 py-1.5 transition">
                      Withdraw
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {data && <Pager page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="requests" />}
      </div>

      {/* Admin review */}
      {review && (
        <Modal title="Review Exit Request" onClose={() => { setReview(null); setDecision(null); }} size="max-w-2xl">
          {reviewLoading || !sp ? (
            <div className="py-10 flex justify-center"><div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {sp.profile_photo ? (
                  <img src={`${API_ROOT_URL}/${sp.profile_photo}`} alt="" className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-2xl font-bold text-indigo-600">{sp.name?.[0]}</div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 text-lg">{sp.name}</h3>
                  <p className="text-slate-400 text-sm">{sp.email}</p>
                </div>
                <StatusBadge status={review.status} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  ['Reg. No', sp.roll_no],
                  ['Course', sp.course_year],
                  ['Phone', sp.phone],
                  ['Parent / Guardian', sp.parent_contact],
                  ['Hostel', sp.current_hostel?.name || 'Not assigned'],
                  ['Room', sp.room ? `${sp.room.room_no}${sp.room.floor ? ` (floor ${sp.room.floor})` : ''}` : sp.room_no],
                  ['Admitted', fmtDate(sp.created_at)],
                  ['Attendance', `${review.history.attendance_present} present · ${review.history.attendance_absent} absent`],
                  ['Complaints', `${review.history.complaints_total} total · ${review.history.complaints_open} open`],
                ].map(([label, value]) => (
                  <div key={label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-400 text-xs">{label}</p>
                    <p className="text-slate-700 text-sm font-medium mt-0.5">{value || 'N/A'}</p>
                  </div>
                ))}
                <div className="bg-slate-50 rounded-xl p-3 col-span-2 sm:col-span-3">
                  <p className="text-slate-400 text-xs">Home Address</p>
                  <p className="text-slate-700 text-sm font-medium mt-0.5 whitespace-pre-line">{sp.home_address || 'N/A'}</p>
                </div>
              </div>

              <div className="border border-slate-100 rounded-xl p-4 space-y-2 text-sm">
                <p className="font-semibold text-slate-800 flex items-center gap-2"><UserCog size={16} /> Request from {review.requester?.name}</p>
                <p className="text-slate-500">{review.requester?.email}{review.requester?.phone ? ` · ${review.requester.phone}` : ''}</p>
                <p className="text-slate-700"><span className="text-slate-400">Reason:</span> {review.reason}</p>
                {review.remarks && <p className="text-slate-700"><span className="text-slate-400">Remarks:</span> {review.remarks}</p>}
                <p className="text-slate-500 flex flex-wrap gap-x-4">
                  <span className="flex items-center gap-1"><Calendar size={13} /> Requested {fmtDateTime(review.created_at)}</span>
                  {review.exit_date && <span>Planned exit {fmtDate(review.exit_date)}</span>}
                </p>
                {review.status === 'Rejected' && <p className="text-red-600">Rejected: {review.rejection_reason}</p>}
              </div>

              {review.status === 'Pending' && (review.history.currently_outside || review.history.open_outpasses > 0 || review.history.complaints_open > 0) && (
                <div className="flex gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  <div>
                    {review.history.currently_outside && <p>The student is currently <b>outside on an outpass</b>.</p>}
                    {review.history.open_outpasses > 0 && <p>{review.history.open_outpasses} open outpass request(s) will be cancelled.</p>}
                    {review.history.complaints_open > 0 && <p>{review.history.complaints_open} open complaint(s) will stay in their history.</p>}
                  </div>
                </div>
              )}

              {review.status === 'Pending' && !decision && (
                <div className="flex gap-3 pt-1">
                  <button onClick={() => startDecision('reject')} className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-600 font-medium py-2.5 rounded-xl hover:bg-red-50 transition"><XCircle size={16} /> Reject</button>
                  <button onClick={() => startDecision('approve')} className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl transition"><CheckCircle2 size={16} /> Approve exit</button>
                </div>
              )}

              {decision && (
                <div className={`rounded-xl border p-4 space-y-3 ${decision.type === 'approve' ? 'border-indigo-200 bg-indigo-50/40' : 'border-red-200 bg-red-50/40'}`}>
                  {decision.type === 'approve' ? (
                    <>
                      <p className="text-sm text-slate-700">
                        <b>{sp.name}</b> will be archived to <b>Past Students</b> with their full profile and history. They'll be removed from all active lists, their bed is freed and they can no longer log in. You can re-admit them later from Past Students.
                      </p>
                      <div className="max-w-xs">
                        <label htmlFor="exit-date" className="block text-sm font-medium text-slate-600 mb-1.5">Exit date</label>
                        <input id="exit-date" type="date" value={decision.exitDate} onChange={(e) => setDecision({ ...decision, exitDate: e.target.value })} className={inputCls} />
                      </div>
                      {decision.needsConfirm && (
                        <p className="text-sm text-amber-800 flex items-center gap-1.5"><AlertTriangle size={14} /> The student is outside right now — approving will archive them anyway.</p>
                      )}
                    </>
                  ) : (
                    <div>
                      <label htmlFor="reject-reason" className="block text-sm font-medium text-slate-600 mb-1.5">Reason for the warden</label>
                      <textarea id="reject-reason" rows={2} maxLength={500} value={decision.reason} onChange={(e) => setDecision({ ...decision, reason: e.target.value })} placeholder="e.g. Room clearance not done yet" className={`${inputCls} resize-none`} />
                      <p className="text-xs text-slate-500 mt-1">The student stays active. The warden sees this reason.</p>
                    </div>
                  )}
                  {decision.error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{decision.error}</div>}
                  <div className="flex gap-3">
                    <button onClick={() => setDecision(null)} disabled={decision.busy} className="flex-1 border border-slate-200 bg-white text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Back</button>
                    <button
                      onClick={submitDecision}
                      disabled={decision.busy || (decision.type === 'reject' && decision.reason.trim().length < 5)}
                      className={`flex-1 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition ${decision.type === 'approve' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-red-600 hover:bg-red-500'}`}
                    >
                      {decision.busy ? 'Saving...' : decision.type === 'approve' ? (decision.needsConfirm ? 'Approve anyway' : 'Confirm approval') : 'Reject request'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </Layout>
  );
};

export default ExitRequests;
