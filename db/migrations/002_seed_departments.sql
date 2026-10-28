-- 002_seed_departments.sql — the four departments that were hardcoded in production.
-- Safe to re-run: existing rows are left untouched.
insert into departments (id, name, color, room_from, room_to, sort_order) values
  ('ob1',  'قسم الولادة ١', 'violet',  126, 148, 1),
  ('ob2',  'قسم الولادة ٢', 'sky',     150, 154, 2),
  ('ob3',  'قسم الولادة ٣', 'emerald', 101, 125, 3),
  ('gine', 'قسم الأرحام',   'rose',    326, 348, 4)
on conflict (id) do nothing;
