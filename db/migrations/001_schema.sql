-- 001_schema.sql — Nutri core schema (Supabase Postgres)
-- Paste into Supabase → SQL Editor and run. Safe to re-run (IF NOT EXISTS everywhere).
-- The app connects server-side as the database owner, which bypasses RLS.
-- RLS is enabled on every table with NO policies, so the public anon/authenticated
-- keys (PostgREST) can read or write nothing.

create table if not exists users (
  id            text primary key,
  username      text not null unique,
  name          text not null,
  role          text not null check (role in ('supervisor','distributor','specialist')),
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table if not exists departments (
  id          text primary key,
  name        text not null,
  color       text not null default 'emerald' check (color in
                ('violet','sky','emerald','rose','amber','indigo','teal','orange','pink','cyan','lime','fuchsia')),
  room_from   int  not null check (room_from between 1 and 9999),
  room_to     int  not null check (room_to between 1 and 9999),
  extra_rooms int[] not null default '{}',
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint departments_room_range check (room_to >= room_from)
);
create unique index if not exists departments_name_key on departments (lower(name));

create table if not exists orders (
  id              text primary key,
  department      text not null references departments(id),
  room            text not null,
  bed             smallint not null check (bed between 1 and 4),
  patient_name    text not null default '',
  person_type     text not null check (person_type in ('patient','companion')),
  day             text check (day in ('sun','mon','tue','wed','thu','fri','sat')),
  meal_time       text not null check (meal_time in ('breakfast','lunch','dinner')),
  main_meal       text not null,
  meal_type       text not null default 'main' check (meal_type in ('main','optional','custom')),
  options         jsonb not null default '[]',
  notes           text not null default '',
  created_by      text not null,
  created_by_name text not null,
  created_at      timestamptz not null default now()
);
create index if not exists orders_created_at_idx on orders (created_at desc);
create index if not exists orders_department_created_idx on orders (department, created_at);

create table if not exists menu (
  day           text primary key check (day in ('sun','mon','tue','wed','thu','fri','sat')),
  main_meal     text not null default '',
  optional_item text not null default '',
  updated_at    timestamptz not null default now()
);

create table if not exists notes (
  id              text primary key,
  message         text not null,
  department      text references departments(id) on delete set null,
  created_by      text not null,
  created_by_name text not null,
  created_at      timestamptz not null default now()
);
create index if not exists notes_created_at_idx on notes (created_at desc);

create table if not exists push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  user_id    text references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key   text primary key,
  value jsonb not null
);

insert into settings (key, value) values ('min_daily', '5') on conflict (key) do nothing;

-- Row Level Security: enabled, no policies → no access through the Supabase public API.
alter table users              enable row level security;
alter table departments        enable row level security;
alter table orders             enable row level security;
alter table menu               enable row level security;
alter table notes              enable row level security;
alter table push_subscriptions enable row level security;
alter table settings           enable row level security;
