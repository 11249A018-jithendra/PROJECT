const supabase = require('../supabase');
const { notifyUsers, notifyRole } = require('../utils/notify');
const { parsePage, pageResponse } = require('../utils/paginate');
const { archiveStudent, sendArchiveError } = require('../utils/studentArchive');
const { withoutPassword } = require('../utils/password');

// Workflow: Warden submits (Pending) -> Admin approves (archive, Approved)
//                                    -> Admin rejects (Rejected, student stays active)
//                                    -> Warden withdraws (Cancelled)

const SELECT = `*,
  student:users!student_id(_id, name, email, roll_no, room_no, course_year, phone, parent_contact, profile_photo, is_active, assigned_warden, hostel_id),
  requester:users!requested_by(_id, name, email, phone),
  decider:users!decided_by(_id, name),
  hostel:hostels(name)`;

const decorate = (r) => ({ ...r, hostel_name: r.hostel?.name || null, hostel: undefined });

const studentLabel = (s) => `${s?.name || 'A student'}${s?.roll_no ? ` (${s.roll_no})` : ''}`;

// @desc    Warden asks the admin to permanently exit one of their students
// @route   POST /api/exit-requests   body: { student_id, reason, exit_date?, remarks? }
// @access  Private (warden — only students assigned to them)
const createExitRequest = async (req, res) => {
  try {
    const { student_id, reason, exit_date, remarks } = req.body;

    const { data: student } = await supabase
      .from('users')
      .select('_id, name, roll_no, is_active, assigned_warden, hostel_id')
      .eq('_id', student_id)
      .eq('role', 'student')
      .maybeSingle();
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    if (student.assigned_warden !== req.user._id) return res.status(403).json({ message: 'You can only request exits for students assigned to you.' });
    if (!student.is_active) return res.status(409).json({ message: 'This student has already left the hostel.' });

    const { data, error } = await supabase
      .from('student_exit_requests')
      .insert({
        student_id: student._id,
        requested_by: req.user._id,
        hostel_id: student.hostel_id || null,
        reason: reason.trim(),
        exit_date: exit_date || null,
        remarks: remarks?.trim() || null,
      })
      .select(SELECT)
      .single();
    if (error) {
      // Unique partial index: one Pending request per student.
      if (error.code === '23505') return res.status(409).json({ message: 'An exit request for this student is already waiting for the admin.' });
      throw error;
    }

    notifyRole('admin', {
      type: 'EXIT_REQUEST',
      title: 'Permanent exit request',
      message: `${req.user.name} asked to permanently exit ${studentLabel(student)}: ${data.reason}`,
      link: '/admin/exit-requests',
    });
    res.status(201).json(decorate(data));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    List exit requests. Admin: all. Warden: requests for their students or made by them.
// @route   GET /api/exit-requests?status=&search=&page=
const getExitRequests = async (req, res) => {
  try {
    const paging = parsePage(req, 20);
    let q = supabase.from('student_exit_requests').select(SELECT, { count: 'exact' }).order('created_at', { ascending: false });
    if (req.query.status && req.query.status !== 'All') q = q.eq('status', req.query.status);
    if (req.user.role === 'warden') q = q.eq('requested_by', req.user._id);
    if (req.query.student_id) q = q.eq('student_id', req.query.student_id);

    const { data, error, count } = paging ? await q.range(paging.from, paging.to) : await q.limit(200);
    if (error) throw error;

    // Pending counts for the tabs / sidebar badge.
    let pendingQ = supabase.from('student_exit_requests').select('*', { count: 'exact', head: true }).eq('status', 'Pending');
    if (req.user.role === 'warden') pendingQ = pendingQ.eq('requested_by', req.user._id);
    const { count: pending } = await pendingQ;

    let rows = (data || []).map(decorate);
    const s = String(req.query.search || '').trim().toLowerCase();
    if (s) rows = rows.filter((r) => [r.student?.name, r.student?.roll_no, r.requester?.name].some((v) => v && v.toLowerCase().includes(s)));

    if (!paging) return res.json(rows);
    res.json({ ...pageResponse(rows, count || 0, paging), pending: pending || 0 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    One request with full student + warden details (for the admin's decision)
// @route   GET /api/exit-requests/:id
const getExitRequest = async (req, res) => {
  try {
    const { data: r, error } = await supabase.from('student_exit_requests').select(SELECT).eq('_id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!r) return res.status(404).json({ message: 'Exit request not found.' });
    if (req.user.role === 'warden' && r.requested_by !== req.user._id) return res.status(403).json({ message: 'Not your request.' });

    // Everything the admin needs before deciding.
    const [{ data: profile }, outpasses, complaints, attendance] = await Promise.all([
      supabase
        .from('users')
        .select('*, room:rooms(room_no, floor, capacity), current_hostel:hostels(name), warden:users!assigned_warden(name, phone, email)')
        .eq('_id', r.student_id)
        .single(),
      supabase.from('outpasses').select('status').eq('student_id', r.student_id),
      supabase.from('complaints').select('status').eq('student_id', r.student_id),
      supabase.from('attendances').select('status').eq('student_id', r.student_id),
    ]);
    const count = (rows, st) => (rows.data || []).filter((x) => !st || st.includes(x.status)).length;

    res.json({
      ...decorate(r),
      student_profile: withoutPassword(profile),
      history: {
        outpasses_total: count(outpasses),
        currently_outside: count(outpasses, ['Checked Out']) > 0,
        open_outpasses: count(outpasses, ['Pending', 'Approved']),
        complaints_total: count(complaints),
        complaints_open: count(complaints, ['Pending', 'In Progress']),
        attendance_present: count(attendance, ['Present']),
        attendance_absent: count(attendance, ['Absent']),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Admin approves: archive the student (atomic) and close the request
// @route   PUT /api/exit-requests/:id/approve   body: { exit_date?, force? }
// @access  Private (admin)
const approveExitRequest = async (req, res) => {
  try {
    const past = await archiveStudent({
      requestId: req.params.id,
      adminId: req.user._id,
      exitDate: req.body.exit_date || null,
      force: req.body.force,
    });

    const { data: request } = await supabase.from('student_exit_requests').select(SELECT).eq('_id', req.params.id).single();
    notifyUsers([request.requested_by], {
      type: 'EXIT_DECISION',
      title: 'Exit request approved',
      message: `${studentLabel(request.student)} has been permanently exited from the hostel by ${req.user.name}.`,
      link: '/warden/exit-requests',
    });
    res.json({ message: `${past.name} has been moved to Past Students.`, request: decorate(request), past_student: past });
  } catch (error) {
    sendArchiveError(res, error);
  }
};

// @desc    Admin rejects: student stays active; reason shown to the warden
// @route   PUT /api/exit-requests/:id/reject   body: { reason }
// @access  Private (admin)
const rejectExitRequest = async (req, res) => {
  try {
    const now = new Date().toISOString();
    // Single conditional update — atomic, and loses cleanly to a concurrent approval.
    const { data, error } = await supabase
      .from('student_exit_requests')
      .update({ status: 'Rejected', decided_by: req.user._id, decided_at: now, rejection_reason: req.body.reason.trim(), updated_at: now })
      .eq('_id', req.params.id)
      .eq('status', 'Pending')
      .select(SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      const { data: exists } = await supabase.from('student_exit_requests').select('status').eq('_id', req.params.id).maybeSingle();
      return exists
        ? res.status(409).json({ message: `This request was already ${exists.status.toLowerCase()}.` })
        : res.status(404).json({ message: 'Exit request not found.' });
    }

    notifyUsers([data.requested_by], {
      type: 'EXIT_DECISION',
      title: 'Exit request rejected',
      message: `Your request to exit ${studentLabel(data.student)} was rejected: ${data.rejection_reason}`,
      link: '/warden/exit-requests',
    });
    res.json({ message: 'Request rejected. The student remains active.', request: decorate(data) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Warden withdraws their own pending request
// @route   PUT /api/exit-requests/:id/cancel
// @access  Private (warden — own requests)
const cancelExitRequest = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('student_exit_requests')
      .update({ status: 'Cancelled', updated_at: new Date().toISOString() })
      .eq('_id', req.params.id)
      .eq('requested_by', req.user._id)
      .eq('status', 'Pending')
      .select(SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ message: 'Only your own pending requests can be withdrawn.' });
    res.json(decorate(data));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createExitRequest, getExitRequests, getExitRequest, approveExitRequest, rejectExitRequest, cancelExitRequest };
