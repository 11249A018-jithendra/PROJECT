import { StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import PrivateRoute from '../components/PrivateRoute';
import { Toaster } from '../components/ui/Toast';
import { ConfirmHost } from '../components/ui/ConfirmDialog';
import '../index.css';

export const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50" role="status" aria-label="Loading">
    <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

// role: one role or a list of roles allowed on the page.
export const guarded = (role, element) => <PrivateRoute role={role}>{element}</PrivateRoute>;

// One portal = one router mounted under its own base path (e.g. /staff). Page
// paths inside stay the same as before (/admin/students is served at
// /staff/admin/students), so pages and their links need no changes.
// Anything unknown goes to the portal's home.
export const PortalApp = ({ portal, home, children }) => (
  <BrowserRouter basename={`/${portal}`}>
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {children}
          <Route path="/" element={<Navigate to={home} replace />} />
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </Suspense>
      <Toaster />
      <ConfirmHost />
    </AuthProvider>
  </BrowserRouter>
);

export const mount = (app) => {
  createRoot(document.getElementById('root')).render(<StrictMode>{app}</StrictMode>);

  // Installable app + offline shell. Production builds only: in development
  // a service worker would cache files and fight Vite's hot reload.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed:', err));
    });
  }
};
