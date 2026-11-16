const express = require('express');
const router = express.Router();
const { updateProfile, getStaffContacts } = require('../controllers/studentController');
const { body } = require('express-validator');
const { protect } = require('../middleware/auth');
const { rules } = require('../middleware/validate');

// Photos only, 5 MB max (middleware/upload.js).
const { imageUpload: upload } = require('../middleware/upload');

// Phones are length-checked only, so numbers already saved in any format still save.
const profileRules = rules(
  body('name').optional({ values: 'falsy' }).isString().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters.'),
  body('phone').optional({ values: 'falsy' }).isString().trim().isLength({ min: 5, max: 20 }).withMessage('Phone number must be 5–20 characters.'),
  body('parent_contact').optional({ values: 'falsy' }).isString().trim().isLength({ min: 5, max: 20 }).withMessage("Parent's phone number must be 5–20 characters."),
  body('course_year').optional({ values: 'falsy' }).isString().trim().isLength({ max: 40 }).withMessage('Course / year is too long (max 40).'),
  body('home_address').optional({ values: 'null' }).isString().isLength({ max: 300 }).withMessage('Home address is too long (max 300).')
);

router.get('/contacts', protect, getStaffContacts);
// multer runs first so the multipart text fields exist when validating.
router.put('/profile', protect, upload.single('profile_photo'), profileRules, updateProfile);

module.exports = router;
