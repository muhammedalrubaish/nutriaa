-- =============================================================================
-- 2026-11-launch-old-db.sql — Nutriaa launch of the 2026-11-17 notes on the
-- EXISTING production database (Supabase project "Nutriaa").
--
-- Combines db/migrations 005, 006 and 007 in ONE transaction.
--  * Safe to run more than once: every step is IF NOT EXISTS / guarded.
--  * Aborts (and changes nothing) if existing orders already hold a duplicate
--    meal slot — run the "duplicates" query in DEPLOY-PLAN.md to see them.
--  * Records 001–007 in public.schema_migrations (the table `npm run db:migrate`
--    uses), so a later `npm run db:migrate` is a no-op and never re-runs the
--    seed files 002/003 on live data. 001–004 are already reflected in the
--    production schema (users_single_sysadmin, role check, departments, menu).
--  * Changes no existing values: only adds columns (with defaults), indexes,
--    tables, and seeds meal_library from existing menu/order meal names.
--
-- How to run: Supabase dashboard → SQL Editor → paste the whole file → Run.
-- (or: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f deploy/2026-11-launch-old-db.sql)
-- =============================================================================

begin;

-- Do not hang behind live traffic: give up if a lock is not granted in 10 s
-- (just run the file again a moment later), and cap the whole run at 2 min.
set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- ---------------------------------------------------------------------------
-- 0. Migration tracking table (same definition as scripts/migrate.mjs)
-- ---------------------------------------------------------------------------
create table if not exists public.schema_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;

-- ---------------------------------------------------------------------------
-- 1. Pre-check (005): no existing duplicate meal slots
--    Slot = department, room, bed, meal_date, meal_time, person_type, patient_name
--    meal_date = nearest date on/after the Riyadh entry date whose weekday = day.
-- ---------------------------------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n from (
    select 1 from public.orders
    where day is not null
    group by department, room, bed,
      (created_at at time zone 'Asia/Riyadh')::date
        + ((array_position(array['sun','mon','tue','wed','thu','fri','sat']::text[], day) - 1
            - extract(dow from (created_at at time zone 'Asia/Riyadh')::date)::int + 7) % 7),
      meal_time, person_type, patient_name
    having count(*) > 1
  ) d;
  if n > 0 then
    raise exception 'ABORTED, nothing changed: % duplicate meal slot(s) already exist in orders. Run the duplicates query in deploy/DEPLOY-PLAN.md, fix or delete the extra rows, then run this file again.', n;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. (005) orders.meal_date + unique meal slot + helper indexes
-- ---------------------------------------------------------------------------
alter table public.orders
  add column if not exists meal_date date
  generated always as (
    (created_at at time zone 'Asia/Riyadh')::date
    + ((array_position(array['sun','mon','tue','wed','thu','fri','sat']::text[], day) - 1
        - extract(dow from (created_at at time zone 'Asia/Riyadh')::date)::int + 7) % 7)
  ) stored;

-- Re-create the unique index only if it is missing or has a different definition.
do $$
declare def text;
begin
  select indexdef into def from pg_indexes
  where schemaname = 'public' and indexname = 'orders_unique_slot';
  if def is not null and def not like
     'CREATE UNIQUE INDEX orders_unique_slot ON public.orders USING btree (department, room, bed, meal_date, meal_time, person_type, patient_name)' then
    execute 'drop index public.orders_unique_slot';
    def := null;
  end if;
  if def is null then
    execute 'create unique index orders_unique_slot on public.orders
             (department, room, bed, meal_date, meal_time, person_type, patient_name)';
  end if;
end $$;

create index if not exists orders_meal_date_idx  on public.orders (meal_date);
create index if not exists orders_created_by_idx on public.orders (created_by);
create index if not exists orders_main_meal_idx  on public.orders (main_meal);

-- ---------------------------------------------------------------------------
-- 3. (006) three optional meals per day + meal library
-- ---------------------------------------------------------------------------
alter table public.menu
  add column if not exists optional_item_2 text not null default '',
  add column if not exists optional_item_3 text not null default '';

create table if not exists public.meal_library (
  id         text primary key default ('m_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
  name       text not null check (length(btrim(name)) between 1 and 200),
  category   text not null default 'any' check (category in ('main', 'optional', 'any')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists meal_library_name_key on public.meal_library (lower(btrim(name)));
alter table public.meal_library enable row level security;

insert into public.meal_library (name, category)
select distinct on (lower(btrim(n))) btrim(n), c
from (
  select main_meal as n, 'main' as c from public.menu
  union all select optional_item,   'optional' from public.menu
  union all select optional_item_2, 'optional' from public.menu
  union all select optional_item_3, 'optional' from public.menu
  union all select main_meal, case when meal_type = 'main' then 'main' else 'optional' end
    from public.orders where meal_type in ('main', 'optional')
) s
where btrim(coalesce(n, '')) <> ''
order by lower(btrim(n)), c
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 4. (007) note audiences, recipients and read receipts
-- ---------------------------------------------------------------------------
alter table public.notes
  add column if not exists audience text not null default 'all',
  add column if not exists target_roles text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.notes'::regclass and conname = 'notes_audience_check') then
    alter table public.notes add constraint notes_audience_check
      check (audience in ('all', 'role', 'users'));
  end if;
end $$;

create table if not exists public.note_recipients (
  note_id text not null references public.notes (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  primary key (note_id, user_id)
);
create index if not exists note_recipients_user_idx on public.note_recipients (user_id);

create table if not exists public.note_reads (
  note_id text not null references public.notes (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (note_id, user_id)
);
create index if not exists note_reads_user_idx on public.note_reads (user_id);
create index if not exists notes_department_idx on public.notes (department);

alter table public.note_recipients enable row level security;
alter table public.note_reads      enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Record in the tracking table used by `npm run db:migrate`
-- ---------------------------------------------------------------------------
insert into public.schema_migrations (name) values
  ('001_schema.sql'),
  ('002_seed_departments.sql'),
  ('003_seed_menu.sql'),
  ('004_role_hierarchy.sql'),
  ('005_orders_unique_meal_slot.sql'),
  ('006_menu_optionals_meal_library.sql'),
  ('007_note_recipients.sql'),
  ('deploy/2026-11-launch-old-db.sql')
on conflict (name) do nothing;

commit;

-- Quick check (read-only) — expected: meal_date_null = 0, slot_index = 1, migrations = 8
select
  (select count(*) from public.orders)                                         as orders,
  (select count(*) from public.orders where day is not null and meal_date is null) as meal_date_null,
  (select count(*) from pg_indexes where indexname = 'orders_unique_slot')      as slot_index,
  (select count(*) from public.meal_library)                                    as meal_library,
  (select count(*) from public.schema_migrations
     where name in ('001_schema.sql','002_seed_departments.sql','003_seed_menu.sql','004_role_hierarchy.sql',
                    '005_orders_unique_meal_slot.sql','006_menu_optionals_meal_library.sql',
                    '007_note_recipients.sql','deploy/2026-11-launch-old-db.sql')) as migrations;
