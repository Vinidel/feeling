begin;

set local statement_timeout = '10s';

do $$
declare
  feelings_owner text;
  weekly_owner text;
  feelings_index text;
begin
  select tableowner into feelings_owner
  from pg_tables
  where schemaname = 'steady' and tablename = 'feelings';

  select tableowner into weekly_owner
  from pg_tables
  where schemaname = 'steady' and tablename = 'weekly_trackers';

  if feelings_owner <> 'steady_migration_owner'
    or weekly_owner <> 'steady_migration_owner' then
    raise exception 'migration owner does not own both application tables';
  end if;

  if exists (
    select 1 from pg_roles
    where rolname in ('steady_migration_owner', 'steady_runtime')
      and (rolsuper or rolcreatedb or rolcreaterole or rolinherit or rolbypassrls)
  ) then
    raise exception 'a Stage 4 role has a forbidden role attribute';
  end if;

  if not pg_has_role(
    'steady_migration_owner',
    'steady_runtime',
    'member'
  ) then
    raise exception 'migration owner cannot explicitly assume the RLS runtime role';
  end if;

  if (select data_type from information_schema.columns
      where table_schema = 'steady' and table_name = 'feelings' and column_name = 'id') <> 'uuid'
    or (select data_type from information_schema.columns
      where table_schema = 'steady' and table_name = 'feelings' and column_name = 'status') <> 'smallint'
    or (select data_type from information_schema.columns
      where table_schema = 'steady' and table_name = 'feelings' and column_name = 'created_at') <> 'timestamp with time zone'
    or (select is_nullable from information_schema.columns
      where table_schema = 'steady' and table_name = 'feelings' and column_name = 'legacy_mongo_id') <> 'YES'
    or (select data_type from information_schema.columns
      where table_schema = 'steady' and table_name = 'weekly_trackers' and column_name = 'week_of') <> 'date'
    or (select data_type from information_schema.columns
      where table_schema = 'steady' and table_name = 'weekly_trackers' and column_name = 'tracker_version') <> 'smallint'
    or (select data_type from information_schema.columns
      where table_schema = 'steady' and table_name = 'weekly_trackers' and column_name = 'updated_at') <> 'timestamp with time zone'
    or (select is_nullable from information_schema.columns
      where table_schema = 'steady' and table_name = 'weekly_trackers' and column_name = 'legacy_mongo_id') <> 'YES' then
    raise exception 'a retained column type or legacy ID nullability is incorrect';
  end if;

  if has_table_privilege('steady_runtime', 'steady.feelings', 'DELETE')
    or has_table_privilege('steady_runtime', 'steady.feelings', 'UPDATE')
    or has_table_privilege('steady_runtime', 'steady.weekly_trackers', 'DELETE') then
    raise exception 'runtime role has a forbidden table privilege';
  end if;

  if not has_table_privilege('steady_runtime', 'steady.feelings', 'SELECT, INSERT')
    or not has_table_privilege('steady_runtime', 'steady.weekly_trackers', 'SELECT, INSERT, UPDATE') then
    raise exception 'runtime role is missing an approved table privilege';
  end if;

  if has_schema_privilege('anon', 'steady', 'USAGE')
    or has_schema_privilege('authenticated', 'steady', 'USAGE')
    or has_schema_privilege('service_role', 'steady', 'USAGE') then
    raise exception 'a Data API role can use the private schema';
  end if;

  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'steady'
      and c.relname in ('feelings', 'weekly_trackers')
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then
    raise exception 'RLS is not enabled and forced on both tables';
  end if;

  if (select count(*) from pg_policies where schemaname = 'steady') <> 5 then
    raise exception 'unexpected number of RLS policies';
  end if;

  select pg_get_indexdef(indexrelid) into feelings_index
  from pg_index
  where indexrelid = 'steady.feelings_user_created_id_idx'::regclass;

  if feelings_index not like '%(user_id, created_at DESC, id DESC)%' then
    raise exception 'feelings deterministic-order index is incorrect: %', feelings_index;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'steady.weekly_trackers'::regclass
      and conname = 'weekly_trackers_user_week_unique'
      and contype = 'u'
  ) then
    raise exception 'weekly user/week uniqueness constraint is missing';
  end if;
end
$$;

set local role steady_runtime;
select set_config('app.auth0_sub', 'auth0|stage4-user-a', true);

do $$
declare
  inserted_id uuid;
  stored_comment text;
  stored_defaults boolean;
begin
  insert into steady.feelings (legacy_mongo_id, user_id, status, created_at)
  values ('stage4-feeling-a', 'auth0|stage4-user-a', 3, '2026-01-02T03:04:05Z')
  returning id, comment,
    not activity_bow and not activity_lift and not activity_run
      and not activity_cycle and not activity_swim
  into inserted_id, stored_comment, stored_defaults;

  if inserted_id is null or stored_comment <> '' or not stored_defaults then
    raise exception 'feelings database-generated ID or defaults are incorrect';
  end if;

  begin
    insert into steady.feelings (legacy_mongo_id, user_id, status, created_at)
    values ('stage4-feeling-a', 'auth0|stage4-user-a', 2, statement_timestamp());
    raise exception 'duplicate feeling legacy ID was accepted';
  exception when unique_violation then
    null;
  end;

  begin
    insert into steady.feelings (user_id, status, created_at)
    values ('auth0|stage4-user-a', 5, statement_timestamp());
    raise exception 'invalid feeling status was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into steady.feelings (user_id, status, created_at)
    values ('auth0|stage4-user-b', 3, statement_timestamp());
    raise exception 'cross-user feeling insert was accepted';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

do $$
declare
  first_id uuid;
  second_id uuid;
  first_updated_at timestamptz;
  second_updated_at timestamptz;
  stored_mood text;
  stored_version smallint;
begin
  insert into steady.weekly_trackers (legacy_mongo_id, user_id, week_of, mood)
  values ('stage4-weekly-a', 'auth0|stage4-user-a', '2026-01-05', 'steady')
  returning id, updated_at into first_id, first_updated_at;

  begin
    insert into steady.weekly_trackers (legacy_mongo_id, user_id, week_of, mood)
    values ('stage4-weekly-a', 'auth0|stage4-user-a', '2026-01-12', 'steady');
    raise exception 'duplicate weekly legacy ID was accepted';
  exception when unique_violation then
    null;
  end;

  perform pg_sleep(0.01);

  insert into steady.weekly_trackers (
    user_id,
    week_of,
    mood,
    tracker_version,
    check_cardio,
    note_win,
    updated_at
  ) values (
    'auth0|stage4-user-a',
    '2026-01-05',
    'good',
    1,
    true,
    'synthetic win',
    clock_timestamp()
  )
  on conflict (user_id, week_of) do update
  set mood = excluded.mood,
      tracker_version = 1,
      check_cardio = excluded.check_cardio,
      note_win = excluded.note_win,
      updated_at = clock_timestamp()
  returning id, mood, tracker_version, updated_at
  into second_id, stored_mood, stored_version, second_updated_at;

  if first_id <> second_id or stored_mood <> 'good' or stored_version <> 1
    or second_updated_at <= first_updated_at then
    raise exception 'weekly atomic upsert or timestamp behavior is incorrect';
  end if;

  begin
    insert into steady.weekly_trackers (user_id, week_of, mood)
    values ('auth0|stage4-user-a', '2026-01-12', 'unknown');
    raise exception 'invalid weekly mood was accepted';
  exception when check_violation then
    null;
  end;

  begin
    insert into steady.weekly_trackers (
      user_id,
      week_of,
      mood,
      tracker_version
    ) values ('auth0|stage4-user-a', '2026-01-12', 'steady', 0);
    raise exception 'invalid weekly version was accepted';
  exception when check_violation then
    null;
  end;

  begin
    update steady.weekly_trackers
    set user_id = 'auth0|stage4-user-b'
    where id = first_id;
    raise exception 'weekly ownership reassignment was accepted';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from steady.weekly_trackers where id = first_id;
    raise exception 'weekly delete was accepted';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

select set_config('app.auth0_sub', 'auth0|stage4-user-b', true);

do $$
begin
  if (select count(*) from steady.feelings) <> 0
    or (select count(*) from steady.weekly_trackers) <> 0 then
    raise exception 'cross-user SELECT exposed rows';
  end if;
end
$$;

select set_config('app.auth0_sub', '', true);

do $$
begin
  if (select count(*) from steady.feelings) <> 0 then
    raise exception 'missing transaction identity exposed feelings';
  end if;

  begin
    insert into steady.feelings (user_id, status, created_at)
    values ('auth0|stage4-user-a', 3, statement_timestamp());
    raise exception 'missing transaction identity allowed insert';
  exception when insufficient_privilege then
    null;
  end;
end
$$;

reset role;
set local role steady_migration_owner;
select set_config('app.auth0_sub', '', true);

do $$
begin
  if (select count(*) from steady.feelings) <> 0 then
    raise exception 'forced RLS did not constrain the table owner';
  end if;
end
$$;

reset role;
rollback;
