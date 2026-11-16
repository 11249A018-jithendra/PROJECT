import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import Pager from '../../components/Pager';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, LogOut, Search, Users, Clock } from 'lucide-react';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';
import { formatDateTime } from '../../utils/format';
import { toast } from '../../components/ui/Toast';

const fmt = formatDateTime;
const istToday = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
const duration = (from, to) => {
  const mins = Math.max(0, Math.round(((to ? new Date(to) : new Date()) - new Date(from)) / 60000));
  return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

const emptyForm = { visitor_name: '', phone: '', relation: '', purpose: '', id_proof: '', student: null };
const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const TABS = [
  { key: 'inside', label: 'Inside now' },
  { key: 'today', label: 'Today' },
  { key: 'all', label: 'All' },
];

const Visitors = () => {
  const { user } = useAuth();
  const canEdit = user?.role === 'security' || user?.role === 'admin';
  const [tab, setTab] = useState('inside');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (tab === 'inside') params.set('inside', 'true');
    if (tab === 'today') params.set('date', istToday());
    if (search.trim()) params.set('search', search.trim());
    try {
      const res = await api.get(`/visitors?${params}`);
      setData(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [tab, search, page]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => {
    const q = studentQuery.trim();
    if (q.length < 2 || form.student) { setStudentResults([]); return undefined; }
    const id = setTimeout(() => {
      api.get(`/outpasses/gate-lookup?q=${encodeURIComponent(q)}`).then((res) => setStudentResults(res.data.map((r) => r.student))).catch(() => {});
    }, 300);
    return () => clearTimeout(id);
  }, [studentQuery, form.student]);

  const checkIn = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { student, ...rest } = form;
      await api.post('/visitors', { ...rest, student_id: student?._id || null });
      setShowForm(false);
      setForm(emptyForm);
      setStudentQuery('');
      setTab('inside');
      setPage(1);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not check the visitor in.');
    } finally {
      setSaving(false);
    }
  };

  const checkOut = async (v) => {
    try {
      await api.put(`/visitors/${v._id}/checkout`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not check out.');
    }
  };

  const rows = data?.items || [];

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Visitor Log</h1>
          <p className="text-slate-500 mt-1">Record everyone who enters the hostel to meet a student</p>
        </div>
        {canEdit && (
          <button onClick={() => { setShowForm(true); setError(''); }} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-200">
            <UserPlus size={18} /> Check In Visitor
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search visitor name or phone..." aria-label="Search visitors" className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title={tab === 'inside' ? 'No visitors inside right now' : 'No visitors found'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-semibold">Visitor</th>
                  <th className="px-5 py-3 font-semibold">Visiting</th>
                  <th className="px-5 py-3 font-semibold">Purpose</th>
                  <th className="px-5 py-3 font-semibold">In</th>
                  <th className="px-5 py-3 font-semibold">Out</th>
                  <th className="px-5 py-3 font-semibold text-right">{canEdit ? 'Action' : ''}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((v) => (
                  <tr key={v._id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800">{v.visitor_name}</p>
                      <p className="text-xs text-slate-400">{[v.relation, v.phone, v.id_proof].filter(Boolean).join(' · ') || '—'}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {v.student ? <>{v.student.name}<span className="text-slate-400"> · {v.student.roll_no} · Room {v.student.room_no || '—'}</span></> : '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-600 max-w-[16rem] truncate">{v.purpose || '—'}</td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{fmt(v.check_in_at)}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {v.check_out_at ? (
                        <span className="text-slate-600">{fmt(v.check_out_at)} <span className="text-slate-400">({duration(v.check_in_at, v.check_out_at)})</span></span>
                      ) : (
                        <span className="text-amber-600 flex items-center gap-1"><Clock size={13} /> Inside {duration(v.check_in_at)}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {canEdit && !v.check_out_at && (
                        <button onClick={() => checkOut(v)} className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-lg px-3 py-1.5 transition">
                          <LogOut size={14} /> Check out
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager page={data.page} pages={data.pages} total={data.total} onChange={setPage} label="visitors" />}
      </div>

      {showForm && (
        <Modal title="Check In Visitor" onClose={() => setShowForm(false)}>
          <form onSubmit={checkIn} className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
            <Field label="Visitor name *"><input required value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} className={inputCls} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone"><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></Field>
              <Field label="Relation"><input value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} placeholder="Father, Friend…" className={inputCls} /></Field>
            </div>
            <Field label="Visiting student">
              {form.student ? (
                <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-sm">
                  <span>{form.student.name} · {form.student.roll_no} · Room {form.student.room_no || '—'}</span>
                  <button type="button" onClick={() => { setForm({ ...form, student: null }); setStudentQuery(''); }} className="text-indigo-600 text-xs hover:underline">Change</button>
                </div>
              ) : (
                <div className="relative">
                  <input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Search roll number or name (optional)" className={inputCls} />
                  {studentResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {studentResults.map((s) => (
                        <button type="button" key={s._id} onClick={() => setForm({ ...form, student: s })} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">
                          {s.name} <span className="text-slate-400">· {s.roll_no} · Room {s.room_no || '—'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Field>
            <Field label="Purpose"><input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="e.g. Dropping off belongings" className={inputCls} /></Field>
            <Field label="ID proof (type + last 4 digits)"><input value={form.id_proof} onChange={(e) => setForm({ ...form, id_proof: e.target.value })} placeholder="e.g. Aadhaar ••••1234" className={inputCls} /></Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition">{saving ? 'Saving...' : 'Check In'}</button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
};

const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
    {children}
  </div>
);

export default Visitors;
