const express = require('express');
const router = express.Router();
const { listHostelNames } = require('../controllers/hostelController');

// Public: hostel names only, used by the student registration form.
router.get('/', listHostelNames);

module.exports = router;
