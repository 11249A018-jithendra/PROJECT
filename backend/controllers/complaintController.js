const supabase = require('../supabase');
const { notifyUsers, notifyRole } = require('../utils/notify');
const { isEscalationReady, escalationDueAt, ESCALATION_HOURS } = require('../utils/complaintEscalation');
const { fetchAll } = require('../utils/schema');
const { parsePage, pageResponse } = require('../utils/paginate');

// Statuses staff can set. 'Cancelled' is set only by the student.
const STAFF_STATUSES = ['Pending', 'In Progress', 'Resolved'];
const REOPEN_WINDOW_DAYS = 7;
const MAX_REOPENS = 3;

const FULL_SELECT = '*, staff:maintenance_staff!assigned_staff_id(_id, name, trade, phone)';

// Adds the computed escalation deadline to complaints still waiting on a
// first response, so every client shows the same countdown.
const withEscalationInfo = (complaint) => {
  const awaiting = complaint.status === 'Pending' && !complaint.first_response_at && !complaint.escalated;
  return {
    ...complaint,
    escalation_due_at: awaiting ? escalationDueAt(complaint) : null,
  };
};

const isOpenEscalation = (c) => c.escalated && ['Pending', 'In Progress'].includes(c.status);

// Tab filters used by the staff complaint screen (server-side when paging).
const VIEW_TESTS = {
  all: () => true,
  escalated: isOpenEscalation,
  awaiting: (c) => Boolean(c.escalation_due_at),
  'in-progress': (c) => c.status === 'In Progress',
  resolved: (c) => c.status === 'Resolved',
  cancelled: (c) => c.status === 'Cancelled',
};

// Loads a complaint the caller is allowed to act on (student: own; warden:
// assigned students; admin: any). Returns { complaint } or { status, message }.
const loadForUser = async (req, id) => {
  const { data: complaint } = await supabase
    .from('complaints')
    .select('*, student:users!student_id(_id, name, room_no, assigned_warden)')
    .eq('_id', id)
    .maybeSingle();
  if (!complaint) return { status: 404, message: 'Complaint not found' };
  if (req.user.role === 'student' && complaint.student_id !== req.user._id) return { status: 403, message: 'Not your complaint' };
  if (req.user.role === 'warden' && complaint.student?.assigned_warden !== req.user._id) return { status: 403, message: 'Not authorized for this student' };
  if (req.user.role === 'security') return { status: 403, message: 'Not authorized' };
  return { complaint };
};

const labelOf = (c) => c.title || c.category || 'Complaint';

// @desc    Submit a complaint (student)
// @route   POST /api/complaints
// @access  Private (student)
const createComplaint = async (req, res) => {
  try {
    const { title, category, description } = req.body;
    // Build a forward-slash relative path ourselves: req.file.path uses the
    // OS separator, which breaks the URL when the server runs on Windows.
    const photo = req.file ? `uploads/${req.file.filename}` : null;

    const { data: complaint, error } = await supabase
      .from('complaints')
      .insert({
        student_id: req.user._id,
        title: title || category || 'Complaint',
        category,
        description,
        photo,
      })
      .select()
      .single();

    if (error) throw error;

    // Let the student's warden know there's something to respond to.
    const { data: student } = await supabase.from('users').select('assigned_warden').eq('_id', req.user._id).single();
    if (student?.assigned_warden) {
      notifyUsers([student.assigned_warden], {
        type: 'COMPLAINT_NEW',
        title: 'New complaint',
        message: `${req.user.name} (Room ${req.user.room_no || '—'}) reported a ${category || 'general'} issue. Respond within ${ESCALATION_HOURS}h to avoid escalation.`,
        link: '/warden/complaints',
        complaint_id: complaint._id,
      });
    }

    res.status(201).json(withEscalationInfo(complaint));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get complaints (student gets own, warden gets assigned students', admin gets all).
//          With ?page= staff get server-side filtering: view, category, search.
// @route   GET /api/complaints
// @access  Private
const getComplaints = async (req, res) => {
  try {
    const paging = parsePage(req, 20);
    let rows;
    if (req.user.role === 'admin' || req.user.role === 'warden') {
      rows = await fetchAll(() => {
        let q = supabase
          .from('complaints')
          .select(`${FULL_SELECT}, student:users!${req.user.role === 'warden' ? 'inner' : 'student_id'}(_id, name, email, roll_no, room_no, assigned_warden)`)
          .order('created_at', { ascending: false });
        if (req.user.role === 'warden') q = q.eq('student.assigned_warden', req.user._id);
        return q;
      });
    } else {
      rows = await fetchAll(() =>
        supabase.from('complaints').select(FULL_SELECT).eq('student_id', req.user._id).order('created_at', { ascending: false })
      );
    }

    let complaints = rows.map(withEscalationInfo);

    // Admin view: show which warden each complaint belongs to.
    if (req.user.role === 'admin') {
      const { data: wardens } = await supabase.from('users').select('_id, name').eq('role', 'warden');
      const wardenNames = Object.fromEntries((wardens || []).map((w) => [w._id, w.name]));
      complaints = complaints.map((c) => ({ ...c, warden_name: wardenNames[c.student?.assigned_warden] || null }));
    }

    if (!paging) return res.json(complaints);

    const counts = Object.fromEntries(Object.entries(VIEW_TESTS).map(([k, test]) => [k, complaints.filter(test).length]));
    const view = VIEW_TESTS[req.query.view] ? req.query.view : 'all';
    const q = String(req.query.search || '').trim().toLowerCase();
    const filtered = complaints.filter((c) => {
      if (!VIEW_TESTS[view](c)) return false;
      if (req.query.category && req.query.category !== 'All' && c.category !== req.query.category) return false;
      if (q && ![c.title, c.description, c.student?.name, c.student?.room_no, c.student?.roll_no].some((v) => v && String(v).toLowerCase().includes(q))) return false;
      return true;
    });
    res.json({ ...pageResponse(filtered.slice(paging.from, paging.to + 1), filtered.length, paging), counts });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update complaint status/remarks
// @route   PUT /api/complaints/:id
// @access  Private (admin, warden — warden only for assigned students)
const updateComplaint = async (req, res) => {
  try {
    const { status, admin_remarks } = req.body;
    if (status !== undefined && !STAFF_STATUSES.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${STAFF_STATUSES.join(', ')}` });
    }

    const found = await loadForUser(req, req.params.id);
    if (found.message) return res.status(found.status).json({ message: found.message });
    const existing = found.complaint;
    if (existing.status === 'Cancelled') return res.status(400).json({ message: 'The student cancelled this complaint.' });

    const now = new Date().toISOString();
    const updates = { updated_at: now };
    if (status !== undefined) updates.status = status;
    if (admin_remarks !== undefined) updates.admin_remarks = admin_remarks;

    if (await isEscalationReady()) {
      const nextStatus = status ?? existing.status;
      const isResponse = nextStatus !== 'Pending' || (admin_remarks && admin_remarks.trim());
      if (!existing.first_response_at && isResponse) {
        updates.first_response_at = now;
        updates.responded_by = req.user._id;
      }
      if (nextStatus === 'Resolved' && existing.status !== 'Resolved') {
        updates.resolved_at = now;
        updates.resolved_by = req.user._id;
      } else if (nextStatus !== 'Resolved' && existing.resolved_at) {
        updates.resolved_at = null;
        updates.resolved_by = null;
      }
    }

    const { data: updated, error } = await supabase
      .from('complaints')
      .update(updates)
      .eq('_id', req.params.id)
      .select(FULL_SELECT)
      .single();

    if (error) throw error;
    if (!updated) return res.status(404).json({ message: 'Complaint not found' });

    const statusChanged = status !== undefined && status !== existing.status;
    const remarksChanged = admin_remarks !== undefined && (admin_remarks || '') !== (existing.admin_remarks || '');
    if (statusChanged || remarksChanged) {
      const by = req.user.role === 'admin' ? 'Admin' : 'Warden';
      notifyUsers([existing.student_id], {
        type: 'COMPLAINT_UPDATED',
        title: statusChanged ? `Complaint ${updated.status.toLowerCase()}` : 'New remark on your complaint',
        message: `${by} updated "${labelOf(existing)}"${admin_remarks ? `: ${admin_remarks}` : '.'}${updated.status === 'Resolved' ? ' Please rate the fix.' : ''}`,
        link: '/complaints',
        complaint_id: existing._id,
      });
    }

    res.json(withEscalationInfo(updated));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Assign (or unassign) a maintenance staff member to a complaint.
//          Counts as a response, and moves a Pending complaint to In Progress.
// @route   PUT /api/complaints/:id/assign   body: { staff_id | null }
// @access  Private (admin, warden — warden only for assigned students)
const assignStaff = async (req, res) => {
  try {
    const found = await loadForUser(req, req.params.id);
    if (found.message) return res.status(found.status).json({ message: found.message });
    const existing = found.complaint;
    if (['Resolved', 'Cancelled'].includes(existing.status)) {
      return res.status(400).json({ message: `This complaint is ${existing.status.toLowerCase()}.` });
    }

    const { staff_id } = req.body;
    let staff = null;
    if (staff_id) {
      const { data } = await supabase.from('maintenance_staff').select('*').eq('_id', staff_id).maybeSingle();
      if (!data || !data.is_active) return res.status(400).json({ message: 'Choose an active staff member.' });
      staff = data;
    }

    const now = new Date().toISOString();
    const updates = { assigned_staff_id: staff?._id || null, assigned_at: staff ? now : null, updated_at: now };
    if (staff) {
      if (existing.status === 'Pending') updates.status = 'In Progress';
      if (!existing.first_response_at) {
        updates.first_response_at = now;
        updates.responded_by = req.user._id;
      }
    }

    const { data: updated, error } = await supabase.from('complaints').update(updates).eq('_id', existing._id).select(FULL_SELECT).single();
    if (error) throw error;

    if (staff) {
      notifyUsers([existing.student_id], {
        type: 'COMPLAINT_UPDATED',
        title: 'Complaint assigned',
        message: `"${labelOf(existing)}" was assigned to ${staff.name} (${staff.trade}).`,
        link: '/complaints',
        complaint_id: existing._id,
      });
    }
    res.json(withEscalationInfo(updated));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Student cancels their own open complaint
// @route   PUT /api/complaints/:id/cancel   body: { reason? }
// @access  Private (student, own)
const cancelComplaint = async (req, res) => {
  try {
    const found = await loadForUser(req, req.params.id);
    if (found.message) return res.status(found.status).json({ message: found.message });
    const c = found.complaint;
    if (!['Pending', 'In Progress'].includes(c.status)) {
      return res.status(400).json({ message: `Only open complaints can be cancelled (this one is ${c.status}).` });
    }
    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('complaints')
      .update({ status: 'Cancelled', cancelled_at: now, cancel_reason: String(req.body.reason || '').trim() || null, updated_at: now })
      .eq('_id', c._id)
      .in('status', ['Pending', 'In Progress'])
      .select(FULL_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!updated) return res.status(409).json({ message: 'This complaint just changed. Refresh and try again.' });

    if (c.student?.assigned_warden) {
      notifyUsers([c.student.assigned_warden], {
        type: 'COMPLAINT_UPDATED',
        title: 'Complaint cancelled',
        message: `${c.student.name} cancelled "${labelOf(c)}".`,
        link: '/warden/complaints',
        complaint_id: c._id,
      });
    }
    res.json(withEscalationInfo(updated));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Student reopens a resolved complaint that isn't actually fixed.
//          Restarts the 24h response clock and clears escalation.
// @route   PUT /api/complaints/:id/reopen   body: { reason }
// @access  Private (student, own)
const reopenComplaint = async (req, res) => {
  try {
    const found = await loadForUser(req, req.params.id);
    if (found.message) return res.status(found.status).json({ message: found.message });
    const c = found.complaint;
    if (c.status !== 'Resolved') return res.status(400).json({ message: 'Only resolved complaints can be reopened.' });
    if ((c.reopened_count || 0) >= MAX_REOPENS) {
      return res.status(400).json({ message: `This complaint was already reopened ${MAX_REOPENS} times. Please file a new one.` });
    }
    const resolvedAt = new Date(c.resolved_at || c.updated_at).getTime();
    if (Date.now() - resolvedAt > REOPEN_WINDOW_DAYS * 86400000) {
      return res.status(400).json({ message: `Complaints can only be reopened within ${REOPEN_WINDOW_DAYS} days of being resolved.` });
    }

    const reason = String(req.body.reason || '').trim();
    const now = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('complaints')
      .update({
        status: 'Pending',
        reopened_at: now,
        reopened_count: (c.reopened_count || 0) + 1,
        first_response_at: null,
        responded_by: null,
        escalated: false,
        escalated_at: null,
        resolved_at: null,
        resolved_by: null,
        admin_reminded_at: null,
        admin_reminder_count: 0,
        rating: null,
        feedback: null,
        rated_at: null,
        description: `${c.description}\n\n[Reopened ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}] ${reason}`,
        updated_at: now,
      })
      .eq('_id', c._id)
      .eq('status', 'Resolved')
      .select(FULL_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!updated) return res.status(409).json({ message: 'This complaint just changed. Refresh and try again.' });

    if (c.student?.assigned_warden) {
      notifyUsers([c.student.assigned_warden], {
        type: 'COMPLAINT_NEW',
        title: 'Complaint reopened',
        message: `${c.student.name} says "${labelOf(c)}" isn't fixed: ${reason}. Respond within ${ESCALATION_HOURS}h.`,
        link: '/warden/complaints',
        complaint_id: c._id,
      });
    } else {
      notifyRole('admin', {
        type: 'COMPLAINT_NEW',
        title: 'Complaint reopened',
        message: `${c.student?.name || 'A student'} reopened "${labelOf(c)}": ${reason}`,
        link: '/admin/complaints',
        complaint_id: c._id,
      });
    }
    res.json(withEscalationInfo(updated));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Student rates how well a resolved complaint was fixed (once)
// @route   PUT /api/complaints/:id/rate   body: { rating 1-5, feedback? }
// @access  Private (student, own)
const rateComplaint = async (req, res) => {
  try {
    const found = await loadForUser(req, req.params.id);
    if (found.message) return res.status(found.status).json({ message: found.message });
    const c = found.complaint;
    if (c.status !== 'Resolved') return res.status(400).json({ message: 'You can rate a complaint once it is resolved.' });
    if (c.rating) return res.status(400).json({ message: 'You already rated this complaint.' });

    const { data: updated, error } = await supabase
      .from('complaints')
      .update({ rating: Number(req.body.rating), feedback: String(req.body.feedback || '').trim() || null, rated_at: new Date().toISOString() })
      .eq('_id', c._id)
      .is('rating', null)
      .select(FULL_SELECT)
      .maybeSingle();
    if (error) throw error;
    if (!updated) return res.status(409).json({ message: 'Already rated.' });
    res.json(withEscalationInfo(updated));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createComplaint, getComplaints, updateComplaint, assignStaff, cancelComplaint, reopenComplaint, rateComplaint };
