create schema if not exists wildhatch;
revoke all on schema wildhatch from public, anon, authenticated;

create table if not exists wildhatch.game_save (
  slot smallint primary key check (slot = 1),
  snapshot bytea not null,
  saved_at timestamptz not null default now()
);

alter table wildhatch.game_save enable row level security;
revoke all on wildhatch.game_save from public, anon, authenticated;

do $$
begin
  if not exists (select from pg_roles where rolname = 'wildhatch_checkpoint') then
    create role wildhatch_checkpoint nologin;
  end if;
end
$$;

grant usage on schema wildhatch to wildhatch_checkpoint;
grant select, insert, update on wildhatch.game_save to wildhatch_checkpoint;
create policy checkpoint_access on wildhatch.game_save
  for all to wildhatch_checkpoint
  using (slot = 1) with check (slot = 1);
