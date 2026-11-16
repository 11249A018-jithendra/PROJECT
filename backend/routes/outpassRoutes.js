const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const {
  createOutpass,
  getOutpasses,
  getMyOutpasses,
  getPendingOutpasses,
  approveOutpass,
  rejectOutpass,
  updateOutpass,
  getOutpassQr,
  scanQr,
  getOverdueOutpasses,
  gateLookup,
  manualGateEntry,
  verifyGateToken,
  confirmGateToken,
} = require('../controllers/outpassController');
const { protect, adminOrWarden, securityViewAccess, authorize } = require('../middleware/auth');
const { rules } = require('../middleware/validate');

const createRules = rules(
  body('reason').trim().notEmpty().withMessage('Reason is required.').isLength({ max: 300 }).withMessage('Reason is too long (max 300).'),
  body('destination').trim().notEmpty().withMessage('Destination is required.').isLength({ max: 200 }).withMessage('Destination is too long (max 200).'),
  body('leave_datetime').isISO8601().withMessage('Leave date/time is invalid.'),
  body('return_datetime').isISO8601().withMessage('Return date/time is invalid.'),
  body('pass_type').optional().isIn(['Outing', 'Home']).withMessage('Outpass type must be Outing or Home.'),
  body('student_id').optional({ values: 'falsy' }).isUUID().withMessage('Invalid student.')
);

const idRule = rules(param('id').isUUID().withMessage('Invalid outpass.'));

const manualRules = rules(
  param('id').isUUID().withMessage('Invalid outpass.'),
  body('action').isIn(['EXIT', 'RETURN']).withMessage('Action must be EXIT or RETURN.'),
  body('reason').trim().isLength({ min: 5, max: 300 }).withMessage('Give a reason for the manual entry (5–300 characters).')
);

router.get('/', protect, getOutpasses);
router.post('/', protect, createRules, createOutpass);

router.get('/my', protect, getMyOutpasses);
router.get('/pending', protect, adminOrWarden, getPendingOutpasses);
router.get('/overdue', protect, securityViewAccess, getOverdueOutpasses);
router.get('/gate-lookup', protect, securityViewAccess, gateLookup);

// Scanning marks a student out/in at the gate: security (admin may override).
router.post('/scan', protect, authorize('security', 'admin'), scanQr);

// Manual / Type Token: the 8-character token under the QR, typed by the guard.
// The format and every rule are checked in the controller (never trusted from the page).
router.post('/token/verify', protect, authorize('security', 'admin'), verifyGateToken);
router.post('/token/confirm', protect, authorize('security', 'admin'), confirmGateToken);

router.get('/:id/qr', protect, idRule, getOutpassQr);
router.put('/:id/approve', protect, adminOrWarden, idRule, approveOutpass);
router.put('/:id/reject', protect, adminOrWarden, idRule, rejectOutpass);
// Manual (no-QR) gate entries: the guard on duty, or an admin.
router.post('/:id/manual', protect, authorize('security', 'admin'), manualRules, manualGateEntry);
router.put('/:id', protect, adminOrWarden, idRule, updateOutpass);

module.exports = router;
