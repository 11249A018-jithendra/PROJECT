// Central map of role -> where that role lands after login, and which
// login page to send them (or an unauthenticated visitor) to. Every place
// that needs to know "where does this role live" reads from here instead of
// hardcoding a ternary, so adding a role later is a one-file change.
export const ROLE_HOME = {
  student: '/dashboard',
  admin: '/admin',
  warden: '/warden',
  security: '/security',
};

// Each portal has its own /login (paths are relative to the portal's base,
// e.g. /staff/login).
export const ROLE_LOGIN = {
  student: '/login',
  admin: '/login',
  warden: '/login',
  security: '/login',
};

export const homeFor = (role) => ROLE_HOME[role] || '/login';
export const loginFor = (role) => ROLE_LOGIN[role] || '/login';
