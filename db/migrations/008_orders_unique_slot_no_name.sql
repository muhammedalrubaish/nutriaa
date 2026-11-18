-- 008_orders_unique_slot_no_name.sql — Abdullah (2026-11-18): one order per bed and meal, whatever the name.
-- Replaces the unique meal slot of 005 (which included patient_name) with
--   (department, room, bed, meal_date, meal_time, person_type)
-- so a second order for the same room, bed, meal and person type is refused even under another name.
-- Same rule as findSlotOrder() in lib/repo.js and the import preview (lib/importParser.js).
--
-- Needs 005 (orders.meal_date). Safe to re-run: the index is rebuilt only when its definition differs.
-- Stops with a clear message (changing nothing) if existing orders already conflict under the new rule;
-- list them with deploy/2026-11-dup-no-name-conflicts.sql, fix or delete the extra rows, then run again.

do $$
declare
  n int;
  want constant text := '(department, room, bed, meal_date, meal_time, person_type)';
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'meal_date'
  ) then
    raise exception '008: orders.meal_date is missing — apply 005_orders_unique_meal_slot.sql first';
  end if;

  if exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'orders' and indexname = 'orders_unique_slot'
      and indexdef like 'CREATE UNIQUE INDEX % USING btree ' || want
  ) then
    raise notice '008: orders_unique_slot already has the new definition — nothing to do';
    return;
  end if;

  select count(*) into n from (
    select 1 from public.orders
    where meal_date is not null
    group by department, room, bed, meal_date, meal_time, person_type
    having count(*) > 1
  ) d;
  if n > 0 then
    raise exception '008: % meal slot(s) already hold more than one order (same department, room, bed, meal date, meal time and person type, different names). List them with deploy/2026-11-dup-no-name-conflicts.sql, fix or delete the extra rows, then run again.', n;
  end if;

  drop index if exists public.orders_unique_slot;
  execute 'create unique index orders_unique_slot on public.orders ' || want;
end $$;
