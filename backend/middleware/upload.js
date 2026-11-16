const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { saveFile } = require('../utils/fileStore');

// Photos only: checked by MIME type AND extension, max 5 MB, random names so
// files can't be guessed or overwrite each other. Errors become friendly 400s
// (see middleware/safeErrors.js). Files are kept in Supabase Storage (see
// utils/fileStore.js) — never on the server's disk, which hosts wipe.
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

const imageFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if ((ALLOWED[file.mimetype] || []).includes(ext)) return cb(null, true);
  const err = new Error('Only JPG, PNG, WebP or GIF images are allowed.');
  err.status = 400;
  err.expose = true;
  return cb(err);
};

const parser = multer({ storage: multer.memoryStorage(), fileFilter: imageFilter, limits: { fileSize: MAX_BYTES, files: 1 } });

// After multer: store the photo and give req.file a `filename`, as before.
const persist = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    await saveFile(filename, req.file.buffer, req.file.mimetype);
    req.file.filename = filename;
    req.file.buffer = undefined;
    next();
  } catch (err) {
    console.error('[upload] could not store photo:', err.message);
    const e = new Error('Could not save the photo. Please try again.');
    e.status = 503;
    e.expose = true;
    next(e);
  }
};

// Same use as before in routes: imageUpload.single('photo').
const imageUpload = { single: (field) => [parser.single(field), persist] };

// Path stored in the database (forward slashes, served by GET /uploads/:name).
const storedPath = (file) => (file ? `uploads/${file.filename}` : null);

module.exports = { imageUpload, storedPath, MAX_BYTES };
