// Returns date and time values in Indian Standard Time (UTC+5:30) (Asia/Kolkata),
// ensuring midnight rollovers and server timestamps are strictly aligned to IST.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const todayIST = () => {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().split('T')[0];
};

// Converts any date/datetime value to a YYYY-MM-DD date string in IST.
const toISTDateString = (dateInput) => {
  if (!dateInput) return null;
  return new Date(new Date(dateInput).getTime() + IST_OFFSET_MS).toISOString().split('T')[0];
};

// Formats a Date object or timestamp as YYYY-MM-DD HH:mm:ss in IST.
const toISTTimestamp = (dateInput) => {
  if (!dateInput) return null;
  const d = new Date(new Date(dateInput).getTime() + IST_OFFSET_MS);
  const iso = d.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
};

// Returns the current server timestamp in IST with seconds: YYYY-MM-DD HH:mm:ss
const nowISTTimestamp = () => {
  const d = new Date(Date.now() + IST_OFFSET_MS);
  const iso = d.toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)}`;
};

// Parses a date-time sent by a form. A value WITHOUT a time zone (what an
// <input type="datetime-local"> sends, e.g. "2026-10-29T17:39") is the hostel's
// wall-clock time, i.e. India time — never the server's or browser's zone.
// Values that already carry a zone ("Z" or "+05:30") are kept as they are.
// Returns a Date, or null when the value isn't a valid date-time.
const parseHostelDateTime = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const str = String(value).trim();
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(str);
  const isoLike = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?/.test(str);
  if (!isoLike) return null;
  const d = new Date(hasZone ? str : `${str.replace(' ', 'T')}+05:30`);
  return Number.isNaN(d.getTime()) ? null : d;
};

module.exports = { todayIST, toISTDateString, toISTTimestamp, nowISTTimestamp, parseHostelDateTime };
