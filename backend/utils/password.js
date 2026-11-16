const bcrypt = require('bcrypt');

const BCRYPT_ROUNDS = 12;

// Returns an error message, or null when the password is acceptable.
// bcrypt silently ignores everything past 72 bytes, so longer input is
// rejected rather than giving a false sense of strength.
const passwordProblem = (password) => {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.';
  if (Buffer.byteLength(password, 'utf8') > 72) return 'Password must be at most 72 bytes.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Password must contain at least one letter and one number.';
  return null;
};

const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

// Never send a password hash to a client.
const withoutPassword = (user) => {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest;
};

module.exports = { passwordProblem, hashPassword, withoutPassword };
