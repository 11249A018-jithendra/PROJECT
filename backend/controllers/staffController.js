const supabase = require('../supabase');

// Maintenance staff (electricians, plumbers, …) complaints get assigned to.
// They don't log in — they're contacts the warden/admin dispatches.

// @route   GET /api/staff?active=true     (admin, warden)
const getStaff = async (req, res) => {
  try {
    let q = supabase.from('maintenance_staff').select('*').order('trade').order('name');
    if (req.query.active === 'true' || req.user.role !== 'admin') q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) throw error;

    // Open workload per person, so the dispatcher can spread jobs out.
    const { data: open } = await supabase
      .from('complaints')
      .select('assigned_staff_id')
      .in('status', ['Pending', 'In Progress'])
      .not('assigned_staff_id', 'is', null);
    const load = {};
    for (const c of open || []) load[c.assigned_staff_id] = (load[c.assigned_staff_id] || 0) + 1;
    res.json((data || []).map((s) => ({ ...s, open_jobs: load[s._id] || 0 })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const pick = (body) => {
  const out = {};
  if (body.name !== undefined) out.name = String(body.name).trim();
  if (body.trade !== undefined) out.trade = String(body.trade).trim();
  if (body.phone !== undefined) out.phone = String(body.phone || '').trim() || null;
  if (body.is_active !== undefined) out.is_active = Boolean(body.is_active);
  return out;
};

// @route   POST /api/staff   (admin)
const createStaff = async (req, res) => {
  try {
    const { data, error } = await supabase.from('maintenance_staff').insert(pick(req.body)).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/staff/:id   (admin) — set is_active false to retire someone
const updateStaff = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('maintenance_staff')
      .update({ ...pick(req.body), updated_at: new Date().toISOString() })
      .eq('_id', req.params.id)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Staff member not found' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getStaff, createStaff, updateStaff };
