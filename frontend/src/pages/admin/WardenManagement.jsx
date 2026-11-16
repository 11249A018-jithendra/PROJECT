import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import PasswordField, { passwordProblem } from '../../components/PasswordField';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/axios';
import SecurityStaffCard from '../../components/SecurityStaffCard';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';
import { formatDate } from '../../utils/format';
import { confirmAction } from '../../components/ui/ConfirmDialog';
import {
  Search, UserCog, Plus, Eye, Pencil, KeyRound, Power, Trash2, Building2, Phone, Mail, Users, AlertTriangle, Filter,
} from 'lucide-react';

const emptyForm = { name: '', email: '', phone: '', hostel_id: '', password: '', confirm: '' };

const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const fmtDate = formatDate;

const WardenManagement = () => {
  const [wardens, setWardens] = useState([]);
  const [hostels, setHostels] = useState([]);
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [hostelFilter, setHostelFilter] = useState('');

  // Which modal is open: { type: 'form'|'view'|'password'|'status', warden }
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [viewData, setViewData] = useState(null);
  const [reassignTo, setReassignTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const fetchWardens = useCallback(async () => {
    try {
      const res = await api.get('/admin/wardens');
      setWardens(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchWardens();
    api.get('/admin/hostels')
      .then((res) => setHostels(res.data))
      .catch((e) => { if (e.response?.status === 503) setSetupRequired(true); });
  }, [fetchWardens]);

  const close = () => { setModal(null); setError(''); setViewData(null); };

  const openForm = (warden = null) => {
    setForm(warden
      ? { name: warden.name, email: warden.email, phone: warden.phone || '', hostel_id: warden.hostel_id || '', password: '', confirm: '' }
      : emptyForm);
    setError('');
    setModal({ type: 'form', warden });
  };

  const openView = async (warden) => {
    setModal({ type: 'view', warden });
    try {
      const res = await api.get(`/admin/wardens/${warden._id}`);
      setViewData(res.data);
    } catch (e) { setError(e.response?.data?.message || 'Could not load warden.'); }
  };

  const openPassword = (warden) => { setForm({ ...emptyForm }); setError(''); setModal({ type: 'password', warden }); };
  const openStatus = (warden) => { setReassignTo(''); setError(''); setModal({ type: 'status', warden }); };

  const run = async (fn, successMsg) => {
    setSubmitting(true);
    setError('');
    try {
      await fn();
      close();
      setNotice(successMsg);
      setTimeout(() => setNotice(''), 4000);
      fetchWardens();
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSave = (e) => {
    e.preventDefault();
    const editing = modal.warden;
    if (!editing) {
      const pw = passwordProblem(form.password);
      if (pw) return setError(`Password: ${pw}`);
      if (form.password !== form.confirm) return setError('Passwords do not match.');
    }
    const payload = { name: form.name, email: form.email, phone: form.phone };
    if (!setupRequired) payload.hostel_id = form.hostel_id || null;
    run(
      () => (editing ? api.put(`/admin/wardens/${editing._id}`, payload) : api.post('/admin/wardens', { ...payload, password: form.password })),
      editing ? 'Warden updated.' : 'Warden account created.'
    );
  };

  const handleReset = (e) => {
    e.preventDefault();
    const pw = passwordProblem(form.password);
    if (pw) return setError(`Password: ${pw}`);
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    run(() => api.put(`/admin/wardens/${modal.warden._id}/password`, { password: form.password }),
      `Password reset for ${modal.warden.name}. They have been signed out everywhere.`);
  };

  const handleStatus = () => {
    const w = modal.warden;
    run(() => api.patch(`/admin/wardens/${w._id}/status`, { is_active: !w.is_active, reassign_to: reassignTo || undefined }),
      w.is_active ? `${w.name} deactivated.` : `${w.name} reactivated.`);
  };

  const handleDelete = async (w) => {
    if (!(await confirmAction({ title: `Permanently delete ${w.name}?`, message: 'Their students will be unassigned. This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
    run(() => api.delete(`/admin/wardens/${w._id}`), 'Warden deleted.');
  };

  const q = search.trim().toLowerCase();
  const filtered = wardens.filter((w) => {
    if (q && ![w.name, w.email, w.phone].some((v) => v && v.toLowerCase().includes(q))) return false;
    if (statusFilter === 'Active' && !w.is_active) return false;
    if (statusFilter === 'Inactive' && w.is_active) return false;
    if (hostelFilter && (hostelFilter === 'none' ? w.hostel_id : w.hostel_id !== hostelFilter)) return false;
    return true;
  });

  const activeCount = wardens.filter((w) => w.is_active).length;
  const otherActive = modal?.warden ? wardens.filter((w) => w.is_active && w._id !== modal.warden._id) : [];

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Warden Management</h1>
          <p className="text-slate-500 mt-1">Create, edit and manage warden accounts and hostel assignments</p>
        </div>
        <button
          onClick={() => openForm()}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-200"
        >
          <Plus size={18} /> Add Warden
        </button>
      </div>

      {setupRequired && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 mb-5 text-sm">
          <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
          <p>Hostel assignment and account status need a one-time database update. Run <code className="font-mono">hostel_tracking.sql</code> in the Supabase SQL Editor.</p>
        </div>
      )}
      {notice && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3 mb-5">{notice}</div>}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          ['Total Wardens', wardens.length, 'text-slate-800'],
          ['Active', activeCount, 'text-green-600'],
          ['Inactive', wardens.length - activeCount, 'text-slate-500'],
        ].map(([label, value, cls]) => (
          <div key={label} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <p className={`text-2xl font-bold ${cls}`}>{loading ? '—' : value}</p>
            <p className="text-slate-500 text-sm">{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or phone..."
            className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3">
          <Filter size={14} className="text-slate-400" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-sm py-2.5 bg-transparent focus:outline-none" aria-label="Filter by status">
            <option>All</option><option>Active</option><option>Inactive</option>
          </select>
        </div>
        {!setupRequired && (
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3">
            <Building2 size={14} className="text-slate-400" />
            <select value={hostelFilter} onChange={(e) => setHostelFilter(e.target.value)} className="text-sm py-2.5 bg-transparent focus:outline-none" aria-label="Filter by hostel">
              <option value="">All hostels</option>
              <option value="none">No hostel</option>
              {hostels.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={UserCog} title={wardens.length ? 'No wardens match your filters' : 'No wardens yet'} message={wardens.length ? undefined : 'Add the first one with the button above.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-semibold">Warden</th>
                  <th className="px-5 py-3 font-semibold">Assigned Hostel</th>
                  <th className="px-5 py-3 font-semibold">Phone</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold text-center">Students</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((w) => (
                  <tr key={w._id} className={`hover:bg-slate-50 transition ${w.is_active ? '' : 'opacity-70'}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-violet-100 rounded-full flex items-center justify-center text-violet-600 font-bold text-sm flex-shrink-0">
                          {w.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800 whitespace-nowrap">{w.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{w.hostel_name || <span className="text-slate-400">Not assigned</span>}</td>
                    <td className="px-5 py-3 text-slate-600 whitespace-nowrap">{w.phone || '—'}</td>
                    <td className="px-5 py-3 text-slate-600">{w.email}</td>
                    <td className="px-5 py-3 text-center text-slate-700 font-medium">{w.student_count}</td>
                    <td className="px-5 py-3"><StatusBadge status={w.is_active ? 'Active' : 'Inactive'} /></td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <IconBtn title="View" onClick={() => openView(w)} icon={Eye} />
                        <IconBtn title="Edit" onClick={() => openForm(w)} icon={Pencil} />
                        <IconBtn title="Reset password" onClick={() => openPassword(w)} icon={KeyRound} />
                        {!setupRequired && (
                          <IconBtn
                            title={w.is_active ? 'Deactivate' : 'Activate'}
                            onClick={() => openStatus(w)}
                            icon={Power}
                            tone={w.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit */}
      {modal?.type === 'form' && (
        <Modal title={modal.warden ? 'Edit Warden' : 'Add New Warden'} onClose={close}>
          <form onSubmit={handleSave} className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
            <Field label="Full Name"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
            <Field label="Email"><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Field>
            <Field label="Phone"><input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" className={inputCls} /></Field>
            {!setupRequired && (
              <Field label="Assigned Hostel">
                <select value={form.hostel_id} onChange={(e) => setForm({ ...form, hostel_id: e.target.value })} className={inputCls}>
                  <option value="">-- Not assigned --</option>
                  {hostels.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
                </select>
                {hostels.length === 0 && <p className="text-xs text-slate-400 mt-1">Create hostels on the Hostels page first.</p>}
              </Field>
            )}
            {!modal.warden && (
              <>
                <PasswordField id="warden-password" label="Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} showStrength />
                <PasswordField id="warden-password-confirm" label="Confirm Password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} />
              </>
            )}
            <FormButtons onCancel={close} submitting={submitting} label={modal.warden ? 'Save Changes' : 'Create Warden'} />
          </form>
        </Modal>
      )}

      {/* View */}
      {modal?.type === 'view' && (
        <Modal title="Warden Details" onClose={close} size="max-w-lg">
          {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4">{error}</div>}
          {!viewData ? (
            <div className="py-10 flex justify-center"><div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center text-2xl font-bold text-violet-600">{viewData.name?.[0]?.toUpperCase()}</div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800 text-lg">{viewData.name}</h3>
                  <StatusBadge status={viewData.is_active ? 'Active' : 'Inactive'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Info icon={Mail} label="Email" value={viewData.email} />
                <Info icon={Phone} label="Phone" value={viewData.phone} />
                <Info icon={Building2} label="Hostel" value={viewData.hostel_name} />
                <Info icon={Users} label="Students" value={viewData.student_count} />
                <Info label="Account created" value={fmtDate(viewData.created_at)} />
                <Info label="Password last changed" value={fmtDate(viewData.password_changed_at)} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Assigned students ({viewData.students.length})</p>
                {viewData.students.length === 0 ? (
                  <p className="text-sm text-slate-400">No students assigned.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-50 border border-slate-100 rounded-xl">
                    {viewData.students.map((s) => (
                      <div key={s._id} className="flex justify-between px-3 py-2 text-sm">
                        <span className="text-slate-700">{s.name}</span>
                        <span className="text-slate-400">{s.roll_no || '—'} · Room {s.room_no || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {!viewData.is_active && (
                <button onClick={() => handleDelete(viewData)} className="w-full flex items-center justify-center gap-2 text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-xl py-2.5 transition">
                  <Trash2 size={16} /> Delete permanently
                </button>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Reset password */}
      {modal?.type === 'password' && (
        <Modal title={`Reset Password — ${modal.warden.name}`} onClose={close}>
          <form onSubmit={handleReset} className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
            <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-3">
              The new password is stored hashed and is never shown again. Share it with the warden securely — they'll be signed out of all devices.
            </p>
            <PasswordField id="reset-password" label="New Password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} showStrength />
            <PasswordField id="reset-password-confirm" label="Confirm New Password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} />
            <FormButtons onCancel={close} submitting={submitting} label="Reset Password" />
          </form>
        </Modal>
      )}

      {/* Activate / deactivate */}
      {modal?.type === 'status' && (
        <Modal title={modal.warden.is_active ? 'Deactivate Warden' : 'Reactivate Warden'} onClose={close}>
          <div className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
            {modal.warden.is_active ? (
              <>
                <p className="text-sm text-slate-600">
                  <span className="font-semibold">{modal.warden.name}</span> will be signed out immediately and won't be able to log in. Their records and history are kept, and you can reactivate them later.
                </p>
                {modal.warden.student_count > 0 && (
                  <Field label={`Move their ${modal.warden.student_count} student(s) to`}>
                    <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className={inputCls}>
                      <option value="">Keep assigned (nobody will approve their outpasses)</option>
                      {otherActive.map((w) => <option key={w._id} value={w._id}>{w.name}{w.hostel_name ? ` — ${w.hostel_name}` : ''}</option>)}
                    </select>
                  </Field>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-600"><span className="font-semibold">{modal.warden.name}</span> will be able to log in again with their existing password.</p>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={close} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
              <button
                onClick={handleStatus}
                disabled={submitting}
                className={`flex-1 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition ${modal.warden.is_active ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500'}`}
              >
                {submitting ? 'Saving...' : modal.warden.is_active ? 'Deactivate' : 'Reactivate'}
              </button>
            </div>
          </div>
        </Modal>
      )}
      <SecurityStaffCard />
    </Layout>
  );
};

const IconBtn = ({ title, onClick, icon: Icon, tone = 'text-indigo-600 hover:bg-indigo-50' }) => (
  <button onClick={onClick} title={title} aria-label={title} className={`p-2 rounded-lg transition ${tone}`}>
    <Icon size={16} />
  </button>
);

const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
    {children}
  </div>
);

const Info = ({ icon: Icon, label, value }) => (
  <div className="bg-slate-50 rounded-xl p-3">
    <p className="text-slate-400 text-xs flex items-center gap-1">{Icon && <Icon size={12} />}{label}</p>
    <p className="text-slate-700 text-sm font-medium mt-0.5 break-words">{value ?? '—'}</p>
  </div>
);

const FormButtons = ({ onCancel, submitting, label }) => (
  <div className="flex gap-3 pt-2">
    <button type="button" onClick={onCancel} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
    <button type="submit" disabled={submitting} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition">
      {submitting ? 'Saving...' : label}
    </button>
  </div>
);

export default WardenManagement;
