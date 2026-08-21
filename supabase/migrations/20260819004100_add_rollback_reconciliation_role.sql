-- Stage 12: operator-only role for mapping acknowledged target writes back to
-- MongoDB during an explicitly authorized post-commit rollback. The request
-- serving role does not receive these privileges.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'steady_rollback') then
    create role steady_rollback
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      nobypassrls;
  else
    alter role steady_rollback
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      nobypassrls;
  end if;
end
$$;

grant steady_rollback to steady_migration_owner;
grant steady_rollback to postgres;
grant usage on schema steady to steady_rollback;
grant select on steady.feelings, steady.weekly_trackers to steady_rollback;
grant update (legacy_mongo_id) on steady.feelings, steady.weekly_trackers
  to steady_rollback;

create policy feelings_rollback_select_own
  on steady.feelings
  for select
  to steady_rollback
  using (
    user_id = nullif((select current_setting('app.auth0_sub', true)), '')
  );

create policy feelings_rollback_link_own
  on steady.feelings
  for update
  to steady_rollback
  using (
    user_id = nullif((select current_setting('app.auth0_sub', true)), '')
  )
  with check (
    user_id = nullif((select current_setting('app.auth0_sub', true)), '')
  );

create policy weekly_rollback_select_own
  on steady.weekly_trackers
  for select
  to steady_rollback
  using (
    user_id = nullif((select current_setting('app.auth0_sub', true)), '')
  );

create policy weekly_rollback_link_own
  on steady.weekly_trackers
  for update
  to steady_rollback
  using (
    user_id = nullif((select current_setting('app.auth0_sub', true)), '')
  )
  with check (
    user_id = nullif((select current_setting('app.auth0_sub', true)), '')
  );
