// Which websites may call this API from a browser.
//  • ALLOWED_ORIGINS set (comma-separated, e.g. "https://site.com") → exactly those.
//  • Not set (local development) → this computer and devices on the same
//    private network (Wi-Fi), so phones can open http://<pc-ip>:5173.
// Requests with no Origin (curl, the QR scanner app, server-to-server) are not
// affected by CORS and are still checked by login/role rules as usual.
const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

const allowedList = () =>
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const list = allowedList();
  if (list.length) return list.includes(origin.replace(/\/$/, ''));
  try {
    return PRIVATE_HOST.test(new URL(origin).hostname);
  } catch {
    return false;
  }
};

const corsOptions = {
  origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
};

module.exports = { corsOptions, isAllowedOrigin };
