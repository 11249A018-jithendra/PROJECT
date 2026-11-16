const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

// Refuse to start without the settings the server cannot work without.
for (const key of ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']) {
  if (!process.env[key]) {
    console.error(`Missing ${key}. Set it in backend/.env (see .env.example) or in the host's environment.`);
    process.exit(1);
  }
}

const app = express();
// Behind a hosting proxy (Render, Nginx, …) set TRUST_PROXY=1 so req.ip is the
// visitor's address — the login limiter counts wrong passwords per address.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Only our own portals may call the API from a browser (see utils/corsOptions.js).
app.use(cors(require('./utils/corsOptions').corsOptions));
app.use(express.json());

// Never send raw database/server errors to users (logged server-side instead).
const { sanitizeServerErrors, errorHandler } = require('./middleware/safeErrors');
app.use(sanitizeServerErrors);

// Uploaded photos: an old local copy if this machine has one, otherwise a
// short-lived signed link to Supabase Storage (utils/fileStore.js).
const uploadsDir = path.join(__dirname, 'uploads');
const { signedUrl } = require('./utils/fileStore');
app.get('/uploads/:name', async (req, res, next) => {
  const { name } = req.params;
  if (!/^[\w.-]+$/.test(name)) return res.status(404).end();
  const local = path.join(uploadsDir, name);
  if (fs.existsSync(local)) return res.sendFile(local);
  try {
    const url = await signedUrl(name);
    if (!url) return res.status(404).end();
    res.set('Cache-Control', 'private, max-age=300');
    res.redirect(302, url);
  } catch (err) {
    next(err);
  }
});

// Test Supabase connection
const supabase = require('./supabase');
supabase.from('users').select('count', { count: 'exact', head: true })
  .then(({ error }) => {
    if (error) {
      console.error('Supabase connection error:', error.message);
    } else {
      console.log('Connected to Supabase');
    }
  });

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/complaints', require('./routes/complaintRoutes'));
app.use('/api/outpasses', require('./routes/outpassRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/warden', require('./routes/wardenRoutes'));
app.use('/api/announcements', require('./routes/announcementRoutes'));
app.use('/api/security', require('./routes/securityRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/hostels', require('./routes/hostelRoutes'));
app.use('/api/staff', require('./routes/staffRoutes'));
app.use('/api/visitors', require('./routes/visitorRoutes'));
app.use('/api/exit-requests', require('./routes/exitRequestRoutes'));
app.use('/api/mess', require('./routes/messRoutes'));
app.use('/api/emergency', require('./routes/emergencyRoutes'));
// Hostel Assistant chatbot (students) — AI with a built-in FAQ fallback.
app.use('/api/chatbot', require('./routes/chatbotRoutes'));
// Developer console — usable only from the developer's own computer (utils/portals.js).
app.use('/api/developer', require('./routes/developerRoutes'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', db: 'Supabase' }));

// Must stay after all routes.
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Time-based rules: complaint escalation + admin reminders, overdue
  // outpass alerts, auto-absent for students who have gone home.
  require('./utils/scheduler').startScheduler();
});
