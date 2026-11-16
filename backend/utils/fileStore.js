// Uploaded photos live in Supabase Storage (private bucket), not on the
// server's disk: hosting platforms wipe the disk on every restart/deploy.
// The database keeps the same "uploads/<name>" paths as before, and
// GET /uploads/<name> (server.js) redirects to a short-lived signed link.
const supabase = require('../supabase');

const BUCKET = process.env.UPLOAD_BUCKET || 'uploads';
const SIGNED_URL_SECONDS = 60 * 60;

let ready = null;
// Creates the bucket the first time it is needed (safe to call repeatedly).
const ensureBucket = () => {
  if (!ready) {
    ready = (async () => {
      const { data } = await supabase.storage.getBucket(BUCKET);
      if (data) return;
      const { error } = await supabase.storage.createBucket(BUCKET, {
        public: false,
        fileSizeLimit: '5MB',
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      });
      if (error && !/already exists/i.test(error.message)) throw error;
    })().catch((err) => {
      ready = null; // try again next time
      throw err;
    });
  }
  return ready;
};

const saveFile = async (name, buffer, contentType) => {
  await ensureBucket();
  const { error } = await supabase.storage.from(BUCKET).upload(name, buffer, { contentType, upsert: false });
  if (error) throw error;
};

const signedUrl = async (name) => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(name, SIGNED_URL_SECONDS);
  if (error) return null;
  return data.signedUrl;
};

const removeFile = async (name) => {
  await supabase.storage.from(BUCKET).remove([name]);
};

module.exports = { ensureBucket, saveFile, signedUrl, removeFile, BUCKET };
