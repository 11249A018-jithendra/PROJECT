import { lazy, Suspense } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

// Students get the floating Hostel Assistant chat on every page.
const HostelAssistant = lazy(() => import('./HostelAssistant'));

const Layout = ({ children }) => {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* First Tab stop: jump past the menu straight to the page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[90] focus:bg-white focus:text-indigo-700 focus:font-medium focus:px-4 focus:py-2.5 focus:rounded-xl focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Sidebar />
      <main id="main-content" tabIndex={-1} className="flex-1 lg:ml-64 min-h-screen min-w-0 focus:outline-none">
        {/* Extra top space on phones so the floating menu button never covers the page title. */}
        <div className="p-6 pt-20 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      {user?.role === 'student' && (
        <Suspense fallback={null}>
          <HostelAssistant />
        </Suspense>
      )}
    </div>
  );
};

export default Layout;
