// A simple chart in the app's card style: one bar split into coloured parts,
// with a legend showing each count and share. No chart library needed.
//   <BreakdownBar title="Today's attendance" items={[{ label: 'Present', value: 40, color: 'bg-green-500' }, …]} />
const BreakdownBar = ({ title, subtitle, items, loading, footer }) => {
  const total = items.reduce((sum, i) => sum + (i.value || 0), 0);
  const pct = (v) => (total ? Math.round((v / total) * 100) : 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-baseline justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {!loading && <span className="text-sm text-slate-500">{total} total</span>}
      </div>

      {loading ? (
        <div className="space-y-3" role="status" aria-label="Loading">
          <div className="h-3 w-full rounded-full bg-slate-100 animate-pulse" />
          <div className="h-2.5 w-2/3 rounded bg-slate-100 animate-pulse" />
        </div>
      ) : (
        <>
          <div
            className="flex h-3 w-full rounded-full overflow-hidden bg-slate-100"
            role="img"
            aria-label={`${title}: ${items.map((i) => `${i.label} ${i.value || 0}`).join(', ')}`}
          >
            {items.map((i) => (i.value ? <div key={i.label} className={i.color} style={{ width: `${(i.value / total) * 100}%` }} /> : null))}
          </div>
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {items.map((i) => (
              <li key={i.label} className="flex items-center gap-2 text-sm">
                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${i.color}`} />
                <span className="text-slate-600">{i.label}</span>
                <span className="ml-auto sm:ml-1 font-semibold text-slate-800">{i.value || 0}</span>
                <span className="text-xs text-slate-500">{pct(i.value || 0)}%</span>
              </li>
            ))}
          </ul>
          {footer && <div className="mt-4 pt-3 border-t border-slate-100 text-xs">{footer}</div>}
        </>
      )}
    </div>
  );
};

export default BreakdownBar;
