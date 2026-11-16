import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { Siren, Phone, Plus, Pencil, Trash2, CheckCircle2, Hand, Car, Shield, UserCog, Ambulance, Stethoscope, Contact } from 'lucide-react';
import { EmptyState, SkeletonRows } from '../../components/ui/Feedback';
import { formatDateTime } from '../../utils/format';
import { toast } from '../../components/ui/Toast';
import { confirmAction } from '../../components/ui/ConfirmDialog';

const CATEGORIES = ['Warden', 'Security', 'Driver', 'Ambulance', 'Medical', 'Other'];
const ICONS = { Warden: UserCog, Security: Shield, Driver: Car, Ambulance, Medical: Stethoscope, Other: Contact };
const inputCls = 'w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';
const fmt = formatDateTime;
const emptyForm = { name: '', category: 'Driver', phone: '', notes: '', is_active: true };

// Warden / admin: SOS alerts + manage emergency contacts. Security: SOS alerts.
const EmergencyCenter = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'warden' || user?.role === 'admin';
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('Active');
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { contact? }
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await api.get(`/emergency/sos?status=${filter}`);
      setAlerts(res.data);
    } catch (e) { console.error(e); }
  }, [filter]);

  const loadContacts = useCallback(async () => {
    if (!canManage) return;
    try {
      const res = await api.get('/emergency/contacts');
      setContacts(res.data);
    } catch (e) { console.error(e); }
  }, [canManage]);

  useEffect(() => {
    Promise.all([loadAlerts(), loadContacts()]).finally(() => setLoading(false));
    // New SOS alerts show up without a refresh.
    const id = setInterval(() => document.visibilityState === 'visible' && loadAlerts(), 20000);
    return () => clearInterval(id);
  }, [loadAlerts, loadContacts]);

  const act = async (a, action) => {
    let note;
    if (action === 'resolve') {
      note = window.prompt('How was it resolved? (optional)', '');
      if (note === null) return;
    }
    setBusy(a._id);
    try {
      await api.put(`/emergency/sos/${a._id}/${action}`, action === 'resolve' ? { note } : {});
      loadAlerts();
    } catch (e) { toast.error(e.response?.data?.message || 'Could not update the alert.'); loadAlerts(); }
    finally { setBusy(null); }
  };

  const openForm = (contact = null) => {
    setForm(contact ? { name: contact.name, category: contact.category, phone: contact.phone, notes: contact.notes || '', is_active: contact.is_active } : emptyForm);
    setError('');
    setModal({ contact });
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (modal.contact) await api.put(`/emergency/contacts/${modal.contact._id}`, form);
      else await api.post('/emergency/contacts', form);
      setModal(null);
      loadContacts();
    } catch (err) { setError(err.response?.data?.message || 'Could not save.'); }
  };

  const remove = async (c) => {
    if (!(await confirmAction({ title: `Remove ${c.name}?`, message: 'They will no longer appear in the emergency contacts students see.', confirmLabel: 'Remove', danger: true }))) return;
    try {
      await api.delete(`/emergency/contacts/${c._id}`);
      loadContacts();
    } catch (err) { toast.error(err.response?.data?.message || 'Could not remove.'); }
  };

  const open = alerts.filter((a) => a.status === 'Open').length;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Siren className="text-red-600" size={24} /> Emergency Help</h1>
        <p className="text-slate-500 mt-1">
          {canManage ? 'SOS alerts from students, and the emergency numbers students see on their dashboard' : 'SOS alerts raised by students'}
        </p>
      </div>

      {/* SOS alerts */}
      <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden mb-6 ${open ? 'border-red-300' : 'border-slate-100'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            SOS Alerts {open > 0 && <span className="text-xs bg-red-600 text-white rounded-full px-2 py-0.5 animate-pulse">{open} new</span>}
          </h3>
          <div className="flex gap-2">
            {['Active', 'Resolved', 'All'].map((t) => (
              <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === t ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}>{t}</button>
            ))}
          </div>
        </div>
        {loading ? (
          <SkeletonRows rows={4} />
        ) : alerts.length === 0 ? (
          <EmptyState title={filter === 'Active' ? 'No active SOS alerts' : 'No alerts'} message={filter === 'Active' ? 'All clear right now.' : undefined} />
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((a) => (
              <div key={a._id} className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 sm:px-5 ${a.status === 'Open' ? 'bg-red-50/60' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
                    {a.student?.name} <span className="font-normal text-sm text-slate-500">{a.student?.roll_no} · Room {a.student?.room_no || '—'}{a.hostel_name ? ` · ${a.hostel_name}` : ''}</span>
                  </p>
                  {a.message && <p className="text-sm text-slate-700 mt-0.5">"{a.message}"</p>}
                  <p className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-4">
                    <span>Raised {fmt(a.created_at)}</span>
                    {a.acknowledged_at && <span>Seen by {a.acknowledger?.name} at {fmt(a.acknowledged_at)}</span>}
                    {a.resolved_at && <span>Resolved by {a.resolver?.name}{a.resolution_note ? `: ${a.resolution_note}` : ''}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  {a.student?.phone && (
                    <a href={`tel:${a.student.phone}`} className="flex items-center gap-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-500 rounded-lg px-3 py-1.5"><Phone size={13} /> Call student</a>
                  )}
                  {a.student?.parent_contact && (
                    <a href={`tel:${a.student.parent_contact}`} className="flex items-center gap-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg px-3 py-1.5"><Phone size={13} /> Parent</a>
                  )}
                  {a.status === 'Open' && (
                    <button disabled={busy === a._id} onClick={() => act(a, 'acknowledge')} className="flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg px-3 py-1.5 disabled:opacity-60"><Hand size={13} /> I'm on it</button>
                  )}
                  {a.status !== 'Resolved' ? (
                    <button disabled={busy === a._id} onClick={() => act(a, 'resolve')} className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 hover:bg-indigo-50 rounded-lg px-3 py-1.5 disabled:opacity-60"><CheckCircle2 size={13} /> Resolve</button>
                  ) : <StatusBadge status="Resolved" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contacts */}
      {canManage && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-100">
            <div>
              <h3 className="font-semibold text-slate-800">Emergency contacts</h3>
              <p className="text-xs text-slate-500">Shown to students on their dashboard. Students also always see their own warden and on-duty security.</p>
            </div>
            <button onClick={() => openForm()} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition text-sm"><Plus size={16} /> Add contact</button>
          </div>
          {contacts.length === 0 ? (
            <EmptyState title="No contacts yet" message="Add the hostel driver, ambulance and doctor numbers." />
          ) : (
            <div className="divide-y divide-slate-100">
              {contacts.map((c) => {
                const Icon = ICONS[c.category] || Contact;
                return (
                  <div key={c._id} className={`flex items-center gap-3 p-4 sm:px-5 ${c.is_active ? '' : 'opacity-50'}`}>
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0"><Icon size={18} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800">{c.name} <span className="text-xs font-normal text-slate-400">· {c.category}{c.hostel_id ? '' : ' · all hostels'}{c.is_active ? '' : ' · hidden'}</span></p>
                      <p className="text-sm text-slate-600">{c.phone}{c.notes ? <span className="text-slate-400"> · {c.notes}</span> : ''}</p>
                    </div>
                    {c.can_edit && (
                      <div className="flex gap-1">
                        <button onClick={() => openForm(c)} className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50" aria-label={`Edit ${c.name}`}><Pencil size={16} /></button>
                        <button onClick={() => remove(c)} className="p-2 rounded-lg text-red-600 hover:bg-red-50" aria-label={`Remove ${c.name}`}><Trash2 size={16} /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {modal && (
        <Modal title={modal.contact ? 'Edit contact' : 'Add emergency contact'} onClose={() => setModal(null)}>
          <form onSubmit={save} className="space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ec-category" className="block text-sm font-medium text-slate-600 mb-1.5">Type</label>
                <select id="ec-category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="ec-phone" className="block text-sm font-medium text-slate-600 mb-1.5">Phone</label>
                <input id="ec-phone" type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="9876543210" className={inputCls} />
              </div>
            </div>
            <div>
              <label htmlFor="ec-name" className="block text-sm font-medium text-slate-600 mb-1.5">Name</label>
              <input id="ec-name" required maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ravi (hostel driver)" className={inputCls} />
            </div>
            <div>
              <label htmlFor="ec-notes" className="block text-sm font-medium text-slate-600 mb-1.5">Notes (optional)</label>
              <input id="ec-notes" maxLength={200} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Night shift · Car KA-01-AB-1234" className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Show to students</label>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setModal(null)} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
              <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl transition">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </Layout>
  );
};

export default EmergencyCenter;
