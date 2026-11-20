const jwt = require('jsonwebtoken');

// Bind sessions to the password version read during authentication. JWT iat
// only has second precision and cannot distinguish a reset in the same second.
const passwordVersion = (changedAt) => changedAt ? new Date(changedAt).getTime() : null;

const generateToken = (id, portal = null, remember = true, changedAt = null) => {
  const claims = { id, pwd: passwordVersion(changedAt) };
  if (portal) claims.portal = portal;
  if (remember) claims.rem = true;
  return jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: remember ? '30d' : '12h' });
};

const sessionInvalidated = (decoded, changedAt) => {
  const current = passwordVersion(changedAt);
  if (Object.prototype.hasOwnProperty.call(decoded, 'pwd')) return decoded.pwd !== current;
  // Existing sessions remain supported, but an ambiguous same-second session
  // must sign in again after a password change.
  return current !== null && (!Number.isFinite(decoded.iat) || decoded.iat <= Math.floor(current / 1000));
};

module.exports = { generateToken, passwordVersion, sessionInvalidated };
