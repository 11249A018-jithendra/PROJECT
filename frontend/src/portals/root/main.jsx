import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { PageLoader } from '../PortalShell';
import '../../index.css';
import { portalRedirect } from '../../utils/portalRedirect';

// The site's front door (/). Shows the portal chooser, and sends links from
// before the split (/admin, /dashboard, /security/scan, ...) to their new home.
const PortalSelect = lazy(() => import('../../pages/PortalSelect'));

const target = portalRedirect(window.location.pathname.replace(/\/+$/, '') || '/');
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
