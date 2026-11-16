// Shared helpers for the end-to-end tests. They talk to a RUNNING backend
// (default http://localhost:5000/api, override with E2E_BASE) and use the
// service key directly only for setup shortcuts and cleanup.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const jwt = require('jsonwebtoken');
const supabase = require('../../supabase');

const BASE = process.env.E2E_BASE || 'http://localhost:5000/api';
const STAMP = Date.now();
const TAG = `E2E TEST ${STAMP}`;

const api = async (method, urlPath, token, body) => {
  const res = await fetch(BASE + urlPath, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data };
};

// Short-lived token for an existing active account of this role.
const tokenForRole = async (role) => {
  const { data } = await supabase.from('users').select('_id').eq('role', role).eq('is_active', true).limit(1);
  if (!data?.length) throw new Error(`No active ${role} account to test with.`);
  return jwt.sign({ id: data[0]._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

// Records everything a test run creates so cleanup can remove it all.
const created = { users: [], hostels: [], staff: [], visitors: [], announcements: [], complaints: [] };

const cleanup = async () => {
  // Alerts the jobs sent to real admins about test records.
  await supabase.from('notifications').delete().ilike('message', `%${TAG}%`);
  if (created.complaints.length) await supabase.from('notifications').delete().in('complaint_id', created.complaints);
  for (const id of created.visitors) await supabase.from('visitors').delete().eq('_id', id);
  for (const id of created.announcements) await supabase.from('announcements').delete().eq('_id', id);
  for (const id of created.users) {
    await supabase.from('outpass_scan_logs').delete().eq('student_id', id);
    await supabase.from('visitors').delete().eq('student_id', id);
  }
  // Exit history rows reference users ON DELETE RESTRICT (by design), so they go first.
  if (created.users.length) {
    await supabase.from('past_students').delete().in('student_id', created.users);
    await supabase.from('student_exit_requests').delete().in('student_id', created.users);
    await supabase.from('student_exit_requests').delete().in('requested_by', created.users);
  }
  // users cascade to outpasses / complaints / attendances / notifications
  if (created.users.length) await supabase.from('users').delete().in('_id', created.users);
  for (const id of created.staff) await supabase.from('maintenance_staff').delete().eq('_id', id);
  // hostels cascade to rooms
  if (created.hostels.length) await supabase.from('hostels').delete().in('_id', created.hostels);

  const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).like('email', `e2e.%.${STAMP}@example.test`);
  return count || 0;
};

module.exports = { api, tokenForRole, supabase, created, cleanup, STAMP, TAG };
