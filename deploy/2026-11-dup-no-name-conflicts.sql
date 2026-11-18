-- =============================================================================
-- 2026-11-dup-no-name-conflicts.sql — READ-ONLY. Lists the orders that would
-- stop deploy/2026-11-dup-no-name.sql: meal slots (same department, room, bed,
-- meal date, meal time and person type) with meal date from 2026-11-19 on that
-- already hold more than one order, usually under different names.
-- Older meals are not listed: the new index does not cover them. Changes nothing.
--
-- How to run: Supabase dashboard → SQL Editor → paste → Run.
-- Every row of one slot shares slot_no; keep one per slot (normally the first,
-- slot_order = 1) and fix or delete the others, then run the main file again.
-- No rows = no conflicts (expected).
-- =============================================================================

select
  dense_rank() over (order by o.department, o.room, o.bed, o.meal_date, o.meal_time, o.person_type) as slot_no,
  row_number() over (partition by o.department, o.room, o.bed, o.meal_date, o.meal_time, o.person_type
                     order by o.created_at, o.id) as slot_order,
  o.id, o.department, o.room, o.bed, o.meal_date, o.meal_time, o.person_type, o.patient_name,
  o.created_at at time zone 'Asia/Riyadh' as created_at_riyadh,
  o.created_by_name
from public.orders o
join (
  select department, room, bed, meal_date, meal_time, person_type
  from public.orders
  where meal_date >= date '2026-11-19'
  group by department, room, bed, meal_date, meal_time, person_type
  having count(*) > 1
) d using (department, room, bed, meal_date, meal_time, person_type)
order by slot_no, slot_order;
