const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const dev = require('../controllers/developerController');
const { protect, developerOnly } = require('../middleware/auth');
const { rules } = require('../middleware/validate');

// Everything here: a developer account, on the developer's own computer only.
router.use(protect, developerOnly);

const id = param('id').isUUID().withMessage('Invalid id.');

router.get('/me', dev.getMe);
router.get('/overview', dev.getOverview);
router.get('/users', dev.getUsers);
router.post('/users', rules(
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name is required.'),
  body('email').trim().isEmail().withMessage('A valid email is required.'),
  body('role').isIn(dev.ROLES).withMessage('Invalid role.'),
  body('password').isString()
), dev.createUser);
router.patch('/users/:id', rules(
  id,
  body('role').optional().isIn(dev.ROLES).withMessage('Invalid role.'),
  body('email').optional().trim().isEmail().withMessage('Invalid email.'),
  body('is_active').optional().isBoolean()
), dev.updateUser);
router.put('/users/:id/password', rules(id, body('password').isString()), dev.resetPassword);
router.post('/impersonate', rules(body('user_id').isUUID().withMessage('Invalid user.')), dev.impersonate);
router.post('/portal-token', rules(body('portal').isIn(['student', 'staff', 'gate'])), dev.portalToken);
router.get('/audit', dev.getAuditLog);
router.get('/errors', dev.getServerErrors);

module.exports = router;
