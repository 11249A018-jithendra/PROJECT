const supabase = require('../supabase');
const { todayIST } = require('../utils/istDate');
const { hasHostelTracking, fetchAll } = require('../utils/schema');
const { LOCATIONS, loadOutpasses, presenceByStudent, presenceFor } = require('../utils/hostelPresence');

const UNASSIGNED = 'unassigned';
const ATTENDANCE_STATES = ['Present', 'Absent', 'Pending'];

const requireMigration = async (res) => {
  if (await hasHostelTracking()) return true;
  res.status(503).json({ message: 'Hostel tracking is not set up yet. Run hostel_tracking.sql in the Supabase SQL Editor.' });
  return false;
};

const cleanName = (name) => String(name || '').trim().replace(/\s+/g, ' ');

// Loads everything the summary and tracking views need in one pass.
const loadTrackingData = async () => {
  const [students, wardens, hostels, attendances] = await Promise.all([
    fetchAll(() =>
      supabase
        .from('users')
        .select('_id, name, email, roll_no, room_no, course_year, phone, parent_contact, home_address, hostel_id, assigned_warden')
        .eq('role', 'student')
        .eq('is_active', true)
        .order('name')
    ),
    fetchAll(() => supabase.from('users').select('_id, name, phone, hostel_id, is_active').eq('role', 'warden')),
    fetchAll(() => supabase.from('hostels').select('*').order('name')),
    fetchAll(() => supabase.from('attendances').select('student_id, status').eq('date', todayIST())),
  ]);
  const presence = presenceByStudent(await loadOutpasses());
  const attendanceById = Object.fromEntries(attendances.map((a) => [a.student_id, a.status]));
  return { students, wardens, hostels, presence, attendanceById };
};

// ---------------------------------------------------------------------------
// Public: hostel names for the student registration form
// ---------------------------------------------------------------------------

// @route   GET /api/hostels
// @access  Public (names only — nothing sensitive)
const listHostelNames = async (req, res) => {
  try {
    if (!(await hasHostelTracking())) return res.json([]);
    const { data, error } = await supabase.from('hostels').select('_id, name').order('name');
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Admin: hostel CRUD
// ---------------------------------------------------------------------------

// @route   GET /api/admin/hostels
const getHostels = async (req, res) => {
  try {
    if (!(await requireMigration(res))) return;
    const [{ data: hostels, error }, { data: users }] = await Promise.all([
      supabase.from('hostels').select('*').order('name'),
      supabase.from('users').select('hostel_id, role').in('role', ['student', 'warden']).not('hostel_id', 'is', null),
    ]);
    if (error) throw error;
    const counts = {};
    for (const u of users || []) {
      const c = (counts[u.hostel_id] ||= { students: 0, wardens: 0 });
      if (u.role === 'student') c.students++;
      else c.wardens++;
    }
    res.json((hostels || []).map((h) => ({ ...h, student_count: counts[h._id]?.students || 0, warden_count: counts[h._id]?.wardens || 0 })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const parseCapacity = (capacity) => {
  if (capacity === undefined || capacity === null || capacity === '') return { value: null };
  const n = Number(capacity);
  if (!Number.isInteger(n) || n < 0 || n > 100000) return { error: 'Capacity must be a whole number.' };
  return { value: n };
};

// @route   POST /api/admin/hostels
const createHostel = async (req, res) => {
  try {
    if (!(await requireMigration(res))) return;
    const name = cleanName(req.body.name);
    if (!name || name.length > 60) return res.status(400).json({ message: 'Hostel name is required (max 60 characters).' });
    const cap = parseCapacity(req.body.capacity);
    if (cap.error) return res.status(400).json({ message: cap.error });

    const { data, error } = await supabase.from('hostels').insert({ name, capacity: cap.value }).select().single();
    if (error) {
      if (error.code === '23505') return res.status(400).json({ message: 'A hostel with this name already exists.' });
      throw error;
    }
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/admin/hostels/:id
const updateHostel = async (req, res) => {
  try {
    if (!(await requireMigration(res))) return;
    const updates = { updated_at: new Date().toISOString() };
    if (req.body.name !== undefined) {
      const name = cleanName(req.body.name);
      if (!name || name.length > 60) return res.status(400).json({ message: 'Hostel name is required (max 60 characters).' });
      updates.name = name;
    }
    if (req.body.capacity !== undefined) {
      const cap = parseCapacity(req.body.capacity);
      if (cap.error) return res.status(400).json({ message: cap.error });
      updates.capacity = cap.value;
    }
    const { data, error } = await supabase.from('hostels').update(updates).eq('_id', req.params.id).select().maybeSingle();
    if (error) {
      if (error.code === '23505') return res.status(400).json({ message: 'A hostel with this name already exists.' });
      throw error;
    }
    if (!data) return res.status(404).json({ message: 'Hostel not found' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   DELETE /api/admin/hostels/:id  (refused while students live there)
const deleteHostel = async (req, res) => {
  try {
    if (!(await requireMigration(res))) return;
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student')
      .eq('is_active', true)
      .eq('hostel_id', req.params.id);
    if (count) return res.status(409).json({ message: `Move the ${count} student(s) in this hostel to another hostel first.` });

    const { error } = await supabase.from('hostels').delete().eq('_id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Hostel deleted.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Admin: hostel summary (per-hostel attendance + live presence)
// ---------------------------------------------------------------------------

const emptyStats = () => ({
  total: 0,
  present: 0,
  absent: 0,
  notMarked: 0,
  inside: 0,
  outside: 0,
  goneHome: 0,
  overdue: 0,
  pendingOutpasses: 0,
});

const addStudent = (stats, attendance, live) => {
  stats.total++;
  if (attendance === 'Present') stats.present++;
  else if (attendance === 'Absent') stats.absent++;
  else stats.notMarked++;
  if (live.location === 'Gone Home') stats.goneHome++;
  else if (live.location === 'Outside Hostel') stats.outside++;
  else stats.inside++;
  if (live.is_overdue) stats.overdue++;
  stats.pendingOutpasses += live.pending_outpasses;
};

// @route   GET /api/admin/hostel-summary
const getHostelSummary = async (req, res) => {
  try {
    if (!(await requireMigration(res))) return;
    const { students, wardens, hostels, presence, attendanceById } = await loadTrackingData();

    const byHostel = Object.fromEntries(
      hostels.map((h) => [h._id, { _id: h._id, name: h.name, capacity: h.capacity, wardens: [], ...emptyStats() }])
    );
    const unassigned = { _id: UNASSIGNED, name: 'No hostel assigned', capacity: null, wardens: [], ...emptyStats() };
    const totals = emptyStats();

    for (const w of wardens) {
      if (w.hostel_id && byHostel[w.hostel_id]) {
        byHostel[w.hostel_id].wardens.push({ _id: w._id, name: w.name, is_active: w.is_active !== false });
      }
    }
    for (const s of students) {
      const live = presenceFor(presence, s._id);
      const attendance = attendanceById[s._id] || 'Pending';
      addStudent(byHostel[s.hostel_id] || unassigned, attendance, live);
      addStudent(totals, attendance, live);
    }

    const list = Object.values(byHostel);
    if (unassigned.total) list.push(unassigned);
    res.json({ date: todayIST(), totals: { ...totals, hostels: hostels.length }, hostels: list });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Admin: student attendance & hostel tracking report
// ---------------------------------------------------------------------------

// @route   GET /api/admin/tracking?search=&hostel_id=&room_no=&attendance=&location=
const getStudentTracking = async (req, res) => {
  try {
    if (!(await requireMigration(res))) return;
    const { students, wardens, hostels, presence, attendanceById } = await loadTrackingData();
    const hostelNames = Object.fromEntries(hostels.map((h) => [h._id, h.name]));
    const wardenNames = Object.fromEntries(wardens.map((w) => [w._id, w.name]));

    const search = String(req.query.search || '').trim().toLowerCase();
    const { hostel_id, room_no, attendance, location } = req.query;

    const rows = students.map((s) => {
      const live = presenceFor(presence, s._id);
      const att = attendanceById[s._id] || 'Pending';
      return {
        ...s,
        hostel_name: hostelNames[s.hostel_id] || null,
        warden_name: wardenNames[s.assigned_warden] || null,
        attendance: att,
        ...live,
        // Roll call says Present but the gate says they're out (or vice versa).
        attendance_conflict: (att === 'Present' && live.location !== 'Inside Hostel') || (att === 'Absent' && live.location === 'Inside Hostel'),
      };
    });

    const filtered = rows.filter((r) => {
      if (search && !(r.name || '').toLowerCase().includes(search) && !(r.roll_no || '').toLowerCase().includes(search)) return false;
      if (hostel_id && (hostel_id === UNASSIGNED ? r.hostel_id : r.hostel_id !== hostel_id)) return false;
      if (room_no && (r.room_no || '').toLowerCase() !== String(room_no).toLowerCase()) return false;
      if (attendance && ATTENDANCE_STATES.includes(attendance) && r.attendance !== attendance) return false;
      if (location && LOCATIONS.includes(location) && r.location !== location) return false;
      return true;
    });

    const rooms = [...new Set(rows.map((r) => r.room_no).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    res.json({
      date: todayIST(),
      total: rows.length,
      students: filtered,
      filters: { hostels: hostels.map((h) => ({ _id: h._id, name: h.name })), rooms },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  listHostelNames,
  getHostels,
  createHostel,
  updateHostel,
  deleteHostel,
  getHostelSummary,
  getStudentTracking,
};
