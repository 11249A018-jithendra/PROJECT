import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import Pager from '../../components/Pager';
import StatusBadge from '../../components/StatusBadge';
import api, { API_ROOT_URL } from '../../api/axios';
import { Search, History, Filter, Building2, UserCheck, DoorClosed, X } from 'lucide-react';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';
import { formatDate, formatDateTime } from '../../utils/format';
import { toast } from '../../components/ui/Toast';
import { confirmAction } from '../../components/ui/ConfirmDialog';

const fmtDate = (d) => formatDate(d ? String(d).slice(0, 10) : d);
const fmtDateTime = formatDateTime;
const selectCls = 'bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const DETAIL_TABS = ['Profile', 'Outpasses', 'Complaints', 'Attendance'];

const PastStudents = () => {
  const [filters, setFilters] = useState({ search: '', hostel_id: '', source: '', from: '', to: '', include_readmitted: false });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailTab, setDetailTab] = useState('Profile');
  const [readmitting, setReadmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, String(v)); });
    try {
      const res = await api.get(`/admin/past-students?${params}`);
      setData(res.data);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load past students.');
    } finally { setLoading(false); }
  }, [filters, page]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };
  const activeFilters = Object.entries(filters).some(([k, v]) => k !== 'search' && v);

  const openDetail = async (row) => {
    setDetailTab('Profile');
    setDetail({ ...row, loading: true });
    try {
      const res = await api.get(`/admin/past-students/${row._id}`);
      setDetail(res.data);
    } catch (e) {
      setDetail(null);
      setError(e.response?.data?.message || 'Could not load details.');
    }
  };

  const readmit = async () => {
    if (!(await confirmAction({ title: `Re-admit ${detail.name}?`, message: 'They become an active student again and need a hostel and room assigned. This history record is kept.', confirmLabel: 'Re-admit' }))) return;
    setReadmitting(true);
    try {
      await api.post(`/admin/students/${detail.student_id}/readmit`);
      setNotice(`${detail.name} was re-admitted. Assign their hostel and room on the Students page.`);
      setTimeout(() => setNotice(''), 6000);
      setDetail(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not re-admit.');
    } finally { setReadmitting(false); }
  };

  const rows = data?.items || [];
  const h = detail?.history;
  const stats = detail?.stats || {};

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Past Students History</h1>
          <p className="text-slate-500 mt-1">Students who have permanently left the hostel — their records as they were on exit</p>
        </div>
        <Link to="/admin/exit-requests" className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition text-sm">
          <DoorClosed size={16} /> Exit Requests
        </Link>
      </div>

      {notice && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3 mb-5">{notice}</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-5">{error}</div>}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-5 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={filters.search} onChange={(e) => setFilter('search', e.target.value)} placeholder="Search name, reg no, email or phone..." aria-label="Search past students" className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Filter size={14} className="text-slate-400" />
          <select value={filters.hostel_id} onChange={(e) => setFilter('hostel_id', e.target.value)} className={selectCls} aria-label="Hostel">
            <option value="">All hostels</option>
            {data?.hostels.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
          </select>
          <select value={filters.source} onChange={(e) => setFilter('source', e.target.value)} className={selectCls} aria-label="How they left">
            <option value="">Any exit type</option>
            <option value="Warden request">Warden request</option>
            <option value="Admin">Admin check-out</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">From <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className={selectCls} aria-label="Exit date from" /></label>
          <label className="flex items-center gap-2 text-sm text-slate-600">To <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className={selectCls} aria-label="Exit date to" /></label>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input type="checkbox" checked={filters.include_readmitted} onChange={(e) => setFilter('include_readmitted', e.target.checked)} /> Include re-admitted
          </label>
          {activeFilters && (
            <button onClick={() => { setFilters({ search: filters.search, hostel_id: '', source: '', from: '', to: '', include_readmitted: false }); setPage(1); }} className="text-sm text-indigo-600 flex items-center gap-1 ml-auto"><X size={14} /> Clear</button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState icon={History} title={`No past students${filters.search || activeFilters ? ' match these filters' : ' yet'}`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-semibold">Reg. No</th>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Last hostel / room</th>
                  <th className="px-5 py-3 font-semibold">Exit date</th>
                  <th className="px-5 py-3 font-semibold">Reason</th>
                  <th className="px-5 py-3 font-semibold">Approved by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p._id} onClick={() => openDetail(p)} onKeyDown={(e) => e.key === 'Enter' && openDetail(p)} tabIndex={0} className="hover:bg-slate-50 cursor-pointer focus:outline-none focus:bg-indigo-50">
                    <td className="px-5 py-3 font-mono text-slate-700 whitespace-nowrap">{p.roll_no || '—'}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{p.name}</p>
                      {p.readmitted_at && <span className="text-[11px] font-semibold text-green-700">Re-admitted {fmtDate(p.readmitted_at)}</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{p.hostel_name || '—'} · {p.room_no || '—'}</td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{fmtDate(p.exit_date)}</td>
                    <td className="px-5 py-3 text-slate-600 max-w-[16rem] truncate">{p.exit_reason}</td>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{p.approved_by_name}<span className="block text-[11px] text-slate-400">{p.source === 'Admin' ? 'Direct check-out' : `Requested by ${p.requested_by_name}`}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="past students" />}
      </div>

      {detail && (
        <Modal title="Past Student" onClose={() => setDetail(null)} size="max-w-2xl">
          {detail.loading ? (
            <div className="py-10 flex justify-center"><div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {detail.profile_photo ? (
                  <img src={`${API_ROOT_URL}/${detail.profile_photo}`} alt="" className="w-14 h-14 rounded-full object-cover" />
                ) : (
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-2xl font-bold text-slate-500">{detail.name?.[0]}</div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-800 text-lg">{detail.name}</h3>
                  <p className="text-slate-400 text-sm truncate">{detail.roll_no} · {detail.email}</p>
                </div>
                {!detail.readmitted_at && (
                  <button onClick={readmit} disabled={readmitting} className="flex items-center gap-1.5 text-xs font-medium border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg px-3 py-1.5 disabled:opacity-60">
                    <UserCheck size={14} /> {readmitting ? 'Re-admitting...' : 'Re-admit'}
                  </button>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm space-y-1">
                <p className="font-semibold text-slate-800">Left on {fmtDate(detail.exit_date)}</p>
                <p className="text-slate-700">{detail.exit_reason}</p>
                <p className="text-slate-500">
                  {detail.source === 'Admin'
                    ? `Checked out directly by ${detail.approved_by_name}`
                    : `Requested by ${detail.requested_by_name} on ${fmtDateTime(detail.requested_at)} · approved by ${detail.approved_by_name}`}
                  {' '}on {fmtDateTime(detail.approved_at)}
                </p>
                {detail.exit_request?.remarks && <p className="text-slate-500">Warden remarks: {detail.exit_request.remarks}</p>}
                {detail.readmitted_at && <p className="text-green-700 font-medium">Re-admitted on {fmtDateTime(detail.readmitted_at)}</p>}
              </div>

              <div className="flex gap-2 border-b border-slate-100">
                {DETAIL_TABS.map((t) => (
                  <button key={t} onClick={() => setDetailTab(t)} className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${detailTab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    {t}{t !== 'Profile' && h ? ` (${h[t.toLowerCase()].length})` : ''}
                  </button>
                ))}
              </div>

              {detailTab === 'Profile' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    ['Student ID', detail.student_id],
                    ['Reg. No', detail.roll_no],
                    ['Course', detail.course_year],
                    ['Phone', detail.phone],
                    ['Parent / Guardian', detail.parent_contact],
                    ['Admitted', fmtDate(detail.admission_date)],
                    ['Hostel', detail.hostel_name],
                    ['Room', detail.room_no ? `${detail.room_no}${detail.room_floor ? ` (floor ${detail.room_floor})` : ''}` : null],
                    ['Warden', detail.warden_name ? `${detail.warden_name}${detail.warden_phone ? ` · ${detail.warden_phone}` : ''}` : null],
                    ['Attendance', `${stats.attendance_present ?? 0} present · ${stats.attendance_absent ?? 0} absent`],
                    ['Outpasses', `${stats.outpasses_total ?? 0} total · ${stats.outpasses_home ?? 0} home visits`],
                    ['Complaints', `${stats.complaints_total ?? 0} total · ${stats.complaints_open ?? 0} open at exit`],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-slate-50 rounded-xl p-3 min-w-0">
                      <p className="text-slate-400 text-xs">{label}</p>
                      <p className="text-slate-700 text-sm font-medium mt-0.5 break-words">{value || 'N/A'}</p>
                    </div>
                  ))}
                  <div className="bg-slate-50 rounded-xl p-3 col-span-2 sm:col-span-3">
                    <p className="text-slate-400 text-xs">Home Address</p>
                    <p className="text-slate-700 text-sm font-medium mt-0.5 whitespace-pre-line">{detail.home_address || 'N/A'}</p>
                  </div>
                  {h.other_stays.length > 0 && (
                    <div className="bg-slate-50 rounded-xl p-3 col-span-2 sm:col-span-3 text-sm">
                      <p className="text-slate-400 text-xs mb-1">Other stays</p>
                      {h.other_stays.map((o) => <p key={o._id} className="text-slate-600">Left {fmtDate(o.exit_date)} — {o.exit_reason}{o.readmitted_at ? ` (re-admitted ${fmtDate(o.readmitted_at)})` : ''}</p>)}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'Outpasses' && (
                <HistoryList empty="No outpasses." rows={h.outpasses} render={(o) => (
                  <>
                    <div className="min-w-0"><p className="text-slate-700 truncate">{o.reason} — {o.destination}{o.pass_type === 'Home' ? ' (home)' : ''}</p><p className="text-xs text-slate-400">{fmtDateTime(o.leave_datetime)} → {fmtDateTime(o.return_datetime)}</p></div>
                    <StatusBadge status={o.status} />
                  </>
                )} />
              )}
              {detailTab === 'Complaints' && (
                <HistoryList empty="No complaints." rows={h.complaints} render={(c) => (
                  <>
                    <div className="min-w-0"><p className="text-slate-700 truncate capitalize">{c.title || c.category}</p><p className="text-xs text-slate-400">{fmtDate(c.created_at)}</p></div>
                    <StatusBadge status={c.status} />
                  </>
                )} />
              )}
              {detailTab === 'Attendance' && (
                <HistoryList empty="No attendance records." rows={h.attendance} render={(a) => (
                  <>
                    <p className="text-slate-700">{fmtDate(a.date)}</p>
                    <StatusBadge status={a.status === 'Pending' ? 'Not Marked' : a.status} />
                  </>
                )} />
              )}
              <p className="text-[11px] text-slate-400 flex items-center gap-1"><Building2 size={11} /> Hostel, room and warden are recorded as they were on the exit date.</p>
            </div>
          )}
        </Modal>
      )}
    </Layout>
  );
};

const HistoryList = ({ rows, render, empty }) =>
  rows.length === 0 ? (
    <p className="text-sm text-slate-400 py-4 text-center">{empty}</p>
  ) : (
    <div className="max-h-72 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-xl">
      {rows.map((r, i) => <div key={r._id || i} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">{render(r)}</div>)}
    </div>
  );

export default PastStudents;
