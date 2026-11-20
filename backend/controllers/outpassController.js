const supabase = require('../supabase');
const { toISTDateString, todayIST, parseHostelDateTime, toISTTimestamp } = require('../utils/istDate');
const { CURRENT_DAY_ONLY, WARDEN_TODAY_ONLY } = require('../utils/wardenRules');
const { generateQrToken, gateCodeFor, normalizeGateCode, GATE_CODE_RE } = require('../utils/qrToken');
const tokenLimiter = require('../utils/gateTokenLimiter');
const { OVERDUE_GRACE_MINUTES, EARLY_EXIT_MINUTES } = require('../utils/outpassConfig');
const { hasPassType, fetchAll } = require('../utils/schema');
const { markAbsentIfUnmarked } = require('../utils/attendanceAuto');
const { parsePage, pageResponse } = require('../utils/paginate');

const PASS_TYPES = ['Outing', 'Home'];

const STUDENT_JOIN = '*, student:users!student_id(_id, name, email, roll_no, room_no, assigned_warden)';

const getStudentJoin = (role, userId) => {
  if (role === 'warden') {
    return '*, student:users!inner(_id, name, email, roll_no, room_no, assigned_warden)';
  }
  return STUDENT_JOIN;
};

const applyWardenFilter = (query, req) => {
  if (req.user.role === 'warden') {
    return query.eq('student.assigned_warden', req.user._id);
  }
  return query;
};

const graceMs = () => OVERDUE_GRACE_MINUTES * 60 * 1000;

const isOverdue = (outpass) => {
  if (outpass.status !== 'Checked Out') return false;
  const deadline = new Date(outpass.return_datetime).getTime() + graceMs();
  return Date.now() > deadline;
};

const minutesSince = (isoString) => {
  if (!isoString) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(isoString).getTime()) / 60000));
};

// Admin and Wardens can only approve a pass for the current IST day (leave date cannot be in the past or different from today).
const cannotApprovePass = (req, outpass) => {
  if (req.user.role === 'admin' || req.user.role === 'warden') {
    return toISTDateString(outpass.leave_datetime) !== todayIST();
  }
  return false;
};

// Records every scan attempt (successful or not) for audit purposes.
// Best-effort: a logging failure never blocks the scan response.
const logScan = async ({ outpass_id, student_id, security_guard_id, action, result, failure_reason, method = 'QR', note = null }) => {
  try {
    await supabase.from('outpass_scan_logs').insert({
      outpass_id: outpass_id || null,
      student_id: student_id || null,
      security_guard_id: security_guard_id || null,
      action: action || null,
      result,
      failure_reason: failure_reason || null,
      method,
      note,
    });
  } catch (e) {
    console.error('Failed to write scan log:', e.message);
  }
};

// @desc    Submit an outpass request (student), or issue one directly (admin)
// @route   POST /api/outpasses
// @access  Private
const createOutpass = async (req, res) => {
  try {
    const { reason, leave_datetime, return_datetime, destination, parent_consent, student_id, pass_type } = req.body;
    const isIssuer = (req.user.role === 'admin' || req.user.role === 'warden') && student_id;
    const targetStudentId = isIssuer ? student_id : req.user._id;
    // Outpasses are always for a student: staff must say which one.
    if (!isIssuer && req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can request an outpass for themselves. Choose a student to issue one.' });
    }

    if (!reason || !leave_datetime || !return_datetime || !destination) {
      return res.status(400).json({ message: 'Reason, destination, leave and return date/time are required.' });
    }
    if (pass_type !== undefined && !PASS_TYPES.includes(pass_type)) {
      return res.status(400).json({ message: 'Outpass type must be Outing or Home.' });
    }
    // Form times have no zone; they are hostel (India) time — see parseHostelDateTime.
    const leaveAt = parseHostelDateTime(leave_datetime);
    const returnAt = parseHostelDateTime(return_datetime);
    if (!leaveAt || !returnAt) {
      return res.status(400).json({ message: 'Leave and return date/time must be valid dates.' });
    }
    if (returnAt <= leaveAt) {
      return res.status(400).json({ message: 'Return time must be after the leave time.' });
    }

    if (req.user.role === 'warden' && isIssuer) {
      const { data: student } = await supabase.from('users').select('assigned_warden').eq('_id', targetStudentId).single();
      if (!student || student.assigned_warden !== req.user._id) return res.status(403).json({ message: 'Not authorized for this student' });
    }
    if (isIssuer && toISTDateString(leaveAt) !== todayIST()) {
      return res.status(403).json({ message: CURRENT_DAY_ONLY });
    }
    // A student's own request: must still be usable, and must not overlap a
    // pass they already have open (waiting, approved or currently outside).
    if (!isIssuer) {
      if (returnAt.getTime() <= Date.now()) {
        return res.status(400).json({ message: 'Return time must be in the future.' });
      }
      const { data: clash, error: clashErr } = await supabase
        .from('outpasses')
        .select('_id, status')
        .eq('student_id', targetStudentId)
        .in('status', ['Pending', 'Approved', 'Checked Out'])
        .lt('leave_datetime', returnAt.toISOString())
        .gt('return_datetime', leaveAt.toISOString())
        .limit(1);
      if (clashErr) throw clashErr;
      if (clash?.length) {
        return res.status(409).json({ message: `You already have a ${clash[0].status.toLowerCase()} outpass for this time. Use that one, or pick a different time.` });
      }
    }

    const insertData = {
      student_id: targetStudentId,
      reason,
      leave_datetime: leaveAt.toISOString(),
      return_datetime: returnAt.toISOString(),
      destination,
      parent_consent,
      // A student's own request always starts Pending and waits for warden
      // review; an admin issuing one on a student's behalf is auto-approved,
      // same as before, but now also gets a QR token like any other approval.
      status: isIssuer ? 'Approved' : 'Pending',
    };
    // Home visit vs local outing decides Gone Home / Outside Hostel on exit.
    if (await hasPassType()) insertData.pass_type = pass_type || 'Outing';
    if (isIssuer) {
      insertData.qr_token = generateQrToken();
      insertData.approved_by = req.user._id;
      insertData.approved_at = new Date().toISOString();
      insertData.issued_at = insertData.approved_at;
    }

    const { data: outpass, error } = await supabase
      .from('outpasses')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    // If admin issues outpass, auto-mark student as Absent in attendance
    // for the day the leave actually starts (not necessarily today).
    // (System mark: never overrides attendance a warden/admin set by hand,
    // which is final under the attendance lock rules.)
    if (isIssuer) {
      await markAbsentIfUnmarked([targetStudentId], toISTDateString(leaveAt));
    }

    res.status(201).json(outpass);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get outpasses (student gets own, admin/warden get all)
// @route   GET /api/outpasses
// @access  Private
const getOutpasses = async (req, res) => {
  try {
    let query;
    const paging = parsePage(req);
    if (req.user.role === 'admin' || req.user.role === 'warden') {
      query = applyWardenFilter(
        supabase.from('outpasses').select(getStudentJoin(req.user.role, req.user._id), paging ? { count: 'exact' } : undefined),
        req
      ).order('created_at', { ascending: false });
      if (req.query.status && req.query.status !== 'All') query = query.eq('status', req.query.status);
      if (paging) {
        const { data, error, count } = await query.range(paging.from, paging.to);
        if (error) throw error;
        return res.json(pageResponse(data || [], count || 0, paging));
      }
    } else {
      query = supabase
        .from('outpasses')
        .select('*')
        .eq('student_id', req.user._id)
        .order('created_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get the logged-in student's own outpasses
// @route   GET /api/outpasses/my
// @access  Private (student)
const getMyOutpasses = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('outpasses')
      .select('*')
      .eq('student_id', req.user._id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get pending outpass requests awaiting warden review
// @route   GET /api/outpasses/pending
// @access  Private (admin, warden)
const getPendingOutpasses = async (req, res) => {
  try {
    let query = supabase
      .from('outpasses')
      .select(getStudentJoin(req.user.role, req.user._id))
      .eq('status', 'Pending')
      .order('created_at', { ascending: true });
      
    const { data, error } = await applyWardenFilter(query, req);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Approve an outpass request — generates its QR token
// @route   PUT /api/outpasses/:id/approve
// @access  Private (admin, warden)
const approveOutpass = async (req, res) => {
  try {
    const { data: current, error: findErr } = await supabase
      .from('outpasses')
      .select('*, student:users!inner(assigned_warden)')
      .eq('_id', req.params.id)
      .single();
    if (findErr || !current) return res.status(404).json({ message: 'Outpass not found' });
    if (req.user.role === 'warden' && current.student.assigned_warden !== req.user._id) {
       return res.status(403).json({ message: 'Not authorized for this student.' });
    }
    if (cannotApprovePass(req, current)) return res.status(403).json({ message: CURRENT_DAY_ONLY });
    if (current.status !== 'Pending') {
      return res.status(400).json({ message: `Only pending outpasses can be approved (current status: ${current.status}).` });
    }

    const approvedAt = new Date().toISOString();
    const { data: updated, error } = await supabase
      .from('outpasses')
      .update({
        status: 'Approved',
        approved_by: req.user._id,
        approved_at: approvedAt,
        issued_at: approvedAt,
        qr_token: generateQrToken(),
        rejected_by: null,
        rejected_at: null,
        rejection_reason: null,
      })
      .eq('_id', req.params.id)
      .eq('status', 'Pending') // guard against a race with another approval/rejection
      .select()
      .single();

    if (error || !updated) {
      return res.status(409).json({ message: 'This outpass was already actioned by someone else.' });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reject an outpass request (reason required)
// @route   PUT /api/outpasses/:id/reject
// @access  Private (admin, warden)
const rejectOutpass = async (req, res) => {
  try {
    const { rejection_reason } = req.body;
    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({ message: 'A rejection reason is required.' });
    }

    const { data: current, error: findErr } = await supabase
      .from('outpasses')
      .select('*, student:users!inner(assigned_warden)')
      .eq('_id', req.params.id)
      .single();
    if (findErr || !current) return res.status(404).json({ message: 'Outpass not found' });
    if (req.user.role === 'warden' && current.student.assigned_warden !== req.user._id) {
       return res.status(403).json({ message: 'Not authorized for this student.' });
    }
    if (current.status !== 'Pending') {
      return res.status(400).json({ message: `Only pending outpasses can be rejected (current status: ${current.status}).` });
    }

    const { data: updated, error } = await supabase
      .from('outpasses')
      .update({
        status: 'Rejected',
        rejected_by: req.user._id,
        rejected_at: new Date().toISOString(),
        rejection_reason: rejection_reason.trim(),
      })
      .eq('_id', req.params.id)
      .eq('status', 'Pending')
      .select()
      .single();

    if (error || !updated) {
      return res.status(409).json({ message: 'This outpass was already actioned by someone else.' });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Legacy status/remarks update — kept for the existing admin
//          outpass screen. Only allows the Pending -> Approved/Rejected
//          transition (routed through the same guarded path as the
//          dedicated endpoints above); once Checked Out/Returned it only
//          accepts remarks.
// @route   PUT /api/outpasses/:id
// @access  Private (admin, warden)
const updateOutpass = async (req, res) => {
  try {
    const { status, admin_remarks } = req.body;

    const { data: current, error: findErr } = await supabase
      .from('outpasses')
      .select('*, student:users!inner(assigned_warden)')
      .eq('_id', req.params.id)
      .single();
    if (findErr || !current) return res.status(404).json({ message: 'Outpass not found' });
    if (req.user.role === 'warden' && current.student.assigned_warden !== req.user._id) {
       return res.status(403).json({ message: 'Not authorized for this student.' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (admin_remarks !== undefined) updates.admin_remarks = admin_remarks;

    if (status && status !== current.status) {
      if (current.status !== 'Pending') {
        return res.status(400).json({ message: `Cannot change the status of a ${current.status} outpass here.` });
      }
      if (status === 'Approved') {
        if (cannotApprovePass(req, current)) return res.status(403).json({ message: CURRENT_DAY_ONLY });
        updates.status = 'Approved';
        updates.approved_by = req.user._id;
        updates.approved_at = updates.updated_at;
        updates.issued_at = updates.updated_at;
        updates.qr_token = generateQrToken();
      } else if (status === 'Rejected') {
        updates.status = 'Rejected';
        updates.rejected_by = req.user._id;
        updates.rejected_at = new Date().toISOString();
        updates.rejection_reason = admin_remarks || 'Rejected by admin.';
      } else {
        return res.status(400).json({ message: `Invalid status: ${status}` });
      }
    }

    const { data: updated, error } = await supabase
      .from('outpasses')
      .update(updates)
      .eq('_id', req.params.id)
      .eq('status', current.status)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!updated) return res.status(409).json({ message: 'This outpass changed while you were editing it. Refresh and try again.' });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get the QR payload for the logged-in student's own approved outpass
// @route   GET /api/outpasses/:id/qr
// @access  Private (student)
const getOutpassQr = async (req, res) => {
  try {
    const { data: outpass, error } = await supabase
      .from('outpasses')
      .select('*')
      .eq('_id', req.params.id)
      .single();

    if (error || !outpass) return res.status(404).json({ message: 'Outpass not found' });
    if (outpass.student_id !== req.user._id) {
      return res.status(403).json({ message: 'Not authorized to view this outpass.' });
    }
    if (!['Approved', 'Checked Out'].includes(outpass.status)) {
      return res.status(400).json({ message: `QR code is not available for a ${outpass.status} outpass.` });
    }

    res.json({
      outpass_id: outpass._id,
      qr_token: outpass.qr_token,
      gate_code: gateCodeFor(outpass.qr_token),
      student_name: req.user.name,
      student_roll_no: req.user.roll_no,
      room_no: req.user.room_no,
      destination: outpass.destination,
      purpose: outpass.reason,
      leave_datetime: outpass.leave_datetime,
      return_datetime: outpass.return_datetime,
      status: outpass.status,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Decides what a gate event would do to this outpass right now.
// Returns { action } when allowed, or { message, action } when not.
const gateDecision = (outpass) => {
  if (outpass.status === 'Pending') return { message: 'Invalid Outpass: This request has not been approved.' };
  if (outpass.status === 'Rejected') return { message: 'Invalid Outpass: This outpass was rejected.' };
  if (outpass.status === 'Returned') return { message: 'Invalid Outpass: Student has already returned.', action: 'RETURN' };
  if (!['Approved', 'Checked Out'].includes(outpass.status)) {
    return { message: `Invalid Outpass: unexpected status (${outpass.status}).` };
  }
  if (outpass.status === 'Approved') {
    const deadline = new Date(outpass.return_datetime).getTime() + graceMs();
    if (Date.now() > deadline) return { message: 'Invalid Outpass: QR code has expired.', action: 'EXIT' };
    const opensAt = new Date(outpass.leave_datetime).getTime() - EARLY_EXIT_MINUTES * 60 * 1000;
    if (Date.now() < opensAt) {
      return { message: `Invalid Outpass: This outpass starts at ${toISTTimestamp(outpass.leave_datetime).slice(0, 16)} IST. Exit is allowed from ${EARLY_EXIT_MINUTES} minutes before that.`, action: 'EXIT' };
    }
    return { action: 'EXIT' };
  }
  // RETURN is always accepted regardless of how late, so the student is
  // recorded back on campus; lateness is surfaced via the overdue alerts.
  return { action: 'RETURN' };
};

// The full gate check, shared by QR scans, manual entries and typed tokens:
// the outpass's own rules (gateDecision) plus the student's live status — a
// student who is already outside on another outpass can't exit again.
const decideAtGate = async (outpass) => {
  const decision = gateDecision(outpass);
  if (decision.message || decision.action !== 'EXIT') return decision;
  const { data: outside, error } = await supabase
    .from('outpasses')
    .select('_id')
    .eq('student_id', outpass.student_id)
    .eq('status', 'Checked Out')
    .neq('_id', outpass._id)
    .limit(1);
  if (error) throw error;
  if (outside?.length) {
    return { message: 'Invalid Outpass: This student is already outside on another outpass. Record their return first.', action: 'EXIT' };
  }
  return decision;
};

// Applies an EXIT or RETURN (shared by QR scans and manual gate entries):
// guarded state transition, attendance side effects and audit log.
// logMethod: how the scan log names the entry when it differs from the
// outpass's exit/return method (a typed token is stored as MANUAL, logged as TOKEN).
const applyGateAction = async (outpass, action, guardId, { method = 'QR', reason = null, logMethod = method } = {}) => {
  const now = new Date().toISOString();
  const isExit = action === 'EXIT';
  const updates = isExit
    ? { status: 'Checked Out', actual_exit_time: now, exit_scanned_by: guardId, exit_scan_timestamp: now, exit_method: method }
    : { status: 'Returned', actual_return_time: now, return_scanned_by: guardId, return_scan_timestamp: now, return_method: method };
  if (method === 'MANUAL') {
    updates.manual_reason = [outpass.manual_reason, `${action}: ${reason}`].filter(Boolean).join(' | ');
  }

  const { data: updated, error } = await supabase
    .from('outpasses')
    .update(updates)
    .eq('_id', outpass._id)
    .eq('status', isExit ? 'Approved' : 'Checked Out') // race guard
    .select(STUDENT_JOIN)
    .single();
  if (error || !updated) return { ok: false, message: 'Invalid Outpass: This scan was already processed.' };

  try {
    if (isExit && updated.pass_type === 'Home') {
      // Going home = absent today (never overrides a hand-marked status).
      await markAbsentIfUnmarked([outpass.student_id]);
    } else if (!isExit) {
      // Back on campus: today's roll call goes back to "not marked" so the
      // warden marks Present after seeing the student.
      const today = todayIST();
      const values = { status: 'Pending', auto_marked: true, marked_by: 'system', updated_at: now };
      const { data: existing } = await supabase
        .from('attendances')
        .select('_id')
        .eq('student_id', outpass.student_id)
        .eq('date', today)
        .maybeSingle();
      if (existing) await supabase.from('attendances').update(values).eq('_id', existing._id);
      else await supabase.from('attendances').insert({ ...values, date: today, student_id: outpass.student_id });
    }
  } catch (attErr) {
    console.error('Attendance side effect failed after gate action:', attErr.message);
  }

  await logScan({
    outpass_id: outpass._id,
    student_id: outpass.student_id,
    security_guard_id: guardId,
    action,
    result: 'SUCCESS',
    method: logMethod,
    note: reason,
  });
  return { ok: true, outpass: updated };
};

// Preview and commit share the same authoritative gate checks. Committing
// requires the previewed action, so retrying an EXIT cannot become a RETURN.
const processQr = async (req, res, preview = false) => {
  const guardId = req.user._id;
  try {
    if (!preview && !['EXIT', 'RETURN'].includes(req.body.action)) {
      return res.status(400).json({ valid: false, message: 'Verify the QR first and provide action EXIT or RETURN.' });
    }
    const qrToken = (req.body.qr_token || '').trim();
    if (!qrToken) {
      return res.status(400).json({ valid: false, message: 'No QR token provided.' });
    }

    const { data: outpass, error } = await supabase
      .from('outpasses')
      .select(STUDENT_JOIN)
      .eq('qr_token', qrToken)
      .single();

    if (error || !outpass) {
      await logScan({ security_guard_id: guardId, result: 'FAILED', failure_reason: 'QR token not recognized' });
      return res.status(404).json({ valid: false, message: 'Invalid Outpass: Unrecognized QR code.' });
    }

    const fail = async (message, action = null) => {
      await logScan({ outpass_id: outpass._id, student_id: outpass.student_id, security_guard_id: guardId, action, result: 'FAILED', failure_reason: message });
      return res.status(409).json({ valid: false, message });
    };

    const decision = await decideAtGate(outpass);
    if (decision.message) return fail(decision.message, decision.action || null);
    if (preview) return res.json({ valid: true, action: decision.action });
    if (req.body.action !== decision.action) {
      return fail('This outpass changed after verification. Scan it again.', req.body.action);
    }

    const result = await applyGateAction(outpass, decision.action, guardId);
    if (!result.ok) return fail(result.message, decision.action);
    return res.json({
      valid: true,
      action: decision.action,
      message: decision.action === 'EXIT' ? 'Exit approved.' : 'Return accepted.',
      outpass: result.outpass,
    });
  } catch (error) {
    res.status(500).json({ valid: false, message: error.message });
  }
};

// POST /api/outpasses/scan/verify only reads; /scan commits the selected action.
const verifyQr = (req, res) => processQr(req, res, true);
const scanQr = (req, res) => processQr(req, res);

// ---------------------------------------------------------------------------
// Manual / Type Token: the guard types the 8-character token shown under the
// student's QR. Same rules, same state change and same audit log as a scan.
// ---------------------------------------------------------------------------
const TOKEN_NOTE = '8-character token typed at the gate';

// Finds the active outpass a typed token belongs to (null when there is none).
const findByGateCode = async (code) => {
  const active = await fetchAll(() =>
    supabase.from('outpasses').select('_id, qr_token').in('status', ['Approved', 'Checked Out']).not('qr_token', 'is', null).order('_id')
  );
  const matches = active.filter((o) => gateCodeFor(o.qr_token) === code);
  if (matches.length !== 1) return null; // unknown (or, practically never, ambiguous)
  const { data } = await supabase.from('outpasses').select(STUDENT_JOIN).eq('_id', matches[0]._id).maybeSingle();
  return data || null;
};

// Only what the guard needs to recognise the student and the pass.
const gateDetails = async (outpass) => {
  const [{ data: student }, { data: outside }] = await Promise.all([
    supabase.from('users').select('hostel_block, hostel:hostels(name)').eq('_id', outpass.student_id).maybeSingle(),
    supabase.from('outpasses').select('_id, pass_type').eq('student_id', outpass.student_id).eq('status', 'Checked Out').limit(1),
  ]);
  const out = outside?.[0];
  return {
    student_name: outpass.student?.name || null,
    register_no: outpass.student?.roll_no || null,
    hostel_block: student?.hostel?.name || student?.hostel_block || null,
    room_no: outpass.student?.room_no || null,
    destination: outpass.destination,
    purpose: outpass.reason,
    pass_type: outpass.pass_type || 'Outing',
    leave_datetime: outpass.leave_datetime,
    expected_return: outpass.return_datetime,
    current_status: out ? (out.pass_type === 'Home' ? 'Gone Home' : 'Outside Hostel') : 'Inside Hostel',
  };
};

// Shared first half of verify/confirm: rate limit, format, lookup, gate rules.
// Returns { outpass, decision, code } or sends the failure response and returns null.
const resolveGateToken = async (req, res) => {
  const guardId = req.user._id;
  const wait = tokenLimiter.blockedFor(guardId);
  if (wait) {
    res.status(429).json({ valid: false, message: tokenLimiter.tooManyMessage(wait) });
    return null;
  }
  const code = normalizeGateCode(req.body.token);
  if (!GATE_CODE_RE.test(code)) {
    res.status(400).json({ valid: false, message: 'Enter the 8-character token (letters A–Z and numbers 0–9 only).' });
    return null;
  }

  const outpass = await findByGateCode(code);
  if (!outpass) {
    tokenLimiter.recordWrong(guardId);
    await logScan({ security_guard_id: guardId, result: 'FAILED', failure_reason: 'Token not recognized', method: 'TOKEN', note: TOKEN_NOTE });
    const left = tokenLimiter.blockedFor(guardId);
    res.status(left ? 429 : 404).json({
      valid: false,
      message: left ? tokenLimiter.tooManyMessage(left) : 'Invalid Outpass: This token is not recognized, or its outpass is no longer active.',
    });
    return null;
  }

  const decision = await decideAtGate(outpass);
  if (decision.message) {
    await logScan({ outpass_id: outpass._id, student_id: outpass.student_id, security_guard_id: guardId, action: decision.action || null, result: 'FAILED', failure_reason: decision.message, method: 'TOKEN', note: TOKEN_NOTE });
    res.status(409).json({ valid: false, message: decision.message, details: await gateDetails(outpass) });
    return null;
  }
  return { outpass, decision, code };
};

// @desc    Step 1 — check a typed token and show who it belongs to and what
//          it would do (EXIT or RETURN). Changes nothing.
// @route   POST /api/outpasses/token/verify   body: { token }
// @access  Private (security, admin)
const verifyGateToken = async (req, res) => {
  try {
    const found = await resolveGateToken(req, res);
    if (!found) return;
    res.json({
      valid: true,
      token: found.code,
      action: found.decision.action,
      message: found.decision.action === 'EXIT' ? 'Approved outpass — student may exit.' : 'Student is outside on this outpass — record the return.',
      details: await gateDetails(found.outpass),
    });
  } catch (error) {
    res.status(500).json({ valid: false, message: error.message });
  }
};

// @desc    Step 2 — the guard approves the EXIT or RETURN shown in step 1.
//          Everything is re-checked here; the action must still be the one
//          the guard saw, and a second approval of the same step is refused.
// @route   POST /api/outpasses/token/confirm   body: { token, action }
// @access  Private (security, admin)
const confirmGateToken = async (req, res) => {
  try {
    const { action } = req.body;
    if (!['EXIT', 'RETURN'].includes(action)) return res.status(400).json({ valid: false, message: 'Action must be EXIT or RETURN.' });
    const found = await resolveGateToken(req, res);
    if (!found) return;
    const { outpass, decision } = found;

    const fail = async (message) => {
      await logScan({ outpass_id: outpass._id, student_id: outpass.student_id, security_guard_id: req.user._id, action, result: 'FAILED', failure_reason: message, method: 'TOKEN', note: TOKEN_NOTE });
      return res.status(409).json({ valid: false, message });
    };
    if (decision.action !== action) return fail(`This outpass now needs a ${decision.action} entry, not ${action}. Verify the token again.`);

    const result = await applyGateAction(outpass, action, req.user._id, { method: 'MANUAL', reason: TOKEN_NOTE, logMethod: 'TOKEN' });
    if (!result.ok) return fail(result.message);
    res.json({
      valid: true,
      action,
      message: action === 'EXIT' ? 'Exit approved.' : 'Return accepted.',
      outpass: result.outpass,
      details: await gateDetails(result.outpass),
    });
  } catch (error) {
    res.status(500).json({ valid: false, message: error.message });
  }
};

// @desc    Find a student at the gate without their QR (dead phone, etc.).
//          Returns matching students with the outpass the gate can act on.
// @route   GET /api/outpasses/gate-lookup?q=<roll no or name>
// @access  Private (security, admin, warden)
const gateLookup = async (req, res) => {
  try {
    const q = String(req.query.q || '').replace(/[,()*%\\:"']/g, ' ').trim().slice(0, 40);
    if (q.length < 2) return res.status(400).json({ message: 'Type at least 2 characters of the roll number or name.' });

    let studentsQuery = supabase
      .from('users')
      .select('_id, name, roll_no, room_no, profile_photo, phone, assigned_warden')
      .eq('role', 'student')
      .eq('is_active', true)
      .or(`roll_no.ilike.%${q}%,name.ilike.%${q}%`)
      .limit(10);
    if (req.user.role === 'warden') studentsQuery = studentsQuery.eq('assigned_warden', req.user._id);
    const { data: students, error } = await studentsQuery;
    if (error) throw error;
    if (!students?.length) return res.json([]);

    const { data: outpasses, error: opErr } = await supabase
      .from('outpasses')
      .select('_id, student_id, status, reason, destination, pass_type, leave_datetime, return_datetime, actual_exit_time, approved_at')
      .in('student_id', students.map((st) => st._id))
      .in('status', ['Approved', 'Checked Out'])
      .order('created_at', { ascending: false });
    if (opErr) throw opErr;

    res.json(students.map((st) => {
      const mine = (outpasses || []).filter((o) => o.student_id === st._id);
      // Someone outside can only come back; otherwise the newest usable pass.
      const outpass = mine.find((o) => o.status === 'Checked Out') || mine.find((o) => !gateDecision(o).message) || null;
      return { student: st, outpass, action: outpass ? gateDecision(outpass).action : null };
    }));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Record an exit or return without a QR scan. Requires a reason,
//          applies exactly the same rules as a scan and is audit-logged
//          as MANUAL.
// @route   POST /api/outpasses/:id/manual
// @access  Private (security, admin)
const manualGateEntry = async (req, res) => {
  try {
    const { action } = req.body;
    const reason = String(req.body.reason || '').trim();

    const { data: outpass, error } = await supabase
      .from('outpasses')
      .select(STUDENT_JOIN)
      .eq('_id', req.params.id)
      .single();
    if (error || !outpass) return res.status(404).json({ valid: false, message: 'Outpass not found.' });

    const decision = await decideAtGate(outpass);
    if (decision.message || decision.action !== action) {
      const message = decision.message || `This outpass needs a ${decision.action} entry, not ${action}.`;
      await logScan({ outpass_id: outpass._id, student_id: outpass.student_id, security_guard_id: req.user._id, action, result: 'FAILED', failure_reason: message, method: 'MANUAL', note: reason });
      return res.status(409).json({ valid: false, message });
    }

    const result = await applyGateAction(outpass, action, req.user._id, { method: 'MANUAL', reason });
    if (!result.ok) return res.status(409).json({ valid: false, message: result.message });
    res.json({
      valid: true,
      action,
      message: action === 'EXIT' ? 'Exit recorded manually.' : 'Return recorded manually.',
      outpass: result.outpass,
    });
  } catch (error) {
    res.status(500).json({ valid: false, message: error.message });
  }
};

// @desc    Students currently outside campus (status = Checked Out)
// @route   GET /api/security/currently-outside
// @access  Private (admin, warden, security)
const getCurrentlyOutside = async (req, res) => {
  try {
    let query = supabase
      .from('outpasses')
      .select(getStudentJoin(req.user.role, req.user._id))
      .eq('status', 'Checked Out')
      .order('actual_exit_time', { ascending: true });
      
    const { data, error } = await applyWardenFilter(query, req);
    if (error) throw error;

    const withDuration = (data || []).map((o) => ({
      ...o,
      duration_outside_minutes: minutesSince(o.actual_exit_time),
      is_overdue: isOverdue(o),
    }));
    res.json(withDuration);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Outpasses that are checked out and past their grace period
// @route   GET /api/outpasses/overdue
// @access  Private (admin, warden, security)
const getOverdueOutpasses = async (req, res) => {
  try {
    let query = supabase
      .from('outpasses')
      .select(getStudentJoin(req.user.role, req.user._id))
      .eq('status', 'Checked Out');
      
    const { data, error } = await applyWardenFilter(query, req);
    if (error) throw error;

    const overdue = (data || [])
      .filter(isOverdue)
      .map((o) => ({ ...o, duration_outside_minutes: minutesSince(o.actual_exit_time) }));
    res.json(overdue);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Security dashboard summary cards
// @route   GET /api/security/today
// @access  Private (admin, warden, security)
const getTodaySummary = async (req, res) => {
  try {
    // Counted by the database (not by loading rows), so the numbers stay
    // right however many outpasses exist.
    const dayStart = new Date(`${todayIST()}T00:00:00+05:30`);
    const from = dayStart.toISOString();
    const to = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const overdueBefore = new Date(Date.now() - graceMs()).toISOString();
    const count = (build) =>
      applyWardenFilter(
        build(supabase.from('outpasses').select(getStudentJoin(req.user.role, req.user._id), { count: 'exact', head: true })),
        req
      );

    const results = await Promise.all([
      count((q) => q.eq('status', 'Checked Out')),
      count((q) => q.gte('actual_exit_time', from).lt('actual_exit_time', to)),
      count((q) => q.gte('actual_return_time', from).lt('actual_return_time', to)),
      count((q) => q.eq('status', 'Checked Out').lt('return_datetime', overdueBefore)),
    ]);
    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;
    const [currentlyOutside, todaysExits, todaysReturns, overdue] = results.map((r) => r.count || 0);

    res.json({ currentlyOutside, todaysExits, todaysReturns, overdue });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Scan audit history
// @route   GET /api/security/scan-history
// @access  Private (admin, warden, security)
const getScanHistory = async (req, res) => {
  try {
    const paging = parsePage(req, 50);
    const countOpt = paging ? { count: 'exact' } : undefined;
    let query = supabase.from('outpass_scan_logs').select('*', countOpt).order('scan_time', { ascending: false });
    if (req.user.role === 'warden') {
      // Scan logs have no database link to users, so filter by the warden's
      // own students' ids instead of a join.
      const mine = await fetchAll(() => supabase.from('users').select('_id').eq('role', 'student').eq('assigned_warden', req.user._id));
      if (!mine.length) return res.json(paging ? pageResponse([], 0, paging) : []);
      query = query.in('student_id', mine.map((s) => s._id));
    }
    if (req.query.result === 'SUCCESS' || req.query.result === 'FAILED') query = query.eq('result', req.query.result);
    if (['QR', 'MANUAL', 'TOKEN'].includes(req.query.method)) query = query.eq('method', req.query.method);
    query = paging ? query.range(paging.from, paging.to) : query.limit(200);
    const { data: logs, error, count } = await query;
    if (error) throw error;

    const userIds = [...new Set((logs || []).flatMap((l) => [l.student_id, l.security_guard_id].filter(Boolean)))];
    let usersById = {};
    if (userIds.length) {
      const { data: users } = await supabase.from('users').select('_id, name, roll_no').in('_id', userIds);
      usersById = Object.fromEntries((users || []).map((u) => [u._id, u]));
    }

    const enriched = (logs || []).map((l) => ({
      ...l,
      student: l.student_id ? usersById[l.student_id] || null : null,
      security_guard: l.security_guard_id ? usersById[l.security_guard_id] || null : null,
    }));
    res.json(paging ? pageResponse(enriched, count || 0, paging) : enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  verifyGateToken,
  confirmGateToken,
  gateLookup,
  manualGateEntry,
  createOutpass,
  getOutpasses,
  getMyOutpasses,
  getPendingOutpasses,
  approveOutpass,
  rejectOutpass,
  updateOutpass,
  getOutpassQr,
  scanQr,
  verifyQr,
  getCurrentlyOutside,
  getOverdueOutpasses,
  getTodaySummary,
  getScanHistory,
};
