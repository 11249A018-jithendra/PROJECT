import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import api from '../../api/axios';
import { EmptyState, SkeletonCards } from '../../components/ui/Feedback';
import { toast } from '../../components/ui/Toast';
import { confirmAction } from '../../components/ui/ConfirmDialog';
import {
  Building2, Users, CheckCircle, XCircle, Home, DoorOpen, LogIn, FileText, Plus, Pencil, Trash2,
  AlertTriangle, RefreshCw, ArrowRight, Clock,
} from 'lucide-react';

// Fixed colours, each always shown with a text label + count.
const LOCATION_SEGMENTS = [
  { key: 'inside', label: 'Inside Hostel', color: 'bg-emerald-500' },
  { key: 'outside', label: 'Outside Hostel', color: 'bg-amber-500' },
  { key: 'goneHome', label: 'Gone Home', color: 'bg-violet-500' },
];
const ATTENDANCE_SEGMENTS = [
  { key: 'present', label: 'Present', color: 'bg-green-500' },
  { key: 'absent', label: 'Absent', color: 'bg-red-500' },
  { key: 'notMarked', label: 'Not marked', color: 'bg-slate-300' },
];

const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

const StackedBar = ({ stats, segments, height = 'h-3' }) => {
  const total = segments.reduce((sum, s) => sum + (stats[s.key] || 0), 0);
  return (
    <div className={`flex w-full ${height} rounded-full overflow-hidden bg-slate-100 gap-0.5`}>
      {total > 0 && segments.map((s) =>
        stats[s.key] > 0 ? (
          <div
            key={s.key}
            className={`${s.color} transition-all duration-500`}
            style={{ width: `${(stats[s.key] / total) * 100}%` }}
            title={`${s.label}: ${stats[s.key]}`}
          />
        ) : null
      )}
    </div>
  );
};

const Legend = ({ stats, segments }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
    {segments.map((s) => (
      <span key={s.key} className="flex items-center gap-1.5 text-xs text-slate-500">
        <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
        {s.label} <span className="font-semibold text-slate-700">{stats[s.key] || 0}</span>
      </span>
    ))}
  </div>
);

const AdminHostels = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { hostel } for edit, {} for create
  const [form, setForm] = useState({ name: '', capacity: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const res = await api.get('/admin/hostel-summary');
      setSummary(res.data);
      setError('');
    } catch (e) {
      if (e.response?.status === 503) setSetupRequired(true);
      else setError(e.response?.data?.message || 'Could not load hostel summary.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Presence changes with every gate scan, so keep it fresh.
    const id = setInterval(() => document.visibilityState === 'visible' && load(true), 60000);
    return () => clearInterval(id);
  }, [load]);

  const openForm = (hostel = null) => {
    setForm(hostel ? { name: hostel.name, capacity: hostel.capacity ?? '' } : { name: '', capacity: '' });
    setFormError('');
    setModal({ hostel });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (modal.hostel) await api.put(`/admin/hostels/${modal.hostel._id}`, form);
      else await api.post('/admin/hostels', form);
      setModal(null);
      load(true);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Could not save hostel.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (hostel) => {
    if (!(await confirmAction({ title: `Delete hostel "${hostel.name}"?`, message: "Its rooms are deleted too. This can't be undone.", confirmLabel: 'Delete', danger: true }))) return;
    try {
      await api.delete(`/admin/hostels/${hostel._id}`);
      load(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete hostel.');
    }
  };

  const t = summary?.totals;
  const cards = [
    { label: 'Total Students', value: t?.total, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { label: 'Present Today', value: t?.present, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100', hint: t && `${t.notMarked} not marked` },
    { label: 'Absent Today', value: t?.absent, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
    { label: 'Inside Hostel', value: t?.inside, icon: LogIn, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Outside Hostel', value: t?.outside, icon: DoorOpen, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', hint: t?.overdue ? `${t.overdue} overdue` : null },
    { label: 'Gone Home', value: t?.goneHome, icon: Home, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100' },
    { label: 'Pending Outpasses', value: t?.pendingOutpasses, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: 'Hostels', value: t?.hostels, icon: Building2, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
  ];

  if (setupRequired) {
    return (
      <Layout>
        <h1 className="text-2xl font-bold text-slate-800 mb-6">Hostel Summary</h1>
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-5 text-sm">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <div>
            <p className="font-semibold mb-1">One-time database setup needed</p>
            <p>Run <code className="font-mono">hostel_tracking.sql</code> in the Supabase SQL Editor (Project → SQL Editor → New query), then reload this page.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Hostel Summary</h1>
          <p className="text-slate-500 mt-1">
            Today's attendance and live hostel presence {summary?.date && `· ${new Date(`${summary.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load(true)} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl transition text-sm" aria-label="Refresh">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => openForm()} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-200 text-sm">
            <Plus size={16} /> Add Hostel
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-5">{error}</div>}

      {/* Explainer: attendance vs presence */}
      <div className="grid sm:grid-cols-2 gap-3 mb-6 text-sm">
        <div className="flex gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <CheckCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-slate-600"><span className="font-semibold text-slate-800">Daily attendance</span> is the roll call marked by wardens or admins for today.</p>
        </div>
        <div className="flex gap-3 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <DoorOpen size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-slate-600"><span className="font-semibold text-slate-800">Hostel presence</span> is live, updated by security QR scans at the gate. Home-visit outpasses count as "Gone Home".</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {cards.map(({ label, value, icon: Icon, color, bg, border, hint }) => (
          <div key={label} className={`bg-white rounded-2xl p-5 shadow-sm border ${border}`}>
            <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-4`}>
              <Icon size={22} className={color} />
            </div>
            <p className="text-3xl font-bold text-slate-800">{loading ? <span className="animate-pulse text-slate-300">—</span> : (value ?? 0)}</p>
            <p className="text-slate-500 text-sm mt-1">{label}</p>
            {hint && !loading && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
          </div>
        ))}
      </div>

      {/* Charts: across all hostels */}
      {t && (
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800 mb-1">Live presence — all hostels</h3>
            <p className="text-xs text-slate-400 mb-4">From gate QR scans</p>
            <StackedBar stats={t} segments={LOCATION_SEGMENTS} height="h-5" />
            <Legend stats={t} segments={LOCATION_SEGMENTS} />
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="font-semibold text-slate-800 mb-1">Today's attendance — all hostels</h3>
            <p className="text-xs text-slate-400 mb-4">Roll call marked by staff</p>
            <StackedBar stats={t} segments={ATTENDANCE_SEGMENTS} height="h-5" />
            <Legend stats={t} segments={ATTENDANCE_SEGMENTS} />
          </div>
        </div>
      )}

      {/* Per-hostel cards */}
      <h3 className="font-semibold text-slate-800 mb-3">By hostel</h3>
      {loading ? (
        <SkeletonCards cards={3} />
      ) : summary.hostels.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <EmptyState icon={Building2} title="No hostels yet" message="Add one, then assign students and wardens to it." />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {summary.hostels.map((h) => {
            const isUnassigned = h._id === 'unassigned';
            const occupancy = h.capacity ? Math.round((h.total / h.capacity) * 100) : null;
            return (
              <div key={h._id} className={`bg-white rounded-2xl shadow-sm border p-5 hover:shadow-md transition-shadow ${isUnassigned ? 'border-amber-200' : 'border-slate-100'}`}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isUnassigned ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                      {isUnassigned ? <AlertTriangle size={18} /> : <Building2 size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{h.name}</p>
                      <p className="text-xs text-slate-400 truncate">
                        {isUnassigned ? 'Assign these students to a hostel' : h.wardens.length ? `Warden: ${h.wardens.map((w) => w.name + (w.is_active ? '' : ' (inactive)')).join(', ')}` : 'No warden assigned'}
                      </p>
                    </div>
                  </div>
                  {!isUnassigned && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => openForm(h)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" aria-label={`Edit ${h.name}`}><Pencil size={15} /></button>
                      <button onClick={() => remove(h)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" aria-label={`Delete ${h.name}`}><Trash2 size={15} /></button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <MiniStat label="Students" value={h.total} sub={occupancy !== null ? `${occupancy}% of ${h.capacity}` : null} />
                  <MiniStat label="Present" value={h.present} tone="text-green-600" />
                  <MiniStat label="Absent" value={h.absent} tone="text-red-600" />
                  <MiniStat label="Inside" value={h.inside} tone="text-emerald-600" />
                  <MiniStat label="Gone Home" value={h.goneHome} tone="text-violet-600" />
                  <MiniStat label="Pending OP" value={h.pendingOutpasses} tone="text-blue-600" />
                </div>

                <p className="text-xs font-medium text-slate-500 mb-1.5">Live presence</p>
                <StackedBar stats={h} segments={LOCATION_SEGMENTS} />
                <Legend stats={h} segments={LOCATION_SEGMENTS} />

                <p className="text-xs font-medium text-slate-500 mb-1.5 mt-4">Today's attendance</p>
                <StackedBar stats={h} segments={ATTENDANCE_SEGMENTS} />
                <Legend stats={h} segments={ATTENDANCE_SEGMENTS} />

                {h.overdue > 0 && (
                  <p className="mt-3 text-xs font-medium text-red-600 flex items-center gap-1"><Clock size={12} /> {h.overdue} overdue to return</p>
                )}
                <Link
                  to={`/admin/tracking?hostel_id=${h._id}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm text-indigo-600 hover:gap-2 transition-all"
                >
                  View students <ArrowRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <Modal title={modal.hostel ? 'Edit Hostel' : 'Add Hostel'} onClose={() => setModal(null)}>
          <form onSubmit={save} className="space-y-4">
            {formError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{formError}</div>}
            <div>
              <label htmlFor="hostel-name" className="block text-sm font-medium text-slate-600 mb-1.5">Hostel name</label>
              <input id="hostel-name" required maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Boys Hostel A" className={inputCls} />
            </div>
            <div>
              <label htmlFor="hostel-capacity" className="block text-sm font-medium text-slate-600 mb-1.5">Capacity (optional)</label>
              <input id="hostel-capacity" type="number" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. 200" className={inputCls} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition">
                {saving ? 'Saving...' : 'Save Hostel'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
};

const MiniStat = ({ label, value, tone = 'text-slate-800', sub }) => (
  <div className="bg-slate-50 rounded-xl py-2 px-1">
    <p className={`text-lg font-bold ${tone}`}>{value}</p>
    <p className="text-[11px] text-slate-500 leading-tight">{label}</p>
    {sub && <p className="text-[10px] text-slate-400">{sub}</p>}
  </div>
);

export default AdminHostels;
