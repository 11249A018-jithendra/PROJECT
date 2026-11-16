const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { registerStudent, loginUser, getMe, changePassword, forgotPassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { rules } = require('../middleware/validate');

// Shape and length limits; the password rules themselves live in the controller.
const text = (field, max, label) =>
  body(field).optional({ values: 'falsy' }).isString().trim().isLength({ max }).withMessage(`${label} is too long (max ${max}).`);

router.post('/register', rules(
  body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Name is required (2–80 characters).'),
  body('email').isString().trim().isEmail().withMessage('A valid email is required.').isLength({ max: 120 }).withMessage('Email is too long.'),
  text('roll_no', 30, 'Registration number'),
  text('room_no', 20, 'Room number'),
  text('course_year', 40, 'Course / year'),
  text('phone', 20, 'Phone number'),
  text('parent_contact', 20, "Parent's phone number"),
  text('home_address', 300, 'Home address'),
  body('hostel_id').optional({ values: 'falsy' }).isUUID().withMessage('Invalid hostel.')
), registerStudent);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.get('/me', protect, getMe);
router.put('/password', protect, rules(
  body('current_password').isString().notEmpty().withMessage('Enter your current password.'),
  body('new_password').isString().notEmpty().withMessage('Enter a new password.')
), changePassword);

module.exports = router;
