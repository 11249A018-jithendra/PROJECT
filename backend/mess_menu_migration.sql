-- Run this in your Supabase SQL Editor to create the mess_menu table
-- Table uses a stable id 1-7 (one per day) for upsert operations

create table if not exists mess_menu (
  id        smallint primary key,  -- 1=Monday ... 7=Sunday
  day       text not null unique,
  breakfast text not null,
  lunch     text not null,
  snacks    text not null,
  dinner    text not null,
  updated_at timestamptz default now()
);

-- RLS on: the backend service key bypasses it, the public anon key gets nothing
alter table mess_menu enable row level security;

-- Seed with default data (runs only if table is empty)
insert into mess_menu (id, day, breakfast, lunch, snacks, dinner) values
  (1, 'Monday',    'Idli, Sambar',    'Rice, Sambar, Poriyal',   'Tea & Biscuits',      'Chapati, Kurma'),
  (2, 'Tuesday',   'Pongal, Chutney', 'Rice, Rasam, Vegetables', 'Banana / Fruit',      'Dosa, Sambar'),
  (3, 'Wednesday', 'Dosa, Sambar',    'Rice, Curd, Poriyal',     'Tea & Snacks',        'Chapati, Channa Masala'),
  (4, 'Thursday',  'Upma, Chutney',   'Rice, Sambar, Poriyal',   'Murmura / Bhel',     'Idiyappam, Kurma'),
  (5, 'Friday',    'Poori, Masala',   'Rice, Rasam, Vegetables', 'Tea & Biscuits',      'Parotta, Kurma'),
  (6, 'Saturday',  'Idli, Chutney',   'Variety Rice, Poriyal',   'Fruit Juice / Juice', 'Dosa, Chutney'),
  (7, 'Sunday',    'Pongal, Vada',    'Biryani, Raita',          'Tea & Snacks',        'Chapati, Vegetable Curry')
on conflict (id) do nothing;
