-- 004_role_hierarchy.sql — ranked roles: sysadmin > manager > supervisor > specialist / distributor.
-- Paste into Supabase → SQL Editor and run once (or `npm run db:migrate`). Safe to re-run.
--
-- Before this, 'supervisor' meant "every permission". Those accounts keep everything they had:
-- the original admin (username 'admin', else the oldest supervisor) becomes the single system admin,
-- every other former supervisor becomes a manager. 'supervisor' now means the new, operations-only role.

alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('sysadmin', 'manager', 'supervisor', 'specialist', 'distributor'));

do $$
begin
  -- Only on the first run: once a system admin exists, 'supervisor' rows are the new role.
  if not exists (select 1 from users where role = 'sysadmin') then
    update users set role = 'sysadmin'
    where id = (
      select id from users where role = 'supervisor'
      order by (username = 'admin') desc, created_at, id
      limit 1
    );
    update users set role = 'manager' where role = 'supervisor';
  end if;
end $$;

-- At most one system admin, enforced by the database as well as the app.
create unique index if not exists users_single_sysadmin on users (role) where role = 'sysadmin';
