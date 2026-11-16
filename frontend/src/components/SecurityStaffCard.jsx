import { useState, useEffect } from 'react';
import Modal from './Modal';
import PasswordField, { passwordProblem } from './PasswordField';
import api from '../api/axios';
import { Shield, KeyRound } from 'lucide-react';

// Admin: security-guard accounts with a password reset ("forgot password").
const SecurityStaffCard = () => {
  const [staff, setStaff] = useState([]);
  const [target, setTarget] = useState(null);
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/admin/security-staff').then((r) => setStaff(r.data)).catch(() => {});
  }, []);

  const open = (s) => { setTarget(s); setForm({ password: '', confirm: '' }); setError(''); setDone(''); };

  const submit = async (e) => {
    e.preventDefault();
    const problem = passwordProblem(form.password);
    if (problem) return setError(`Password: ${problem}`);
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    setError('');
    try {
      const r = await api.put(`/admin/users/${target._id}/password`, { password: form.password });
      setDone(r.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mt-6">
      <h3 className="font-semibold text-slate-800 p-5 border-b border-slate-100 flex items-center gap-2"><Shield size={18} className="text-slate-500" /> Security staff accounts</h3>
      {staff.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No security accounts.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {staff.map((s) => (
            <div key={s._id} className="flex items-center gap-3 p-4 sm:px-5">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800">{s.name}</p>
                <p className="text-xs text-slate-500">{s.email}{s.phone ? ` · ${s.phone}` : ''}</p>
              </div>
              <button onClick={() => open(s)} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg px-3 py-1.5"><KeyRound size={14} /> Reset password</button>
            </div>
          ))}
        </div>
      )}

      {target && (
        <Modal title={`Reset password — ${target.name}`} onClose={() => setTarget(null)}>
          {done ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3">{done}</div>
              <button onClick={() => setTarget(null)} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl transition">Done</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
              <PasswordField id="sec-reset-pw" label="New password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} showStrength />
              <PasswordField id="sec-reset-pw2" label="Confirm new password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} />
              <div className="flex gap-3">
                <button type="button" onClick={() => setTarget(null)} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
                <button type="submit" disabled={busy} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition">{busy ? 'Saving...' : 'Reset Password'}</button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};

export default SecurityStaffCard;
