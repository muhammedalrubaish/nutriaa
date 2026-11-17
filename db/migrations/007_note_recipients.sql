-- 007_note_recipients.sql — note 11: choose who receives a dashboard note, and read receipts.
-- Safe to re-run. notes.created_by keeps holding the sender's username (as before);
-- recipients and readers are stored by user id.
alter table notes
  add column if not exists audience text not null default 'all' check (audience in ('all', 'role', 'users')),
  add column if not exists target_roles text[] not null default '{}';

create table if not exists note_recipients (
  note_id text not null references notes (id) on delete cascade,
  user_id text not null references users (id) on delete cascade,
  primary key (note_id, user_id)
);
create index if not exists note_recipients_user_idx on note_recipients (user_id);

create table if not exists note_reads (
  note_id text not null references notes (id) on delete cascade,
  user_id text not null references users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (note_id, user_id)
);
create index if not exists note_reads_user_idx on note_reads (user_id);
create index if not exists notes_department_idx on notes (department);

alter table note_recipients enable row level security;
alter table note_reads      enable row level security;
