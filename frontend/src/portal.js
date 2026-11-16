// The site is split into separate portals that live under their own path:
//   /student   students
//   /staff     admins + wardens
//   /gate      security
//   /developer developer console (local development only — never built for the public site)
// Each portal keeps its own sign-in, so a student and a warden can use the
// same browser without overwriting each other.
export const PORTALS = {
  student: { label: 'Student portal', roles: ['student'] },
  staff: { label: 'Staff portal', roles: ['admin', 'warden'] },
  gate: { label: 'Gate portal', roles: ['security'] },
  developer: { label: 'Developer console', roles: ['developer', 'admin'] },
};

const ROLE_PORTAL = { student: 'student', admin: 'staff', warden: 'staff', security: 'gate', developer: 'developer' };

// Which portal the current page belongs to (from the first path segment).
export const currentPortal = () => {
  const seg = window.location.pathname.split('/')[1];
  return PORTALS[seg] ? seg : null;
};

export const portalForRole = (role) => ROLE_PORTAL[role] || null;

// Where a portal's sign-in token is stored in this browser.
export const tokenKey = (portal = currentPortal()) => (portal ? `hms_token_${portal}` : 'token');

// "Remember me" keeps the sign-in in localStorage (survives closing the
// browser); otherwise it lives in sessionStorage and ends with the tab.
export const getToken = () => {
  try { return localStorage.getItem(tokenKey()) || sessionStorage.getItem(tokenKey()); } catch { return null; }
};
// remember: true/false, or leave it out to keep wherever the current sign-in lives.
export const setToken = (token, portal, remember) => {
  const key = tokenKey(portal);
  try {
    const persist = remember ?? !sessionStorage.getItem(key);
    (persist ? localStorage : sessionStorage).setItem(key, token);
    (persist ? sessionStorage : localStorage).removeItem(key);
  } catch { /* storage blocked */ }
};
export const clearToken = () => {
  try {
    localStorage.removeItem(tokenKey());
    sessionStorage.removeItem(tokenKey());
  } catch { /* storage blocked */ }
};

// Full URL path of a portal page, for links that leave the current portal.
export const portalUrl = (portal, path = '/') => `/${portal}${path === '/' ? '/' : path}`;
