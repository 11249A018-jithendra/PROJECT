import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Mirrors the backend rule in backend/utils/password.js.
export const passwordProblem = (pw) => {
  if (!pw || pw.length < 8) return 'At least 8 characters.';
  if (new TextEncoder().encode(pw).length > 72) return 'At most 72 bytes.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Include at least one letter and one number.';
  return null;
};

const strength = (pw) => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
};

const LEVELS = [
  { label: 'Too weak', bar: 'bg-red-500' },
  { label: 'Weak', bar: 'bg-red-500' },
  { label: 'Fair', bar: 'bg-amber-500' },
  { label: 'Good', bar: 'bg-green-500' },
  { label: 'Strong', bar: 'bg-green-600' },
];

const PasswordField = ({ id, label, value, onChange, showStrength = false, autoComplete = 'new-password' }) => {
  const [visible, setVisible] = useState(false);
  const s = strength(value || '');
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-600 mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {showStrength && value && (
        <div className="mt-2">
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i < s ? LEVELS[s].bar : 'bg-slate-200'}`} />
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {LEVELS[s].label}{passwordProblem(value) ? ` · ${passwordProblem(value)}` : ''}
          </p>
        </div>
      )}
    </div>
  );
};

export default PasswordField;
