import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '../components/ui/Toast';

// One loader for every dashboard: first load, the Refresh button and optional
// automatic refresh all go through the same `run`, so they can never overlap
// (one request set at a time) and none of them duplicates the page's API calls.
//
//   const refresh = useDashboardData(async ({ initial }) => { …fetch + setState… }, { intervalMs: 30000 });
//   refresh.run({ manual: true })  → fetch now, then toast "Dashboard refreshed successfully."
//
// `load` must throw when its data could not be fetched (a failed refresh keeps
// the data already on screen) and only set state once everything arrived.

// True while the person is in the middle of something: a dialog is open, or
// they have text typed into a field they are still focused on. Automatic
// refresh waits; the Refresh button always works.
const userIsBusy = () => {
  if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return true;
  const el = document.activeElement;
  if (!el || el === document.body) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    const nonText = ['checkbox', 'radio', 'button', 'submit', 'file', 'range'];
    return !nonText.includes(el.type) && String(el.value || '').length > 0;
  }
  return false;
};

const friendlyError = (err) => {
  if (!err.response) return 'Could not reach the server. Check your connection and try again.';
  if (err.response.status >= 500) return 'The server had a problem loading the dashboard. Please try again in a moment.';
  return err.response.data?.message || 'Could not refresh the dashboard. Please try again.';
};

const useDashboardData = (load, { intervalMs = 0 } = {}) => {
  const [loading, setLoading] = useState(true); // first load only
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadRef = useRef(load);
  const busy = useRef(false);
  const mounted = useRef(true);
  const lastAt = useRef(0);

  // Always call the newest `load`, so changing filters or props never needs a new timer.
  useEffect(() => {
    loadRef.current = load;
  });

  const run = useCallback(async ({ manual = false, initial = false } = {}) => {
    if (busy.current) return false; // one refresh at a time
    busy.current = true;
    if (!initial && mounted.current) setRefreshing(true);
    try {
      await loadRef.current({ initial });
      if (!mounted.current) return true;
      lastAt.current = Date.now();
      setLastUpdated(new Date(lastAt.current));
      setError('');
      if (manual) toast.success('Dashboard refreshed successfully.');
      return true;
    } catch (err) {
      if (mounted.current) {
        const message = friendlyError(err);
        setError(message);
        if (manual) toast.error(message);
      }
      return false;
    } finally {
      busy.current = false;
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    run({ initial: true });
    return () => {
      mounted.current = false;
    };
  }, [run]);

  // Optional automatic refresh: only while the tab is visible and online, and
  // never while the person is typing or a dialog is open.
  useEffect(() => {
    if (!intervalMs) return undefined;
    const tick = () => {
      if (document.hidden || !navigator.onLine || userIsBusy()) return;
      run();
    };
    const timer = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (!document.hidden && lastAt.current && Date.now() - lastAt.current > intervalMs) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, run]);

  const refresh = useCallback(() => run({ manual: true }), [run]);

  return { loading, refreshing, error, lastUpdated, refresh };
};

export default useDashboardData;
