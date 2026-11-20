import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, UserPlus } from 'lucide-react';

import AuthShell from '../components/AuthShell';

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '', roll_no: '', room_no: '',
    course_year: '', phone: '', parent_contact: '', hostel_id: '', home_address: '',
  });
  const [hostels, setHostels] = useState([]);

  // Public list of hostel names (empty until hostels are set up by the admin).
  useEffect(() => {
    api.get('/hostels').then((res) => setHostels(res.data)).catch(() => {});
  }, []);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { name: 'name', label: 'Full Name', type: 'text', placeholder: 'John Doe', required: true },
    { name: 'email', label: 'Email Address', type: 'email', placeholder: 'you@example.com', required: true },
    { name: 'roll_no', label: 'Roll Number', type: 'text', placeholder: 'CS2021001', required: true },
    { name: 'room_no', label: 'Room Number', type: 'text', placeholder: 'A-101', required: true },
    { name: 'course_year', label: 'Course / Year', type: 'text', placeholder: 'B.Tech 2nd Year', required: true },
    { name: 'phone', label: 'Phone Number', type: 'tel', placeholder: '9876543210', required: true },
    { name: 'parent_contact', label: 'Parent Contact', type: 'tel', placeholder: '9876543211', required: true },
  ];

  return (
    <AuthShell title="Create your account" subtitle="Make yourself at home. Register as a new student." eyebrow="STUDENT REGISTRATION">
      <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-700 rounded-xl p-3 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map(({ name, label, type, placeholder, required }) => (
                <div key={name} className={name === 'name' || name === 'email' ? 'sm:col-span-2' : ''}>
                  <label htmlFor={`register-${name}`} className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
                  <input
                    id={`register-${name}`}
                    type={type}
                    name={name}
                    required={required}
                    value={form[name]}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
              ))}

              {hostels.length > 0 && (
                <div className="sm:col-span-2">
                  <label htmlFor="register-hostel" className="block text-sm font-medium text-slate-600 mb-1.5">Hostel</label>
                  <select id="register-hostel" name="hostel_id" required value={form.hostel_id} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition">
                    <option value="">Select your hostel</option>
                    {hostels.map((h) => <option key={h._id} value={h._id}>{h.name}</option>)}
                  </select>
                </div>
              )}

              <div className="sm:col-span-2">
                <label htmlFor="register-home_address" className="block text-sm font-medium text-slate-600 mb-1.5">Home Address</label>
                <textarea
                  id="register-home_address"
                  name="home_address"
                  required
                  rows={2}
                  maxLength={300}
                  value={form.home_address}
                  onChange={handleChange}
                  placeholder="House no., street, city, state, PIN"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
                />
              </div>

              {/* Password field */}
              <div className="sm:col-span-2">
                <label htmlFor="register-password" className="block text-sm font-medium text-slate-600 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Min. 8 characters"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-indigo-700 transition"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus size={18} />
                  Register
                </>
              )}
            </button>
          </form>
      <p className="text-center text-slate-500 text-sm mt-6">Already registered? <Link to="/login" className="text-indigo-700 font-semibold">Sign in</Link></p>
    </AuthShell>
  );
};

export default Register;
