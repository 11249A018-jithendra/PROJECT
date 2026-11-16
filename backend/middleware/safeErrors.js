const crypto = require('crypto');

// Users never see raw database/server errors (they reveal table and column
// names). Any 5xx response is logged in full on the server with a short
// reference code, and the client gets a friendly message + that code.
// 4xx messages are written by us for users ("Room is full") and pass through.
const GENERIC = 'Something went wrong on our side. Please try again in a moment.';

const logError = (req, detail) => {
  const ref = crypto.randomBytes(4).toString('hex');
  console.error(`[error ${ref}] ${req.method} ${req.originalUrl} (user ${req.user?._id || '-'}):`, detail);
  // Also keep it for the developer console (best effort; never blocks the reply).
  try {
    require('../supabase')
      .from('server_errors')
      .insert({
        ref,
        method: req.method,
        path: (req.originalUrl || '').split('?')[0],
        user_id: req.user?._id || null,
        detail: String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 4000),
      })
      .then(() => {}, () => {});
  } catch { /* unit tests run without a database */ }
  return ref;
};

const sanitizeServerErrors = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500) {
      const ref = logError(req, body && typeof body === 'object' ? body.message || body : body);
      const safe = { message: `${GENERIC} (ref ${ref})`, ref };
      if (body && body.valid === false) safe.valid = false; // QR scanner reads this flag
      return json(safe);
    }
    return json(body);
  };
  next();
};

// Last-resort handler for thrown errors (incl. bad JSON bodies and upload errors).
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'The request body is not valid JSON.' });
  if (err.name === 'MulterError') {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large.' : 'That upload could not be accepted.';
    return res.status(400).json({ message: msg });
  }
  if (err.status && err.status < 500 && err.expose) return res.status(err.status).json({ message: err.message });
  const ref = logError(req, err.stack || err.message);
  res.status(500).json({ message: `${GENERIC} (ref ${ref})`, ref });
};

module.exports = { sanitizeServerErrors, errorHandler };
