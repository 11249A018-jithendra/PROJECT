// Slows down guessing of 8-character outpass tokens at the gate. Counts WRONG
// tokens only, per signed-in guard: 8 wrong tokens in 10 minutes blocks token
// entry for that guard for the rest of the 10 minutes (QR scanning still
// works). Kept in memory, so a server restart resets it.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_WRONG = 8;

const fails = new Map(); // guard id -> { count, first }

const live = (key) => {
  const entry = fails.get(key);
  if (entry && Date.now() - entry.first > WINDOW_MS) {
    fails.delete(key);
    return null;
  }
  return entry || null;
};

// Milliseconds until this guard may try a token again (0 = allowed now).
const blockedFor = (guardId) => {
  const entry = live(guardId);
  return entry && entry.count >= MAX_WRONG ? WINDOW_MS - (Date.now() - entry.first) : 0;
};

const recordWrong = (guardId) => {
  const entry = live(guardId);
  if (entry) entry.count += 1;
  else fails.set(guardId, { count: 1, first: Date.now() });
  if (fails.size > 2000) for (const k of fails.keys()) live(k);
};

const tooManyMessage = (ms) => {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  return `Too many wrong tokens. Token entry is paused for ${minutes} minute${minutes === 1 ? '' : 's'} — scan the QR code or use manual entry instead.`;
};

module.exports = { blockedFor, recordWrong, tooManyMessage, MAX_WRONG };
