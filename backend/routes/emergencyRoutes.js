const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const {
  getContacts, createContact, updateContact, deleteContact, raiseSos, getSosAlerts, acknowledgeSos, resolveSos,
} = require('../controllers/emergencyController');
const { protect, adminOrWarden, authorize } = require('../middleware/auth');
const { rules } = require('../middleware/validate');

const CATEGORIES = ['Warden', 'Security', 'Driver', 'Ambulance', 'Medical', 'Other'];
const id = param('id').isUUID().withMessage('Invalid id.');
const contactFields = (optional) => [
  (optional ? body('name').optional() : body('name')).trim().isLength({ min: 2, max: 80 }).withMessage('Name is required (2–80 characters).'),
  (optional ? body('category').optional() : body('category')).isIn(CATEGORIES).withMessage(`Type must be one of: ${CATEGORIES.join(', ')}`),
  (optional ? body('phone').optional() : body('phone')).trim().matches(/^[+0-9][0-9 -]{5,19}$/).withMessage('Enter a valid phone number.'),
  body('notes').optional().trim().isLength({ max: 200 }).withMessage('Notes are too long (max 200).'),
  body('hostel_id').optional({ values: 'falsy' }).isUUID().withMessage('Invalid hostel.'),
  body('is_active').optional().isBoolean(),
];
const staff = authorize('warden', 'security', 'admin');

// Contacts: everyone reads; only wardens and admins manage.
router.get('/contacts', protect, getContacts);
router.post('/contacts', protect, adminOrWarden, rules(...contactFields(false)), createContact);
router.put('/contacts/:id', protect, adminOrWarden, rules(id, ...contactFields(true)), updateContact);
router.delete('/contacts/:id', protect, adminOrWarden, rules(id), deleteContact);

// SOS: students raise; warden / security / admin respond.
router.post('/sos', protect, authorize('student'), rules(body('message').optional().trim().isLength({ max: 300 })), raiseSos);
router.get('/sos', protect, rules(query('status').optional().isIn(['Active', 'Open', 'Acknowledged', 'Resolved', 'All'])), getSosAlerts);
router.put('/sos/:id/acknowledge', protect, staff, rules(id), acknowledgeSos);
router.put('/sos/:id/resolve', protect, staff, rules(id, body('note').optional().trim().isLength({ max: 300 })), resolveSos);

module.exports = router;
