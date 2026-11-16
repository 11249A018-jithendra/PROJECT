-- Add assigned_warden to users table
alter table public.users
  add column if not exists assigned_warden uuid references public.users(_id) on delete set null;

-- Add block/hostel if it doesn't exist, though requirements just mention "Hostel/block"
alter table public.users
  add column if not exists hostel_block text;
