-- 006_menu_optionals_meal_library.sql — notes 6 and 8. Safe to re-run.

-- Note 6: three optional meals per day (optional_item stays slot 1).
alter table menu
  add column if not exists optional_item_2 text not null default '',
  add column if not exists optional_item_3 text not null default '';

-- Note 8: a library of meal names for the searchable menu pickers.
create table if not exists meal_library (
  id         text primary key default ('m_' || substr(md5(random()::text || clock_timestamp()::text), 1, 16)),
  name       text not null check (length(btrim(name)) between 1 and 200),
  category   text not null default 'any' check (category in ('main', 'optional', 'any')),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists meal_library_name_key on meal_library (lower(btrim(name)));
alter table meal_library enable row level security;

-- Seed from the weekly menu and the menu meals already ordered (custom free text is left out).
insert into meal_library (name, category)
select distinct on (lower(btrim(n))) btrim(n), c
from (
  select main_meal as n, 'main' as c from menu
  union all select optional_item, 'optional' from menu
  union all select optional_item_2, 'optional' from menu
  union all select optional_item_3, 'optional' from menu
  union all select main_meal, case when meal_type = 'main' then 'main' else 'optional' end
    from orders where meal_type in ('main', 'optional')
) s
where btrim(coalesce(n, '')) <> ''
order by lower(btrim(n)), c
on conflict do nothing;
