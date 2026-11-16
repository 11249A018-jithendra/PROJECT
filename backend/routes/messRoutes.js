const express = require('express');
const router = express.Router();
const { getMenu, updateMenu } = require('../controllers/messController');
const { protect, adminOnly } = require('../middleware/auth');

// Anyone logged in can read the menu
router.get('/menu', protect, getMenu);

// Only admin can edit
router.put('/menu', protect, adminOnly, updateMenu);

module.exports = router;
