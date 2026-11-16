const supabase = require('../supabase');
const { parsePage, pageResponse } = require('../utils/paginate');

// Past Students History (admin only). Rows are frozen snapshots taken when the
// exit was approved; the student's outpasses, complaints and attendance stay in
// their own tables (linked by student_id) and are shown read-only here.

const LIST_COLS = '_id, student_id, source, name, email, roll_no, phone, course_year, profile_photo, hostel_id, hostel_name, room_no, warden_name, exit_date, exit_reason, requested_by_name, approved_by_name, approved_at, readmitted_at';

// @desc    Search / filter past students
// @route   GET /api/admin/past-students?search=&hostel_id=&from=&to=&source=&include_readmitted=&page=
const getPastStudents = async (req, res) => {
  try {
    const paging = parsePage(req, 20) || { page: 1, limit: 100, from: 0, to: 99 };
    let q = supabase.from('past_students').select(LIST_COLS, { count: 'exact' }).order('exit_date', { ascending: false }).order('approved_at', { ascending: false });

    if (req.query.include_readmitted !== 'true') q = q.is('readmitted_at', null);
    if (req.query.hostel_id) q = q.eq('hostel_id', req.query.hostel_id);
    if (req.query.source === 'Admin' || req.query.source === 'Warden request') q = q.eq('source', req.query.source);
    if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '')) q = q.gte('exit_date', req.query.from);
    if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '')) q = q.lte('exit_date', req.query.to);
    const search = String(req.query.search || '').replace(/[,()*%\\:"']/g, ' ').trim().slice(0, 60);
    if (search) q = q.or(`name.ilike.%${search}%,roll_no.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);

    const { data, error, count } = await q.range(paging.from, paging.to);
    if (error) throw error;

    // Hostels that appear in history, for the filter dropdown (names as recorded at exit).
    const { data: hostelRows } = await supabase.from('past_students').select('hostel_id, hostel_name').not('hostel_id', 'is', null);
    const hostels = [...new Map((hostelRows || []).map((h) => [h.hostel_id, { _id: h.hostel_id, name: h.hostel_name }])).values()];

    res.json({ ...pageResponse(data || [], count || 0, paging), hostels });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    One past student: snapshot + exit request + preserved history rows
// @route   GET /api/admin/past-students/:id
const getPastStudent = async (req, res) => {
  try {
    const { data: past, error } = await supabase.from('past_students').select('*').eq('_id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!past) return res.status(404).json({ message: 'Past student not found.' });

    const [request, outpasses, complaints, attendance, earlierExits] = await Promise.all([
      past.exit_request_id
        ? supabase.from('student_exit_requests').select('*').eq('_id', past.exit_request_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('outpasses').select('_id, reason, destination, pass_type, status, leave_datetime, return_datetime, actual_exit_time, actual_return_time').eq('student_id', past.student_id).order('created_at', { ascending: false }).limit(50),
      supabase.from('complaints').select('_id, title, category, status, created_at, resolved_at').eq('student_id', past.student_id).order('created_at', { ascending: false }).limit(50),
      supabase.from('attendances').select('date, status').eq('student_id', past.student_id).order('date', { ascending: false }).limit(60),
      supabase.from('past_students').select('_id, exit_date, exit_reason, readmitted_at').eq('student_id', past.student_id).neq('_id', past._id).order('exit_date', { ascending: false }),
    ]);

    res.json({
      ...past,
      exit_request: request.data,
      history: {
        outpasses: outpasses.data || [],
        complaints: complaints.data || [],
        attendance: attendance.data || [],
        other_stays: earlierExits.data || [],
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getPastStudents, getPastStudent };
