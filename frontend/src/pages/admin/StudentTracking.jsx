import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/axios';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';
import { formatDateTime } from '../../utils/format';
import {
  Search, MapPin, Users, AlertTriangle, RefreshCw, Phone, Home, UserCog, Building2, LogIn, LogOut, FileText, X,
} from 'lucide-react';

const ATTENDANCE_OPTIONS = [
  { value: '', label: 'All attendance' },
  { value: 'Present', label: 'Present' },
  { value: 'Absent', label: 'Absent' },
  { value: 'Pending', label: 'Not marked' },
];
const LOCATION_OPTIONS = ['', 'Inside Hostel', 'Outside Hostel', 'Gone Home'];
const FILTER_KEYS = ['search', 'hostel_id', 'room_no', 'attendance', 'location'];

const fmt = formatDateTime;
const attendanceLabel = (a) => (a === 'Pending' ? 'Not Marked' : a);
const selectCls = 'bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

const StudentTracking = () => {
  const [params, setParams] = useSearchParams();
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  const [searchInput, setSearchInput] = useState(filters.search);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const query = params.toString();

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const res = await api.get(`/admin/tracking${query ? `?${query}` : ''}`);
      setData(res.data);
      setError('');
    } catch (e) {
      if (e.response?.status === 503) setSetupRequired(true);
      else setError(e.response?.data?.message || 'Could not load student tracking.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  // Debounce the search box into the URL.
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== filters.search) setFilter('search', searchInput);
    }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  };

  const clearFilters = () => {
    setSearchInput('');
    setParams({}, { replace: true });
  };

  const activeFilterCount = FILTER_KEYS.filter((k) => filters[k]).length;
  const rows = data?.students || [];
  const counts = rows.reduce(
    (acc, r) => {
      acc[r.location] = (acc[r.location] || 0) + 1;
      if (r.attendance_conflict) acc.conflicts++;
      return acc;
    },
    { conflicts: 0 }
  );

  if (setupRequired) {
    return (
      <Layout>
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Student Tracking</h1>
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-5 text-sm">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <p>Run <code className="font-mono">hostel_tracking.sql</code> in the Supabase SQL Editor to enable student tracking, then reload.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Student Attendance & Hostel Status</h1>
          <p className="text-slate-500 mt-1">Daily roll call alongside live presence from gate QR scans</p>
        </div>
        <button onClick={() => load(true)} className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition text-sm">
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Reg. no. or name..."
              aria-label="Search by registration number or name"
              className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select value={filters.hostel_id} onChange={(e) => setFilter('hostel_id', e.target.value)} className={selectCls} aria-label="Filter by hostel">
            <option value="">All hostels</option>
            {data?.filters.hostels.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
            <option value="unassigned">No hostel assigned</option>
          </select>
          <select value={filters.room_no} onChange={(e) => setFilter('room_no', e.target.value)} className={selectCls} aria-label="Filter by room">
            <option value="">All rooms</option>
            {data?.filters.rooms.map((r) => <option key={r} value={r}>Room {r}</option>)}
          </select>
          <select value={filters.attendance} onChange={(e) => setFilter('attendance', e.target.value)} className={selectCls} aria-label="Filter by attendance">
            {ATTENDANCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={filters.location} onChange={(e) => setFilter('location', e.target.value)} className={selectCls} aria-label="Filter by location">
            {LOCATION_OPTIONS.map((l) => <option key={l} value={l}>{l || 'All locations'}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-slate-500">
          <span>
            Showing <span className="font-semibold text-slate-700">{rows.length}</span> of {data?.total ?? 0} students
          </span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Inside {counts['Inside Hostel'] || 0}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Outside {counts['Outside Hostel'] || 0}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" /> Gone home {counts['Gone Home'] || 0}</span>
          {counts.conflicts > 0 && (
            <span className="flex items-center gap-1 text-amber-700"><AlertTriangle size={14} /> {counts.conflicts} attendance/presence mismatch</span>
          )}
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-indigo-600 hover:text-indigo-500">
              <X size={14} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-5">{error}</div>}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="No students match these filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-semibold">Reg. No</th>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Hostel / Room</th>
                  <th className="px-5 py-3 font-semibold">Attendance (today)</th>
                  <th className="px-5 py-3 font-semibold">Hostel Status (live)</th>
                  <th className="px-5 py-3 font-semibold">Last Exit</th>
                  <th className="px-5 py-3 font-semibold">Last Entry</th>
                  <th className="px-5 py-3 font-semibold">Outpass</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr
                    key={r._id}
                    onClick={() => setSelected(r)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(r)}
                    tabIndex={0}
                    className="hover:bg-slate-50 cursor-pointer transition focus:outline-none focus:bg-indigo-50"
                  >
                    <td className="px-5 py-3 font-mono text-slate-700 whitespace-nowrap">{r.roll_no || '—'}</td>
                    <td className="px-5 py-3 font-medium text-slate-800 whitespace-nowrap">{r.name}</td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">
                      {r.hostel_name || <span className="text-amber-600">Unassigned</span>}
                      <span className="text-slate-400"> · {r.room_no || '—'}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={attendanceLabel(r.attendance)} />
                        {r.attendance_conflict && (
                          <span title="Attendance does not match live hostel status" aria-label="Attendance does not match live hostel status">
                            <AlertTriangle size={14} className="text-amber-500" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={r.location} />
                        {r.is_overdue && <StatusBadge status="Overdue" />}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{fmt(r.last_exit)}</td>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{fmt(r.last_entry)}</td>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {r.active_outpass ? (
                        <span>
                          <span className="font-medium text-slate-700">{r.active_outpass.pass_type === 'Home' ? 'Home visit' : 'Outing'}</span>
                          {' · back by '}{fmt(r.active_outpass.return_datetime)}
                        </span>
                      ) : r.pending_outpasses ? (
                        <span className="text-amber-600">{r.pending_outpasses} pending</span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Student detail (admin-only sensitive info) */}
      {selected && (
        <Modal title="Student Details" onClose={() => setSelected(null)} size="max-w-lg">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-2xl font-bold text-indigo-600">
                {selected.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{selected.name}</h3>
                <p className="text-slate-400 text-sm">Reg. No {selected.roll_no || '—'} · {selected.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-1">Attendance today</p>
                <StatusBadge status={attendanceLabel(selected.attendance)} />
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-1">Hostel status (live)</p>
                <div className="flex gap-1.5 flex-wrap">
                  <StatusBadge status={selected.location} />
                  {selected.is_overdue && <StatusBadge status="Overdue" />}
                </div>
              </div>
              <Info icon={Building2} label="Hostel" value={selected.hostel_name || 'Not assigned'} />
              <Info label="Room" value={selected.room_no} />
              <Info icon={Phone} label="Phone" value={selected.phone} />
              <Info icon={Phone} label="Parent / Guardian" value={selected.parent_contact} />
              <Info icon={UserCog} label="Warden" value={selected.warden_name || 'Not assigned'} />
              <Info label="Course" value={selected.course_year} />
              <div className="col-span-2"><Info icon={Home} label="Home address" value={selected.home_address || 'Not provided'} /></div>
              <Info icon={LogOut} label="Last exit" value={fmt(selected.last_exit)} />
              <Info icon={LogIn} label="Last entry" value={fmt(selected.last_entry)} />
            </div>

            {selected.attendance_conflict && (
              <p className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                Today's attendance ({attendanceLabel(selected.attendance)}) doesn't match the gate record ({selected.location}). Check with the warden.
              </p>
            )}

            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5"><FileText size={15} /> Current outpass</p>
              {selected.active_outpass ? (
                <div className="border border-slate-100 rounded-xl p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{selected.active_outpass.reason}</span>
                    <StatusBadge status={selected.active_outpass.status} />
                  </div>
                  <p className="text-slate-500 flex items-center gap-1"><MapPin size={13} /> {selected.active_outpass.destination} · {selected.active_outpass.pass_type === 'Home' ? 'Home visit' : 'Outing'}</p>
                  <p className="text-slate-500">Leave {fmt(selected.active_outpass.leave_datetime)} → return by {fmt(selected.active_outpass.return_datetime)}</p>
                  {selected.active_outpass.approved_at && <p className="text-slate-400 text-xs">Approved {fmt(selected.active_outpass.approved_at)}</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No approved or active outpass.{selected.pending_outpasses ? ` ${selected.pending_outpasses} pending approval.` : ''}</p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </Layout>
  );
};

const Info = ({ icon: Icon, label, value }) => (
  <div className="bg-slate-50 rounded-xl p-3">
    <p className="text-slate-400 text-xs flex items-center gap-1">{Icon && <Icon size={12} />}{label}</p>
    <p className="text-slate-700 text-sm font-medium mt-0.5 break-words">{value || '—'}</p>
  </div>
);

export default StudentTracking;
