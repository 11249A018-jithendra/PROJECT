const supabase = require('../supabase');
const { notifyUsers } = require('../utils/notify');
const { todayIST } = require('../utils/istDate');
const { parsePage, pageResponse } = require('../utils/paginate');

const SELECT = '*, student:users!student_id(_id, name, roll_no, room_no, assigned_warden), hostel:hostels(name)';
const IST_OFFSET = '+05:30';

const decorate = (v) => ({ ...v, hostel_name: v.hostel?.name || null, hostel: undefined });

// @desc    Visitor log (filter by IST date, inside-only, search)
// @route   GET /api/visitors?date=YYYY-MM-DD&inside=true&search=&page=
// @access  Private (security, admin; warden sees visitors of their students)
const getVisitors = async (req, res) => {
  try {
    const paging = parsePage(req, 25);
    let q = supabase
      .from('visitors')
      .select(req.user.role === 'warden' ? SELECT.replace('users!student_id', 'users!inner') : SELECT, paging ? { count: 'exact' } : undefined)
      .order('check_in_at', { ascending: false });

    if (req.user.role === 'warden') q = q.eq('student.assigned_warden', req.user._id);
    if (req.query.inside === 'true') q = q.is('check_out_at', null);
    if (req.query.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) return res.status(400).json({ message: 'Date must be YYYY-MM-DD.' });
      const start = new Date(`${req.query.date}T00:00:00${IST_OFFSET}`);
      const end = new Date(start.getTime() + 86400000);
      q = q.gte('check_in_at', start.toISOString()).lt('check_in_at', end.toISOString());
    }
    const search = String(req.query.search || '').replace(/[,()*%\\:"']/g, ' ').trim().slice(0, 40);
    if (search) q = q.or(`visitor_name.ilike.%${search}%,phone.ilike.%${search}%`);

    const { data, error, count } = paging ? await q.range(paging.from, paging.to) : await q.limit(200);
    if (error) throw error;
    const rows = (data || []).map(decorate);
    res.json(paging ? pageResponse(rows, count || 0, paging) : rows);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Check a visitor in at the gate (optionally linked to a student)
// @route   POST /api/visitors
// @access  Private (security, admin)
const checkInVisitor = async (req, res) => {
  try {
    const { visitor_name, phone, relation, purpose, id_proof, student_id } = req.body;
    let student = null;
    if (student_id) {
      const { data } = await supabase
        .from('users')
        .select('_id, name, hostel_id, is_active')
        .eq('_id', student_id)
        .eq('role', 'student')
        .maybeSingle();
      if (!data || !data.is_active) return res.status(400).json({ message: 'Student not found.' });
      student = data;
    }

    const { data, error } = await supabase
      .from('visitors')
      .insert({
        visitor_name: visitor_name.trim(),
        phone: phone?.trim() || null,
        relation: relation?.trim() || null,
        purpose: purpose?.trim() || null,
        id_proof: id_proof?.trim() || null,
        student_id: student?._id || null,
        hostel_id: student?.hostel_id || null,
        checked_in_by: req.user._id,
      })
      .select(SELECT)
      .single();
    if (error) throw error;

    if (student) {
      notifyUsers([student._id], {
        type: 'VISITOR',
        title: 'You have a visitor',
        message: `${data.visitor_name}${data.relation ? ` (${data.relation})` : ''} is at the hostel gate.`,
        link: '/dashboard',
      });
    }
    res.status(201).json(decorate(data));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Check a visitor out
// @route   PUT /api/visitors/:id/checkout
// @access  Private (security, admin)
const checkOutVisitor = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('visitors')
      .update({ check_out_at: new Date().toISOString(), checked_out_by: req.user._id })
      .eq('_id', req.params.id)
      .is('check_out_at', null)
      .select(SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ message: 'Visitor not found or already checked out.' });
    res.json(decorate(data));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Today's visitor counts for the security dashboard
// @route   GET /api/visitors/summary
const getVisitorSummary = async (req, res) => {
  try {
    const start = new Date(`${todayIST()}T00:00:00${IST_OFFSET}`).toISOString();
    const [{ count: today }, { count: inside }] = await Promise.all([
      supabase.from('visitors').select('*', { count: 'exact', head: true }).gte('check_in_at', start),
      supabase.from('visitors').select('*', { count: 'exact', head: true }).is('check_out_at', null),
    ]);
    res.json({ today: today || 0, inside: inside || 0 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getVisitors, checkInVisitor, checkOutVisitor, getVisitorSummary };
