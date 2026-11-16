const crypto = require('crypto');

// Opaque, unguessable reference the QR code encodes — never the outpass or
// student's real data. The backend looks this up to find the actual record.
const generateQrToken = () => `OPQR_${crypto.randomBytes(24).toString('hex')}`;

// The short code a guard can type when the QR can't be scanned: exactly 8
// characters, A–Z and 0–9 (e.g. H7K9M2P4). It is derived from the outpass's QR
// token with the server's secret, so it needs no extra database column, can't
// be worked out by anyone without the secret, and stops working the moment the
// outpass (and its QR token) is no longer active.
const GATE_CODE_LENGTH = 8;
const GATE_CODE_RE = /^[A-Z0-9]{8}$/;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

const gateCodeFor = (qrToken) => {
  if (!qrToken) return null;
  let code = '';
  // Bytes ≥ 252 are skipped so every character is equally likely.
  for (let round = 0; code.length < GATE_CODE_LENGTH; round++) {
    const bytes = crypto.createHmac('sha256', process.env.JWT_SECRET).update(`gate-code:${round}:${qrToken}`).digest();
    for (const b of bytes) {
      if (b < 252 && code.length < GATE_CODE_LENGTH) code += ALPHABET[b % ALPHABET.length];
    }
  }
  return code;
};

// What a guard typed → the form codes are compared in (upper case, no spaces).
const normalizeGateCode = (value) => String(value ?? '').replace(/\s+/g, '').toUpperCase();

module.exports = { generateQrToken, gateCodeFor, normalizeGateCode, GATE_CODE_RE, GATE_CODE_LENGTH };
