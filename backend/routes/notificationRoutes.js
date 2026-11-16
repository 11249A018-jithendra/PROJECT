const express = require('express');
const router = express.Router();
const { getMyNotifications, markRead, markAllRead } = require('../controllers/notificationController');
const { param } = require('express-validator');
const { protect } = require('../middleware/auth');
const { rules } = require('../middleware/validate');

router.get('/', protect, getMyNotifications);
router.put('/read-all', protect, markAllRead);
router.put('/:id/read', protect, rules(param('id').isUUID().withMessage('Invalid notification.')), markRead);

module.exports = router;
