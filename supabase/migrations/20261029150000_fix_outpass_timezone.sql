-- ============================================================================
-- Fix outpass leave/return times that were stored 5½ hours late.
--
-- Until 2026-10-29 14:53 UTC the backend saved the form's zone-less value
-- (e.g. "2026-10-28T19:32", meant as India time) straight into a timestamptz
-- column, which Postgres read as UTC → 19:32 UTC = 01:02 IST next day.
-- From that moment the backend converts form times as India time
-- (utils/istDate.js parseHostelDateTime), so only older rows are affected.
--
-- Only rows created before the cutoff AND with whole-minute times (what the
-- datetime-local form produces) are corrected; a row written by a script with
-- an exact UTC timestamp (has seconds/ms) was already right and is skipped.
-- Original values are kept in outpasses_tz_backup_20261029.
-- ============================================================================

create table if not exists public.outpasses_tz_backup_20261029 as
  select _id, leave_datetime, return_datetime, now() as backed_up_at
  from public.outpasses
  where created_at < '2026-10-29T14:53:28Z'
    and date_trunc('minute', leave_datetime) = leave_datetime
    and date_trunc('minute', return_datetime) = return_datetime;

alter table public.outpasses_tz_backup_20261029 enable row level security;

update public.outpasses o set
  leave_datetime = o.leave_datetime - interval '5 hours 30 minutes',
  return_datetime = o.return_datetime - interval '5 hours 30 minutes'
from public.outpasses_tz_backup_20261029 b
where o._id = b._id
  and o.leave_datetime = b.leave_datetime;  -- idempotent: only rows still at the old value

-- To undo:
--   update public.outpasses o set leave_datetime = b.leave_datetime, return_datetime = b.return_datetime
--   from public.outpasses_tz_backup_20261029 b where o._id = b._id;
