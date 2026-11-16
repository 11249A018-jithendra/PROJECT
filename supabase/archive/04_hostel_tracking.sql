-- ============================================================================
-- Hostel Management System — Hostels, warden accounts & hostel tracking
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query).
-- Purely additive and safe to re-run: nothing existing is dropped or renamed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Hostels
-- ----------------------------------------------------------------------------
create table if not exists public.hostels (
  _id uuid primary key default gen_random_uuid(),
  name text not null unique,
  capacity integer check (capacity is null or capacity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backend uses the service key; RLS with no policies blocks the anon key.
alter table public.hostels enable row level security;

-- ----------------------------------------------------------------------------
-- 2. Users: hostel assignment, account status, home address, password audit
-- ----------------------------------------------------------------------------
alter table public.users
  add column if not exists hostel_id uuid references public.hostels(_id) on delete set null,
  add column if not exists is_active boolean not null default true,
  add column if not exists deactivated_at timestamptz,
  add column if not exists home_address text,
  -- Tokens issued before this moment are rejected (password reset = logout everywhere).
  add column if not exists password_changed_at timestamptz;

create index if not exists users_role_idx on public.users (role);
create index if not exists users_hostel_idx on public.users (hostel_id);

-- Carry over any hostel names already typed into the old hostel_block column.
insert into public.hostels (name)
  select distinct trim(hostel_block) from public.users
  where hostel_block is not null and trim(hostel_block) <> ''
on conflict (name) do nothing;

update public.users u
  set hostel_id = h._id
  from public.hostels h
  where u.hostel_id is null and u.hostel_block is not null and trim(u.hostel_block) = h.name;

-- ----------------------------------------------------------------------------
-- 3. Outpass type — lets a "Checked Out" student be shown as Gone Home
--    (home visit) vs Outside Hostel (local outing). Existing rows = Outing.
-- ----------------------------------------------------------------------------
alter table public.outpasses
  add column if not exists pass_type text not null default 'Outing';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'outpasses_pass_type_check') then
    alter table public.outpasses
      add constraint outpasses_pass_type_check check (pass_type in ('Outing', 'Home'));
  end if;
end $$;

create index if not exists outpasses_student_idx on public.outpasses (student_id, created_at desc);

-- ============================================================================
-- Done. Verify with:
--   select name from public.hostels;
--   select role, is_active, hostel_id from public.users limit 5;
--   select pass_type, count(*) from public.outpasses group by 1;
-- ============================================================================
