const supabase = require('../supabase');
const { todayIST, nowISTTimestamp } = require('../utils/istDate');
const { hasHostelTracking, fetchAll } = require('../utils/schema');
const { withoutPassword } = require('../utils/password');
const { archiveStudent, readmitStudent: readmitStudentFn, sendArchiveError } = require('../utils/studentArchive');

// Student ids with an exit request waiting for the admin.
const pendingExitIds = async (ids) => {
  if (!ids.length) return new Set();
  const { data } = await supabase.from('student_exit_requests').select('student_id').eq('status', 'Pending').in('student_id', ids);
  return new Set((data || []).map((r) => r.student_id));
};
const { presenceByStudent, presenceFor } = require('../utils/hostelPresence');

const STUDENT_COLS = '_id, name, email, role, roll_no, room_no, course_year, phone, parent_contact, profile_photo, created_at, assigned_warden, is_active, checked_out_at, checkout_reason, room_id';
const studentCols = async () => ((await hasHostelTracking()) ? `${STUDENT_COLS}, hostel_id, home_address` : STUDENT_COLS);

// Strips characters that carry meaning inside a PostgREST .or() filter
// (commas, parentheses, wildcards, quotes) so a search box can't alter the query.
const safeSearch = (q) => String(q || '').replace(/[,()*%\\:"']/g, ' ').trim().slice(0, 60);

const hostelNameMap = async () => {
  if (!(await hasHostelTracking())) return {};
  const { data } = await supabase.from('hostels').select('_id, name');
  return Object.fromEntries((data || []).map((h) => [h._id, h.name]));
};

// @desc    Get dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private (admin)
const getDashboardStats = async (req, res) => {
  try {
    const [
      { count: totalStudents },
      { count: pendingComplaints },
      { count: pendingOutpasses },
      { count: totalComplaints },
      { count: totalOutpasses },
      { count: markedAttendanceCount },
      { count: currentlyOutside },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true),
      supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
      supabase.from('outpasses').select('*', { count: 'exact', head: true }).eq('status', 'Pending'),
      supabase.from('complaints').select('*', { count: 'exact', head: true }),
      supabase.from('outpasses').select('*', { count: 'exact', head: true }),
      supabase.from('attendances').select('*', { count: 'exact', head: true })
        .eq('date', todayIST())
        .in('status', ['Present', 'Absent']),
      supabase.from('outpasses').select('*', { count: 'exact', head: true }).eq('status', 'Checked Out'),
    ]);

    const pendingAttendance = Math.max((totalStudents || 0) - (markedAttendanceCount || 0), 0);

    // Open complaints auto-escalated to Admin. The `escalated` column comes
    // from complaint_escalation.sql — before that migration runs, report 0.
    const { count: escalatedCount, error: escalatedErr } = await supabase
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('escalated', true)
      .in('status', ['Pending', 'In Progress']);
    const escalatedComplaints = escalatedErr ? 0 : (escalatedCount || 0);

    res.json({
      totalStudents,
      pendingComplaints,
      pendingOutpasses,
      totalComplaints,
      totalOutpasses,
      pendingAttendance,
      currentlyOutside,
      escalatedComplaints,
      current_date: todayIST(),
      server_time: nowISTTimestamp(),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all students
// @route   GET /api/admin/students
// @access  Private (admin)
const getAllStudents = async (req, res) => {
  try {
    const { room_no, course_year, hostel_id, status = 'active' } = req.query;
    const search = safeSearch(req.query.search);
    const cols = await studentCols();
    const tracking = await hasHostelTracking();
    // Paged through in full: one response is capped at 1000 rows.
    const data = await fetchAll(() => {
      let query = supabase
        .from('users')
        .select(cols)
        .eq('role', 'student')
        .order('created_at', { ascending: false })
        .order('_id');

      if (status === 'active') query = query.eq('is_active', true);
      else if (status === 'checked_out') query = query.eq('is_active', false);
      if (room_no) query = query.eq('room_no', room_no);
      if (course_year) query = query.eq('course_year', course_year);
      if (hostel_id && tracking) {
        query = hostel_id === 'unassigned' ? query.is('hostel_id', null) : query.eq('hostel_id', hostel_id);
      }
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,roll_no.ilike.%${search}%`);
      }
      return query;
    });
    const pending = await pendingExitIds((data || []).map((st) => st._id));
    res.json((data || []).map((st) => ({ ...st, exit_request_pending: pending.has(st._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single student full profile with complaints and outpasses
// @route   GET /api/admin/students/:id
// @access  Private (admin)
const getStudentById = async (req, res) => {
  try {
    const { data: row, error: sErr } = await supabase
      .from('users')
      .select('*')
      .eq('_id', req.params.id)
      .eq('role', 'student')
      .single();

    if (sErr || !row) return res.status(404).json({ message: 'Student not found' });
    const student = withoutPassword(row);

    const [{ data: complaints }, { data: outpasses }, { data: attendance }, hostels, wardenRes] = await Promise.all([
      supabase.from('complaints').select('*').eq('student_id', req.params.id).order('created_at', { ascending: false }),
      supabase.from('outpasses').select('*').eq('student_id', req.params.id).order('created_at', { ascending: false }),
      supabase.from('attendances').select('status').eq('student_id', req.params.id).eq('date', todayIST()).maybeSingle(),
      hostelNameMap(),
      student.assigned_warden
        ? supabase.from('users').select('name, phone').eq('_id', student.assigned_warden).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const presence = presenceFor(presenceByStudent(outpasses || []), student._id);
    const { data: exitRequests } = await supabase
      .from('student_exit_requests')
      .select('_id, status, reason, exit_date, created_at, rejection_reason, requester:users!requested_by(name)')
      .eq('student_id', student._id)
      .order('created_at', { ascending: false })
      .limit(1);
    res.json({
      student: {
        ...student,
        hostel_name: hostels[student.hostel_id] || null,
        warden_name: wardenRes.data?.name || null,
        attendance_today: attendance?.status || 'Pending',
        ...presence,
        latest_exit_request: exitRequests?.[0] || null,
      },
      complaints: complaints || [],
      outpasses: outpasses || [],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign warden to student
// @route   PUT /api/admin/students/:id/warden
// @access  Private (admin)
const assignWarden = async (req, res) => {
  try {
    const { assigned_warden } = req.body;
    if (assigned_warden) {
      const { data: warden } = await supabase.from('users').select('*').eq('_id', assigned_warden).eq('role', 'warden').maybeSingle();
      if (!warden) return res.status(400).json({ message: 'Warden not found.' });
      if (warden.is_active === false) return res.status(400).json({ message: 'Cannot assign students to a deactivated warden.' });
    }
    const { data, error } = await supabase
      .from('users')
      .update({ assigned_warden: assigned_warden || null })
      .eq('_id', req.params.id)
      .eq('role', 'student')
      .eq('is_active', true)
      .select('_id, name, email, role, roll_no, room_no, course_year, phone, parent_contact, profile_photo, assigned_warden')
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ message: 'Student not found' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin checks a student out directly (left / graduated / transferred).
//          Same atomic operation as approving a warden's exit request:
//          snapshot to Past Students, deactivate, free room, close requests.
// @route   POST /api/admin/students/:id/checkout   body: { reason, exit_date?, force? }
// @access  Private (admin)
const checkoutStudent = async (req, res) => {
  try {
    const past = await archiveStudent({
      studentId: req.params.id,
      adminId: req.user._id,
      reason: req.body.reason,
      exitDate: req.body.exit_date || null,
      force: req.body.force,
    });
    res.json({ message: `${past.name} has been moved to Past Students.`, past_student: past, _id: past.student_id, is_active: false, room_id: null });
  } catch (error) {
    sendArchiveError(res, error);
  }
};

// @desc    Re-admit a past student (they'll need a hostel/room again).
//          Their Past Students record is kept and marked "readmitted".
// @route   POST /api/admin/students/:id/readmit
// @access  Private (admin)
const readmitStudent = async (req, res) => {
  try {
    const user = await readmitStudentFn({ studentId: req.params.id, adminId: req.user._id });
    res.json(withoutPassword(user));
  } catch (error) {
    sendArchiveError(res, error);
  }
};

module.exports = { getDashboardStats, getAllStudents, getStudentById, assignWarden, checkoutStudent, readmitStudent };
