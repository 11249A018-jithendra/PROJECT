import { lazy, useState } from 'react';
import { Route, Navigate, useNavigate } from 'react-router-dom';
import { PortalApp, PageLoader, mount } from '../PortalShell';
import { useAuth } from '../../context/AuthContext';
import PasswordField from '../../components/PasswordField';
import AuthShell from '../../components/AuthShell';
import { Terminal } from 'lucide-react';

// Developer console — served at /developer, and only by the local dev server
// (it is left out of production builds; the API refuses it off this computer).
const DevConsole = lazy(() => import('./DevConsole'));

const DevLogin = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate('/console', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthShell title="Developer sign in" subtitle="Local tools for your campus workspace." eyebrow="HOSTELMS · DEVELOPER">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-semibold"><Terminal size={20} className="text-indigo-600" /> Developer console</div>
        {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">{error}</div>}
        <label htmlFor="dev-login-email" className="block text-sm font-medium">Developer email</label>
        <input id="dev-login-email" type="email" required autoComplete="username" placeholder="Developer email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        <PasswordField id="dev-login-pw" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="submit" disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl">{busy ? 'Signing in...' : 'Sign in'}</button>
        <p className="text-xs text-slate-400">Works only on this computer.</p>
      </form>
    </AuthShell>
  );
};

const RequireDev = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return user ? children : <Navigate to="/login" replace />;
};

mount(
  <PortalApp portal="developer" home="/console">
    <Route path="/login" element={<DevLogin />} />
    <Route path="/console" element={<RequireDev><DevConsole /></RequireDev>} />
  </PortalApp>
);
