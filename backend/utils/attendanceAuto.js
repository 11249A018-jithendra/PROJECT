const supabase = require('../supabase');
const { todayIST, toISTDateString } = require('./istDate');

// Students who are away on a Home-visit outpass are Absent for the day.
// Only fills an empty / "Pending" (not marked) record — a status a warden
// or admin set by hand is never overwritten.
const markAbsentIfUnmarked = async (studentIds, date = todayIST()) => {
  const ids = [...new Set(studentIds.filter(Boolean))];
  if (!ids.length) return 0;

  const { data: existing } = await supabase
    .from('attendances')
    .select('_id, student_id, status')
    .eq('date', date)
    .in('student_id', ids);
  const byStudent = Object.fromEntries((existing || []).map((a) => [a.student_id, a]));

  let marked = 0;
  for (const id of ids) {
    const row = byStudent[id];
    if (row && row.status !== 'Pending') continue;
    const values = { status: 'Absent', auto_marked: true, marked_by: 'system', updated_at: new Date().toISOString() };
    const { error } = row
      ? await supabase.from('attendances').update(values).eq('_id', row._id).eq('status', 'Pending')
      : await supabase.from('attendances').insert({ ...values, date, student_id: id });
    if (!error) marked++;
  }
  return marked;
};

// Daily pass: everyone currently Gone Home gets today's Absent.
const runGoneHomeAbsent = async () => {
  const { data, error } = await supabase
    .from('outpasses')
    .select('student_id')
    .eq('status', 'Checked Out')
    .eq('pass_type', 'Home');
  if (error) {
    console.error('[attendance] gone-home check failed:', error.message);
    return 0;
  }
  const marked = await markAbsentIfUnmarked((data || []).map((o) => o.student_id));
  if (marked) console.log(`[attendance] auto-marked ${marked} gone-home student(s) Absent`);
  return marked;
};

// Closes and locks all previous days' attendance records at midnight or on startup
const closePastAttendance = async () => {
  try {
    const today = todayIST();

    // 1. Mark any unlocked past attendance records as locked
    const { data: locked, error: attError } = await supabase
      .from('attendances')
      .update({ is_locked: true })
      .lt('date', today)
      .eq('is_locked', false)
      .select('_id');

    if (attError) {
      console.error('[attendance] Error locking past attendances:', attError.message);
    } else if (locked && locked.length > 0) {
      console.log(`[attendance] Locked ${locked.length} past attendance record(s).`);
    }

    // 2. Record yesterday as closed — once; later ticks keep the first closed_at.
    const yesterday = toISTDateString(Date.now() - 24 * 60 * 60 * 1000);
    const { error: lockErr } = await supabase
      .from('attendance_daily_locks')
      .upsert({ date: yesterday, status: 'Closed', closed_at: new Date().toISOString() }, { onConflict: 'date', ignoreDuplicates: true });
    if (lockErr) {
      console.error('[attendance] Error recording daily lock:', lockErr.message);
    }

    return true;
  } catch (e) {
    console.error('[attendance] closePastAttendance failed:', e.message);
    return false;
  }
};

module.exports = { markAbsentIfUnmarked, runGoneHomeAbsent, closePastAttendance };
