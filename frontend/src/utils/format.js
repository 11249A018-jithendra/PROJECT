// Small, dependency-free date helpers — the one place the app's date and time
// formats live, so every page shows them the same way:
//   date       13 Nov 2026
//   date+time  13 Nov 2026, 3:45 pm
//   time       3:45 pm

// A plain "YYYY-MM-DD" (a calendar day, e.g. an exit date) is read as that day,
// not as midnight UTC, so it never shows as the day before.
const toDate = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value));

export const formatDate = (value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  value ? toDate(value).toLocaleDateString('en-IN', opts) : '—';

export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

export const formatTime = (value) =>
  value ? new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '—';

export const timeAgo = (value) => {
  if (!value) return '';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
};

// "5h 20m" until `value`; null once it has passed.
export const timeUntil = (value) => {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
};

// Exact timestamp in hostel (India) time with seconds, e.g. "2026-10-28 22:35:42 IST".
// Independent of the viewer's device time zone.
export const istTimestamp = (value) => {
  if (!value) return '—';
  const iso = new Date(new Date(value).getTime() + 5.5 * 3600000).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} IST`;
};
