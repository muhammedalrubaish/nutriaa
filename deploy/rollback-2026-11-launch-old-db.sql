-- =============================================================================
-- rollback-2026-11-launch-old-db.sql — undo deploy/2026-11-launch-old-db.sql
--
-- RUN ONLY IF REALLY NEEDED, and only AFTER the app code is back on the
-- previous version (the new code needs these columns/tables; the old code
-- works fine with them in place, so usually you do NOT need this file).
-- Take a backup first. One transaction; safe to run more than once.
--
-- DATA THIS ROLLBACK LOSES (permanently, unless restored from the backup):
--   * menu.optional_item_2 / optional_item_3  — the 2nd and 3rd optional meal of each day
--     (optional_item, the 1st one, is kept)
--   * meal_library                           — the whole meal-name library (pickers)
--   * notes.audience / target_roles, note_recipients — who each note was sent to
--   * note_reads                             — read receipts
--   * orders.meal_date                       — derived only; recomputed if re-applied (no loss)
--   * the duplicate protection (orders_unique_slot) is gone: duplicates can be entered again
--   Orders themselves (incl. orders entered after launch), users, departments,
--   settings and the notes' text are NOT touched — except as below.
--
-- PRIVACY: the old app shows every note to everyone. Notes sent to specific
-- roles/users would therefore become visible to all staff after rollback.
-- This file DELETES those private notes (audience <> 'all') by default.
-- To keep them visible to everyone instead, comment out the line marked [PRIVATE].
-- =============================================================================

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'notes' and column_name = 'audience') then
    execute 'delete from public.notes where audience <> ''all'''; -- [PRIVATE]
  end if;
end $$;

-- 007
drop table if exists public.note_reads;
drop table if exists public.note_recipients;
drop index if exists public.notes_department_idx;
alter table public.notes drop constraint if exists notes_audience_check;
alter table public.notes
  drop column if exists audience,
  drop column if exists target_roles;

-- 006
drop table if exists public.meal_library;
alter table public.menu
  drop column if exists optional_item_2,
  drop column if exists optional_item_3;

-- 005 (indexes go with the column, dropped explicitly for clarity)
drop index if exists public.orders_unique_slot;
drop index if exists public.orders_meal_date_idx;
drop index if exists public.orders_created_by_idx;
drop index if exists public.orders_main_meal_idx;
alter table public.orders drop column if exists meal_date;

-- Tracking: forget 005–007 so the launch file / `npm run db:migrate` can re-apply them.
-- 001–004 stay recorded (they describe the schema that is still there).
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    delete from public.schema_migrations where name in (
      '005_orders_unique_meal_slot.sql', '006_menu_optionals_meal_library.sql',
      '007_note_recipients.sql', 'deploy/2026-11-launch-old-db.sql');
  end if;
end $$;

commit;
