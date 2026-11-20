import { lazy, Suspense } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';
import { Building2, CalendarDays } from 'lucide-react';

// Students get the floating Hostel Assistant chat on every page.
const HostelAssistant = lazy(() => import('./HostelAssistant'));

const Layout = ({ children }) => {
  const { user } = useAuth();
  return (
    <div className="vs-app flex min-h-screen" data-role={user?.real_role || user?.role}>
      {/* First Tab stop: jump past the menu straight to the page. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[90] focus:bg-white focus:text-indigo-700 focus:font-medium focus:px-4 focus:py-2.5 focus:rounded-xl focus:shadow-lg"
      >
        Skip to main content
      </a>
      <Sidebar />
      <main id="main-content" tabIndex={-1} className="flex-1 lg:ml-64 min-h-screen min-w-0 focus:outline-none">
        <header className="vs-topbar">
          <div className="flex items-center gap-2 min-w-0"><Building2 size={17} aria-hidden="true" /><span>HostelMS</span><span className="vs-topbar-divider">/</span><span className="capitalize truncate">{user?.real_role || user?.role} workspace</span></div>
          <span className="vs-workspace-label"><CalendarDays size={15} aria-hidden="true" /><span>Campus life, connected</span></span>
        </header>
        <div className="vs-page p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
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
