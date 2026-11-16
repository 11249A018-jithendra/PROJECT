const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { getDashboardStats, getAllStudents, getStudentById, assignWarden, checkoutStudent, readmitStudent } = require('../controllers/adminController');
const { getAllWardens, getWardenById, createWarden, updateWarden, resetWardenPassword, resetUserPassword, setWardenStatus, deleteWarden } = require('../controllers/wardenAdminController');
const { getHostels, createHostel, updateHostel, deleteHostel, getHostelSummary, getStudentTracking } = require('../controllers/hostelController');
const { getAttendance, markAttendance, markAttendanceBulk, getAttendanceReport } = require('../controllers/attendanceController');
const { getRooms, createRoom, createRoomsBulk, updateRoom, deleteRoom, deleteRoomsRange, assignStudentRoom } = require('../controllers/roomController');
const { getPastStudents, getPastStudent } = require('../controllers/pastStudentController');
const { protect, adminOnly } = require('../middleware/auth');
const { rules } = require('../middleware/validate');

// Every route here is admin-only: it exposes sensitive student data
// (contacts, home address, live location) and account management.
router.use(protect, adminOnly);

const id = param('id').isUUID().withMessage('Invalid id.');

router.get('/dashboard', getDashboardStats);

// Wardens
router.get('/wardens', getAllWardens);
router.post('/wardens', createWarden);
router.get('/wardens/:id', rules(id), getWardenById);
router.put('/wardens/:id', rules(id), updateWarden);
router.put('/wardens/:id/password', rules(id), resetWardenPassword);
router.patch('/wardens/:id/status', rules(id), setWardenStatus);
router.delete('/wardens/:id', rules(id), deleteWarden);

// Password reset for students and security staff ("forgot password" — no email service)
router.put('/users/:id/password', rules(id), resetUserPassword);

// Security staff accounts (list only, for the reset UI)
router.get('/security-staff', async (req, res) => {
  try {
    const { data, error } = await require('../supabase').from('users').select('_id, name, email, phone, created_at').eq('role', 'security').order('name');
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Students
router.get('/students', getAllStudents);
router.get('/students/:id', rules(id), getStudentById);
router.put('/students/:id/warden', rules(id), assignWarden);
router.put('/students/:id/hostel', rules(
  id,
  body('hostel_id').optional({ values: 'falsy' }).isUUID().withMessage('Invalid hostel.'),
  body('room_id').optional({ values: 'falsy' }).isUUID().withMessage('Invalid room.')
), assignStudentRoom);
router.post('/students/:id/checkout', rules(
  id,
  body('reason').trim().isLength({ min: 5, max: 500 }).withMessage('Give the exit reason (5–500 characters).'),
  body('exit_date').optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Date must be YYYY-MM-DD.'),
  body('force').optional().isBoolean()
), checkoutStudent);
router.post('/students/:id/readmit', rules(id), readmitStudent);

// Past Students History (admin only — snapshots of students who left)
router.get('/past-students', getPastStudents);
router.get('/past-students/:id', rules(id), getPastStudent);

// Hostels & tracking
router.get('/hostels', getHostels);
router.post('/hostels', createHostel);
router.put('/hostels/:id', rules(id), updateHostel);
router.delete('/hostels/:id', rules(id), deleteHostel);
router.get('/hostel-summary', getHostelSummary);
router.get('/tracking', getStudentTracking);

// Rooms
const roomFields = [
  body('capacity').isInt({ min: 1, max: 50 }).withMessage('Capacity must be 1–50 beds.'),
  body('floor').optional({ values: 'falsy' }).trim().isLength({ max: 20 }),
];
router.get('/rooms', getRooms);
router.post('/rooms', rules(
  body('hostel_id').isUUID().withMessage('Choose a hostel.'),
  body('room_no').trim().isLength({ min: 1, max: 20 }).withMessage('Room number is required (max 20).'),
  ...roomFields
), createRoom);
router.post('/rooms/bulk', rules(
  body('hostel_id').isUUID().withMessage('Choose a hostel.'),
  body('from').isInt({ min: 0, max: 99999 }).withMessage('"From" must be a number.'),
  body('to').isInt({ min: 0, max: 99999 }).withMessage('"To" must be a number.'),
  body('prefix').optional().trim().isLength({ max: 10 }),
  ...roomFields
), createRoomsBulk);
router.post('/rooms/bulk-delete', rules(
  body('hostel_id').isUUID().withMessage('Choose a hostel.'),
  body('from').isInt({ min: 0, max: 99999 }).withMessage('"From" must be a number.'),
  body('to').isInt({ min: 0, max: 99999 }).withMessage('"To" must be a number.'),
  body('prefix').optional().trim().isLength({ max: 10 }),
  body('confirm').optional().isBoolean()
), deleteRoomsRange);
router.put('/rooms/:id', rules(id, body('capacity').optional().isInt({ min: 1, max: 50 }).withMessage('Capacity must be 1–50 beds.')), updateRoom);
router.delete('/rooms/:id', rules(id), deleteRoom);

// Attendance
router.get('/attendance', getAttendance);
router.get('/attendance/report', getAttendanceReport);
router.put('/attendance', markAttendanceBulk);
router.put('/attendance/:studentId', rules(param('studentId').isUUID()), markAttendance);

module.exports = router;
