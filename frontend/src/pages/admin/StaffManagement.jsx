import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/axios';
import { Plus, Wrench, Pencil, Power } from 'lucide-react';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';
import { toast } from '../../components/ui/Toast';
import { confirmAction } from '../../components/ui/ConfirmDialog';

const TRADES = ['Electrician', 'Plumber', 'Carpenter', 'Housekeeping', 'Mess / Kitchen', 'IT / Internet', 'General maintenance'];
const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const emptyForm = { name: '', trade: TRADES[0], phone: '' };

const StaffManagement = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { member } | {}
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.get('/staff').then((r) => setStaff(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = (member = null) => {
    setForm(member ? { name: member.name, trade: member.trade, phone: member.phone || '' } : emptyForm);
    setError('');
    setModal({ member });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (modal.member) await api.put(`/staff/${modal.member._id}`, form);
      else await api.post('/staff', form);
      setModal(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (m) => {
    if (m.is_active && m.open_jobs && !(await confirmAction({ title: `Deactivate ${m.name}?`, message: `${m.name} has ${m.open_jobs} open job(s). They stay assigned until you reassign them.`, confirmLabel: 'Deactivate', danger: true }))) return;
    await api.put(`/staff/${m._id}`, { is_active: !m.is_active }).catch((err) => toast.error(err.response?.data?.message || 'Failed'));
    load();
  };

  return (
    <Layout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Maintenance Staff</h1>
          <p className="text-slate-500 mt-1">People complaints can be assigned to — electricians, plumbers, housekeeping…</p>
        </div>
        <button onClick={() => open()} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl transition shadow-md shadow-indigo-200">
          <Plus size={18} /> Add Staff
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : staff.length === 0 ? (
          <EmptyState icon={Wrench} title="No staff yet" message="Add the people who fix things so complaints can be assigned to them." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Trade</th>
                  <th className="px-5 py-3 font-semibold">Phone</th>
                  <th className="px-5 py-3 font-semibold text-center">Open jobs</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((m) => (
                  <tr key={m._id} className={`hover:bg-slate-50 ${m.is_active ? '' : 'opacity-60'}`}>
                    <td className="px-5 py-3 font-medium text-slate-800">{m.name}</td>
                    <td className="px-5 py-3 text-slate-600">{m.trade}</td>
                    <td className="px-5 py-3 text-slate-600">{m.phone || '—'}</td>
                    <td className="px-5 py-3 text-center text-slate-700">{m.open_jobs}</td>
                    <td className="px-5 py-3"><StatusBadge status={m.is_active ? 'Active' : 'Inactive'} /></td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => open(m)} className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50" aria-label={`Edit ${m.name}`}><Pencil size={16} /></button>
                        <button onClick={() => toggle(m)} className={`p-2 rounded-lg ${m.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`} aria-label={m.is_active ? `Deactivate ${m.name}` : `Activate ${m.name}`}><Power size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal.member ? 'Edit Staff' : 'Add Staff'} onClose={() => setModal(null)}>
          <form onSubmit={save} className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
            <div>
              <label htmlFor="staff-name" className="block text-sm font-medium text-slate-600 mb-1.5">Name</label>
              <input id="staff-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label htmlFor="staff-trade" className="block text-sm font-medium text-slate-600 mb-1.5">Trade</label>
              <input id="staff-trade" list="staff-trades" required value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} className={inputCls} />
              <datalist id="staff-trades">{TRADES.map((t) => <option key={t} value={t} />)}</datalist>
            </div>
            <div>
              <label htmlFor="staff-phone" className="block text-sm font-medium text-slate-600 mb-1.5">Phone</label>
              <input id="staff-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModal(null)} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
};

export default StaffManagement;
