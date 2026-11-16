const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { getVisitors, checkInVisitor, checkOutVisitor, getVisitorSummary } = require('../controllers/visitorController');
const { protect, authorize, securityViewAccess } = require('../middleware/auth');
const { rules } = require('../middleware/validate');

const gateStaff = authorize('security', 'admin');

const checkInRules = rules(
  body('visitor_name').trim().isLength({ min: 2, max: 80 }).withMessage("Visitor's name is required."),
  body('phone').optional({ values: 'falsy' }).trim().matches(/^[+\d][\d\s-]{6,19}$/).withMessage('Phone number looks invalid.'),
  body('relation').optional().trim().isLength({ max: 40 }),
  body('purpose').optional().trim().isLength({ max: 200 }),
  body('id_proof').optional().trim().isLength({ max: 60 }),
  body('student_id').optional({ values: 'falsy' }).isUUID().withMessage('Invalid student.')
);

router.get('/', protect, securityViewAccess, getVisitors);
router.get('/summary', protect, securityViewAccess, getVisitorSummary);
router.post('/', protect, gateStaff, checkInRules, checkInVisitor);
router.put('/:id/checkout', protect, gateStaff, rules(param('id').isUUID()), checkOutVisitor);

module.exports = router;
