-- Stage 4: private relational model for the retained feelings and weekly
-- tracker responsibilities. Login passwords are provisioned per environment
-- through the managed secret workflow and never appear in migration history.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'steady_migration_owner') then
    create role steady_migration_owner
      login
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      nobypassrls;
  else
    alter role steady_migration_owner
      login
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      nobypassrls;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'steady_runtime') then
    create role steady_runtime
      login
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      nobypassrls;
  else
    alter role steady_runtime
      login
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      nobypassrls;
  end if;
end
$$;

grant steady_migration_owner to postgres;
grant steady_runtime to postgres;

create schema steady authorization steady_migration_owner;

set role steady_migration_owner;

create table steady.feelings (
  id uuid primary key default gen_random_uuid(),
  legacy_mongo_id text unique,
  user_id text not null constraint feelings_user_id_nonempty check (btrim(user_id) <> ''),
  status smallint not null constraint feelings_status_valid check (status between 0 and 4),
  created_at timestamptz not null,
  comment text not null default '',
  activity_bow boolean not null default false,
  activity_lift boolean not null default false,
  activity_run boolean not null default false,
  activity_cycle boolean not null default false,
  activity_swim boolean not null default false
);

create index feelings_user_created_id_idx
  on steady.feelings (user_id, created_at desc, id desc);

create table steady.weekly_trackers (
  id uuid primary key default gen_random_uuid(),
  legacy_mongo_id text unique,
  user_id text not null constraint weekly_trackers_user_id_nonempty check (btrim(user_id) <> ''),
  week_of date not null,
  mood text not null constraint weekly_trackers_mood_valid
    check (mood in ('rough', 'low', 'steady', 'good', 'great')),
  tracker_version smallint not null default 1
    constraint weekly_trackers_version_positive check (tracker_version > 0),
  check_cardio boolean not null default false,
  check_strength boolean not null default false,
  check_mobility boolean not null default false,
  check_build boolean not null default false,
  check_archery boolean not null default false,
  check_hunt boolean not null default false,
  note_win text not null default '',
  note_challenge text not null default '',
  note_next_week text not null default '',
  updated_at timestamptz not null default statement_timestamp(),
  constraint weekly_trackers_user_week_unique unique (user_id, week_of)
);

alter table steady.feelings enable row level security;
alter table steady.feelings force row level security;
alter table steady.weekly_trackers enable row level security;
alter table steady.weekly_trackers force row level security;

create policy feelings_select_own
  on steady.feelings
  for select
  to steady_runtime
  using (
    user_id = nullif((select current_setting('app.auth0_sub', true)), '')
  );

create policy feelings_insert_own
  on steady.feelings
  for insert
  to steady_runtime
  with check (
    user_id = nullif((select current_setting('app.auth0_sub', true)), '')
  );

create policy weekly_trackers_select_own
  on steady.weekly_trackers
  for select
  to steady_runtime
  using (
    user_id = nullif((select current_setting('app.auth0_sub', true)), '')
  );

create policy weekly_trackers_insert_own
  on steady.weekly_trackers
  for insert
  to steady_runtime
  with check (
    user_id = nullif((select current_setting('app.auth0_sub', true)), '')
  );

create policy weekly_trackers_update_own
  on steady.weekly_trackers
  for update
  to steady_runtime
  using (
    user_id = nullif((select current_setting('app.auth0_sub', true)), '')
  )
  with check (
    user_id = nullif((select current_setting('app.auth0_sub', true)), '')
  );

reset role;

revoke all on schema steady from public, anon, authenticated, service_role;
revoke all on all tables in schema steady from public, anon, authenticated, service_role;
revoke all on all sequences in schema steady from public, anon, authenticated, service_role;
revoke all on all functions in schema steady from public, anon, authenticated, service_role;

alter default privileges for role steady_migration_owner in schema steady
  revoke all on tables from public, anon, authenticated, service_role;
alter default privileges for role steady_migration_owner in schema steady
  revoke all on sequences from public, anon, authenticated, service_role;
alter default privileges for role steady_migration_owner in schema steady
  revoke execute on functions from public, anon, authenticated, service_role;

grant usage on schema steady to steady_runtime;
grant select, insert on table steady.feelings to steady_runtime;
grant select, insert, update on table steady.weekly_trackers to steady_runtime;
