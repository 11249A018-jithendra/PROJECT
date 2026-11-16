import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import { Users, CheckCircle, XCircle, Clock, Search, ChevronLeft, ChevronRight, BarChart3, CheckCheck, Lock, ShieldAlert } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { EmptyState, SkeletonTableRows } from '../../components/ui/Feedback';
import { formatTime } from '../../utils/format';
import { confirmAction } from '../../components/ui/ConfirmDialog';

const WARDEN_TODAY_ONLY = 'Access denied: You can manage student attendance and issue outpasses for the current date only.';
const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const shiftDate = (d, days) => new Date(Date.parse(`${d}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const prettyDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtTime = (d) => (d ? formatTime(d) : '');

const getLiveISTTime = () => {
  const d = new Date(Date.now() + 5.5 * 3600000);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC', hour12: true });
};

const AdminAttendance = () => {
  const { user } = useAuth();
  const isWarden = user?.role === 'warden';
  const prefix = isWarden ? '/warden' : '/admin';
  const today = istToday();

  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDate = searchParams.get('date');

  const [date, setDate] = useState(() => {
    if (isWarden) return today;
    return requestedDate || today;
  });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [hostelFilter, setHostelFilter] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [liveTime, setLiveTime] = useState(getLiveISTTime());
  const [midnightNotice, setMidnightNotice] = useState('');
  const [feedback, setFeedback] = useState(null);

  // Live clock and midnight transition detector
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTime(getLiveISTTime());

      // Check for midnight rollover
      const currentToday = istToday();
      if (isWarden && date !== currentToday) {
        setDate(currentToday);
        setMidnightNotice(`Midnight transition: Previous day's attendance has closed and locked. Switched to ${prettyDate(currentToday)}.`);
        setTimeout(() => setMidnightNotice(''), 10000);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isWarden, date]);

  // URL date tampering protection for Warden
  useEffect(() => {
    if (isWarden && requestedDate && requestedDate !== today) {
      setError(WARDEN_TODAY_ONLY);
      setDate(today);
      setSearchParams({});
    }
  }, [isWarden, requestedDate, today, setSearchParams]);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const targetDate = isWarden ? today : date;
      const response = await api.get(`${prefix}/attendance?date=${targetDate}`);
      setData(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [prefix, date, isWarden, today]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const recount = (students) => {
    let present = 0, absent = 0, pending = 0;
    students.forEach((s) => {
      if (s.status === 'Present') present++;
      else if (s.status === 'Absent') absent++;
      else pending++;
    });
    return { total: students.length, present, absent, pending };
  };

  const applyLocal = (ids, status) => {
    setData((prev) => {
      if (!prev) return prev;
      const isCleared = status === 'Pending';
      const students = prev.students.map((s) =>
        ids.includes(s._id)
          ? {
              ...s,
              status,
              auto_marked: false,
              is_locked: !isCleared,
              marked_by_name: isCleared ? null : user?.name,
              marked_at: isCleared ? null : new Date().toISOString(),
            }
          : s
      );
      return { ...prev, students, stats: recount(students) };
    });
  };

  const handleMark = async (studentId, status) => {
    const targetDate = isWarden ? today : date;
    try {
      await api.put(`${prefix}/attendance/${studentId}`, { status, date: targetDate });
      applyLocal([studentId], status);
      setFeedback({
        type: 'success',
        text: `Attendance ${status === 'Pending' ? 'cleared' : `marked as ${status}`} for selected student.`,
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update attendance',
      });
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const markRemainingPresent = async (ids) => {
    if (!ids.length) return;
    const targetDate = isWarden ? today : date;
    if (!(await confirmAction({ title: 'Mark everyone else Present?', message: `${ids.length} unmarked student(s) will be marked Present for ${prettyDate(targetDate)}. Marked attendance is locked and can't be changed.`, confirmLabel: 'Mark Present' }))) return;
    setBulkSaving(true);
    try {
      await api.put(`${prefix}/attendance`, { student_ids: ids, status: 'Present', date: targetDate });
      applyLocal(ids, 'Present');
      setFeedback({ type: 'success', text: `Marked ${ids.length} student(s) as Present.` });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err) {
      setFeedback({ type: 'error', text: err.response?.data?.message || 'Bulk update failed' });
      setTimeout(() => setFeedback(null), 5000);
    } finally {
      setBulkSaving(false);
    }
  };

  const students = data?.students || [];
  const stats = data?.stats || { total: 0, present: 0, absent: 0, pending: 0 };
  const hostelNames = [...new Set(students.map((s) => s.hostel_name || 'Unassigned'))].sort();

  const filteredStudents = students.filter((s) => {
    if (filter !== 'All' && s.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.roll_no?.toLowerCase().includes(q) && !s.name?.toLowerCase().includes(q)) return false;
    }
    if (hostelFilter && (s.hostel_name || 'Unassigned') !== hostelFilter) return false;
    return true;
  });
  const unmarkedVisible = filteredStudents.filter((s) => s.status === 'Pending').map((s) => s._id);
  const editable = data?.editable;

  const cards = [
    { key: 'All', label: 'Total Students', value: stats.total, icon: Users, tone: 'bg-blue-100 text-blue-600', ring: 'ring-indigo-500' },
    { key: 'Present', label: 'Present', value: stats.present, icon: CheckCircle, tone: 'bg-green-100 text-green-600', ring: 'ring-green-500' },
    { key: 'Absent', label: 'Absent', value: stats.absent, icon: XCircle, tone: 'bg-red-100 text-red-600', ring: 'ring-red-500' },
    { key: 'Pending', label: 'Not Marked', value: stats.pending, icon: Clock, tone: 'bg-yellow-100 text-yellow-600', ring: 'ring-yellow-500' },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Daily Attendance</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Attendance is the roll call. Once marked and saved, records are <span className="font-semibold text-slate-700">permanently locked</span> and cannot be edited, updated, or deleted by anyone. Students on a home visit are marked Absent automatically.
            </p>
          </div>
          {!isWarden && (
            <Link to={`${prefix}/attendance/report`} className="flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition text-sm flex-shrink-0">
              <BarChart3 size={16} /> Monthly report
            </Link>
          )}
        </div>

        {/* Date display & controls */}
        {isWarden ? (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-indigo-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Clock size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-slate-800">{prettyDate(today)}</span>
                  <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
                    Current Date Only
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Server Time (Asia/Kolkata): <span className="font-mono font-medium text-indigo-700">{liveTime}</span>
                </p>
              </div>
            </div>
            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
              <Lock size={12} className="text-slate-400" />
              <span>Past dates locked automatically at 12:00:00 AM midnight</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-3">
            <button onClick={() => setDate(shiftDate(date, -1))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600" aria-label="Previous day"><ChevronLeft size={18} /></button>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              aria-label="Attendance date"
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button onClick={() => setDate(shiftDate(date, 1))} disabled={date >= today} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-30" aria-label="Next day"><ChevronRight size={18} /></button>
            <span className="text-sm font-medium text-slate-700 ml-1">{prettyDate(date)}</span>
            {date !== today && <button onClick={() => setDate(today)} className="text-sm text-indigo-600 hover:underline ml-auto">Back to today</button>}
            {data && !editable && (
              <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 rounded-full px-3 py-1 ml-auto"><Lock size={12} /> View only</span>
            )}
          </div>
        )}

        {midnightNotice && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl p-3.5 flex items-center gap-2.5">
            <Clock size={16} className="text-amber-600 flex-shrink-0" />
            <span>{midnightNotice}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3.5 flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {feedback && (
          <div
            className={`text-sm rounded-xl p-3.5 border transition-all ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map(({ key, label, value, icon: Icon, tone, ring }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`bg-white rounded-xl shadow-sm border p-5 flex items-center text-left transition-all ${filter === key ? `ring-2 ${ring} border-transparent` : 'border-gray-100 hover:border-indigo-300'}`}
            >
              <div className={`p-3 rounded-lg mr-4 ${tone}`}><Icon className="w-6 h-6" /></div>
              <div>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{loading ? '—' : value}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Reg No or name..."
              className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {hostelNames.length > 1 && (
            <select value={hostelFilter} onChange={(e) => setHostelFilter(e.target.value)} aria-label="Filter by hostel" className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">All hostels</option>
              {hostelNames.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          )}
          {editable && unmarkedVisible.length > 0 && (
            <button
              onClick={() => markRemainingPresent(unmarkedVisible)}
              disabled={bulkSaving}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition ml-auto"
            >
              <CheckCheck size={16} /> {bulkSaving ? 'Saving...' : `Mark ${unmarkedVisible.length} unmarked as Present`}
            </button>
          )}
        </div>

        {/* Student List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Reg No</th>
                  <th className="px-6 py-4 font-medium">Hostel / Room</th>
                  <th className="px-6 py-4 font-medium">Attendance</th>
                  {data?.is_today && <th className="px-6 py-4 font-medium">Hostel Status (live)</th>}
                  <th className="px-6 py-4 font-medium text-right">{editable ? 'Actions' : 'Marked by'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <SkeletonTableRows rows={6} cols={6} />
                ) : filteredStudents.map((s) => (
                  <tr key={s._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{s.name}</td>
                    <td className="px-6 py-4">{s.roll_no || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{s.hostel_name || 'Unassigned'} · {s.room_no || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={s.status === 'Pending' ? 'Not Marked' : s.status} />
                      {s.marked_by_name && s.status !== 'Pending' && (
                        <p className="text-[11px] text-slate-400 mt-1 whitespace-nowrap">
                          {s.auto_marked ? 'Auto (gone home)' : `by ${s.marked_by_name}`} {fmtTime(s.marked_at)}
                        </p>
                      )}
                    </td>
                    {data?.is_today && <td className="px-6 py-4">{s.location ? <StatusBadge status={s.location} /> : '—'}</td>}
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      {editable ? (
                        s.is_locked ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200" title="Attendance is permanently locked and cannot be edited or deleted">
                            <Lock size={12} className="text-slate-500" /> Locked
                          </span>
                        ) : (
                          <>
                            {[['Present', 'bg-green-600 hover:bg-green-700 text-white'], ['Absent', 'bg-red-600 hover:bg-red-700 text-white']].map(([st, cls]) => (
                              <button
                                key={st}
                                onClick={() => handleMark(s._id, st)}
                                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors shadow-sm ${cls}`}
                              >
                                Mark {st}
                              </button>
                            ))}
                          </>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">{s.marked_by_name || '—'}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && filteredStudents.length === 0 && (
                  <tr><td colSpan="6"><EmptyState title="No students match these filters" /></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminAttendance;
