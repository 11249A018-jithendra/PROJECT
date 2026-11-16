const supabase = require('../supabase');
const { notifyRole, notifyUsers } = require('./notify');

// How long a warden has to respond before a complaint is escalated to Admin,
// and how long an escalated complaint may sit before Admin is reminded again.
const ESCALATION_HOURS = Number(process.env.COMPLAINT_ESCALATION_HOURS) || 24;
const ADMIN_REMINDER_HOURS = Number(process.env.COMPLAINT_ADMIN_REMINDER_HOURS) || 24;
const OPEN_STATUSES = ['Pending', 'In Progress'];

const hoursMs = (h) => h * 60 * 60 * 1000;

// The escalation columns come from the complaint escalation migration. Until
// it has run, every escalation code path quietly no-ops instead of erroring.
let schemaReady = null;
let schemaCheckedAt = 0;
const SCHEMA_RECHECK_MS = 5 * 60 * 1000;

const isEscalationReady = async () => {
  if (schemaReady !== null && Date.now() - schemaCheckedAt < SCHEMA_RECHECK_MS) return schemaReady;
  const { error } = await supabase.from('complaints').select('escalated, first_response_at').limit(1);
  const wasReady = schemaReady;
  schemaReady = !error;
  schemaCheckedAt = Date.now();
  if (!schemaReady && wasReady !== false) {
    console.warn('[escalation] complaint escalation columns missing — run the migrations in supabase/migrations.');
  }
  return schemaReady;
};

// The response clock starts at submission, or restarts when the student
// reopens a resolved complaint.
const clockStart = (complaint) => complaint.reopened_at || complaint.created_at;

const escalationDueAt = (complaint) =>
  new Date(new Date(clockStart(complaint)).getTime() + hoursMs(ESCALATION_HOURS)).toISOString();

const describe = (complaint) => {
  const who = complaint.student?.name ? `${complaint.student.name} (Room ${complaint.student.room_no || '—'})` : 'A student';
  return { who, label: complaint.title || complaint.category || 'Complaint' };
};

// Level 1: escalate every Pending complaint nobody has responded to in time.
const runEscalationCheck = async () => {
  if (!(await isEscalationReady())) return 0;

  const cutoff = new Date(Date.now() - hoursMs(ESCALATION_HOURS)).toISOString();
  const { data: overdue, error } = await supabase
    .from('complaints')
    .select('_id, title, category, student_id, created_at, reopened_at, student:users!student_id(name, room_no)')
    .eq('status', 'Pending')
    .eq('escalated', false)
    .is('first_response_at', null)
    .lt('created_at', cutoff)
    .or(`reopened_at.is.null,reopened_at.lt.${cutoff}`);

  if (error) {
    console.error('[escalation] check failed:', error.message);
    return 0;
  }

  let escalatedCount = 0;
  for (const complaint of overdue || []) {
    // Conditional update (escalated = false) makes this idempotent even if two
    // server instances run the check at the same moment.
    const { data: updated, error: updErr } = await supabase
      .from('complaints')
      .update({ escalated: true, escalated_at: new Date().toISOString() })
      .eq('_id', complaint._id)
      .eq('escalated', false)
      .select('_id');
    if (updErr || !updated?.length) continue;
    escalatedCount++;

    const { who, label } = describe(complaint);
    await notifyRole('admin', {
      type: 'COMPLAINT_ESCALATED',
      title: 'Complaint escalated',
      message: `${who}: "${label}" got no warden response in ${ESCALATION_HOURS}h.`,
      link: '/admin/complaints?view=escalated',
      complaint_id: complaint._id,
    });
    await notifyUsers([complaint.student_id], {
      type: 'COMPLAINT_ESCALATED',
      title: 'Your complaint was escalated',
      message: `"${label}" has been forwarded to the Admin for faster action.`,
      link: '/complaints',
      complaint_id: complaint._id,
    });
  }

  if (escalatedCount) console.log(`[escalation] escalated ${escalatedCount} complaint(s) to Admin`);
  return escalatedCount;
};

// Level 2: an escalated complaint that is still open keeps reminding every
// admin each ADMIN_REMINDER_HOURS until someone resolves (or cancels) it.
const runAdminReminders = async () => {
  if (!(await isEscalationReady())) return 0;
  const { data: open, error } = await supabase
    .from('complaints')
    .select('_id, title, category, escalated_at, admin_reminded_at, admin_reminder_count, student:users!student_id(name, room_no)')
    .eq('escalated', true)
    .in('status', OPEN_STATUSES);
  if (error) {
    console.error('[escalation] reminder check failed:', error.message);
    return 0;
  }

  const now = Date.now();
  let reminded = 0;
  for (const c of open || []) {
    const last = c.admin_reminded_at || c.escalated_at;
    if (!last || now - new Date(last).getTime() < hoursMs(ADMIN_REMINDER_HOURS)) continue;

    const count = (c.admin_reminder_count || 0) + 1;
    let claim = supabase.from('complaints').update({ admin_reminded_at: new Date().toISOString(), admin_reminder_count: count }).eq('_id', c._id);
    claim = c.admin_reminded_at ? claim.eq('admin_reminded_at', c.admin_reminded_at) : claim.is('admin_reminded_at', null);
    const { data: claimed } = await claim.select('_id');
    if (!claimed?.length) continue;
    reminded++;

    const { who, label } = describe(c);
    const hoursOpen = Math.round((now - new Date(c.escalated_at).getTime()) / 3600000);
    await notifyRole('admin', {
      type: 'COMPLAINT_REMINDER',
      title: `Reminder #${count}: escalated complaint still open`,
      message: `${who}: "${label}" has been escalated for ${hoursOpen}h without being resolved.`,
      link: '/admin/complaints?view=escalated',
      complaint_id: c._id,
    });
  }
  if (reminded) console.log(`[escalation] reminded admins about ${reminded} complaint(s)`);
  return reminded;
};

module.exports = {
  ESCALATION_HOURS,
  isEscalationReady,
  escalationDueAt,
  runEscalationCheck,
  runAdminReminders,
};
