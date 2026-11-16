const supabase = require('../supabase');
const { notifyUsers, notifyRole } = require('./notify');
const { OVERDUE_GRACE_MINUTES } = require('./outpassConfig');
const { todayIST } = require('./istDate');

// Sends ONE alert per overdue outpass (student still outside after the
// expected return time + grace period) to the student's warden, every admin
// and the student. overdue_notified_at makes it fire exactly once.
const runOverdueAlerts = async () => {
  const cutoff = new Date(Date.now() - OVERDUE_GRACE_MINUTES * 60 * 1000).toISOString();
  const { data: overdue, error } = await supabase
    .from('outpasses')
    .select('_id, student_id, destination, return_datetime, pass_type, student:users!student_id(name, roll_no, room_no, assigned_warden)')
    .eq('status', 'Checked Out')
    .is('overdue_notified_at', null)
    .lt('return_datetime', cutoff);
  if (error) {
    console.error('[overdue] check failed:', error.message);
    return 0;
  }

  let sent = 0;
  for (const o of overdue || []) {
    const { data: claimed } = await supabase
      .from('outpasses')
      .update({ overdue_notified_at: new Date().toISOString() })
      .eq('_id', o._id)
      .is('overdue_notified_at', null)
      .select('_id');
    if (!claimed?.length) continue; // another server instance got it
    sent++;

    const s = o.student || {};
    const due = new Date(o.return_datetime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    const payload = {
      type: 'OUTPASS_OVERDUE',
      title: 'Student overdue',
      message: `${s.name || 'A student'} (${s.roll_no || '—'}, Room ${s.room_no || '—'}) was due back by ${due} and has not returned.`,
      link: '/security/currently-outside',
    };
    if (s.assigned_warden) await notifyUsers([s.assigned_warden], payload);
    await notifyRole('admin', { ...payload, link: '/admin/tracking?location=' + encodeURIComponent(o.pass_type === 'Home' ? 'Gone Home' : 'Outside Hostel') });
    await notifyUsers([o.student_id], {
      type: 'OUTPASS_OVERDUE',
      title: 'You are overdue',
      message: `Your outpass to ${o.destination} ended at ${due}. Please return to the hostel and scan in at the gate.`,
      link: '/outpasses',
    });
  }
  if (sent) console.log(`[overdue] alerted for ${sent} outpass(es)`);
  return sent;
};

// Closes requests nobody reviewed before their leave day: once that day has
// passed (India time) they can no longer be approved, so they are marked
// Rejected with a clear reason and the student is told to request again.
const EXPIRED_REASON = 'Expired: this request was not reviewed before its leave date. Please submit a new request.';
const runExpirePending = async () => {
  const todayStart = new Date(`${todayIST()}T00:00:00+05:30`).toISOString();
  const { data: expired, error } = await supabase
    .from('outpasses')
    .update({ status: 'Rejected', rejected_at: new Date().toISOString(), rejection_reason: EXPIRED_REASON, updated_at: new Date().toISOString() })
    .eq('status', 'Pending')
    .lt('leave_datetime', todayStart)
    .select('_id, student_id, destination');
  if (error) {
    console.error('[outpass] expiring old requests failed:', error.message);
    return 0;
  }
  for (const o of expired || []) {
    await notifyUsers([o.student_id], {
      type: 'OUTPASS_EXPIRED',
      title: 'Outpass request expired',
      message: `Your request to ${o.destination} was not reviewed before its leave date. Please submit a new one.`,
      link: '/outpasses',
    });
  }
  if (expired?.length) console.log(`[outpass] expired ${expired.length} unreviewed request(s)`);
  return expired?.length || 0;
};

module.exports = { runOverdueAlerts, runExpirePending };
