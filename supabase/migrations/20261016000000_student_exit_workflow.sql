-- ============================================================================
-- Permanent hostel exit: warden request -> admin approval -> Past Students.
--
-- Design notes
-- * Students are ARCHIVED, never hard-deleted: complaints, outpasses,
--   attendances and notifications reference users(_id) ON DELETE CASCADE, so
--   deleting the user row would destroy their history. Archiving =
--   users.is_active = false + hostel/room/warden assignment cleared.
-- * past_students keeps a frozen snapshot of the profile and allocation as it
--   was on the exit date (names of hostel/room/warden included, so later
--   renames or deletions don't change history), plus summary statistics.
-- * archive_student() does everything in ONE transaction (a plpgsql function
--   is atomic): it can't leave a student half-removed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Exit requests
-- ----------------------------------------------------------------------------
create table if not exists public.student_exit_requests (
  _id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(_id) on delete restrict,
  requested_by uuid not null references public.users(_id) on delete restrict,
  hostel_id uuid references public.hostels(_id) on delete set null,  -- student's hostel when requested
  reason text not null check (length(trim(reason)) between 5 and 500),
  exit_date date,                                                    -- planned last day in the hostel
  remarks text,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected', 'Cancelled')),
  decided_by uuid references public.users(_id) on delete restrict,
  decided_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.student_exit_requests enable row level security;

-- At most one open request per student — enforced by the database, so two
-- simultaneous submissions can't both succeed.
create unique index if not exists student_exit_requests_one_pending
  on public.student_exit_requests (student_id) where status = 'Pending';
create index if not exists student_exit_requests_status_idx on public.student_exit_requests (status, created_at desc);

-- ----------------------------------------------------------------------------
-- 2. Past students (frozen snapshot at exit)
-- ----------------------------------------------------------------------------
create table if not exists public.past_students (
  _id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.users(_id) on delete restrict, -- traceable to all history rows
  exit_request_id uuid references public.student_exit_requests(_id) on delete restrict,
  source text not null check (source in ('Warden request', 'Admin')),

  -- profile at exit
  name text not null,
  email text,
  roll_no text,
  phone text,
  parent_contact text,
  home_address text,
  course_year text,
  profile_photo text,
  admission_date timestamptz,                -- account / hostel registration date

  -- allocation at exit (ids + names, names survive later renames/deletes)
  hostel_id uuid,
  hostel_name text,
  room_id uuid,
  room_no text,
  room_floor text,
  warden_id uuid,
  warden_name text,
  warden_phone text,

  -- exit details
  exit_date date not null,
  exit_reason text not null,
  requested_by uuid references public.users(_id) on delete restrict,
  requested_by_name text,
  requested_at timestamptz,
  approved_by uuid not null references public.users(_id) on delete restrict,
  approved_by_name text,
  approved_at timestamptz not null default now(),

  -- summary of history at exit (detail rows stay in their own tables)
  stats jsonb not null default '{}'::jsonb,
  -- every non-secret users column at exit, for anything not broken out above
  profile jsonb not null default '{}'::jsonb,

  readmitted_at timestamptz,
  readmitted_by uuid references public.users(_id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.past_students enable row level security;
create index if not exists past_students_exit_idx on public.past_students (exit_date desc);
create index if not exists past_students_student_idx on public.past_students (student_id);
-- A student can only be "currently" past once (they may be re-admitted and leave again).
create unique index if not exists past_students_one_current
  on public.past_students (student_id) where readmitted_at is null;

-- ----------------------------------------------------------------------------
-- 3. archive_student(): the one atomic exit operation
--    p_request_id null  -> admin checked the student out directly
--    p_force            -> allow archiving while the student is outside on an outpass
-- Raises: STUDENT_NOT_FOUND, STUDENT_NOT_ACTIVE, STUDENT_OUTSIDE,
--         REQUEST_NOT_FOUND, REQUEST_NOT_PENDING, ADMIN_NOT_FOUND, REASON_REQUIRED
-- ----------------------------------------------------------------------------
create or replace function public.archive_student(
  p_student_id uuid,
  p_admin_id uuid,
  p_request_id uuid default null,
  p_reason text default null,
  p_exit_date date default null,
  p_force boolean default false
) returns public.past_students
language plpgsql
set search_path = public
as $$
declare
  v_student public.users%rowtype;
  v_request public.student_exit_requests%rowtype;
  v_admin public.users%rowtype;
  v_hostel public.hostels%rowtype;
  v_room public.rooms%rowtype;
  v_warden public.users%rowtype;
  v_requester public.users%rowtype;
  v_reason text;
  v_exit_date date;
  v_now timestamptz := now();
  v_past public.past_students%rowtype;
begin
  select * into v_admin from public.users where _id = p_admin_id and role = 'admin' and is_active;
  if not found then raise exception 'ADMIN_NOT_FOUND'; end if;

  if p_request_id is not null then
    -- Lock the request: a concurrent approve/reject waits, then sees the new status.
    select * into v_request from public.student_exit_requests where _id = p_request_id for update;
    if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
    if v_request.status <> 'Pending' then raise exception 'REQUEST_NOT_PENDING'; end if;
    p_student_id := v_request.student_id;
  end if;

  select * into v_student from public.users where _id = p_student_id and role = 'student' for update;
  if not found then raise exception 'STUDENT_NOT_FOUND'; end if;
  if not v_student.is_active then raise exception 'STUDENT_NOT_ACTIVE'; end if;

  if not p_force and exists (
    select 1 from public.outpasses where student_id = v_student._id and status = 'Checked Out'
  ) then
    raise exception 'STUDENT_OUTSIDE';
  end if;

  v_reason := coalesce(nullif(trim(p_reason), ''), v_request.reason);
  if v_reason is null then raise exception 'REASON_REQUIRED'; end if;
  v_exit_date := coalesce(p_exit_date, v_request.exit_date, (v_now at time zone 'Asia/Kolkata')::date);

  if v_student.hostel_id is not null then select * into v_hostel from public.hostels where _id = v_student.hostel_id; end if;
  if v_student.room_id is not null then select * into v_room from public.rooms where _id = v_student.room_id; end if;
  if v_student.assigned_warden is not null then select * into v_warden from public.users where _id = v_student.assigned_warden; end if;
  if v_request.requested_by is not null then select * into v_requester from public.users where _id = v_request.requested_by; end if;

  -- 1) Preserve: frozen snapshot first.
  insert into public.past_students (
    student_id, exit_request_id, source,
    name, email, roll_no, phone, parent_contact, home_address, course_year, profile_photo, admission_date,
    hostel_id, hostel_name, room_id, room_no, room_floor, warden_id, warden_name, warden_phone,
    exit_date, exit_reason, requested_by, requested_by_name, requested_at,
    approved_by, approved_by_name, approved_at, stats, profile
  ) values (
    v_student._id, v_request._id, case when v_request._id is null then 'Admin' else 'Warden request' end,
    v_student.name, v_student.email, v_student.roll_no, v_student.phone, v_student.parent_contact,
    v_student.home_address, v_student.course_year, v_student.profile_photo, v_student.created_at,
    v_student.hostel_id, v_hostel.name, v_student.room_id, coalesce(v_room.room_no, v_student.room_no), v_room.floor,
    v_warden._id, v_warden.name, v_warden.phone,
    v_exit_date, v_reason, v_request.requested_by, v_requester.name, v_request.created_at,
    v_admin._id, v_admin.name, v_now,
    jsonb_build_object(
      'attendance_present', (select count(*) from public.attendances where student_id = v_student._id and status = 'Present'),
      'attendance_absent', (select count(*) from public.attendances where student_id = v_student._id and status = 'Absent'),
      'outpasses_total', (select count(*) from public.outpasses where student_id = v_student._id),
      'outpasses_home', (select count(*) from public.outpasses where student_id = v_student._id and pass_type = 'Home' and status in ('Checked Out', 'Returned')),
      'complaints_total', (select count(*) from public.complaints where student_id = v_student._id),
      'complaints_open', (select count(*) from public.complaints where student_id = v_student._id and status in ('Pending', 'In Progress')),
      'last_exit', (select max(actual_exit_time) from public.outpasses where student_id = v_student._id),
      'last_entry', (select max(actual_return_time) from public.outpasses where student_id = v_student._id),
      'was_outside_at_exit', exists (select 1 from public.outpasses where student_id = v_student._id and status = 'Checked Out')
    ),
    to_jsonb(v_student) - 'password'
  ) returning * into v_past;

  -- 2) Remove from active records: deactivate + free room/hostel/warden.
  update public.users set
    is_active = false,
    deactivated_at = v_now,
    checked_out_at = v_now,
    checkout_reason = v_reason,
    hostel_id = null,
    room_id = null,
    room_no = null,
    assigned_warden = null,
    updated_at = v_now
  where _id = v_student._id;

  -- 3) Open outpasses can no longer be used.
  update public.outpasses set
    status = 'Rejected', rejected_by = v_admin._id::text, rejected_at = v_now,
    rejection_reason = 'Student permanently left the hostel.', updated_at = v_now
  where student_id = v_student._id and status in ('Pending', 'Approved');

  -- 4) Close the request (or any other pending one, when the admin acted directly).
  update public.student_exit_requests set
    status = 'Approved', decided_by = v_admin._id, decided_at = v_now, updated_at = v_now
  where student_id = v_student._id and status = 'Pending';

  return v_past;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. readmit_student(): reverse an exit (history snapshot is kept, marked readmitted)
-- ----------------------------------------------------------------------------
create or replace function public.readmit_student(p_student_id uuid, p_admin_id uuid)
returns public.users
language plpgsql
set search_path = public
as $$
declare
  v_user public.users%rowtype;
begin
  perform 1 from public.users where _id = p_admin_id and role = 'admin' and is_active;
  if not found then raise exception 'ADMIN_NOT_FOUND'; end if;

  update public.users set
    is_active = true, deactivated_at = null, checked_out_at = null, checkout_reason = null, updated_at = now()
  where _id = p_student_id and role = 'student' and not is_active
  returning * into v_user;
  if not found then raise exception 'STUDENT_NOT_ARCHIVED'; end if;

  update public.past_students set readmitted_at = now(), readmitted_by = p_admin_id
  where student_id = p_student_id and readmitted_at is null;

  return v_user;
end;
$$;

-- Only the backend (service role) may call these — never the public anon key.
revoke all on function public.archive_student(uuid, uuid, uuid, text, date, boolean) from public, anon, authenticated;
revoke all on function public.readmit_student(uuid, uuid) from public, anon, authenticated;
grant execute on function public.archive_student(uuid, uuid, uuid, text, date, boolean) to service_role;
grant execute on function public.readmit_student(uuid, uuid) to service_role;
