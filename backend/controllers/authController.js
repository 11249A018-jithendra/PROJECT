const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../supabase');
const { hasHostelTracking } = require('../utils/schema');
const { passwordProblem, hashPassword } = require('../utils/password');
const { PORTAL_ROLES, PORTALS, portalForRole, developerAllowed } = require('../utils/portals');
const limiter = require('../utils/loginLimiter');
const { notifyUsers } = require('../utils/notify');

const PORTAL_NAMES = { student: 'Student portal', staff: 'Staff portal (admin & warden)', gate: 'Gate portal (security)', developer: 'Developer console' };

// `portal` (when given) locks the token to that portal — see middleware/auth.js.
// "Remember me" sign-ins last 30 days; others 12 hours.
const generateToken = (id, portal = null, remember = true) => {
  const claims = { id };
  if (portal) claims.portal = portal;
  if (remember) claims.rem = true;
  return jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: remember ? '30d' : '12h' });
};

// Case-insensitive exact match for ilike (escape its wildcards).
const likeExact = (v) => String(v).replace(/[\\%_]/g, (c) => `\\${c}`);

// @desc    Register a student
// @route   POST /api/auth/register
// @access  Public
const registerStudent = async (req, res) => {
  try {
    const { name, password, room_no, course_year, phone, parent_contact, home_address, hostel_id } = req.body;
    // Stored in lower case so sign-in never depends on how it was typed.
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email.includes('@') || !name) return res.status(400).json({ message: 'Name and a valid email are required.' });
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ message: problem });
    const roll_no = typeof req.body.roll_no === 'string' ? req.body.roll_no.trim() : req.body.roll_no;

    // Check if user already exists
    const { data: existing } = await supabase
      .from('users')
      .select('_id')
      .ilike('email', likeExact(email))
      .limit(1)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Registration numbers are unique (also enforced by a database index).
    if (roll_no) {
      const { data: sameRoll } = await supabase
        .from('users')
        .select('_id')
        .eq('role', 'student')
        .ilike('roll_no', likeExact(roll_no))
        .limit(1);
      if (sameRoll?.length) {
        return res.status(400).json({ message: 'This registration number is already registered. Contact the hostel office if this is your number.' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        role: 'student',
        name,
        email,
        password: hashedPassword,
        roll_no,
        room_no,
        course_year,
        phone,
        parent_contact,
        // Optional fields from hostel_tracking.sql — only written once migrated.
        ...((await hasHostelTracking()) ? { home_address: home_address || null, hostel_id: hostel_id || null } : {}),
      })
      .select('_id, name, email, role, roll_no, room_no, course_year, phone, parent_contact')
      .single();

    if (error) {
      // Lost a race with another registration using the same number/email.
      if (error.code === '23505') {
        return res.status(400).json({ message: 'This email or registration number is already registered.' });
      }
      throw error;
    }

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      roll_no: user.roll_no,
      room_no: user.room_no,
      course_year: user.course_year,
      phone: user.phone,
      parent_contact: user.parent_contact,
      token: generateToken(user._id, 'student'),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const portal = req.body.portal || null;
    if (portal && !PORTALS.includes(portal)) {
      return res.status(400).json({ message: 'Unknown portal.' });
    }

    // Sign in with an email, or (students) a roll number. Both are matched
    // ignoring case and stray spaces.
    const identifier = String(email || '').trim();
    const remember = req.body.remember !== false;

    const wait = limiter.blockedFor(req, identifier);
    if (wait) return res.status(429).json({ message: limiter.tooManyMessage(wait) });
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .ilike(identifier.includes('@') ? 'email' : 'roll_no', likeExact(identifier))
      .single();

    const isMatch = !error && user?.password ? await bcrypt.compare(password || '', user.password) : false;
    if (!isMatch) {
      limiter.recordFailure(req, identifier);
      const left = limiter.blockedFor(req, identifier);
      return res.status(left ? 429 : 401).json({ message: left ? limiter.tooManyMessage(left) : 'Invalid credentials' });
    }
    limiter.recordSuccess(req, identifier);
    // Checked after the password so this can't be used to probe which emails exist.
    if (user.is_active === false) {
      return res.status(403).json({ message: 'Your account has been deactivated. Contact the administrator.' });
    }
    // Each portal only accepts its own roles (checked after the password, so
    // this can't be used to discover which emails exist).
    if (portal && !PORTAL_ROLES[portal].includes(user.role)) {
      const home = portalForRole(user.role);
      return res.status(403).json({
        message: home && home !== 'developer'
          ? `This account can't sign in here. Please use the ${PORTAL_NAMES[home]}.`
          : "This account can't sign in here.",
        portal: home !== 'developer' ? home : undefined,
      });
    }
    // Staff portal: the person picks Admin or Warden; say plainly if it's the other one.
    const asRole = req.body.role;
    if (portal === 'staff' && ['admin', 'warden'].includes(asRole) && user.role !== asRole) {
      const label = { admin: 'Admin', warden: 'Warden' }[user.role];
      return res.status(403).json({ message: `This is a ${label} account. Choose "${label}" above and sign in again.`, role: user.role });
    }
    if (user.role === 'developer' && (portal !== 'developer' || !developerAllowed(req))) {
      return res.status(403).json({ message: 'Developer accounts can only sign in to the Developer console on the developer’s own computer.' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      roll_no: user.roll_no,
      room_no: user.room_no,
      course_year: user.course_year,
      phone: user.phone,
      parent_contact: user.parent_contact,
      hostel_id: user.hostel_id ?? null,
      home_address: user.home_address ?? null,
      portal,
      token: generateToken(user._id, portal, remember),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Change your own password (any role). Signs out every other device;
//          returns a fresh token for this one.
// @route   PUT /api/auth/password   body: { current_password, new_password }
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    const { data: user } = await supabase.from('users').select('_id, password').eq('_id', req.user._id).single();
    if (!user || !(await bcrypt.compare(current_password || '', user.password))) {
      return res.status(400).json({ message: 'Your current password is incorrect.' });
    }
    const problem = passwordProblem(new_password);
    if (problem) return res.status(400).json({ message: problem });
    if (await bcrypt.compare(new_password, user.password)) {
      return res.status(400).json({ message: 'Choose a password different from your current one.' });
    }

    const changedAt = new Date().toISOString();
    const { error } = await supabase
      .from('users')
      .update({ password: await hashPassword(new_password), password_changed_at: changedAt, updated_at: changedAt })
      .eq('_id', user._id);
    if (error) throw error;

    // Issued after password_changed_at, so this token stays valid while older ones don't.
    // Keep the same portal lock as the session that made the change.
    res.json({ message: 'Password changed. You have been signed out on other devices.', token: generateToken(user._id, req.tokenPortal || null, req.tokenRemember) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    "Forgot password?" on the login page. There is no email service, so
//          this tells the people who can reset it (admins; for a student
//          also their hostel's warden) via an in-app notification.
//          Always answers the same way, so it can't reveal which accounts exist.
// @route   POST /api/auth/forgot-password   body: { identifier }
// @access  Public (rate limited)
const forgotPassword = async (req, res) => {
  const reply = () => res.json({ message: 'If that account exists, the hostel office has been told. They will reset your password and give you the new one.' });
  try {
    const identifier = String(req.body.identifier || '').trim();
    if (!identifier) return res.status(400).json({ message: 'Enter your email or roll number.' });
    if (limiter.forgotBlocked(req, identifier)) {
      return res.status(429).json({ message: 'Too many requests. Please contact the hostel office directly.' });
    }
    limiter.recordForgot(req, identifier);

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .ilike(identifier.includes('@') ? 'email' : 'roll_no', likeExact(identifier))
      .limit(1)
      .maybeSingle();
    // Developer accounts are reset with scripts/create-developer.js, never via staff.
    if (!user || user.is_active === false || user.role === 'developer') return reply();

    let recipients = [];
    const { data: admins } = await supabase.from('users').select('_id').eq('role', 'admin').neq('is_active', false);
    recipients = (admins || []).map((a) => a._id).filter((id) => id !== user._id);
    if (user.role === 'student' && user.hostel_id) {
      const { data: wardens } = await supabase.from('users').select('_id').eq('role', 'warden').eq('hostel_id', user.hostel_id).neq('is_active', false);
      recipients.push(...(wardens || []).map((w) => w._id));
    }
    const who = user.role === 'student' && user.roll_no ? `${user.name} (student, ${user.roll_no})` : `${user.name} (${user.role}, ${user.email})`;
    await notifyUsers(recipients, {
      type: 'PASSWORD_RESET',
      title: 'Password reset requested',
      message: `${who} forgot their password. Please confirm it is really them, then reset it and tell them the new one.`,
      link: user.role === 'student' ? '/admin/students' : '/admin/wardens',
    });
    reply();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerStudent, loginUser, getMe, changePassword, forgotPassword, generateToken };
