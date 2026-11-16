const supabase = require('../supabase');

// Detects whether optional columns from a migration (e.g. hostel_tracking.sql)
// exist yet, so code can write them only when present and keep every existing
// flow working before the migration is run. Results are cached briefly so a
// migration run later is picked up without a restart.
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

const columnsExist = async (table, columns) => {
  const key = `${table}:${columns}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.ok;
  const { error } = await supabase.from(table).select(columns).limit(1);
  const ok = !error;
  cache.set(key, { ok, at: Date.now() });
  return ok;
};

const hasHostelTracking = () => columnsExist('users', 'hostel_id, is_active, home_address, password_changed_at');
const hasPassType = () => columnsExist('outpasses', 'pass_type');

// Supabase/PostgREST caps a response at 1000 rows by default. This pages
// through `build()` (a fresh query builder each call) until it is exhausted.
const PAGE = 1000;
const fetchAll = async (build) => {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) return rows;
  }
};

module.exports = { columnsExist, hasHostelTracking, hasPassType, fetchAll };
