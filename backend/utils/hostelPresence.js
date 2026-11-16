const supabase = require('../supabase');
const { fetchAll, hasPassType } = require('./schema');
const { OVERDUE_GRACE_MINUTES } = require('./outpassConfig');

// Real-time hostel presence is derived ONLY from gate QR scans recorded on
// outpasses (actual_exit_time / actual_return_time). It is deliberately kept
// separate from daily attendance, which is a roll call marked by staff.
//
//   Checked Out + pass_type 'Home'   -> 'Gone Home'
//   Checked Out + anything else      -> 'Outside Hostel'
//   otherwise                        -> 'Inside Hostel'
const LOCATIONS = ['Inside Hostel', 'Outside Hostel', 'Gone Home'];

const BASE_FIELDS = '_id, student_id, status, reason, destination, leave_datetime, return_datetime, approved_at, actual_exit_time, actual_return_time, created_at';

// Loads every outpass that matters for presence/history, for the given
// student ids (or everyone when ids is null).
const loadOutpasses = async (studentIds = null) => {
  if (studentIds && studentIds.length === 0) return [];
  const fields = (await hasPassType()) ? `${BASE_FIELDS}, pass_type` : BASE_FIELDS;
  return fetchAll(() => {
    let q = supabase.from('outpasses').select(fields).order('created_at', { ascending: false });
    if (studentIds) q = q.in('student_id', studentIds);
    return q;
  });
};

const later = (a, b) => (!a ? b : !b ? a : new Date(a) > new Date(b) ? a : b);

// Groups outpasses by student and computes each student's live status.
const presenceByStudent = (outpasses) => {
  const graceMs = OVERDUE_GRACE_MINUTES * 60 * 1000;
  const now = Date.now();
  const map = {};
  for (const o of outpasses) {
    const p = (map[o.student_id] ||= { checkedOut: null, approved: null, lastExit: null, lastEntry: null, pendingOutpasses: 0 });
    if (o.status === 'Checked Out' && !p.checkedOut) p.checkedOut = o;
    if (o.status === 'Approved' && !p.approved && new Date(o.return_datetime).getTime() + graceMs > now) p.approved = o;
    if (o.status === 'Pending') p.pendingOutpasses++;
    p.lastExit = later(p.lastExit, o.actual_exit_time);
    p.lastEntry = later(p.lastEntry, o.actual_return_time);
  }

  const result = {};
  for (const [studentId, p] of Object.entries(map)) {
    const out = p.checkedOut;
    const active = out || p.approved;
    result[studentId] = {
      location: out ? (out.pass_type === 'Home' ? 'Gone Home' : 'Outside Hostel') : 'Inside Hostel',
      last_exit: p.lastExit,
      last_entry: p.lastEntry,
      pending_outpasses: p.pendingOutpasses,
      is_overdue: Boolean(out && now > new Date(out.return_datetime).getTime() + graceMs),
      active_outpass: active
        ? {
            _id: active._id,
            status: active.status,
            pass_type: active.pass_type || 'Outing',
            reason: active.reason,
            destination: active.destination,
            leave_datetime: active.leave_datetime,
            return_datetime: active.return_datetime,
            approved_at: active.approved_at,
            actual_exit_time: active.actual_exit_time,
          }
        : null,
    };
  }
  return result;
};

const DEFAULT_PRESENCE = {
  location: 'Inside Hostel',
  last_exit: null,
  last_entry: null,
  pending_outpasses: 0,
  is_overdue: false,
  active_outpass: null,
};

const presenceFor = (presenceMap, studentId) => presenceMap[studentId] || DEFAULT_PRESENCE;

module.exports = { LOCATIONS, loadOutpasses, presenceByStudent, presenceFor };
