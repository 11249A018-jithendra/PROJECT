const supabase = require('../supabase');
const { todayIST, toISTDateString, nowISTTimestamp } = require('../utils/istDate');
const { fetchAll } = require('../utils/schema');
const { loadOutpasses, presenceByStudent, presenceFor } = require('../utils/hostelPresence');
const { CURRENT_DAY_ONLY, WARDEN_TODAY_ONLY } = require('../utils/wardenRules');

const LOCKED_MESSAGE = 'Attendance is permanently locked once marked and cannot be edited, updated, or deleted by anyone.';
// A hand-marked record is final; a system auto-mark (gone-home Absent) can still
// be replaced the same day, until the midnight job locks the date.
// The database enforces the same rule (attendances_enforce_lock trigger).
const isLocked = (a) => Boolean(a) && (a.is_locked || !a.auto_marked);
const isLockError = (error) => (error?.message || '').includes('ATTENDANCE_LOCKED');

const STATUSES = ['Present', 'Absent', 'Pending'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (d) => DATE_RE.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

// Active (not checked-out) students the caller may see; wardens only get theirs.
const scopedStudents = (req, { hostelId } = {}) =>
  fetchAll(() => {
    let q = supabase
      .from('users')
      .select('_id, name, roll_no, room_no, assigned_warden, hostel_id, created_at')
      .eq('role', 'student')
      .eq('is_active', true)
      .order('name');
    if (req.user.role === 'warden') q = q.eq('assigned_warden', req.user._id);
    if (hostelId === 'unassigned') q = q.is('hostel_id', null);
    else if (hostelId) q = q.eq('hostel_id', hostelId);
    return q;
  });

const hostelNameMap = async () => {
  const { data } = await supabase.from('hostels').select('_id, name');
  return Object.fromEntries((data || []).map((h) => [h._id, h.name]));
};

// Strict current-day policy: Marking and editing attendance is restricted strictly to the current IST day.
const canMarkDate = (_req, date) => date === todayIST();

// @desc    Attendance for one day (defaults to today)
// @route   GET /api/admin/attendance?date=YYYY-MM-DD&hostel_id=   (and /api/warden/attendance)
// @access  Private (admin, warden — warden scoped to assigned students)
const getAttendance = async (req, res) => {
  try {
    const today = todayIST();
    const date = req.query.date || today;
    if (!isDate(date)) return res.status(400).json({ message: 'Date must be YYYY-MM-DD.' });
    if (req.user.role === 'warden' && !canMarkDate(req, date)) return res.status(403).json({ message: WARDEN_TODAY_ONLY });
    if (date > today) return res.status(400).json({ message: 'Attendance cannot be viewed for a future date.' });

    const [students, attendances, hostels] = await Promise.all([
      scopedStudents(req, { hostelId: req.query.hostel_id }),
      fetchAll(() => supabase.from('attendances').select('student_id, status, marked_by, auto_marked, is_locked, updated_at').eq('date', date)),
      hostelNameMap(),
    ]);
    // Students who joined after this date weren't residents yet.
    const residents = students.filter((s) => !s.created_at || toISTDateString(s.created_at) <= date);

    const isToday = date === today;
    const presence = isToday ? presenceByStudent(await loadOutpasses(residents.map((s) => s._id))) : {};

    const byStudent = Object.fromEntries(attendances.map((a) => [a.student_id, a]));
    const markerIds = [...new Set(attendances.map((a) => a.marked_by).filter((m) => m && m !== 'system'))];
    const { data: markers } = markerIds.length
      ? await supabase.from('users').select('_id, name').in('_id', markerIds)
      : { data: [] };
    const markerNames = Object.fromEntries((markers || []).map((m) => [m._id, m.name]));

    let present = 0, absent = 0, pending = 0;
    const rows = residents.map((s) => {
      const a = byStudent[s._id];
      const status = a?.status || 'Pending';
      if (status === 'Present') present++;
      else if (status === 'Absent') absent++;
      else pending++;
      const live = isToday ? presenceFor(presence, s._id) : null;
      return {
        ...s,
        status,
        is_locked: isLocked(a),
        hostel_name: hostels[s.hostel_id] || null,
        marked_by_name: a?.marked_by === 'system' ? 'Automatic' : markerNames[a?.marked_by] || null,
        auto_marked: Boolean(a?.auto_marked),
        marked_at: a?.updated_at || null,
        location: live?.location || null,
        last_exit: live?.last_exit || null,
        last_entry: live?.last_entry || null,
      };
    });

    res.json({
      date,
      is_today: isToday,
      editable: canMarkDate(req, date),
      server_time: nowISTTimestamp(),
      current_date: today,
      timezone: 'Asia/Kolkata',
      stats: { total: rows.length, present, absent, pending },
      students: rows,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const upsertMark = (studentIds, date, status, userId) =>
  supabase
    .from('attendances')
    .upsert(
      studentIds.map((student_id) => ({
        student_id,
        date,
        status,
        marked_by: userId,
        auto_marked: false,
        is_locked: false,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'date,student_id' }
    )
    .select();

// Ensures every id is an active student the caller may mark.
const assertMarkable = async (req, studentIds) => {
  const { data } = await supabase
    .from('users')
    .select('_id, assigned_warden')
    .eq('role', 'student')
    .eq('is_active', true)
    .in('_id', studentIds);
  const ok = (data || []).filter((s) => req.user.role === 'admin' || s.assigned_warden === req.user._id);
  return ok.length === new Set(studentIds).size;
};

// @desc    Mark one student (Present, Absent, or Pending/Clear)
// @route   PUT /api/admin/attendance/:studentId   body: { status, date? }
// @access  Private (admin any date ≤ today; warden today, own students)
const markAttendance = async (req, res) => {
  try {
    const { status } = req.body;
    const today = todayIST();
    const date = req.body.date || today;
    if (!STATUSES.includes(status)) return res.status(400).json({ message: `Status must be one of: ${STATUSES.join(', ')}` });
    if (!isDate(date) || date > today) return res.status(400).json({ message: 'Invalid attendance date.' });
    if (!canMarkDate(req, date)) return res.status(403).json({ message: CURRENT_DAY_ONLY });
    if (!(await assertMarkable(req, [req.params.studentId]))) return res.status(403).json({ message: 'Not authorized for this student' });

    const { data: existing, error: checkError } = await supabase
      .from('attendances')
      .select('auto_marked, is_locked')
      .eq('date', date)
      .eq('student_id', req.params.studentId)
      .maybeSingle();
    if (checkError) throw checkError;
    if (isLocked(existing)) return res.status(409).json({ message: LOCKED_MESSAGE });

    if (status === 'Pending') {
      // Only an unlocked auto-mark can be cleared.
      if (existing) {
        const { error } = await supabase.from('attendances').delete().eq('date', date).eq('student_id', req.params.studentId);
        if (error) throw error;
      }
      return res.json({ student_id: req.params.studentId, date, status: 'Pending', cleared: Boolean(existing) });
    }

    const { data, error } = await upsertMark([req.params.studentId], date, status, req.user._id);
    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    if (isLockError(error)) return res.status(409).json({ message: LOCKED_MESSAGE });
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark many students at once (e.g. "everyone left = Present")
// @route   PUT /api/admin/attendance   body: { student_ids: [], status, date? }
const markAttendanceBulk = async (req, res) => {
  try {
    const { status, student_ids } = req.body;
    const today = todayIST();
    const date = req.body.date || today;
    if (!STATUSES.includes(status)) return res.status(400).json({ message: `Status must be one of: ${STATUSES.join(', ')}` });
    if (!Array.isArray(student_ids) || !student_ids.length || student_ids.length > 1000) {
      return res.status(400).json({ message: 'Choose between 1 and 1000 students.' });
    }
    if (!isDate(date) || date > today) return res.status(400).json({ message: 'Invalid attendance date.' });
    if (!canMarkDate(req, date)) return res.status(403).json({ message: CURRENT_DAY_ONLY });
    if (!(await assertMarkable(req, student_ids))) return res.status(403).json({ message: 'Some students are not yours to mark.' });

    const uniqueIds = [...new Set(student_ids)];
    const { data: existingRecords, error: checkError } = await supabase
      .from('attendances')
      .select('student_id, auto_marked, is_locked')
      .eq('date', date)
      .in('student_id', uniqueIds);
    if (checkError) throw checkError;

    // Locked students are skipped, not overwritten.
    const lockedIds = new Set((existingRecords || []).filter(isLocked).map((r) => r.student_id));
    const markableIds = uniqueIds.filter((id) => !lockedIds.has(id));
    if (!markableIds.length) return res.status(409).json({ message: 'All selected students already have locked attendance records.' });

    if (status === 'Pending') {
      const { error } = await supabase
        .from('attendances')
        .delete()
        .eq('date', date)
        .in('student_id', markableIds);
      if (error) throw error;
      return res.json({ cleared: markableIds.length });
    }

    const { data, error } = await upsertMark(markableIds, date, status, req.user._id);
    if (error) throw error;
    res.json({ updated: data.length, skipped_locked: lockedIds.size });
  } catch (error) {
    if (isLockError(error)) return res.status(409).json({ message: LOCKED_MESSAGE });
    res.status(500).json({ message: error.message });
  }
};

// @desc    Monthly attendance report: per-student counts + percentage, per-day totals
// @route   GET /api/admin/attendance/report?month=YYYY-MM&hostel_id=  (admin only)
const getAttendanceReport = async (req, res) => {
  try {
    const today = todayIST();
    const month = req.query.month || today.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ message: 'Month must be YYYY-MM.' });

    const [y, m] = month.split('-').map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${month}-${String(d).padStart(2, '0')}`;
      if (iso > today) break;
      days.push(iso);
    }
    if (!days.length) return res.status(400).json({ message: 'That month has not started yet.' });

    const [students, hostels] = await Promise.all([scopedStudents(req, { hostelId: req.query.hostel_id }), hostelNameMap()]);
    const ids = students.map((s) => s._id);
    const records = ids.length
      ? await fetchAll(() =>
          supabase.from('attendances').select('student_id, date, status').gte('date', days[0]).lte('date', days[days.length - 1]).in('student_id', ids)
        )
      : [];

    const byKey = Object.fromEntries(records.map((r) => [`${r.student_id}|${r.date}`, r.status]));
    const daily = Object.fromEntries(days.map((d) => [d, { date: d, present: 0, absent: 0, notMarked: 0 }]));

    const rows = students.map((s) => {
      const joined = s.created_at ? toISTDateString(s.created_at) : days[0];
      let present = 0, absent = 0, notMarked = 0;
      for (const d of days) {
        if (d < joined) continue;
        const st = byKey[`${s._id}|${d}`];
        if (st === 'Present') { present++; daily[d].present++; }
        else if (st === 'Absent') { absent++; daily[d].absent++; }
        else { notMarked++; daily[d].notMarked++; }
      }
      const marked = present + absent;
      return {
        _id: s._id,
        name: s.name,
        roll_no: s.roll_no,
        room_no: s.room_no,
        hostel_name: hostels[s.hostel_id] || null,
        days: present + absent + notMarked,
        present,
        absent,
        not_marked: notMarked,
        percentage: marked ? Math.round((present / marked) * 1000) / 10 : null,
      };
    });

    const withPct = rows.filter((r) => r.percentage !== null);
    res.json({
      month,
      days: days.length,
      summary: {
        students: rows.length,
        average_percentage: withPct.length ? Math.round((withPct.reduce((a, r) => a + r.percentage, 0) / withPct.length) * 10) / 10 : null,
        below_75: withPct.filter((r) => r.percentage < 75).length,
      },
      students: rows,
      daily: Object.values(daily),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getAttendance, markAttendance, markAttendanceBulk, getAttendanceReport };
