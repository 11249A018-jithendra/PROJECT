import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn, ShieldCheck, UserCog } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { currentPortal } from '../portal';
import { homeFor } from '../utils/roleRoutes';
import api from '../api/axios';
import AuthShell from '../components/AuthShell';
import StudentAuthShell from '../components/StudentAuthShell';

const ROLE_LABELS = { student: 'Student', security: 'Security', admin: 'Admin', warden: 'Warden', staff: 'Staff' };
const Login = ({ initialRole }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const portal = currentPortal();
  const params = new URLSearchParams(location.search);
  const targetRole = initialRole || params.get('role') || 'student';
  const [staffRole, setStaffRole] = useState(() => {
    const chosen = params.get('as');
    if (chosen === 'admin' || chosen === 'warden') return chosen;
    try { return localStorage.getItem('hms_staff_role') === 'warden' ? 'warden' : 'admin'; } catch { return 'admin'; }
  });
  const [form, setForm] = useState({ identifier: '', password: '', rememberMe: false });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState({ open: false, sending: false, message: '', error: '' });
  const label = ROLE_LABELS[targetRole === 'staff' ? staffRole : targetRole] || 'Student';
  const Shell = targetRole === 'student' ? StudentAuthShell : AuthShell;
  const pickStaffRole = (role) => {
    setStaffRole(role);
    setError('');
    try { localStorage.setItem('hms_staff_role', role); } catch { /* storage blocked */ }
  };
  const requestReset = async () => {
    const identifier = form.identifier.trim();
    if (!identifier) return setForgot(f => ({ ...f, error: 'Type your email or roll number above first.', message: '' }));
    setForgot(f => ({ ...f, sending: true, error: '', message: '' }));
    try {
      const res = await api.post('/auth/forgot-password', { identifier });
      setForgot(f => ({ ...f, sending: false, message: res.data.message }));
    } catch (err) {
      setForgot(f => ({ ...f, sending: false, error: err.response?.data?.message || 'Could not send the request.' }));
    }
  };
  const handleSubmit = async event => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const user = await login(form.identifier.trim(), form.password, form.rememberMe, targetRole === 'staff' ? staffRole : undefined);
      navigate(homeFor(user.role));
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to sign in. Please verify your credentials and try again.');
    } finally { setLoading(false); }
  };
  return (
    <Shell title={`${label} sign in`} subtitle={targetRole === 'student' ? 'Your room, your people, your everyday campus life.' : 'Welcome back. Your campus workspace is ready.'} eyebrow="YOUR HOSTELMS ACCOUNT">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
        {targetRole === 'staff' && <fieldset><legend className="text-sm font-medium text-slate-600 mb-2">Sign in as</legend><div className="grid grid-cols-2 gap-2 p-1 bg-indigo-50 border border-indigo-100 rounded-xl">
          {[['admin', 'Admin', ShieldCheck], ['warden', 'Warden', UserCog]].map(([role, name, Icon]) => <button key={role} type="button" aria-pressed={staffRole === role} onClick={() => pickStaffRole(role)} className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition ${staffRole === role ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}><Icon size={16} aria-hidden="true" />{name}</button>)}
        </div></fieldset>}
        <div><label htmlFor="login-identifier" className="block font-medium mb-2">{portal === 'student' ? 'Email or roll number' : 'Email address'}</label><input id="login-identifier" name="identifier" type="text" required autoComplete="username" value={form.identifier} onChange={event => setForm({ ...form, identifier: event.target.value })} placeholder={portal === 'student' ? 'Your email or roll number' : 'you@example.com'} className="w-full px-4 py-3 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /></div>
        <div><div className="flex justify-between items-center gap-3 mb-2"><label htmlFor="login-password" className="font-medium">Password</label><button type="button" className="text-xs font-medium text-indigo-700 min-h-6" onClick={() => setForgot(f => ({ ...f, open: !f.open, error: '', message: '' }))} aria-expanded={forgot.open}>Forgot password?</button></div><div className="relative"><input id="login-password" name="password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} placeholder="Enter your password" className="w-full px-4 py-3 pr-12 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" /><button id="toggle-password-visibility" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1 p-2.5 text-slate-500 hover:text-indigo-700">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
        {forgot.open && <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3 text-sm"><p className="text-slate-600">Enter your email{portal === 'student' ? ' or roll number' : ''} above. The hostel office can reset your password.</p>{forgot.error && <p role="alert" className="text-red-700">{forgot.error}</p>}{forgot.message ? <p role="status" className="text-green-700">{forgot.message}</p> : <button type="button" onClick={requestReset} disabled={forgot.sending} className="bg-white border border-indigo-200 text-indigo-700 px-3 py-2 rounded-lg disabled:opacity-60">{forgot.sending ? 'Sending...' : 'Send reset request'}</button>}</div>}
        <label className="flex items-center gap-2 cursor-pointer"><input id="login-remember-me" type="checkbox" checked={form.rememberMe} onChange={event => setForm({ ...form, rememberMe: event.target.checked })} className="w-4 h-4 accent-indigo-600" /><span>Remember me</span></label>
        <button id="login-submit" type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"><LogIn size={18} aria-hidden="true" />{loading ? 'Signing in...' : 'Sign in'}</button>
      </form>
      {portal === 'student' && <p className="text-sm text-slate-500 text-center mt-6">New to the hostel? <Link to="/register" className="text-indigo-700 font-semibold">Create an account</Link></p>}
      <a href="/" className="block text-center text-sm text-slate-500 hover:text-indigo-700 mt-5">Choose another portal</a>
    </Shell>
  );
};
export default Login;
