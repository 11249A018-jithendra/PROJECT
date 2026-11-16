import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { homeFor } from '../utils/roleRoutes';
import { currentPortal } from '../portal';
import {
  Eye,
  EyeOff,
  LogIn,
  ShieldCheck,
  Clock,
  Building2,
  Users2,
  Lock,
  Mail,
  GraduationCap,
  UserCog,
  ScanLine
} from 'lucide-react';
import hostelBuildingImg from '../assets/hostel_building.jpg';

// Role configurations matching the reference page cards
const ROLES = {
  student: {
    label: 'Student',
    dashboard: '/dashboard',
    hint: 'Enter your student email or roll ID',
    accentColor: 'indigo',
    icon: GraduationCap,
    badgeBg: 'bg-indigo-50 border-indigo-200 text-indigo-700',
  },
  warden: {
    label: 'Warden',
    dashboard: '/warden',
    hint: 'Enter your warden staff email',
    accentColor: 'emerald',
    icon: UserCog,
    badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  },
  security: {
    label: 'Security',
    dashboard: '/security',
    hint: 'Enter your gate security email',
    accentColor: 'amber',
    icon: ScanLine,
    badgeBg: 'bg-amber-50 border-amber-200 text-amber-700',
  },
  staff: {
    label: 'Staff (Admin / Warden)',
    dashboard: '/admin',
    hint: 'Enter your admin or warden email',
    accentColor: 'blue',
    icon: UserCog,
    badgeBg: 'bg-blue-50 border-blue-200 text-blue-700',
  },
  admin: {
    label: 'Admin',
    dashboard: '/admin',
    hint: 'Enter your administrator credentials',
    accentColor: 'blue',
    icon: ShieldCheck,
    badgeBg: 'bg-blue-50 border-blue-200 text-blue-700',
  },
};

const Login = ({ initialRole }) => {
  const { login } = useAuth();
  const portal = currentPortal();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine if this login instance was opened with a preselected role context
  // (e.g. from /admin/login, /warden/login, /security/login or query param ?role=...)
  const queryParams = new URLSearchParams(location.search);
  const targetRole = initialRole || queryParams.get('role');

  // Staff portal: Admin or Warden, chosen on the page (remembered for next time).
  const [staffRole, setStaffRole] = useState(() => {
    try { return localStorage.getItem('hms_staff_role') === 'warden' ? 'warden' : 'admin'; } catch { return 'admin'; }
  });
  const pickStaffRole = (role) => {
    setStaffRole(role);
    setError('');
    try { localStorage.setItem('hms_staff_role', role); } catch { /* storage blocked */ }
  };
  const configKey = targetRole === 'staff' ? staffRole : targetRole;
  const roleConfig = configKey && ROLES[configKey] ? ROLES[configKey] : null;

  const [form, setForm] = useState({
    identifier: '',
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [forgot, setForgot] = useState({ open: false, sending: false, message: '', error: '' });

  const requestReset = async () => {
    const identifier = form.identifier.trim();
    if (!identifier) return setForgot((f) => ({ ...f, error: 'Type your email or roll number above first.', message: '' }));
    setForgot((f) => ({ ...f, sending: true, error: '', message: '' }));
    try {
      const res = await api.post('/auth/forgot-password', { identifier });
      setForgot((f) => ({ ...f, sending: false, message: res.data.message }));
    } catch (err) {
      setForgot((f) => ({ ...f, sending: false, error: err.response?.data?.message || 'Could not send the request.' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Authenticate with existing backend API
      const user = await login(form.identifier.trim(), form.password, form.rememberMe, targetRole === 'staff' ? staffRole : undefined);

      // The server already refused accounts that don't belong to this portal.
      navigate(homeFor(user.role));
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'Unable to sign in. Please verify your credentials and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F8FC] flex flex-col justify-between font-sans selection:bg-blue-500 selection:text-white">
      {/* Top Navigation Bar mirroring the Reference Header */}
      <header className="w-full bg-white/80 backdrop-blur-md border-b border-blue-100/60 sticky top-0 z-30 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.04)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand matching Reference exactly */}
          <div className="flex items-center gap-3.5 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1E56A0] to-[#163172] flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              <svg
                className="w-7 h-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9.5L12 3l9 6.5" />
                <path d="M19 13v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6" />
                <path d="M9 21V12h6v9" />
                <path d="M7 16h4" />
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0F2B5C]">
                Hostel Management System
              </span>
              <div className="flex items-center gap-2 text-xs sm:text-[13px] font-medium text-slate-500">
                <span>Safe Stay</span>
                <span className="text-blue-300" aria-hidden="true">|</span>
                <span>Smart Management</span>
                <span className="text-blue-300" aria-hidden="true">|</span>
                <span className="text-blue-600 font-semibold">Better Tomorrow</span>
              </div>
            </div>
          </div>

          {/* Slogan & Portal link */}
          <div className="hidden md:flex items-center gap-6">
            <div className="text-right">
              <span className="block font-serif italic text-base font-semibold text-[#1E56A0]">
                "Your Home Away From Home"
              </span>
              <span className="text-xs text-slate-500">Campus Residential Portal</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="w-full bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(20,50,110,0.12)] border border-blue-100 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
          
          {/* Left Column: High-Quality Hostel Photography & Slogan (5 cols) */}
          <div className="lg:col-span-5 relative bg-gradient-to-br from-blue-900 to-indigo-950 min-h-[280px] lg:min-h-full overflow-hidden flex flex-col justify-between p-6 sm:p-10">
            {/* Background Image with Fallback */}
            {!imageError ? (
              <img
                src={hostelBuildingImg}
                alt="Hostel Campus & Building"
                onError={() => setImageError(true)}
                className="absolute inset-0 w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-700 ease-out"
              />
            ) : (
              /* High-fidelity CSS architectural illustration fallback */
              <div className="absolute inset-0 bg-gradient-to-br from-[#1E56A0] via-[#163172] to-[#0A1931] flex items-center justify-center">
                <div className="text-center p-8 text-white/80">
                  <Building2 size={72} className="mx-auto text-blue-300 mb-3 opacity-75" />
                  <p className="font-bold text-lg text-white">Modern Campus Living</p>
                  <p className="text-xs text-blue-200 mt-1">Safe • Secure • Connected</p>
                </div>
              </div>
            )}

            {/* Gradient Overlay for Text Legibility & Brand Tone */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A1931]/95 via-[#0A1931]/40 to-transparent pointer-events-none" />
            
            {/* Soft modern glowing accent badge */}
            <div className="relative z-10 flex items-center justify-between">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-semibold tracking-wide uppercase shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Campus Verified
              </span>
              {roleConfig && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md shadow-sm ${roleConfig.badgeBg}`}>
                  {roleConfig.label} Access
                </span>
              )}
            </div>

            {/* Bottom Quote & Branding Badge mirroring reference design */}
            <div className="relative z-10 pt-16">
              <div className="p-5 sm:p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-xl shadow-black/10">
                <div className="flex items-center gap-2 mb-2 text-blue-200">
                  <Building2 size={18} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Residential Life</span>
                </div>
                <blockquote className="text-lg sm:text-xl font-medium leading-snug">
                  “A Safe and Comfortable Stay for Every Student”
                </blockquote>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1 w-10 bg-blue-400 rounded-full" />
                  <span className="text-xs text-blue-200">24/7 Security & Active Warden Support</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Clean, Polished Login Form (7 cols) */}
          <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center bg-white">
            <div className="w-full max-w-lg mx-auto">
              
              {/* Form Heading */}
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-3 border border-blue-100">
                  <Lock size={12} />
                  <span>Secure Portal Authentication</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F2B5C] tracking-tight">
                  Welcome Back!
                </h1>
                <p className="text-slate-500 text-sm mt-1.5">
                  {roleConfig
                    ? `Signing in as ${roleConfig.label}. ${roleConfig.hint}.`
                    : 'Enter your credentials to access your hostel management account.'}
                </p>
              </div>

              {/* Error Alert Box */}
              {error && (
                <div role="alert" className="mb-6 rounded-2xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 flex items-start gap-3 shadow-sm animate-shake">
                  <div className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    !
                  </div>
                  <div className="flex-1 font-medium">{error}</div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {targetRole === 'staff' && (
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">I am</span>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-[#F8FAFC] border border-slate-200 rounded-xl" role="radiogroup" aria-label="Sign in as">
                      {[['admin', 'Admin', ShieldCheck], ['warden', 'Warden', UserCog]].map(([key, label, Icon]) => (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={staffRole === key}
                          onClick={() => pickStaffRole(key)}
                          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${staffRole === key ? 'bg-[#1E56A0] text-white shadow-md' : 'text-slate-600 hover:bg-white'}`}
                        >
                          <Icon size={16} /> {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Identifier (Email / Student ID) */}
                <div>
                  <label
                    htmlFor="login-identifier"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
                  >
                    {portal === 'student' ? 'Email or Roll Number' : 'Email'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Mail size={18} />
                    </div>
                    <input
                      id="login-identifier"
                      name="identifier"
                      type="text"
                      required
                      autoComplete="username"
                      value={form.identifier}
                      onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                      placeholder={portal === 'student' ? 'Your email or roll number' : 'Your email'}
                      className="w-full pl-10 pr-4 py-3 bg-[#F8FAFC] border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-[#1E56A0] focus:ring-4 focus:ring-blue-100 rounded-xl text-slate-900 text-sm placeholder-slate-400 transition-all outline-none font-medium"
                    />
                  </div>
                </div>

                {/* Password with Show/Hide */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                    >
                      Password
                    </label>
                    <a
                      href="#forgot-password"
                      onClick={(e) => {
                        e.preventDefault();
                        setForgot((f) => ({ ...f, open: !f.open, message: '', error: '' }));
                      }}
                      className="inline-flex items-center min-h-6 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Lock size={18} />
                    </div>
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-12 py-3 bg-[#F8FAFC] border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-[#1E56A0] focus:ring-4 focus:ring-blue-100 rounded-xl text-slate-900 text-sm placeholder-slate-400 transition-all outline-none font-medium"
                    />
                    <button
                      type="button"
                      id="toggle-password-visibility"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {forgot.open && (
                  <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 space-y-3 text-sm">
                    <p className="text-slate-600">
                      Type your email{portal === 'student' ? ' or roll number' : ''} in the first box, then send a request. The hostel office will reset your password and give you the new one.
                    </p>
                    {forgot.error && <p className="text-red-600">{forgot.error}</p>}
                    {forgot.message ? (
                      <p className="text-green-700">{forgot.message}</p>
                    ) : (
                      <button
                        type="button"
                        onClick={requestReset}
                        disabled={forgot.sending}
                        className="w-full py-2.5 rounded-xl font-semibold text-blue-700 bg-white border border-blue-200 hover:bg-blue-100 disabled:opacity-60 transition-colors"
                      >
                        {forgot.sending ? 'Sending...' : 'Send reset request'}
                      </button>
                    )}
                  </div>
                )}

                {/* Remember Me & Help */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      id="login-remember-me"
                      type="checkbox"
                      checked={form.rememberMe}
                      onChange={(e) => setForm({ ...form, rememberMe: e.target.checked })}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 transition-all"
                    />
                    <span className="text-xs font-medium text-slate-600">Keep me signed in on this device</span>
                  </label>
                  {window.location.protocol === 'https:' && <span className="text-xs text-slate-500">SSL Encrypted</span>}
                </div>

                {/* Blue Login Button */}
                <button
                  id="login-submit-button"
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-[#1E56A0] to-[#163172] hover:from-[#163172] hover:to-[#0F2B5C] active:scale-[0.99] transition-all duration-200 shadow-lg shadow-blue-900/25 disabled:opacity-60 disabled:cursor-not-allowed group text-base"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <LogIn size={18} className="group-hover:translate-x-0.5 transition-transform" />
                      <span>Sign In</span>
                    </>
                  )}
                </button>
              </form>

              {/* Student Registration Link */}
              <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs gap-3">
                {portal === 'student' ? (
                  <>
                    <span className="text-slate-500">
                      New resident student?{' '}
                      <Link
                        to="/register"
                        className="inline-flex items-center min-h-6 text-blue-600 hover:text-blue-800 font-bold underline transition-colors"
                      >
                        Register here
                      </Link>
                    </span>
                    <a
                      href="/staff/login"
                      className="text-slate-400 hover:text-slate-600 font-medium transition-colors"
                    >
                      Staff Login →
                    </a>
                  </>
                ) : <span />}
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Feature Icons Strip mirroring the Reference Bottom Footer */}
      <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 border-y border-blue-100/70 text-slate-600 text-xs sm:text-sm font-semibold">
          <div className="flex items-center justify-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <span>Secure Access</span>
          </div>

          <div className="flex items-center justify-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Clock size={18} />
            </div>
            <span>Quick & Easy</span>
          </div>

          <div className="flex items-center justify-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Building2 size={18} />
            </div>
            <span>Smart Hostel</span>
          </div>

          <div className="flex items-center justify-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Users2 size={18} />
            </div>
            <span>Better Communication</span>
          </div>
        </div>
      </section>

      {/* Footer Text “Designed by Jithendra” matching reference */}
      <footer className="w-full py-5 text-center text-xs text-slate-600">
        <div className="flex items-center justify-center gap-2">
          <div className="w-12 h-px bg-slate-200" />
          <span className="font-medium text-slate-600">
            Designed by Jithendra <span className="text-blue-600" aria-hidden="true">❤</span>
          </span>
          <div className="w-12 h-px bg-slate-200" />
        </div>
      </footer>
    </div>
  );
};

export default Login;
