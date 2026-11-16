const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { getStaff, createStaff, updateStaff } = require('../controllers/staffController');
const { protect, adminOnly, adminOrWarden } = require('../middleware/auth');
const { rules } = require('../middleware/validate');

const fields = (optional) => [
  (optional ? body('name').optional() : body('name')).trim().isLength({ min: 2, max: 60 }).withMessage('Name is required (2–60 characters).'),
  (optional ? body('trade').optional() : body('trade')).trim().isLength({ min: 2, max: 40 }).withMessage('Trade is required, e.g. Electrician.'),
  body('phone').optional({ values: 'falsy' }).trim().matches(/^[+\d][\d\s-]{6,19}$/).withMessage('Phone number looks invalid.'),
  body('is_active').optional().isBoolean(),
];

router.get('/', protect, adminOrWarden, getStaff);
router.post('/', protect, adminOnly, rules(...fields(false)), createStaff);
router.put('/:id', protect, adminOnly, rules(param('id').isUUID(), ...fields(true)), updateStaff);

module.exports = router;
