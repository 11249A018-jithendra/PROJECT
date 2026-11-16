const supabase = require('../supabase');

// Thin wrappers around the atomic Postgres functions in
// supabase/migrations/20261016000000_student_exit_workflow.sql.
// The whole exit (snapshot + deactivate + free room + close requests) runs in
// one database transaction, so a failure can never leave a student half-removed.

const ERRORS = {
  STUDENT_OUTSIDE: [409, 'This student is currently outside on an outpass. Record their return first, or confirm to proceed anyway.', { needs_confirmation: true }],
  REQUEST_NOT_PENDING: [409, 'This request has already been decided.'],
  REQUEST_NOT_FOUND: [404, 'Exit request not found.'],
  STUDENT_NOT_FOUND: [404, 'Student not found.'],
  STUDENT_NOT_ACTIVE: [409, 'This student has already left the hostel.'],
  STUDENT_NOT_ARCHIVED: [404, 'No past student with this id.'],
  ADMIN_NOT_FOUND: [403, 'Only an active admin can do this.'],
  REASON_REQUIRED: [400, 'An exit reason is required.'],
};

class ArchiveError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const translate = (error) => {
  const code = Object.keys(ERRORS).find((k) => (error.message || '').includes(k));
  if (!code) return error;
  const [status, message, extra] = ERRORS[code];
  return new ArchiveError(status, message, extra);
};

// Returns the new past_students row.
// Dangling past_students rows (student reactivated without readmit_student) are
// closed inside archive_student itself, after its checks pass — see
// 20261028000000_fix_past_students_rearchive.sql.
const archiveStudent = async ({ studentId = null, adminId, requestId = null, reason = null, exitDate = null, force = false }) => {
  const { data, error } = await supabase.rpc('archive_student', {
    p_student_id: studentId,
    p_admin_id: adminId,
    p_request_id: requestId,
    p_reason: reason,
    p_exit_date: exitDate,
    p_force: Boolean(force),
  });
  if (error) throw translate(error);
  return data;
};

const readmitStudent = async ({ studentId, adminId }) => {
  const { data, error } = await supabase.rpc('readmit_student', { p_student_id: studentId, p_admin_id: adminId });
  if (error) throw translate(error);
  return data;
};

// Sends ArchiveErrors as their HTTP status; anything else is a 500.
const sendArchiveError = (res, error) => {
  if (error instanceof ArchiveError) return res.status(error.status).json({ message: error.message, ...error.extra });
  return res.status(500).json({ message: error.message });
};

module.exports = { archiveStudent, readmitStudent, sendArchiveError, ArchiveError };
