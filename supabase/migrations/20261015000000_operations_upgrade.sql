-- ============================================================================
-- Operations upgrade: overdue alerts, manual gate entries, attendance audit,
-- complaint workflow (cancel / reopen / rate / assign staff / admin reminders),
-- rooms, student check-out, targeted announcements, visitor log.
-- Additive only — no existing column or row is removed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Maintenance staff (electrician, plumber, …) that complaints are assigned to
-- ----------------------------------------------------------------------------
create table if not exists public.maintenance_staff (
  _id uuid primary key default gen_random_uuid(),
  name text not null,
  trade text not null,              -- e.g. Electrician, Plumber, Housekeeping
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.maintenance_staff enable row level security;

-- ----------------------------------------------------------------------------
-- 2. Complaints: cancel, reopen, rating, staff assignment, admin reminders
-- ----------------------------------------------------------------------------
alter table public.complaints drop constraint if exists complaints_status_check;
alter table public.complaints
  add constraint complaints_status_check check (status in ('Pending', 'In Progress', 'Resolved', 'Cancelled'));

alter table public.complaints
  add column if not exists assigned_staff_id uuid references public.maintenance_staff(_id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists reopened_count integer not null default 0,
  add column if not exists reopened_at timestamptz,
  add column if not exists rating smallint check (rating between 1 and 5),
  add column if not exists feedback text,
  add column if not exists rated_at timestamptz,
  add column if not exists admin_reminded_at timestamptz,
  add column if not exists admin_reminder_count integer not null default 0;

-- ----------------------------------------------------------------------------
-- 3. Rooms with capacity
-- ----------------------------------------------------------------------------
create table if not exists public.rooms (
  _id uuid primary key default gen_random_uuid(),
  hostel_id uuid not null references public.hostels(_id) on delete cascade,
  room_no text not null,
  floor text,
  capacity integer not null default 2 check (capacity between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hostel_id, room_no)
);
alter table public.rooms enable row level security;

alter table public.users
  add column if not exists room_id uuid references public.rooms(_id) on delete set null,
  -- Student check-out (left the hostel). is_active = false archives them.
  add column if not exists checked_out_at timestamptz,
  add column if not exists checkout_reason text;

create index if not exists users_room_idx on public.users (room_id);

-- ----------------------------------------------------------------------------
-- 4. Announcements: expiry + hostel targeting (null hostel = everyone)
-- ----------------------------------------------------------------------------
alter table public.announcements
  add column if not exists expires_at timestamptz,
  add column if not exists hostel_id uuid references public.hostels(_id) on delete cascade;

-- The app reads announcements through the backend (service key). This policy
-- let anyone holding the public anon key read every announcement directly;
-- nothing uses it, and with hostel targeting it would leak hostel notices.
drop policy if exists anon_read_announcements on public.announcements;

-- ----------------------------------------------------------------------------
-- 5. Outpasses: overdue alerting + manual (no-QR) gate entries
-- ----------------------------------------------------------------------------
alter table public.outpasses
  add column if not exists overdue_notified_at timestamptz,
  add column if not exists exit_method text not null default 'QR' check (exit_method in ('QR', 'MANUAL')),
  add column if not exists return_method text check (return_method in ('QR', 'MANUAL')),
  add column if not exists manual_reason text;

alter table public.outpass_scan_logs
  add column if not exists method text not null default 'QR',
  add column if not exists note text;

-- ----------------------------------------------------------------------------
-- 6. Attendance audit
-- ----------------------------------------------------------------------------
alter table public.attendances
  add column if not exists marked_by text,
  add column if not exists auto_marked boolean not null default false;

create index if not exists attendances_student_date_idx on public.attendances (student_id, date desc);

-- ----------------------------------------------------------------------------
-- 7. Visitor log at the gate
-- ----------------------------------------------------------------------------
create table if not exists public.visitors (
  _id uuid primary key default gen_random_uuid(),
  visitor_name text not null,
  phone text,
  relation text,                    -- e.g. Father, Friend, Courier
  purpose text,
  id_proof text,                    -- e.g. "Aadhaar ••••1234"
  student_id uuid references public.users(_id) on delete set null,
  hostel_id uuid references public.hostels(_id) on delete set null,
  check_in_at timestamptz not null default now(),
  check_out_at timestamptz,
  checked_in_by text,
  checked_out_by text,
  created_at timestamptz not null default now()
);
alter table public.visitors enable row level security;
create index if not exists visitors_check_in_idx on public.visitors (check_in_at desc);
create index if not exists visitors_open_idx on public.visitors (check_out_at) where check_out_at is null;
