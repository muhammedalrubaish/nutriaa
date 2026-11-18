-- 005_orders_unique_meal_slot.sql — note 7: no duplicate orders for the same meal.
-- Safe to re-run (IF NOT EXISTS / drop-then-create of the same index).
--
-- meal_date = the nearest date on or after the entry date (created_at in Asia/Riyadh) whose weekday is
-- the chosen `day`. The database computes it (the client cannot set it) and backfills existing rows.
-- Same rule as mealDateFor() in lib/time.js. An order for Wednesday lunch entered on Tuesday therefore
-- blocks a second Wednesday-lunch order entered on Wednesday, but not next week's, and not Tuesday's lunch.
--
-- The unique key: department, room, bed, meal_date, meal_time, person_type, patient_name.

-- Stop with a clear message (instead of a cryptic index error) if old data already holds duplicates.
-- Find them with the query inside this block and delete or fix the extra rows first.
do $$
declare n int;
begin
  select count(*) into n from (
    select 1 from orders
    where day is not null
    group by department, room, bed,
      (created_at at time zone 'Asia/Riyadh')::date
        + ((array_position(array['sun','mon','tue','wed','thu','fri','sat']::text[], day) - 1
            - extract(dow from (created_at at time zone 'Asia/Riyadh')::date)::int + 7) % 7),
      meal_time, person_type, patient_name
    having count(*) > 1
  ) d;
  if n > 0 then
    raise exception '005: % duplicate meal slot(s) in orders; resolve them before applying this migration', n;
  end if;
end $$;

alter table orders
  add column if not exists meal_date date
  generated always as (
    (created_at at time zone 'Asia/Riyadh')::date
    + ((array_position(array['sun','mon','tue','wed','thu','fri','sat']::text[], day) - 1
        - extract(dow from (created_at at time zone 'Asia/Riyadh')::date)::int + 7) % 7)
  ) stored;

drop index if exists orders_unique_slot;
create unique index orders_unique_slot
  on orders (department, room, bed, meal_date, meal_time, person_type, patient_name);
create index if not exists orders_meal_date_idx on orders (meal_date);
create index if not exists orders_created_by_idx on orders (created_by);
create index if not exists orders_main_meal_idx on orders (main_meal);
