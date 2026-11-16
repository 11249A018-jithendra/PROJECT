import { ChevronLeft, ChevronRight } from 'lucide-react';

// Previous / next pager for the API's `{ page, pages, total }` responses.
const Pager = ({ page, pages, total, onChange, label = 'results' }) => {
  if (!total) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
      <span>{total} {label} · page {page} of {pages}</span>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          aria-label="Previous page"
        >
          <ChevronLeft size={15} /> Prev
        </button>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= pages}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          aria-label="Next page"
        >
          Next <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default Pager;
