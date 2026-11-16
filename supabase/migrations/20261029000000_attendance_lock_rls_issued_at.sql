-- ============================================================================
-- Follow-ups to the mess menu and warden current-day migrations:
-- 1. Turn RLS back on for the new tables (the backend uses the service key,
--    which bypasses RLS; with RLS off the anon key could read/write them).
-- 2. Enforce the attendance lock in the database, not only in the API.
-- 3. Store outpasses.issued_at as a real timestamp instead of zone-less text.
-- ============================================================================

-- 1) RLS, matching every other public table.
alter table public.mess_menu enable row level security;
alter table public.attendance_daily_locks enable row level security;

-- 2) Attendance lock. A hand-marked record (auto_marked = false) or a record
--    closed by the midnight job (is_locked) is final: it can't be changed or
--    deleted. The only allowed update is the midnight job flipping is_locked on.
--    A system auto-mark stays replaceable until it is locked.
--    Cascading deletes when the student row itself is removed still work.
create or replace function public.attendances_enforce_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_locked or not old.auto_marked then
    if tg_op = 'DELETE' then
      if not exists (select 1 from public.users where _id = old.student_id) then
        return old;
      end if;
      raise exception 'ATTENDANCE_LOCKED';
    end if;
    if (new.status, new.marked_by, new.auto_marked, new.date, new.student_id)
       is distinct from (old.status, old.marked_by, old.auto_marked, old.date, old.student_id)
       or (old.is_locked and not new.is_locked) then
      raise exception 'ATTENDANCE_LOCKED';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists attendances_enforce_lock on public.attendances;
create trigger attendances_enforce_lock
  before update or delete on public.attendances
  for each row execute function public.attendances_enforce_lock();

-- 3) issued_at: existing values were written as IST wall-clock text.
alter table public.outpasses
  alter column issued_at type timestamptz
  using (case when issued_at is null or issued_at = '' then null
              else (issued_at::timestamp at time zone 'Asia/Kolkata') end);
