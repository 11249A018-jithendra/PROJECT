import { RefreshCw } from 'lucide-react';
import CampusBanner from './CampusBanner';
import { formatTime } from '../../utils/format';

// "Refresh" for a dashboard: icon + label (icon only on small screens, with a
// tooltip), spins and disables while loading. Success and error messages come
// from useDashboardData's toasts.
export const RefreshButton = ({ onRefresh, refreshing, loading, lastUpdated }) => (
  <div className="flex items-center gap-3 flex-shrink-0">
    {lastUpdated && <span className="hidden md:inline text-xs text-slate-500">Updated {formatTime(lastUpdated)}</span>}
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing || loading}
      aria-busy={refreshing}
      aria-label="Refresh dashboard"
      title="Refresh Dashboard"
      className="inline-flex items-center justify-center gap-2 h-11 min-w-11 sm:h-10 px-3 sm:px-4 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium shadow-sm hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-700 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200 disabled:hover:text-slate-700 transition"
    >
      <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
      <span className="hidden sm:inline">Refresh</span>
    </button>
  </div>
);

// Page title on the left, Refresh on the right (wraps under the title on a phone).
const DashboardHeader = ({ title, subtitle, refresh }) => (
  <div className="mb-8">
    <CampusBanner title={title} subtitle={subtitle} action={<RefreshButton onRefresh={refresh.refresh} refreshing={refresh.refreshing} loading={refresh.loading} lastUpdated={refresh.lastUpdated} />} />
    {refresh.error && (
      <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mt-4">
        {refresh.error} Showing the last data loaded.
      </p>
    )}
  </div>
);

export default DashboardHeader;
