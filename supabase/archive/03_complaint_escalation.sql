-- ============================================================================
-- Hostel Management System — Complaint escalation + notifications migration
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Purely additive and safe to re-run: no existing column, row or constraint
-- is dropped, so every existing feature keeps working.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Complaint response / escalation / resolution tracking
-- ----------------------------------------------------------------------------
alter table public.complaints
  add column if not exists first_response_at timestamptz,  -- first warden/admin action
  add column if not exists responded_by text,              -- user _id of that responder
  add column if not exists escalated boolean not null default false,
  add column if not exists escalated_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by text;

create index if not exists complaints_escalation_idx
  on public.complaints (status, escalated, created_at);

-- Backfill: complaints a warden/admin already acted on count as responded,
-- so only genuinely untouched complaints get escalated.
update public.complaints
  set first_response_at = coalesce(updated_at, created_at)
  where first_response_at is null and status <> 'Pending';

update public.complaints
  set resolved_at = coalesce(updated_at, created_at)
  where resolved_at is null and status = 'Resolved';

-- ----------------------------------------------------------------------------
-- 2. In-app notifications (one row per recipient so read-state is per user)
-- ----------------------------------------------------------------------------
create table if not exists public.notifications (
  _id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(_id) on delete cascade,
  type text not null default 'info',   -- e.g. COMPLAINT_ESCALATED, COMPLAINT_NEW
  title text not null,
  message text,
  link text,                           -- frontend route to open on click
  complaint_id text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- The backend talks to Supabase with the service key (bypasses RLS). Turning
-- RLS on with no policies keeps this table unreadable via the public anon key.
alter table public.notifications enable row level security;

-- ============================================================================
-- Done. Verify with:
--   select escalated, first_response_at from public.complaints limit 5;
--   select count(*) from public.notifications;
-- ============================================================================
