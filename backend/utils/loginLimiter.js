// Slows down password guessing. Counts WRONG passwords only:
//  • per account: 5 wrong tries in 15 minutes locks that account's sign-in
//    for the rest of the 15 minutes (a correct password clears the count);
//  • per network address: 30 wrong tries in 15 minutes, across any accounts.
// Kept in memory, so a server restart resets it. Behind a reverse proxy, set
// Express "trust proxy" so req.ip is the visitor's address, not the proxy's.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_ACCOUNT = 5;
const MAX_PER_IP = 30;
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const fails = new Map(); // key -> { count, first }

const live = (key) => {
  const entry = fails.get(key);
  if (entry && Date.now() - entry.first > WINDOW_MS) {
    fails.delete(key);
    return null;
  }
  return entry || null;
};

const record = (key) => {
  const entry = live(key);
  if (entry) entry.count += 1;
  else fails.set(key, { count: 1, first: Date.now() });
  // Keep memory bounded: drop expired entries now and then.
  if (fails.size > 5000) for (const k of fails.keys()) live(k);
};

const lockedFor = (key, max) => {
  const entry = live(key);
  return entry && entry.count >= max ? WINDOW_MS - (Date.now() - entry.first) : 0;
};

const keysFor = (req, identifier) => ({
  account: `acct:${String(identifier || '').trim().toLowerCase()}`,
  // This computer is not limited per address (the account limit still applies).
  ip: LOOPBACK.has(req.ip) ? null : `ip:${req.ip}`,
});

// Milliseconds until this sign-in may be tried again (0 = allowed now).
const blockedFor = (req, identifier) => {
  const { account, ip } = keysFor(req, identifier);
  return Math.max(lockedFor(account, MAX_PER_ACCOUNT), ip ? lockedFor(ip, MAX_PER_IP) : 0);
};

const recordFailure = (req, identifier) => {
  const { account, ip } = keysFor(req, identifier);
  record(account);
  if (ip) record(ip);
};

const recordSuccess = (req, identifier) => fails.delete(keysFor(req, identifier).account);

const tooManyMessage = (ms) => {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  return `Too many wrong attempts. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again, or use "Forgot password?".`;
};

// Separate small budget for "forgot password" requests (they notify staff).
const FORGOT_MAX = 5;
const forgotKeys = (req, identifier) => ({
  account: `forgot-acct:${String(identifier || '').trim().toLowerCase()}`,
  ip: LOOPBACK.has(req.ip) ? null : `forgot-ip:${req.ip}`,
});
const forgotBlocked = (req, identifier) => {
  const { account, ip } = forgotKeys(req, identifier);
  return lockedFor(account, 3) || (ip ? lockedFor(ip, FORGOT_MAX) : 0);
};
const recordForgot = (req, identifier) => {
  const { account, ip } = forgotKeys(req, identifier);
  record(account);
  if (ip) record(ip);
};

module.exports = { blockedFor, recordFailure, recordSuccess, tooManyMessage, forgotBlocked, recordForgot, MAX_PER_ACCOUNT };
