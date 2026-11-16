const jwt = require('jsonwebtoken');
const supabase = require('../supabase');
const { withoutPassword } = require('../utils/password');
const { PORTAL_ROLES, developerAllowed } = require('../utils/portals');

const DEV_ONLY_LOCAL = 'Developer access works only on the developer’s own computer.';

// Every change made with developer powers (directly, or while impersonating
// someone) is written to developer_audit_log once the response is sent.
const auditDeveloper = (req, res, developerId, actingAsId) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  res.on('finish', () => {
    supabase
      .from('developer_audit_log')
      .insert({
        developer_id: developerId,
        acting_as_id: actingAsId || null,
        action: `${req.method} ${req.originalUrl.split('?')[0]}`,
        target: req.params?.id || req.params?.studentId || null,
        status: res.statusCode,
        ip: req.socket?.remoteAddress || null,
      })
      .then(({ error }) => error && console.error('[audit] could not log developer action:', error.message));
  });
};

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // select('*') so optional columns (is_active, hostel_id, …) are picked up
      // when the hostel_tracking migration has run, without breaking before it.
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('_id', decoded.id)
        .single();

      if (error || !user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }
      if (user.is_active === false) {
        return res.status(401).json({ message: 'Account deactivated. Contact the administrator.' });
      }
      // A password reset invalidates every token issued before it.
      if (user.password_changed_at && decoded.iat < Math.floor(new Date(user.password_changed_at).getTime() / 1000)) {
        return res.status(401).json({ message: 'Session expired after a password change. Please log in again.' });
      }

      // Portal lock: a token minted for one portal only works while the
      // user's role still belongs to it (developers may enter any portal).
      if (decoded.portal && user.role !== 'developer' && !(PORTAL_ROLES[decoded.portal] || []).includes(user.role)) {
        return res.status(401).json({ message: 'This sign-in is not valid for this portal. Please log in again.' });
      }

      // Developer powers and impersonation only from the developer's machine.
      const impersonatorId = decoded.imp_by || null;
      if (user.role === 'developer' || impersonatorId) {
        if (!developerAllowed(req)) return res.status(401).json({ message: DEV_ONLY_LOCAL });
      }
      if (impersonatorId) {
        const { data: dev } = await supabase.from('users').select('_id, role, is_active').eq('_id', impersonatorId).maybeSingle();
        if (!dev || dev.role !== 'developer' || dev.is_active === false) {
          return res.status(401).json({ message: 'Impersonation session is no longer valid.' });
        }
      }

      req.user = withoutPassword(user);
      req.tokenPortal = decoded.portal || null;
      req.tokenRemember = Boolean(decoded.rem);
      if (user.role === 'developer') {
        // Full control: a developer passes every admin check in the API.
        req.user = { ...req.user, role: 'admin', real_role: 'developer', is_developer: true };
        auditDeveloper(req, res, user._id, null);
      } else if (impersonatorId) {
        req.user = { ...req.user, impersonated_by: impersonatorId };
        auditDeveloper(req, res, impersonatorId, user._id);
      }
      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Generic role guard: authorize('warden', 'admin') only lets those roles through.
const authorize = (...roles) => (req, res, next) => {
  if (req.user && roles.includes(req.user.role)) {
    return next();
  }
  res.status(403).json({ message: `Not authorized. Requires role: ${roles.join(' or ')}` });
};

// Developer console endpoints: a real developer account, on the local machine.
const developerOnly = (req, res, next) => {
  if (req.user?.is_developer && developerAllowed(req)) return next();
  res.status(403).json({ message: 'Developer console only.' });
};

// Named guards used across the app. adminOnly is kept exactly as before so
// every route that already depends on it keeps working unchanged.
const adminOnly = authorize('admin');
const wardenOnly = authorize('warden');
const securityOnly = authorize('security');
// Outpass approval: Warden is the primary owner, Admin keeps override access
// so the existing admin approve/reject screen doesn't lose functionality.
const adminOrWarden = authorize('admin', 'warden');
// Security-dashboard read views (currently-outside, today, scan history) are
// useful to Warden and Admin too, not just Security.
const securityViewAccess = authorize('admin', 'warden', 'security');

module.exports = { protect, adminOnly, wardenOnly, securityOnly, adminOrWarden, securityViewAccess, authorize, developerOnly };
