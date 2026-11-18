-- =============================================================================
-- 2026-11-dup-no-name.sql — Nutriaa: one order per bed and meal, whatever the
-- name (Abdullah, 2026-11-18). Applies db/migrations/008_orders_unique_slot_no_name.sql
-- on the EXISTING production database, in ONE transaction.
--
--  * ADDS the partial unique index orders_unique_bed_slot on
--    (department, room, bed, meal_date, meal_time, person_type)
--    for meal dates from 2026-11-19 on. Same bed + same meal = duplicate, even
--    under another name.
--  * Past orders are NOT touched and nothing has to be deleted: meals before
--    2026-11-19 are outside the new index.
--  * The existing index orders_unique_slot (with the name) stays unchanged.
--  * Changes no data. Safe to run more than once.
--  * Aborts and changes nothing only if orders for meal dates from 2026-11-19
--    already conflict (expected: none). The error says how many; list them with
--    deploy/2026-11-dup-no-name-conflicts.sql (read-only).
--
-- How to run: Supabase dashboard → SQL Editor → paste the whole file → Run.
-- Expected last row: old_slot_index = 1, bed_slot_index_ok = 1, migrations = 1,
-- orders = unchanged.
-- =============================================================================

begin;

-- Do not hang behind live traffic: give up if a lock is not granted in 10 s
-- (just run the file again a moment later), and cap each statement at 2 min.
set local lock_timeout = '10s';
set local statement_timeout = '120s';

do $$
declare
  n int;
  def constant text := 'CREATE UNIQUE INDEX orders_unique_bed_slot ON public.orders USING btree (department, room, bed, meal_date, meal_time, person_type) WHERE (meal_date >= ''2026-11-19''::date)';
begin
  -- Needs the 2026-11 launch (005: orders.meal_date).
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'meal_date'
  ) then
    raise exception 'ABORTED, nothing changed: orders.meal_date is missing — run deploy/2026-11-launch-old-db.sql first.';
  end if;

  -- Already applied? Then there is nothing to build.
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'orders_unique_bed_slot' and indexdef = def) then
    raise notice 'orders_unique_bed_slot already exists — nothing to build';
    return;
  end if;

  -- Pre-check: from meal date 2026-11-19 on, no bed/meal slot may already hold two orders.
  select count(*) into n from (
    select 1 from public.orders
    where meal_date >= date '2026-11-19'
    group by department, room, bed, meal_date, meal_time, person_type
    having count(*) > 1
  ) d;
  if n > 0 then
    raise exception 'ABORTED, nothing changed: % meal slot(s) from 2026-11-19 on already hold more than one order (same room, bed, meal date, meal time and person type under different names). Run deploy/2026-11-dup-no-name-conflicts.sql to list them, fix or delete the extra rows, then run this file again.', n;
  end if;

  drop index if exists public.orders_unique_bed_slot;
  create unique index orders_unique_bed_slot
    on public.orders (department, room, bed, meal_date, meal_time, person_type)
    where meal_date >= date '2026-11-19';
end $$;

-- Record it in the tracking table used by `npm run db:migrate`.
create table if not exists public.schema_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);
insert into public.schema_migrations (name) values ('008_orders_unique_slot_no_name.sql')
on conflict (name) do nothing;

commit;

-- Quick check (read-only) — expected: old_slot_index = 1, bed_slot_index_ok = 1, migrations = 1, orders unchanged.
select
  (select count(*) from public.orders) as orders,
  (select count(*) from pg_indexes
     where schemaname = 'public' and indexname = 'orders_unique_slot'
       and indexdef like '% USING btree (department, room, bed, meal_date, meal_time, person_type, patient_name)') as old_slot_index,
  (select count(*) from pg_indexes
     where schemaname = 'public' and indexname = 'orders_unique_bed_slot'
       and indexdef = 'CREATE UNIQUE INDEX orders_unique_bed_slot ON public.orders USING btree (department, room, bed, meal_date, meal_time, person_type) WHERE (meal_date >= ''2026-11-19''::date)') as bed_slot_index_ok,
  (select count(*) from public.schema_migrations where name = '008_orders_unique_slot_no_name.sql') as migrations;
