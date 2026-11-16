-- ============================================================================
-- Portal split + local-only Developer console.
-- 1. New role 'developer' (full control; usable only from the developer's own
--    computer — enforced by the backend, see backend/utils/portals.js).
-- 2. developer_audit_log: every change a developer (or a developer
--    impersonating someone) makes.
-- 3. server_errors: 5xx errors, so the developer console can show them.
-- Additive only.
-- ============================================================================

alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('student', 'admin', 'warden', 'security', 'developer'));

create table if not exists public.developer_audit_log (
  _id uuid primary key default gen_random_uuid(),
  developer_id uuid references public.users(_id) on delete set null,
  acting_as_id uuid references public.users(_id) on delete set null,  -- set when impersonating
  action text not null,           -- e.g. "PUT /api/admin/students/…/hostel" or "IMPERSONATE"
  target text,                    -- free-text detail (record id, user name…)
  status integer,                 -- HTTP status of the request
  ip text,
  created_at timestamptz not null default now()
);
alter table public.developer_audit_log enable row level security;
create index if not exists developer_audit_log_created_idx on public.developer_audit_log (created_at desc);

create table if not exists public.server_errors (
  _id uuid primary key default gen_random_uuid(),
  ref text not null,               -- the code users see: "(ref 1a2b3c4d)"
  method text,
  path text,
  user_id uuid,
  detail text,
  created_at timestamptz not null default now()
);
alter table public.server_errors enable row level security;
create index if not exists server_errors_created_idx on public.server_errors (created_at desc);
