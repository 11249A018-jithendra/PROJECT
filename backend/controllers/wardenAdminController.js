const supabase = require('../supabase');
const { hasHostelTracking } = require('../utils/schema');
const { passwordProblem, hashPassword } = require('../utils/password');

// Columns safe to return for a warden. Never includes `password`.
const BASE_COLS = '_id, name, email, role, phone, created_at, updated_at';
const TRACKING_COLS = `${BASE_COLS}, hostel_id, is_active, deactivated_at, password_changed_at`;
const wardenCols = async () => ((await hasHostelTracking()) ? TRACKING_COLS : BASE_COLS);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s-]{6,19}$/;

const normalizeEmail = (email) => (email || '').trim().toLowerCase();

const validateProfile = ({ name, email, phone }, { partial = false } = {}) => {
  if (!partial || name !== undefined) {
    if (!name || !name.trim()) return 'Name is required.';
  }
  if (!partial || email !== undefined) {
    if (!EMAIL_RE.test(normalizeEmail(email))) return 'A valid email is required.';
  }
  if (phone && !PHONE_RE.test(phone.trim())) return 'Phone number looks invalid.';
  return null;
};

const emailTaken = async (email, exceptId = null) => {
  // Case-insensitive exact match; escape LIKE wildcards so "a_b@x.com" can't match "axb@x.com".
  const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  let q = supabase.from('users').select('_id').ilike('email', pattern);
  if (exceptId) q = q.neq('_id', exceptId);
  const { data } = await q.limit(1);
  return Boolean(data && data.length);
};

const hostelExists = async (hostelId) => {
  if (!hostelId) return true;
  const { data } = await supabase.from('hostels').select('_id').eq('_id', hostelId).maybeSingle();
  return Boolean(data);
};

// Adds hostel name, assigned-student count and a normalized status.
const decorate = async (wardens) => {
  const ids = wardens.map((w) => w._id);
  const hostelIds = [...new Set(wardens.map((w) => w.hostel_id).filter(Boolean))];
  const [{ data: students }, { data: hostels }] = await Promise.all([
    ids.length
      ? supabase.from('users').select('assigned_warden').eq('role', 'student').in('assigned_warden', ids)
      : Promise.resolve({ data: [] }),
    hostelIds.length
      ? supabase.from('hostels').select('_id, name').in('_id', hostelIds)
      : Promise.resolve({ data: [] }),
  ]);
  const counts = {};
  for (const s of students || []) counts[s.assigned_warden] = (counts[s.assigned_warden] || 0) + 1;
  const hostelNames = Object.fromEntries((hostels || []).map((h) => [h._id, h.name]));
  return wardens.map((w) => ({
    ...w,
    is_active: w.is_active !== false,
    hostel_name: w.hostel_id ? hostelNames[w.hostel_id] || null : null,
    student_count: counts[w._id] || 0,
  }));
};

// @desc    Get all wardens (with hostel, status and student counts)
// @route   GET /api/admin/wardens
// @access  Private (admin)
const getAllWardens = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(await wardenCols())
      .eq('role', 'warden')
      .order('name', { ascending: true });
    if (error) throw error;
    res.json(await decorate(data || []));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get one warden with their assigned students
// @route   GET /api/admin/wardens/:id
// @access  Private (admin)
const getWardenById = async (req, res) => {
  try {
    const { data: warden, error } = await supabase
      .from('users')
      .select(await wardenCols())
      .eq('_id', req.params.id)
      .eq('role', 'warden')
      .maybeSingle();
    if (error) throw error;
    if (!warden) return res.status(404).json({ message: 'Warden not found' });

    const { data: students } = await supabase
      .from('users')
      .select('_id, name, roll_no, room_no')
      .eq('role', 'student')
      .eq('assigned_warden', warden._id)
      .order('name');
    const [decorated] = await decorate([warden]);
    res.json({ ...decorated, students: students || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new warden account
// @route   POST /api/admin/wardens
// @access  Private (admin)
const createWarden = async (req, res) => {
  try {
    const { name, email, password, phone, hostel_id } = req.body;
    const problem = validateProfile({ name, email, phone }) || passwordProblem(password);
    if (problem) return res.status(400).json({ message: problem });

    const cleanEmail = normalizeEmail(email);
    if (await emailTaken(cleanEmail)) return res.status(400).json({ message: 'A user with this email already exists.' });

    const tracking = await hasHostelTracking();
    if (tracking && !(await hostelExists(hostel_id))) return res.status(400).json({ message: 'Selected hostel does not exist.' });

    const row = {
      role: 'warden',
      name: name.trim(),
      email: cleanEmail,
      password: await hashPassword(password),
      phone: phone?.trim() || null,
    };
    if (tracking) {
      row.hostel_id = hostel_id || null;
      row.is_active = true;
      row.password_changed_at = new Date().toISOString();
    }

    const { data, error } = await supabase.from('users').insert(row).select(await wardenCols()).single();
    if (error) throw error;
    const [decorated] = await decorate([data]);
    res.status(201).json(decorated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update warden details (name, email, phone, hostel)
// @route   PUT /api/admin/wardens/:id
// @access  Private (admin)
const updateWarden = async (req, res) => {
  try {
    const { name, email, phone, hostel_id, password } = req.body;
    const problem = validateProfile({ name, email, phone }, { partial: true });
    if (problem) return res.status(400).json({ message: problem });

    const tracking = await hasHostelTracking();
    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (email !== undefined) {
      const cleanEmail = normalizeEmail(email);
      if (await emailTaken(cleanEmail, req.params.id)) return res.status(400).json({ message: 'Another user already uses this email.' });
      updates.email = cleanEmail;
    }
    if (tracking && hostel_id !== undefined) {
      if (!(await hostelExists(hostel_id))) return res.status(400).json({ message: 'Selected hostel does not exist.' });
      updates.hostel_id = hostel_id || null;
    }
    // Backward compatibility: older clients sent a new password here.
    if (password) {
      const pwProblem = passwordProblem(password);
      if (pwProblem) return res.status(400).json({ message: pwProblem });
      updates.password = await hashPassword(password);
      if (tracking) updates.password_changed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('_id', req.params.id)
      .eq('role', 'warden')
      .select(await wardenCols())
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Warden not found' });
    const [decorated] = await decorate([data]);
    res.json(decorated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reset a warden's password (admin sets it; signs them out everywhere)
// @route   PUT /api/admin/wardens/:id/password
// @access  Private (admin)
// Admin-set password reset for accounts of the given roles. The new password
// is hashed, never returned, and every existing session of that user ends.
const resetPasswordFor = (roles) => async (req, res) => {
  try {
    const { password } = req.body;
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ message: problem });

    const updates = { password: await hashPassword(password), updated_at: new Date().toISOString() };
    if (await hasHostelTracking()) updates.password_changed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('_id', req.params.id)
      .in('role', roles)
      .select('_id, name, role')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Account not found' });
    res.json({ message: `Password reset for ${data.name}. They have been signed out of all sessions.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const resetWardenPassword = resetPasswordFor(['warden']);
// "Forgot password" for students and security staff: the admin sets a new one.
const resetUserPassword = resetPasswordFor(['student', 'security']);

// @desc    Activate / deactivate a warden. Optionally move their students to
//          another active warden when deactivating.
// @route   PATCH /api/admin/wardens/:id/status
// @access  Private (admin)
const setWardenStatus = async (req, res) => {
  try {
    if (!(await hasHostelTracking())) {
      return res.status(503).json({ message: 'Run hostel_tracking.sql in Supabase to enable account status.' });
    }
    const { is_active, reassign_to } = req.body;
    if (typeof is_active !== 'boolean') return res.status(400).json({ message: 'is_active must be true or false.' });

    if (!is_active && reassign_to) {
      if (reassign_to === req.params.id) return res.status(400).json({ message: 'Choose a different warden to take over.' });
      const { data: target } = await supabase
        .from('users')
        .select('_id, is_active')
        .eq('_id', reassign_to)
        .eq('role', 'warden')
        .maybeSingle();
      if (!target || target.is_active === false) return res.status(400).json({ message: 'Students can only be moved to an active warden.' });
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        is_active,
        deactivated_at: is_active ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('_id', req.params.id)
      .eq('role', 'warden')
      .select(TRACKING_COLS)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Warden not found' });

    if (!is_active && reassign_to) {
      const { error: moveErr } = await supabase
        .from('users')
        .update({ assigned_warden: reassign_to })
        .eq('role', 'student')
        .eq('assigned_warden', req.params.id);
      if (moveErr) throw moveErr;
    }

    const [decorated] = await decorate([data]);
    res.json(decorated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Permanently delete a warden account (kept for compatibility —
//          the UI prefers deactivation, which preserves history)
// @route   DELETE /api/admin/wardens/:id
// @access  Private (admin)
const deleteWarden = async (req, res) => {
  try {
    await supabase.from('users').update({ assigned_warden: null }).eq('assigned_warden', req.params.id);

    const { error } = await supabase.from('users').delete().eq('_id', req.params.id).eq('role', 'warden');
    if (error) throw error;
    res.json({ message: 'Warden deleted and students unassigned.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getAllWardens, getWardenById, createWarden, updateWarden, resetWardenPassword, resetUserPassword, setWardenStatus, deleteWarden };
