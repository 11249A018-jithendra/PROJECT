const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { param } = require('express-validator');
const { protect, wardenOnly } = require('../middleware/auth');
const { rules } = require('../middleware/validate');
const { withoutPassword } = require('../utils/password');
const { todayIST, nowISTTimestamp } = require('../utils/istDate');

router.get('/students', protect, wardenOnly, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('_id, name, email, role, roll_no, room_no, course_year, phone, parent_contact, profile_photo, created_at, assigned_warden')
      .eq('role', 'student')
      .eq('is_active', true)
      .eq('assigned_warden', req.user._id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const ids = (data || []).map((st) => st._id);
    const { data: pending } = ids.length
      ? await supabase.from('student_exit_requests').select('student_id').eq('status', 'Pending').in('student_id', ids)
      : { data: [] };
    const pendingIds = new Set((pending || []).map((r) => r.student_id));
    res.json((data || []).map((st) => ({ ...st, exit_request_pending: pendingIds.has(st._id) })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/students/:id', protect, wardenOnly, rules(param('id').isUUID().withMessage('Invalid student.')), async (req, res) => {
  try {
    // Wardens see full details (incl. home address) only for their own students.
    const { data: row, error: sErr } = await supabase
      .from('users')
      .select('*')
      .eq('_id', req.params.id)
      .eq('role', 'student')
      .eq('is_active', true)
      .eq('assigned_warden', req.user._id)
      .single();
    const student = withoutPassword(row);

    if (sErr || !student) return res.status(404).json({ message: 'Student not found or not assigned to you' });

    const [{ data: complaints }, { data: outpasses }, { data: exitRequests }] = await Promise.all([
      supabase.from('complaints').select('*').eq('student_id', req.params.id).order('created_at', { ascending: false }),
      supabase.from('outpasses').select('*').eq('student_id', req.params.id).order('created_at', { ascending: false }),
      supabase.from('student_exit_requests').select('_id, status, reason, exit_date, created_at, rejection_reason, decided_at').eq('student_id', req.params.id).order('created_at', { ascending: false }).limit(1),
    ]);

    res.json({ student: { ...student, latest_exit_request: exitRequests?.[0] || null }, complaints: complaints || [], outpasses: outpasses || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const { getAttendance, markAttendance, markAttendanceBulk } = require('../controllers/attendanceController');

router.get('/dashboard', protect, wardenOnly, async (req, res) => {
  try {
    const [{ count: totalStudents }, { count: currentlyOutside }, { count: pendingOutpasses }] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', true).eq('assigned_warden', req.user._id),
      supabase.from('outpasses').select('*, student:users!inner(assigned_warden)', { count: 'exact', head: true }).eq('status', 'Checked Out').eq('student.assigned_warden', req.user._id),
      supabase.from('outpasses').select('*, student:users!inner(assigned_warden)', { count: 'exact', head: true }).eq('status', 'Pending').eq('student.assigned_warden', req.user._id),
    ]);
    res.json({ totalStudents, currentlyOutside, pendingOutpasses, server_time: nowISTTimestamp(), current_date: todayIST() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Trusted server time in IST (Asia/Kolkata)
router.get('/time', protect, wardenOnly, (req, res) => {
  res.json({
    date: todayIST(),
    server_time: nowISTTimestamp(),
    timezone: 'Asia/Kolkata',
  });
});

// Attendance routes for Warden (strictly scoped to current date in controller)
router.get('/attendance', protect, wardenOnly, getAttendance);
router.put('/attendance', protect, wardenOnly, markAttendanceBulk);
router.put('/attendance/:studentId', protect, wardenOnly, rules(param('studentId').isUUID().withMessage('Invalid student.')), markAttendance);

module.exports = router;
