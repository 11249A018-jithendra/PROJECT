import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import api from '../../api/axios';
import { ArrowLeft, Download, AlertTriangle, Users, Percent, Search } from 'lucide-react';
import { EmptyState, SkeletonTableRows } from '../../components/ui/Feedback';

const istMonth = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 7);
const monthLabel = (m) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const pctTone = (p) => (p === null ? 'text-slate-400' : p >= 90 ? 'text-green-600' : p >= 75 ? 'text-amber-600' : 'text-red-600');

// Quotes a CSV cell (commas, quotes, newlines) and defuses values Excel
// would run as a formula (e.g. a student named "=HYPERLINK(...)").
const cell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

const AttendanceReport = () => {
  const [month, setMonth] = useState(istMonth());
  const [hostelId, setHostelId] = useState('');
  const [hostels, setHostels] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('percentage');

  useEffect(() => {
    api.get('/admin/hostels').then((r) => setHostels(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ month });
    if (hostelId) params.set('hostel_id', hostelId);
    api.get(`/admin/attendance/report?${params}`)
      .then((r) => { setData(r.data); setError(''); })
      .catch((e) => setError(e.response?.data?.message || 'Could not load the report.'))
      .finally(() => setLoading(false));
  }, [month, hostelId]);

  const rows = (data?.students || [])
    .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.roll_no || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : (a.percentage ?? 101) - (b.percentage ?? 101)));

  const downloadCsv = () => {
    if (!data) return;
    const days = (data.daily || []).map((d) => d.date);
    const header = ['Roll No', 'Name', 'Room', 'Hostel', ...days, 'Present', 'Absent', 'Days Marked', 'Percentage'];
    const lines = [header.map(cell).join(',')];
    for (const s of rows) {
      lines.push([
        cell(s.roll_no), cell(s.name), cell(s.room_no), cell(s.hostel_name),
        ...days.map(() => ''), // matrix per-student left compact for summary
        cell(s.present), cell(s.absent), cell(s.days), cell(s.percentage !== null ? `${s.percentage}%` : 'N/A'),
      ].join(','));
    }
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${month}${hostelId ? `-${hostelId}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/admin/attendance" className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition" aria-label="Back">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Attendance Report</h1>
              <p className="text-slate-500 text-sm mt-0.5">Monthly rollup and percentage per student</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="month"
              value={month}
              max={istMonth()}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {hostels.length > 1 && (
              <select value={hostelId} onChange={(e) => setHostelId(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">All hostels</option>
                {hostels.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
              </select>
            )}
            <button
              onClick={downloadCsv}
              disabled={!data || !rows.length}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
            >
              <Download size={16} /> Export CSV
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}

        {/* Summary stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600"><Users size={22} /></div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Students</p>
              <p className="text-2xl font-bold text-slate-800 mt-0.5">{loading ? '—' : data?.summary?.students ?? 0}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-50 text-green-600"><Percent size={22} /></div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Average Attendance</p>
              <p className="text-2xl font-bold text-slate-800 mt-0.5">{loading ? '—' : data?.summary?.average_percentage != null ? `${data.summary.average_percentage}%` : '—'}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-50 text-red-600"><AlertTriangle size={22} /></div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Below 75%</p>
              <p className="text-2xl font-bold text-red-600 mt-0.5">{loading ? '—' : data?.summary?.below_75 ?? 0}</p>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student or Reg No..."
              className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <span className="text-xs text-slate-500">Showing {monthLabel(month)} ({data?.days ?? 0} days recorded)</span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Student</th>
                <th className="px-5 py-3.5">Hostel / Room</th>
                <th className="px-5 py-3.5 text-center">Days</th>
                <th className="px-5 py-3.5 text-center">Present</th>
                <th className="px-5 py-3.5 text-center">Absent</th>
                <th className="px-5 py-3.5 text-center">Not Marked</th>
                <th className="px-5 py-3.5 text-right cursor-pointer select-none" onClick={() => setSort(sort === 'percentage' ? 'name' : 'percentage')}>
                  Attendance %
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <SkeletonTableRows rows={6} cols={7} />
              ) : rows.length === 0 ? (
                <tr><td colSpan={7}><EmptyState title="No records for this month" /></td></tr>
              ) : (
                rows.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      <div>{s.name}</div>
                      <div className="text-xs text-slate-400 font-normal">{s.roll_no || '—'}</div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">{s.hostel_name || 'Unassigned'} · {s.room_no || '—'}</td>
                    <td className="px-5 py-3.5 text-center">{s.days}</td>
                    <td className="px-5 py-3.5 text-center font-medium text-green-600">{s.present}</td>
                    <td className="px-5 py-3.5 text-center font-medium text-red-600">{s.absent}</td>
                    <td className="px-5 py-3.5 text-center text-slate-400">{s.not_marked}</td>
                    <td className={`px-5 py-3.5 text-right font-bold ${pctTone(s.percentage)}`}>
                      {s.percentage !== null ? `${s.percentage}%` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
};

export default AttendanceReport;
