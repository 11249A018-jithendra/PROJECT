const jwt = require('jsonwebtoken');
const { passwordVersion } = require('../utils/sessionToken');
const supabase = require('../supabase');
const { parsePage, pageResponse } = require('../utils/paginate');
const { passwordProblem, hashPassword, withoutPassword } = require('../utils/password');
const { PORTAL_ROLES, portalForRole } = require('../utils/portals');

// Developer console API. Every route is behind protect + developerOnly
// (a developer account, on the developer's own computer); every change is
// recorded in developer_audit_log by middleware/auth.js.

const ROLES = ['student', 'admin', 'warden', 'security', 'developer'];
const USER_COLS = '_id, name, email, role, roll_no, room_no, phone, is_active, created_at, updated_at, hostel_id, assigned_warden, password_changed_at';
const startedAt = Date.now();

const audit = (req, action, target) =>
  supabase.from('developer_audit_log').insert({
    developer_id: req.user._id,
    action,
    target,
    status: 200,
    ip: req.socket?.remoteAddress || null,
  });

// @route GET /api/developer/overview — system health and counts
const getOverview = async (req, res) => {
  try {
    const t0 = Date.now();
    const { error: pingErr } = await supabase.from('users').select('_id', { head: true, count: 'exact' }).limit(1);
    const dbMs = Date.now() - t0;

    const count = (table, build = (q) => q) =>
      build(supabase.from(table).select('*', { count: 'exact', head: true })).then((r) => r.count || 0);
    const since24h = new Date(Date.now() - 86400000).toISOString();

    const [byRole, inactive, outpassesOpen, complaintsOpen, sosOpen, errors24h, devActions24h] = await Promise.all([
      Promise.all(ROLES.map(async (r) => [r, await count('users', (q) => q.eq('role', r).eq('is_active', true))])),
      count('users', (q) => q.eq('is_active', false)),
      count('outpasses', (q) => q.in('status', ['Pending', 'Approved', 'Checked Out'])),
      count('complaints', (q) => q.in('status', ['Pending', 'In Progress'])),
      count('sos_alerts', (q) => q.in('status', ['Open', 'Acknowledged'])),
      count('server_errors', (q) => q.gte('created_at', since24h)),
      count('developer_audit_log', (q) => q.gte('created_at', since24h)),
    ]);

    res.json({
      server: {
        uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
        node: process.version,
        environment: process.env.NODE_ENV || 'development',
        time: new Date().toISOString(),
      },
      database: { ok: !pingErr, latency_ms: dbMs, error: pingErr?.message || null },
      users: { active_by_role: Object.fromEntries(byRole), inactive },
      open: { outpasses: outpassesOpen, complaints: complaintsOpen, sos: sosOpen },
      last_24h: { server_errors: errors24h, developer_actions: devActions24h },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/developer/users?search=&role=&status=active|inactive&page=
const getUsers = async (req, res) => {
  try {
    const paging = parsePage(req, 25) || { page: 1, limit: 25, from: 0, to: 24 };
    let q = supabase.from('users').select(USER_COLS, { count: 'exact' }).order('created_at', { ascending: false });
    if (ROLES.includes(req.query.role)) q = q.eq('role', req.query.role);
    if (req.query.status === 'active') q = q.eq('is_active', true);
    if (req.query.status === 'inactive') q = q.eq('is_active', false);
    const s = String(req.query.search || '').replace(/[,()*%\\:"']/g, ' ').trim().slice(0, 60);
    if (s) q = q.or(`name.ilike.%${s}%,email.ilike.%${s}%,roll_no.ilike.%${s}%,phone.ilike.%${s}%`);
    const { data, error, count } = await q.range(paging.from, paging.to);
    if (error) throw error;
    res.json(pageResponse(data || [], count || 0, paging));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/developer/users — create any account (incl. another developer)
const createUser = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ message: problem });
    const { data, error } = await supabase
      .from('users')
      .insert({ name: name.trim(), email: email.trim().toLowerCase(), role, phone: phone?.trim() || null, password: await hashPassword(password), password_changed_at: new Date().toISOString() })
      .select(USER_COLS)
      .single();
    if (error) {
      if (error.code === '23505') return res.status(400).json({ message: 'A user with this email already exists.' });
      throw error;
    }
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route PATCH /api/developer/users/:id — name, email, phone, role, is_active
const updateUser = async (req, res) => {
  try {
    if (req.params.id === req.user._id && (req.body.role !== undefined || req.body.is_active === false)) {
      return res.status(400).json({ message: "You can't change your own role or deactivate yourself." });
    }
    const updates = { updated_at: new Date().toISOString() };
    for (const k of ['name', 'phone']) if (req.body[k] !== undefined) updates[k] = String(req.body[k] || '').trim() || null;
    if (req.body.email !== undefined) updates.email = String(req.body.email).trim().toLowerCase();
    if (req.body.role !== undefined) updates.role = req.body.role;
    if (req.body.is_active !== undefined) {
      updates.is_active = Boolean(req.body.is_active);
      updates.deactivated_at = updates.is_active ? null : new Date().toISOString();
    }
    const { data, error } = await supabase.from('users').update(updates).eq('_id', req.params.id).select(USER_COLS).maybeSingle();
    if (error) {
      if (error.code === '23505') return res.status(400).json({ message: 'Another user already uses this email.' });
      throw error;
    }
    if (!data) return res.status(404).json({ message: 'User not found.' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route PUT /api/developer/users/:id/password — any account
const resetPassword = async (req, res) => {
  try {
    const problem = passwordProblem(req.body.password);
    if (problem) return res.status(400).json({ message: problem });
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('users')
      .update({ password: await hashPassword(req.body.password), password_changed_at: now, updated_at: now })
      .eq('_id', req.params.id)
      .select('_id, name')
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: `Password reset for ${data.name}. They have been signed out everywhere.` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/developer/impersonate   body: { user_id }
// A 1-hour token to open that user's portal exactly as they see it. It only
// works on this computer (middleware/auth.js) and every change is audited.
const impersonate = async (req, res) => {
  try {
    const { data: target } = await supabase.from('users').select('_id, name, role, is_active, password_changed_at').eq('_id', req.body.user_id).maybeSingle();
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.role === 'developer') return res.status(400).json({ message: 'Developers cannot be impersonated.' });
    if (target.is_active === false) return res.status(400).json({ message: 'This account is deactivated — re-activate it first.' });
    const portal = portalForRole(target.role);
    const token = jwt.sign({ id: target._id, portal, imp_by: req.user._id, pwd: passwordVersion(target.password_changed_at) }, process.env.JWT_SECRET, { expiresIn: '1h' });
    await audit(req, 'IMPERSONATE', `${target.name} (${target.role})`);
    res.json({ token, portal, user: { _id: target._id, name: target.name, role: target.role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route POST /api/developer/portal-token   body: { portal: 'staff' }
// Lets the developer open the Staff portal with full admin rights as themselves.
const portalToken = async (req, res) => {
  try {
    const { portal } = req.body;
    if (!PORTAL_ROLES[portal] || portal === 'developer') return res.status(400).json({ message: 'Choose student, staff or gate.' });
    const token = jwt.sign({ id: req.user._id, portal, pwd: passwordVersion(req.user.password_changed_at) }, process.env.JWT_SECRET, { expiresIn: '8h' });
    await audit(req, 'OPEN_PORTAL', portal);
    res.json({ token, portal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const listTable = (table, select) => async (req, res) => {
  try {
    const paging = parsePage(req, 50) || { page: 1, limit: 50, from: 0, to: 49 };
    const { data, error, count } = await supabase.from(table).select(select, { count: 'exact' }).order('created_at', { ascending: false }).range(paging.from, paging.to);
    if (error) throw error;
    res.json(pageResponse(data || [], count || 0, paging));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route GET /api/developer/audit — who did what with developer powers
const getAuditLog = listTable('developer_audit_log', '*, developer:users!developer_id(name, email), acting_as:users!acting_as_id(name, role)');
// @route GET /api/developer/errors — server errors (the "ref" users see)
const getServerErrors = listTable('server_errors', '*');

// @route GET /api/developer/me — the console's own session check
const getMe = (req, res) => res.json({ ...withoutPassword(req.user), role: 'developer' });

module.exports = { getOverview, getUsers, createUser, updateUser, resetPassword, impersonate, portalToken, getAuditLog, getServerErrors, getMe, ROLES };
