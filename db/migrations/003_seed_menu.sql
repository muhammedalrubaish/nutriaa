-- 003_seed_menu.sql — default weekly menu as seen in production (Friday/Saturday held
-- test text there, so they start empty). Safe to re-run: existing days are kept.
insert into menu (day, main_meal, optional_item) values
  ('sun', 'وجبة عادية',       'عصير طازج'),
  ('mon', 'وجبة دايت',        'فاكهة'),
  ('tue', 'وجبة مرضى السكري', 'زبادي'),
  ('wed', 'وجبة مرضى الضغط',  'سلطة'),
  ('thu', 'وجبة عادية',       'حلى'),
  ('fri', '',                 ''),
  ('sat', '',                 '')
on conflict (day) do nothing;
