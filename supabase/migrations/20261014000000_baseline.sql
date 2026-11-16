-- ============================================================================
-- Baseline: the full public schema as it existed on 2026-10-14, generated from
-- the live database. Already applied in production (marked as applied with
-- `supabase migration repair`); used to rebuild a fresh database from scratch.
-- The hand-written SQL files that produced it are kept in supabase/archive/.
-- ============================================================================

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.announcements (
  _id uuid default gen_random_uuid() not null,
  title text not null,
  message text not null,
  priority text default 'Normal'::text not null,
  created_by uuid,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.attendances (
  _id uuid default uuid_generate_v4() not null,
  date date not null,
  student_id uuid,
  status text default 'Pending'::text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.complaints (
  _id uuid default uuid_generate_v4() not null,
  student_id uuid,
  title text default 'Complaint'::text,
  description text not null,
  category text not null,
  status text default 'Pending'::text,
  photo text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  admin_remarks text,
  first_response_at timestamp with time zone,
  responded_by text,
  escalated boolean default false not null,
  escalated_at timestamp with time zone,
  resolved_at timestamp with time zone,
  resolved_by text
);

create table if not exists public.hostels (
  _id uuid default gen_random_uuid() not null,
  name text not null,
  capacity integer,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.notifications (
  _id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  type text default 'info'::text not null,
  title text not null,
  message text,
  link text,
  complaint_id text,
  is_read boolean default false not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.outpass_scan_logs (
  _id uuid default gen_random_uuid() not null,
  outpass_id text,
  student_id text,
  security_guard_id text,
  action text,
  result text not null,
  failure_reason text,
  scan_time timestamp with time zone default now() not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.outpasses (
  _id uuid default uuid_generate_v4() not null,
  student_id uuid,
  reason text not null,
  leave_datetime timestamp with time zone not null,
  return_datetime timestamp with time zone not null,
  destination text not null,
  parent_consent boolean default false,
  status text default 'Pending'::text,
  admin_remarks text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  qr_token text,
  approved_by text,
  approved_at timestamp with time zone,
  rejected_by text,
  rejected_at timestamp with time zone,
  rejection_reason text,
  actual_exit_time timestamp with time zone,
  exit_scanned_by text,
  exit_scan_timestamp timestamp with time zone,
  actual_return_time timestamp with time zone,
  return_scanned_by text,
  return_scan_timestamp timestamp with time zone,
  pass_type text default 'Outing'::text not null
);

create table if not exists public.users (
  _id uuid default uuid_generate_v4() not null,
  role text not null,
  name text not null,
  email text not null,
  password text not null,
  roll_no text,
  room_no text,
  course_year text,
  phone text,
  parent_contact text,
  profile_photo text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  assigned_warden uuid,
  hostel_block text,
  hostel_id uuid,
  is_active boolean default true not null,
  deactivated_at timestamp with time zone,
  home_address text,
  password_changed_at timestamp with time zone
);

alter table public.announcements add constraint announcements_pkey PRIMARY KEY (_id);

alter table public.announcements add constraint announcements_priority_check CHECK ((priority = ANY (ARRAY['Normal'::text, 'Important'::text, 'Urgent'::text])));

alter table public.attendances add constraint attendances_date_student_id_key UNIQUE (date, student_id);

alter table public.attendances add constraint attendances_pkey PRIMARY KEY (_id);

alter table public.attendances add constraint attendances_status_check CHECK ((status = ANY (ARRAY['Present'::text, 'Absent'::text, 'Pending'::text])));

alter table public.complaints add constraint complaints_pkey PRIMARY KEY (_id);

alter table public.complaints add constraint complaints_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'In Progress'::text, 'Resolved'::text])));

alter table public.hostels add constraint hostels_capacity_check CHECK (((capacity IS NULL) OR (capacity >= 0)));

alter table public.hostels add constraint hostels_name_key UNIQUE (name);

alter table public.hostels add constraint hostels_pkey PRIMARY KEY (_id);

alter table public.notifications add constraint notifications_pkey PRIMARY KEY (_id);

alter table public.outpass_scan_logs add constraint outpass_scan_logs_pkey PRIMARY KEY (_id);

alter table public.outpasses add constraint outpasses_pass_type_check CHECK ((pass_type = ANY (ARRAY['Outing'::text, 'Home'::text])));

alter table public.outpasses add constraint outpasses_pkey PRIMARY KEY (_id);

alter table public.outpasses add constraint outpasses_status_check CHECK ((status = ANY (ARRAY['Pending'::text, 'Approved'::text, 'Rejected'::text, 'Checked Out'::text, 'Returned'::text])));

alter table public.users add constraint users_email_key UNIQUE (email);

alter table public.users add constraint users_pkey PRIMARY KEY (_id);

alter table public.users add constraint users_role_check CHECK ((role = ANY (ARRAY['student'::text, 'admin'::text, 'warden'::text, 'security'::text])));

alter table public.announcements add constraint announcements_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(_id) ON DELETE SET NULL;

alter table public.attendances add constraint attendances_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(_id) ON DELETE CASCADE;

alter table public.complaints add constraint complaints_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(_id) ON DELETE CASCADE;

alter table public.notifications add constraint notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(_id) ON DELETE CASCADE;

alter table public.outpasses add constraint outpasses_student_id_fkey FOREIGN KEY (student_id) REFERENCES users(_id) ON DELETE CASCADE;

alter table public.users add constraint users_assigned_warden_fkey FOREIGN KEY (assigned_warden) REFERENCES users(_id) ON DELETE SET NULL;

alter table public.users add constraint users_hostel_id_fkey FOREIGN KEY (hostel_id) REFERENCES hostels(_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS announcements_created_at_idx ON public.announcements USING btree (created_at DESC);

CREATE INDEX IF NOT EXISTS complaints_escalation_idx ON public.complaints USING btree (status, escalated, created_at);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications USING btree (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS outpass_scan_logs_outpass_idx ON public.outpass_scan_logs USING btree (outpass_id);

CREATE INDEX IF NOT EXISTS outpass_scan_logs_scan_time_idx ON public.outpass_scan_logs USING btree (scan_time DESC);

CREATE INDEX IF NOT EXISTS outpasses_status_idx ON public.outpasses USING btree (status);

CREATE INDEX IF NOT EXISTS outpasses_student_idx ON public.outpasses USING btree (student_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS outpasses_qr_token_idx ON public.outpasses USING btree (qr_token) WHERE (qr_token IS NOT NULL);

CREATE INDEX IF NOT EXISTS users_hostel_idx ON public.users USING btree (hostel_id);

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users USING btree (role);

alter table public.announcements enable row level security;

alter table public.attendances enable row level security;

alter table public.complaints enable row level security;

alter table public.hostels enable row level security;

alter table public.notifications enable row level security;

alter table public.outpass_scan_logs enable row level security;

alter table public.outpasses enable row level security;

alter table public.users enable row level security;

create policy anon_read_announcements on public.announcements as PERMISSIVE for SELECT to public using (true);
