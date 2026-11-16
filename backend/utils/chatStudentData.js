const supabase = require('../supabase');
const { fetchAll } = require('./schema');
const { todayIST, toISTDateString } = require('./istDate');
const { OVERDUE_GRACE_MINUTES } = require('./outpassConfig');

// Everything the Hostel Assistant may look up about a student. Every function
// takes the SIGNED-IN student's id (from the login token, never from the chat
// text), so a student can only ever get their own records. Each returns only
// the few fields needed to answer — no email, phone, address or ids.

const fmtIST = (value) =>
  value
    ? new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
    : null;

const pct = (present, absent) => (present + absent ? Math.round((present / (present + absent)) * 1000) / 10 : null);

// Room, hostel and warden name.
const getRoom = async (studentId) => {
  const { data: s, error } = await supabase
    .from('users')
    .select('room_no, course_year, hostel:hostels(name), room:rooms(floor, capacity), warden:users!assigned_warden(name)')
    .eq('_id', studentId)
    .maybeSingle();
  if (error) throw error;
  if (!s) return { found: false };
  return {
    found: true,
    room_no: s.room_no || null,
    hostel: s.hostel?.name || null,
    floor: s.room?.floor || null,
    beds_in_room: s.room?.capacity || null,
    course_year: s.course_year || null,
    warden_name: s.warden?.name || null,
  };
};

// Today's roll call, this month's and overall attendance.
const getAttendance = async (studentId) => {
  const today = todayIST();
  const monthStart = `${today.slice(0, 7)}-01`;
  const rows = await fetchAll(() =>
    supabase.from('attendances').select('date, status').eq('student_id', studentId).order('date', { ascending: false })
  );
  const count = (list) => ({
    present: list.filter((r) => r.status === 'Present').length,
    absent: list.filter((r) => r.status === 'Absent').length,
  });
  const month = count(rows.filter((r) => r.date >= monthStart && r.date <= today));
  const overall = count(rows);
  const todayRow = rows.find((r) => r.date === today);
  return {
    today: todayRow && todayRow.status !== 'Pending' ? todayRow.status : 'Not marked yet',
    this_month: { ...month, percentage: pct(month.present, month.absent) },
    overall: { ...overall, percentage: pct(overall.present, overall.absent) },
    has_records: overall.present + overall.absent > 0,
  };
};

// Latest outpass plus a count per status.
const getOutpasses = async (studentId) => {
  const rows = await fetchAll(() =>
    supabase
      .from('outpasses')
      .select('status, pass_type, reason, destination, leave_datetime, return_datetime, actual_exit_time, actual_return_time, rejection_reason, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
  );
  const counts = {};
  for (const o of rows) counts[o.status] = (counts[o.status] || 0) + 1;
  const describe = (o) => ({
    status: o.status,
    type: o.pass_type || 'Outing',
    destination: o.destination,
    purpose: o.reason,
    leave_at: fmtIST(o.leave_datetime),
    return_by: fmtIST(o.return_datetime),
    left_at: fmtIST(o.actual_exit_time),
    returned_at: fmtIST(o.actual_return_time),
    rejection_reason: o.status === 'Rejected' ? o.rejection_reason || null : null,
    overdue: o.status === 'Checked Out' && Date.now() > new Date(o.return_datetime).getTime() + OVERDUE_GRACE_MINUTES * 60000,
  });
  return { total: rows.length, counts, latest: rows[0] ? describe(rows[0]) : null, recent: rows.slice(0, 3).map(describe) };
};

// Complaint counts per status and the latest few.
const getComplaints = async (studentId) => {
  const rows = await fetchAll(() =>
    supabase
      .from('complaints')
      .select('title, category, status, escalated, admin_remarks, created_at')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
  );
  const counts = {};
  for (const c of rows) counts[c.status] = (counts[c.status] || 0) + 1;
  return {
    total: rows.length,
    counts,
    pending: counts.Pending || 0,
    in_progress: counts['In Progress'] || 0,
    recent: rows.slice(0, 5).map((c) => ({
      title: c.title || c.category,
      category: c.category,
      status: c.status,
      escalated_to_admin: Boolean(c.escalated),
      staff_remark: c.admin_remarks || null,
      filed_on: toISTDateString(c.created_at),
    })),
  };
};

// The student's own warden (name + phone, as already shown on the Help page).
const getWardenContact = async (studentId) => {
  const { data: me, error } = await supabase.from('users').select('assigned_warden').eq('_id', studentId).maybeSingle();
  if (error) throw error;
  if (!me?.assigned_warden) return { assigned: false };
  const { data: w } = await supabase.from('users').select('name, phone, is_active').eq('_id', me.assigned_warden).maybeSingle();
  if (!w || w.is_active === false) return { assigned: false };
  return { assigned: true, name: w.name, phone: w.phone || null };
};

// Current announcements for everyone or the student's hostel.
const getAnnouncements = async (studentId) => {
  const { data: me } = await supabase.from('users').select('hostel_id').eq('_id', studentId).maybeSingle();
  const nowIso = new Date().toISOString();
  let q = supabase
    .from('announcements')
    .select('title, message, priority, created_at')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order('created_at', { ascending: false })
    .limit(5);
  q = me?.hostel_id ? q.or(`hostel_id.is.null,hostel_id.eq.${me.hostel_id}`) : q.is('hostel_id', null);
  const { data, error } = await q;
  if (error) throw error;
  return {
    count: (data || []).length,
    announcements: (data || []).map((a) => ({
      title: a.title,
      priority: a.priority,
      posted_on: toISTDateString(a.created_at),
      message: String(a.message || '').slice(0, 300),
    })),
  };
};

// Today's mess menu.
const getMessMenu = async () => {
  const day = new Date(Date.now() + 5.5 * 3600000).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const { data, error } = await supabase.from('mess_menu').select('day, breakfast, lunch, snacks, dinner').eq('day', day).maybeSingle();
  if (error) throw error;
  return data ? { found: true, ...data } : { found: false, day };
};

module.exports = { getRoom, getAttendance, getOutpasses, getComplaints, getWardenContact, getAnnouncements, getMessMenu };
