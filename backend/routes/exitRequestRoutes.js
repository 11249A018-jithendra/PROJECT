const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const {
  createExitRequest, getExitRequests, getExitRequest, approveExitRequest, rejectExitRequest, cancelExitRequest,
} = require('../controllers/exitRequestController');
const { protect, adminOnly, wardenOnly, adminOrWarden } = require('../middleware/auth');
const { rules } = require('../middleware/validate');

const id = param('id').isUUID().withMessage('Invalid request id.');
const isoDate = (field) =>
  body(field).optional({ values: 'falsy' }).isISO8601({ strict: true }).withMessage('Date must be YYYY-MM-DD.');

router.get('/', protect, adminOrWarden, rules(
  query('status').optional().isIn(['All', 'Pending', 'Approved', 'Rejected', 'Cancelled']),
  query('student_id').optional().isUUID()
), getExitRequests);

// Warden submits — the warden can never approve: approve/reject are admin-only.
router.post('/', protect, wardenOnly, rules(
  body('student_id').isUUID().withMessage('Invalid student.'),
  body('reason').trim().isLength({ min: 5, max: 500 }).withMessage('Give the exit reason (5–500 characters).'),
  isoDate('exit_date'),
  body('remarks').optional().trim().isLength({ max: 500 }).withMessage('Remarks are too long (max 500).')
), createExitRequest);

router.get('/:id', protect, adminOrWarden, rules(id), getExitRequest);
router.put('/:id/approve', protect, adminOnly, rules(id, isoDate('exit_date'), body('force').optional().isBoolean()), approveExitRequest);
router.put('/:id/reject', protect, adminOnly, rules(
  id,
  body('reason').trim().isLength({ min: 5, max: 500 }).withMessage('Tell the warden why (5–500 characters).')
), rejectExitRequest);
router.put('/:id/cancel', protect, wardenOnly, rules(id), cancelExitRequest);

module.exports = router;
