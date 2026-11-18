-- =============================================================================
-- 2026-11-dup-no-name.sql — Nutriaa: one order per bed and meal, whatever the name
-- (Abdullah, 2026-11-18). Applies db/migrations/008_orders_unique_slot_no_name.sql
-- on the EXISTING production database, in ONE transaction.
--
--  * Old rule (005): duplicate = same department, room, bed, meal date, meal time,
--    person type AND name.  New rule: the same WITHOUT the name.
--  * Safe to run more than once: the index is rebuilt only if it still has the
--    old definition; the schema_migrations row is "on conflict do nothing".
--  * ABORTS and changes nothing if existing orders already conflict under the
--    new rule — the error says how many. To see them, run
--    deploy/2026-11-dup-no-name-conflicts.sql (read-only), fix or delete the
--    extra rows, then run this file again.
--  * Changes no data: it only replaces one index.
--
-- How to run: Supabase dashboard → SQL Editor → paste the whole file → Run.
-- Expected last row: slot_index_def_ok = 1, migrations = 1 (orders = unchanged).
-- =============================================================================

begin;

-- Do not hang behind live traffic: give up if a lock is not granted in 10 s
-- (just run the file again a moment later), and cap each statement at 2 min.
set local lock_timeout = '10s';
set local statement_timeout = '120s';

do $$
declare
  n int;
  want constant text := '(department, room, bed, meal_date, meal_time, person_type)';
begin
  -- Needs the 2026-11 launch (005: orders.meal_date).
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'meal_date'
  ) then
    raise exception 'ABORTED, nothing changed: orders.meal_date is missing — run deploy/2026-11-launch-old-db.sql first.';
  end if;

  -- Already applied? Then there is nothing to rebuild.
  if exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'orders' and indexname = 'orders_unique_slot'
      and indexdef like 'CREATE UNIQUE INDEX % USING btree ' || want
  ) then
    raise notice 'orders_unique_slot already has the new definition — nothing to rebuild';
    return;
  end if;

  -- Pre-check: no meal slot may already hold two orders (different names).
  select count(*) into n from (
    select 1 from public.orders
    where meal_date is not null
    group by department, room, bed, meal_date, meal_time, person_type
    having count(*) > 1
  ) d;
  if n > 0 then
    raise exception 'ABORTED, nothing changed: % meal slot(s) already hold more than one order (same room, bed, meal date, meal time and person type under different names). Run deploy/2026-11-dup-no-name-conflicts.sql to list them, fix or delete the extra rows, then run this file again.', n;
  end if;

  drop index if exists public.orders_unique_slot;
  execute 'create unique index orders_unique_slot on public.orders ' || want;
end $$;

-- Record it in the tracking table used by `npm run db:migrate`.
create table if not exists public.schema_migrations (
  name       text primary key,
  applied_at timestamptz not null default now()
);
insert into public.schema_migrations (name) values ('008_orders_unique_slot_no_name.sql')
on conflict (name) do nothing;

commit;

-- Quick check (read-only) — expected: slot_index_def_ok = 1, migrations = 1, orders unchanged.
select
  (select count(*) from public.orders) as orders,
  (select count(*) from pg_indexes
     where schemaname = 'public' and tablename = 'orders' and indexname = 'orders_unique_slot'
       and indexdef like 'CREATE UNIQUE INDEX % USING btree (department, room, bed, meal_date, meal_time, person_type)') as slot_index_def_ok,
  (select count(*) from public.schema_migrations where name = '008_orders_unique_slot_no_name.sql') as migrations;
