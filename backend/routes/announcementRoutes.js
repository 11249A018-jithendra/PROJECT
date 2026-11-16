const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { getAnnouncements, createAnnouncement, deleteAnnouncement } = require('../controllers/announcementController');
const { protect, adminOrWarden } = require('../middleware/auth');
const { rules } = require('../middleware/validate');
const { imageUpload } = require('../middleware/upload');

const createRules = rules(
  body('title').trim().isLength({ min: 3, max: 120 }).withMessage('Title is required (3–120 characters).'),
  body('message').trim().isLength({ min: 3, max: 3000 }).withMessage('Message is required (max 3000 characters).'),
  body('priority').optional().isIn(['Normal', 'Important', 'Urgent']).withMessage('Priority must be Normal, Important or Urgent.'),
  body('hostel_id').optional({ values: 'falsy' }).isUUID().withMessage('Invalid hostel.'),
  body('expires_at').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid expiry date.')
);

router.route('/')
  .get(protect, getAnnouncements)
  // multipart (optional 'photo') — multer runs first so text fields are parsed for validation
  .post(protect, adminOrWarden, imageUpload.single('photo'), createRules, createAnnouncement);

router.route('/:id')
  .delete(protect, adminOrWarden, rules(param('id').isUUID()), deleteAnnouncement);

module.exports = router;
