-- ============================================================================
-- Warden Current-Day Restrictions:
-- 1. Store actual outpass issue timestamp with seconds (e.g. 2026-10-28 22:35:42)
-- 2. Track daily attendance closure and record locking
-- ============================================================================

-- Outpasses: record actual issue timestamp
alter table public.outpasses
  add column if not exists issued_at text;

-- Attendances: flag locked/closed records
alter table public.attendances
  add column if not exists is_locked boolean not null default false;

-- Daily attendance locks table to track closed/archived dates
create table if not exists public.attendance_daily_locks (
  date date primary key,
  status text not null default 'Closed',
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.attendance_daily_locks disable row level security;

