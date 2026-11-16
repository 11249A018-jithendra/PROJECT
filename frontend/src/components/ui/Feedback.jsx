import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';

// Empty list: soft icon, one line saying what's missing, an optional hint and
// an optional next step (a link `to` or a button `onAction`).
export const EmptyState = ({ icon: Icon = Inbox, title = 'Nothing here yet', message, actionLabel, to, onAction }) => (
  <div className="flex flex-col items-center justify-center text-center py-10 px-4">
    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-3">
      <Icon size={26} className="text-indigo-400" />
    </div>
    <p className="text-sm font-medium text-slate-600">{title}</p>
    {message && <p className="text-xs text-slate-500 mt-1 max-w-xs">{message}</p>}
    {actionLabel && to && (
      <Link to={to} className="mt-4 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition">
        {actionLabel}
      </Link>
    )}
    {actionLabel && onAction && !to && (
      <button type="button" onClick={onAction} className="mt-4 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition">
        {actionLabel}
      </button>
    )}
  </div>
);

// Placeholder rows while a list loads (inside an existing card).
export const SkeletonRows = ({ rows = 4 }) => (
  <div className="divide-y divide-slate-50" role="status" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-5 py-4">
        <div className="w-9 h-9 rounded-full bg-slate-100 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-1/3 bg-slate-100 rounded animate-pulse" />
          <div className="h-2.5 w-2/3 bg-slate-100 rounded animate-pulse" />
        </div>
      </div>
    ))}
  </div>
);

// Placeholder cards while a page of separate cards loads.
export const SkeletonCards = ({ cards = 3 }) => (
  <div className="space-y-3" role="status" aria-label="Loading">
    {Array.from({ length: cards }).map((_, i) => (
      <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
        <div className="h-3.5 w-1/3 bg-slate-100 rounded animate-pulse" />
        <div className="h-2.5 w-3/4 bg-slate-100 rounded animate-pulse" />
        <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-pulse" />
      </div>
    ))}
  </div>
);

// Placeholder table rows (inside an existing <tbody>).
export const SkeletonTableRows = ({ rows = 5, cols = 4 }) =>
  Array.from({ length: rows }).map((_, r) => (
    <tr key={r} className="border-b border-slate-50">
      {Array.from({ length: cols }).map((__, c) => (
        <td key={c} className="px-4 py-3.5">
          <div className={`h-3 bg-slate-100 rounded animate-pulse ${c === 0 ? 'w-32' : 'w-20'}`} />
        </td>
      ))}
    </tr>
  ));
