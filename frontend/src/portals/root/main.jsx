import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { PageLoader } from '../PortalShell';
import '../../index.css';

// The site's front door (/). Shows the portal chooser, and sends links from
// before the split (/admin, /dashboard, /security/scan, ...) to their new home.
const PortalSelect = lazy(() => import('../../pages/PortalSelect'));

const STUDENT_PATHS = ['/login', '/register', '/dashboard', '/profile', '/complaints', '/outpasses', '/announcements', '/help'];

const newLocation = (path) => {
  const under = (base) => path === base || path.startsWith(`${base}/`);
  if (path === '' || path === '/') return '/student/login';
  if (path === '/admin/login' || path === '/warden/login') return '/staff/login';
  if (path === '/security/login') return '/gate/login';
  if (under('/admin') || under('/warden') || under('/emergency')) return `/staff${path}`;
  if (under('/security')) return `/gate${path}`;
  if (STUDENT_PATHS.some(under)) return `/student${path}`;
  if (path === '/select-role' || path === '/portals') return null;
  return '/student/login';
};

const target = newLocation(window.location.pathname.replace(/\/+$/, '') || '/');
if (target) {
  window.location.replace(target + window.location.search + window.location.hash);
} else {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Suspense fallback={<PageLoader />}>
        <PortalSelect />
      </Suspense>
    </StrictMode>
  );
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed:', err));
    });
  }
}
