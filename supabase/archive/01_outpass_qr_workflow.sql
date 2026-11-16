-- ============================================================================
-- Hostel Management System — Outpass QR Workflow migration
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Safe to re-run: every step is guarded (IF NOT EXISTS / dynamic constraint
-- lookup), so running it twice does nothing the second time.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Allow the two new roles: warden, security
-- ----------------------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where rel.relname = 'users' and att.attname = 'role' and con.contype = 'c'
  loop
    execute format('alter table public.users drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.users
  add constraint users_role_check check (role in ('student', 'admin', 'warden', 'security'));

-- ----------------------------------------------------------------------------
-- 2. Extend outpasses with the QR / approval / scan lifecycle fields.
--    Existing fields are kept as-is (reason, destination, leave_datetime,
--    return_datetime, parent_consent, status, admin_remarks).
-- ----------------------------------------------------------------------------
alter table public.outpasses
  add column if not exists qr_token text,
  add column if not exists approved_by text,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_by text,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists actual_exit_time timestamptz,
  add column if not exists exit_scanned_by text,
  add column if not exists exit_scan_timestamp timestamptz,
  add column if not exists actual_return_time timestamptz,
  add column if not exists return_scanned_by text,
  add column if not exists return_scan_timestamp timestamptz;

-- One QR token maps to exactly one outpass.
create unique index if not exists outpasses_qr_token_idx
  on public.outpasses (qr_token)
  where qr_token is not null;

-- Widen the status values to the full lifecycle. Keeps existing
-- 'Pending' / 'Approved' / 'Rejected' values and their casing, adds the two
-- new post-approval states.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_attribute att on att.attrelid = rel.oid and att.attnum = any(con.conkey)
    where rel.relname = 'outpasses' and att.attname = 'status' and con.contype = 'c'
  loop
    execute format('alter table public.outpasses drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.outpasses
  add constraint outpasses_status_check
  check (status in ('Pending', 'Approved', 'Rejected', 'Checked Out', 'Returned'));

create index if not exists outpasses_status_idx on public.outpasses (status);

-- ----------------------------------------------------------------------------
-- 3. Scan audit log (security guard EXIT/RETURN scans).
--    No FK constraints on purpose: this project's ids may be uuid or bigint
--    depending on how the tables were created, and the app already treats
--    every id as an opaque string end-to-end (JWT, .eq() filters). Storing
--    these as plain text avoids a type mismatch when the migration runs.
-- ----------------------------------------------------------------------------
create table if not exists public.outpass_scan_logs (
  _id uuid primary key default gen_random_uuid(),
  outpass_id text,
  student_id text,
  security_guard_id text,
  action text,           -- 'EXIT' | 'RETURN' (nullable: unrecognized QR)
  result text not null,  -- 'SUCCESS' | 'FAILED'
  failure_reason text,
  scan_time timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists outpass_scan_logs_outpass_idx on public.outpass_scan_logs (outpass_id);
create index if not exists outpass_scan_logs_scan_time_idx on public.outpass_scan_logs (scan_time desc);

-- ----------------------------------------------------------------------------
-- Done. Verify with:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.users'::regclass or conrelid = 'public.outpasses'::regclass;
-- ============================================================================
