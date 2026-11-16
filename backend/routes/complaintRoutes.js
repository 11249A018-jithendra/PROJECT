const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const {
  createComplaint, getComplaints, updateComplaint, assignStaff, cancelComplaint, reopenComplaint, rateComplaint,
} = require('../controllers/complaintController');
const { protect, adminOrWarden, authorize } = require('../middleware/auth');
const { rules } = require('../middleware/validate');

// Photos only, 5 MB max (middleware/upload.js).
const { imageUpload: upload } = require('../middleware/upload');

const CATEGORIES = ['electrical', 'plumbing', 'cleanliness', 'food/mess', 'internet', 'other'];
const idRule = param('id').isUUID().withMessage('Invalid complaint.');

const createRules = rules(
  body('category').isIn(CATEGORIES).withMessage(`Category must be one of: ${CATEGORIES.join(', ')}`),
  body('title').optional().trim().isLength({ max: 80 }).withMessage('Title is too long (max 80).'),
  body('description').trim().notEmpty().withMessage('Please describe the issue.').isLength({ max: 2000 }).withMessage('Description is too long (max 2000).')
);

router.get('/', protect, getComplaints);
// multer runs first so the multipart text fields exist when validating.
router.post('/', protect, authorize('student'), upload.single('photo'), createRules, createComplaint);

router.put('/:id/assign', protect, adminOrWarden, rules(idRule, body('staff_id').optional({ values: 'null' }).isUUID().withMessage('Invalid staff member.')), assignStaff);
router.put('/:id/cancel', protect, authorize('student'), rules(idRule, body('reason').optional().trim().isLength({ max: 300 })), cancelComplaint);
router.put('/:id/reopen', protect, authorize('student'), rules(idRule, body('reason').trim().isLength({ min: 5, max: 500 }).withMessage('Tell us what is still wrong (5–500 characters).')), reopenComplaint);
router.put('/:id/rate', protect, authorize('student'), rules(
  idRule,
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1 to 5 stars.'),
  body('feedback').optional().trim().isLength({ max: 500 }).withMessage('Feedback is too long (max 500).')
), rateComplaint);
router.put('/:id', protect, adminOrWarden, rules(idRule, body('admin_remarks').optional().isLength({ max: 1000 })), updateComplaint);

module.exports = router;
