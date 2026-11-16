const express = require('express');
const router = express.Router();
const { sendMessage, getHistory, clearHistory, getFaqs } = require('../controllers/chatbotController');
const { protect, authorize } = require('../middleware/auth');

// Hostel Assistant chatbot — signed-in students only. The controller always
// works on the signed-in student's own data.
router.use(protect, authorize('student'));

router.post('/message', sendMessage);
router.get('/history', getHistory);
router.delete('/history', clearHistory);
router.get('/faqs', getFaqs);

module.exports = router;
