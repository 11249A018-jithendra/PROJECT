// Photos go to Supabase Storage (not the server disk) and are served through
// GET /uploads/<name> as a redirect to a short-lived signed link.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { api, supabase, created, cleanup, STAMP, TAG } = require('./helpers');
const { hashPassword } = require('../../utils/password');
const { removeFile } = require('../../utils/fileStore');

const ROOT = (process.env.E2E_BASE || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
// Smallest valid PNG (1×1 pixel).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const ctx = {};

before(async () => {
  const email = `e2e.upload.${STAMP}@example.test`;
  const { data, error } = await supabase
    .from('users')
    .insert({ role: 'student', name: `${TAG} Upload`, email, password: await hashPassword('Upload#2026x'), roll_no: `UP${STAMP}` })
    .select('_id')
    .single();
  if (error) throw error;
  created.users.push(data._id);
  ctx.token = (await api('POST', '/auth/login', null, { email, password: 'Upload#2026x', portal: 'student' })).data.token;
});

after(async () => {
  if (ctx.file) await removeFile(ctx.file);
  await cleanup();
});

const postComplaint = (file, name, type) => {
  const form = new FormData();
  form.append('category', 'other');
  form.append('description', `${TAG} photo upload check`);
  form.append('photo', new Blob([file], { type }), name);
  return fetch(`${ROOT}/api/complaints`, { method: 'POST', headers: { Authorization: `Bearer ${ctx.token}` }, body: form });
};

test('a complaint photo is stored in Supabase Storage and served by /uploads', async () => {
  const res = await postComplaint(PNG, 'pixel.png', 'image/png');
  assert.equal(res.status, 201);
  const complaint = await res.json();
  assert.match(complaint.photo, /^uploads\/[\w.-]+\.png$/);
  ctx.file = complaint.photo.split('/')[1];
  assert.equal(require('fs').existsSync(require('path').join(__dirname, '..', '..', 'uploads', ctx.file)), false, 'nothing written to the server disk');

  const served = await fetch(`${ROOT}/${complaint.photo}`, { redirect: 'manual' });
  assert.equal(served.status, 302);
  const image = await fetch(served.headers.get('location'));
  assert.equal(image.status, 200);
  assert.equal(Buffer.from(await image.arrayBuffer()).length, PNG.length);
});

test('non-images are refused and unknown files are 404', async () => {
  assert.equal((await postComplaint(Buffer.from('hello'), 'notes.txt', 'text/plain')).status, 400);
  assert.equal((await fetch(`${ROOT}/uploads/does-not-exist-${STAMP}.png`, { redirect: 'manual' })).status, 404);
  assert.equal((await fetch(`${ROOT}/uploads/..%2F.env`, { redirect: 'manual' })).status, 404);
});
