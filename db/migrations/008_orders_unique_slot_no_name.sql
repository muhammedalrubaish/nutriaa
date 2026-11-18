-- 008_orders_unique_slot_no_name.sql — Abdullah (2026-11-18): one order per bed and meal, whatever the name.
-- ADDS a partial unique index orders_unique_bed_slot on
--   (department, room, bed, meal_date, meal_time, person_type) WHERE meal_date >= 2026-11-19
-- so, from meal date 2026-11-19 on, a second order for the same room, bed, meal and person type is refused
-- even under another name. Older meals are left alone: past orders with two names in one slot stay as they
-- are, and nobody has to delete history. The 005 index orders_unique_slot (with patient_name) is kept
-- unchanged and still guards every date against the exact same order twice.
-- Same rule as findSlotOrder() in lib/repo.js and the import preview (lib/importParser.js).
--
-- Needs 005 (orders.meal_date). Safe to re-run: the index is (re)built only when missing or different.
-- Stops with a clear message (changing nothing) if orders for meal dates from 2026-11-19 already conflict;
-- list them with deploy/2026-11-dup-no-name-conflicts.sql.

do $$
declare
  n int;
  def constant text := 'CREATE UNIQUE INDEX orders_unique_bed_slot ON public.orders USING btree (department, room, bed, meal_date, meal_time, person_type) WHERE (meal_date >= ''2026-11-19''::date)';
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'meal_date'
  ) then
    raise exception '008: orders.meal_date is missing — apply 005_orders_unique_meal_slot.sql first';
  end if;

  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'orders_unique_bed_slot' and indexdef = def) then
    raise notice '008: orders_unique_bed_slot already exists — nothing to do';
    return;
  end if;

  select count(*) into n from (
    select 1 from public.orders
    where meal_date >= date '2026-11-19'
    group by department, room, bed, meal_date, meal_time, person_type
    having count(*) > 1
  ) d;
  if n > 0 then
    raise exception '008: % meal slot(s) from 2026-11-19 on already hold more than one order (same department, room, bed, meal date, meal time and person type, different names). List them with deploy/2026-11-dup-no-name-conflicts.sql, fix or delete the extra rows, then run again.', n;
  end if;

  drop index if exists public.orders_unique_bed_slot;
  create unique index orders_unique_bed_slot
    on public.orders (department, room, bed, meal_date, meal_time, person_type)
    where meal_date >= date '2026-11-19';
end $$;
