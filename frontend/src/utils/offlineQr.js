// Keeps a copy of a student's outpass QR on their own device so it can still
// be shown at the gate without signal. Only active passes are kept, and
// everything is wiped on logout so a shared phone doesn't keep them.
const PREFIX = 'hms_qr_';
const ACTIVE = ['Approved', 'Checked Out'];

const safe = (fn, fallback = null) => {
  try { return fn(); } catch { return fallback; }
};

export const saveQr = (outpassId, payload) =>
  safe(() => localStorage.setItem(PREFIX + outpassId, JSON.stringify({ ...payload, saved_at: new Date().toISOString() })));

export const loadQr = (outpassId) => safe(() => JSON.parse(localStorage.getItem(PREFIX + outpassId)));

// Drop saved QRs for passes that are no longer usable (returned, rejected…).
export const pruneQrs = (outpasses) =>
  safe(() => {
    const active = new Set(outpasses.filter((o) => ACTIVE.includes(o.status)).map((o) => PREFIX + o._id));
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX) && !active.has(k)).forEach((k) => localStorage.removeItem(k));
  });

export const clearAllQrs = () =>
  safe(() => Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k)));
