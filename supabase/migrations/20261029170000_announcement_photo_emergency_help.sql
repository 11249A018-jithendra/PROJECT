-- ============================================================================
-- 1. Announcements can carry one photo.
-- 2. Emergency help: contacts the warden maintains (warden, security, driver,
--    ambulance…) shown to students, plus SOS alerts students can raise.
-- Additive only.
-- ============================================================================

alter table public.announcements
  add column if not exists photo text;   -- relative path, e.g. uploads/1730...jpg

-- ----------------------------------------------------------------------------
-- Emergency contacts (not login accounts — a driver is just a name + phone)
-- ----------------------------------------------------------------------------
create table if not exists public.emergency_contacts (
  _id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  category text not null check (category in ('Warden', 'Security', 'Driver', 'Ambulance', 'Medical', 'Other')),
  phone text not null check (phone ~ '^[+0-9][0-9 -]{5,19}$'),
  notes text,                                   -- e.g. "Night shift 8 PM – 8 AM", vehicle no.
  hostel_id uuid references public.hostels(_id) on delete cascade,  -- null = every hostel
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid references public.users(_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.emergency_contacts enable row level security;
create index if not exists emergency_contacts_hostel_idx on public.emergency_contacts (hostel_id, is_active);

-- ----------------------------------------------------------------------------
-- SOS alerts raised by students
-- ----------------------------------------------------------------------------
create table if not exists public.sos_alerts (
  _id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(_id) on delete cascade,
  hostel_id uuid references public.hostels(_id) on delete set null,
  message text,
  status text not null default 'Open' check (status in ('Open', 'Acknowledged', 'Resolved')),
  acknowledged_by uuid references public.users(_id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references public.users(_id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);
alter table public.sos_alerts enable row level security;
create index if not exists sos_alerts_status_idx on public.sos_alerts (status, created_at desc);
create index if not exists sos_alerts_student_idx on public.sos_alerts (student_id, created_at desc);
