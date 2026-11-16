-- ============================================================================
-- Registration numbers (users.roll_no) must be unique among students,
-- ignoring case and surrounding spaces.
--
-- One existing duplicate: "11249A018" was used by two accounts (both already
-- moved to Past Students). The college-email account keeps the number; the
-- other gets the suffix "-DUP" so it stays findable. Past Students snapshots
-- (past_students.roll_no) keep the original value for history.
-- Undo: update public.users set roll_no = '11249A018' where email = 'jithendraangadi@gmail.com';
-- ============================================================================

update public.users
  set roll_no = '11249A018-DUP', updated_at = now()
  where role = 'student'
    and upper(trim(roll_no)) = '11249A018'
    and lower(email) = 'jithendraangadi@gmail.com';

create unique index if not exists users_student_roll_no_unique
  on public.users (upper(trim(roll_no)))
  where role = 'student' and roll_no is not null and trim(roll_no) <> '';
