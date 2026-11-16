const supabase = require('../supabase');
const { notifyUsers, notifyRole } = require('../utils/notify');

// Emergency help: contacts students can call (warden-managed) + SOS alerts.
// Drivers/ambulance are plain contacts, not login accounts.

const SOS_COOLDOWN_MINUTES = 10;
const CONTACT_COLS = '_id, name, category, phone, notes, hostel_id, is_active, sort_order, created_by, created_at, updated_at';
const CATEGORY_ORDER = ['Warden', 'Security', 'Driver', 'Ambulance', 'Medical', 'Other'];

const byCategory = (a, b) =>
  CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name);

// Contacts a warden may edit: their hostel's, everyone's (when they have no
// hostel), or ones they created.
const wardenCanEdit = (user, contact) =>
  contact.created_by === user._id || (user.hostel_id ? contact.hostel_id === user.hostel_id : contact.hostel_id === null);

// @desc    Emergency contacts.
//          Student: active contacts for everyone + their hostel, plus their own
//          warden and on-duty security accounts (with phone numbers).
//          Warden/admin: the managed list (incl. inactive) for editing.
// @route   GET /api/emergency/contacts
const getContacts = async (req, res) => {
  try {
    const { role, hostel_id: myHostel } = req.user;
    let q = supabase.from('emergency_contacts').select(CONTACT_COLS);
    if (role === 'student' || role === 'security') {
      q = q.eq('is_active', true);
      q = myHostel ? q.or(`hostel_id.is.null,hostel_id.eq.${myHostel}`) : q.is('hostel_id', null);
    } else if (role === 'warden') {
      q = myHostel ? q.or(`hostel_id.is.null,hostel_id.eq.${myHostel},created_by.eq.${req.user._id}`) : q.or(`hostel_id.is.null,created_by.eq.${req.user._id}`);
    }
    const { data, error } = await q;
    if (error) throw error;
    let contacts = (data || []).map((c) => ({ ...c, source: 'manual', can_edit: role === 'admin' || (role === 'warden' && wardenCanEdit(req.user, c)) }));

    if (role === 'student') {
      // Always include the people who can actually help, from their accounts.
      const [{ data: me }, { data: guards }] = await Promise.all([
        supabase.from('users').select('assigned_warden').eq('_id', req.user._id).single(),
        supabase.from('users').select('_id, name, phone').eq('role', 'security').eq('is_active', true).not('phone', 'is', null),
      ]);
      const accountContacts = [];
      if (me?.assigned_warden) {
        const { data: w } = await supabase.from('users').select('_id, name, phone').eq('_id', me.assigned_warden).eq('is_active', true).maybeSingle();
        if (w?.phone) accountContacts.push({ _id: `user-${w._id}`, name: w.name, category: 'Warden', phone: w.phone, notes: 'Your warden', source: 'account' });
      }
      for (const g of guards || []) accountContacts.push({ _id: `user-${g._id}`, name: g.name, category: 'Security', phone: g.phone, notes: 'Hostel security', source: 'account' });
      const known = new Set(contacts.map((c) => c.phone.replace(/\D/g, '')));
      contacts = [...accountContacts.filter((c) => !known.has(c.phone.replace(/\D/g, ''))), ...contacts];
    }

    res.json(contacts.sort(byCategory));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const pick = (body) => {
  const out = {};
  if (body.name !== undefined) out.name = String(body.name).trim();
  if (body.category !== undefined) out.category = body.category;
  if (body.phone !== undefined) out.phone = String(body.phone).trim();
  if (body.notes !== undefined) out.notes = String(body.notes || '').trim() || null;
  if (body.is_active !== undefined) out.is_active = Boolean(body.is_active);
  if (body.sort_order !== undefined) out.sort_order = Number(body.sort_order) || 0;
  return out;
};

// @route   POST /api/emergency/contacts   (warden: forced to their hostel; admin: any / all)
const createContact = async (req, res) => {
  try {
    const row = { ...pick(req.body), created_by: req.user._id };
    row.hostel_id = req.user.role === 'warden' ? req.user.hostel_id || null : req.body.hostel_id || null;
    const { data, error } = await supabase.from('emergency_contacts').insert(row).select(CONTACT_COLS).single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const loadEditable = async (req) => {
  const { data } = await supabase.from('emergency_contacts').select(CONTACT_COLS).eq('_id', req.params.id).maybeSingle();
  if (!data) return { status: 404, message: 'Contact not found.' };
  if (req.user.role === 'warden' && !wardenCanEdit(req.user, data)) return { status: 403, message: 'You can only edit contacts for your hostel.' };
  return { contact: data };
};

// @route   PUT /api/emergency/contacts/:id
const updateContact = async (req, res) => {
  try {
    const found = await loadEditable(req);
    if (found.message) return res.status(found.status).json({ message: found.message });
    const updates = { ...pick(req.body), updated_at: new Date().toISOString() };
    if (req.user.role === 'admin' && req.body.hostel_id !== undefined) updates.hostel_id = req.body.hostel_id || null;
    const { data, error } = await supabase.from('emergency_contacts').update(updates).eq('_id', req.params.id).select(CONTACT_COLS).single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   DELETE /api/emergency/contacts/:id
const deleteContact = async (req, res) => {
  try {
    const found = await loadEditable(req);
    if (found.message) return res.status(found.status).json({ message: found.message });
    const { error } = await supabase.from('emergency_contacts').delete().eq('_id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Contact removed.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------------------------------------------------------------------------
// SOS
// ---------------------------------------------------------------------------
const SOS_SELECT = '*, student:users!student_id(_id, name, roll_no, room_no, phone, parent_contact, assigned_warden), hostel:hostels(name), acknowledger:users!acknowledged_by(name), resolver:users!resolved_by(name)';
const decorateSos = (a) => ({ ...a, hostel_name: a.hostel?.name || null, hostel: undefined });

// @desc    Student raises an SOS. Notifies their warden, all security, all admins.
// @route   POST /api/emergency/sos   body: { message? }
// @access  Private (student)
const raiseSos = async (req, res) => {
  try {
    const since = new Date(Date.now() - SOS_COOLDOWN_MINUTES * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('sos_alerts')
      .select(SOS_SELECT)
      .eq('student_id', req.user._id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1);
    if (recent?.length) {
      return res.status(429).json({ message: `Your SOS was already sent at ${new Date(recent[0].created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}. Help has been alerted — please also call a contact below.`, alert: decorateSos(recent[0]) });
    }

    const { data: me } = await supabase.from('users').select('name, roll_no, room_no, phone, assigned_warden, hostel_id').eq('_id', req.user._id).single();
    const { data, error } = await supabase
      .from('sos_alerts')
      .insert({ student_id: req.user._id, hostel_id: me.hostel_id || null, message: String(req.body.message || '').trim() || null })
      .select(SOS_SELECT)
      .single();
    if (error) throw error;

    const payload = {
      type: 'SOS',
      title: '🚨 SOS — student needs help',
      message: `${me.name} (${me.roll_no || '—'}, Room ${me.room_no || '—'}${me.phone ? `, ${me.phone}` : ''})${data.message ? `: ${data.message}` : ' pressed the emergency button.'}`,
      link: '/emergency',
    };
    if (me.assigned_warden) await notifyUsers([me.assigned_warden], payload);
    await notifyRole('security', payload);
    await notifyRole('admin', payload);
    res.status(201).json({ message: 'SOS sent. Your warden, security and the admin have been alerted.', alert: decorateSos(data) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    SOS alerts. Student: their own. Warden: their students'. Security/admin: all.
// @route   GET /api/emergency/sos?status=Open|Acknowledged|Resolved|All
const getSosAlerts = async (req, res) => {
  try {
    const { role } = req.user;
    let q = supabase
      .from('sos_alerts')
      .select(role === 'warden' ? SOS_SELECT.replace('users!student_id', 'users!student_id!inner') : SOS_SELECT)
      .order('created_at', { ascending: false })
      .limit(100);
    if (role === 'student') q = q.eq('student_id', req.user._id);
    if (role === 'warden') q = q.eq('student.assigned_warden', req.user._id);
    const status = req.query.status;
    if (status === 'Active') q = q.in('status', ['Open', 'Acknowledged']);
    else if (['Open', 'Acknowledged', 'Resolved'].includes(status)) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    res.json((data || []).map(decorateSos));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Warden may only act on their own students' alerts.
const loadSosForStaff = async (req) => {
  const { data } = await supabase.from('sos_alerts').select(SOS_SELECT).eq('_id', req.params.id).maybeSingle();
  if (!data) return { status: 404, message: 'Alert not found.' };
  if (req.user.role === 'warden' && data.student?.assigned_warden !== req.user._id) return { status: 403, message: 'Not your student.' };
  return { alert: data };
};

// @route   PUT /api/emergency/sos/:id/acknowledge   — "I'm on it"
const acknowledgeSos = async (req, res) => {
  try {
    const found = await loadSosForStaff(req);
    if (found.message) return res.status(found.status).json({ message: found.message });
    const { data, error } = await supabase
      .from('sos_alerts')
      .update({ status: 'Acknowledged', acknowledged_by: req.user._id, acknowledged_at: new Date().toISOString() })
      .eq('_id', req.params.id)
      .eq('status', 'Open')
      .select(SOS_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ message: 'Someone already responded to this alert.' });
    notifyUsers([data.student_id], { type: 'SOS', title: 'Help is on the way', message: `${req.user.name} has seen your SOS and is responding.`, link: '/dashboard' });
    res.json(decorateSos(data));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/emergency/sos/:id/resolve   body: { note? }
const resolveSos = async (req, res) => {
  try {
    const found = await loadSosForStaff(req);
    if (found.message) return res.status(found.status).json({ message: found.message });
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('sos_alerts')
      .update({
        status: 'Resolved',
        resolved_by: req.user._id,
        resolved_at: now,
        resolution_note: String(req.body.note || '').trim() || null,
        ...(found.alert.acknowledged_at ? {} : { acknowledged_by: req.user._id, acknowledged_at: now }),
      })
      .eq('_id', req.params.id)
      .in('status', ['Open', 'Acknowledged'])
      .select(SOS_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ message: 'This alert is already resolved.' });
    res.json(decorateSos(data));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getContacts, createContact, updateContact, deleteContact, raiseSos, getSosAlerts, acknowledgeSos, resolveSos };
