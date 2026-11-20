// Only legacy links redirect. The front door shows all role choices.
const STUDENT_PATHS = ['/login', '/register', '/dashboard', '/profile', '/complaints', '/outpasses', '/announcements', '/help'];

export const portalRedirect = path => {
  const under = base => path === base || path.startsWith(`${base}/`);
  if (path === '' || path === '/' || path === '/select-role' || path === '/portals') return null;
  if (path === '/admin/login' || path === '/warden/login') return '/staff/login';
  if (path === '/security/login') return '/gate/login';
  if (under('/admin') || under('/warden') || under('/emergency')) return `/staff${path}`;
  if (under('/security')) return `/gate${path}`;
  if (STUDENT_PATHS.some(under)) return `/student${path}`;
  return '/student/login';
};
