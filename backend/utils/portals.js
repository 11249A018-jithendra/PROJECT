// The four portals and which roles may sign in to each.
//   /student  → students            /staff → admins + wardens
//   /gate     → security            developer console → developer (local only)
const PORTAL_ROLES = {
  student: ['student'],
  staff: ['admin', 'warden'],
  gate: ['security'],
  developer: ['developer'],
};

const PORTALS = Object.keys(PORTAL_ROLES);

// Where a role normally works (used for impersonation and redirects).
const portalForRole = (role) => PORTALS.find((p) => PORTAL_ROLES[p].includes(role)) || null;

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// The developer console only works from the developer's own computer:
//  1. enabled by config (on by default for local development; set
//     DEVELOPER_PORTAL_ENABLED=false — or NODE_ENV=production — on any
//     public server),
//  2. the request comes from this machine (loopback socket address), and
//  3. it did not pass through a proxy (a proxy makes every request look local,
//     so any forwarding header disqualifies it).
const developerAllowed = (req) => {
  const flag = process.env.DEVELOPER_PORTAL_ENABLED;
  const enabled = flag === 'true' || (flag === undefined && process.env.NODE_ENV !== 'production');
  if (!enabled) return false;
  if (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.headers.forwarded) return false;
  return LOOPBACK.has(req.socket?.remoteAddress);
};

module.exports = { PORTAL_ROLES, PORTALS, portalForRole, developerAllowed };
