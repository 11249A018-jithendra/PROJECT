const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const rows = [
  { id:1, day:"Monday",    breakfast:"Idli, Sambar",    lunch:"Rice, Sambar, Poriyal",   snacks:"Tea & Biscuits",      dinner:"Chapati, Kurma" },
  { id:2, day:"Tuesday",   breakfast:"Pongal, Chutney", lunch:"Rice, Rasam, Vegetables", snacks:"Banana / Fruit",      dinner:"Dosa, Sambar" },
  { id:3, day:"Wednesday", breakfast:"Dosa, Sambar",    lunch:"Rice, Curd, Poriyal",     snacks:"Tea & Snacks",        dinner:"Chapati, Channa Masala" },
  { id:4, day:"Thursday",  breakfast:"Upma, Chutney",   lunch:"Rice, Sambar, Poriyal",   snacks:"Murmura / Bhel",     dinner:"Idiyappam, Kurma" },
  { id:5, day:"Friday",    breakfast:"Poori, Masala",   lunch:"Rice, Rasam, Vegetables", snacks:"Tea & Biscuits",      dinner:"Parotta, Kurma" },
  { id:6, day:"Saturday",  breakfast:"Idli, Chutney",   lunch:"Variety Rice, Poriyal",   snacks:"Fruit Juice / Juice", dinner:"Dosa, Chutney" },
  { id:7, day:"Sunday",    breakfast:"Pongal, Vada",    lunch:"Biryani, Raita",          snacks:"Tea & Snacks",        dinner:"Chapati, Vegetable Curry" },
];

async function run() {
  // Try inserting - if table exists, this will work. If not, we need the SQL.
  const { data, error } = await supabase.from("mess_menu").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("Error:", error.message);
    console.log("\n>>> The table does not exist yet. Please run this SQL in your Supabase SQL Editor:\n");
    console.log(`create table if not exists public.mess_menu (
  id         smallint primary key,
  day        text not null unique,
  breakfast  text not null,
  lunch      text not null,
  snacks     text not null,
  dinner     text not null,
  updated_at timestamptz default now()
);

alter table public.mess_menu enable row level security;`);
    console.log("\nThen run this script again to seed the data.");
  } else {
    console.log("mess_menu table seeded successfully with 7 rows!");
  }
}
run();
