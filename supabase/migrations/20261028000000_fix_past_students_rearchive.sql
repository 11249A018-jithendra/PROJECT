-- ----------------------------------------------------------------------------
-- Fix for duplicate key violation on past_students_one_current
--
-- When a student who had previously exited is reactivated (e.g. manually or via script)
-- without calling readmit_student(), their previous record in past_students retains
-- readmitted_at = NULL. When they exit again, inserting a new record violates the
-- unique partial index past_students_one_current (where readmitted_at is null).
--
-- This migration updates archive_student() to automatically close any prior
-- unreadmitted past_students record for the student before creating the new exit snapshot.
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

  -- Close any previous dangling past_students record where readmitted_at was NULL
  update public.past_students
    set readmitted_at = coalesce(v_student.updated_at, v_now),
        readmitted_by = coalesce(readmitted_by, v_admin._id)
    where student_id = v_student._id and readmitted_at is null;

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

