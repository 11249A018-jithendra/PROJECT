import { useState } from 'react';
import Modal from './Modal';
import PasswordField, { passwordProblem } from './PasswordField';
import api from '../api/axios';
import { setToken } from '../portal';

// Any signed-in user changes their own password. Other devices are signed
// out; this one keeps working with the fresh token the server returns.
const ChangePasswordModal = ({ onClose }) => {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const problem = passwordProblem(form.next);
    if (problem) return setError(`New password: ${problem}`);
    if (form.next !== form.confirm) return setError('The new passwords do not match.');
    setSaving(true);
    try {
      const res = await api.put('/auth/password', { current_password: form.current, new_password: form.next });
      setToken(res.data.token);
      setDone(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change the password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Change Password" onClose={onClose}>
      {done ? (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3">{done}</div>
          <button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 rounded-xl transition">Done</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
          <PasswordField id="pw-current" label="Current password" value={form.current} onChange={(v) => setForm({ ...form, current: v })} autoComplete="current-password" />
          <PasswordField id="pw-new" label="New password" value={form.next} onChange={(v) => setForm({ ...form, next: v })} showStrength />
          <PasswordField id="pw-confirm" label="Confirm new password" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} />
          <p className="text-xs text-slate-500">You'll stay signed in here; other devices will be signed out.</p>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 font-medium py-2.5 rounded-xl hover:bg-slate-50 transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl transition">
              {saving ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ChangePasswordModal;
