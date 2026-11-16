const express = require('express');
const router = express.Router();
const { getCurrentlyOutside, getTodaySummary, getScanHistory } = require('../controllers/outpassController');
const { protect, securityViewAccess } = require('../middleware/auth');

// Read views: useful to Security (their own dashboard), Warden and Admin.
// The only write action (the actual scan) lives at POST /api/outpasses/scan
// and is security-only — kept there since it's conceptually an outpass
// state transition, not a "security resource".
router.get('/currently-outside', protect, securityViewAccess, getCurrentlyOutside);
router.get('/today', protect, securityViewAccess, getTodaySummary);
router.get('/scan-history', protect, securityViewAccess, getScanHistory);

module.exports = router;
