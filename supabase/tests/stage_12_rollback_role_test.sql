begin;

set local statement_timeout = '10s';
set local role steady_runtime;
select set_config('app.auth0_sub', 'auth0|stage12-rollback-a', true);

insert into steady.feelings (user_id, status, created_at, comment)
values (
  'auth0|stage12-rollback-a', 4, '2026-08-19T00:00:00Z', 'synthetic-a'
);

insert into steady.weekly_trackers (user_id, week_of, mood)
values ('auth0|stage12-rollback-a', '2026-08-17', 'good');

select set_config('app.auth0_sub', 'auth0|stage12-rollback-b', true);
insert into steady.feelings (user_id, status, created_at, comment)
values (
  'auth0|stage12-rollback-b', 1, '2026-08-19T00:00:00Z', 'synthetic-b'
);

reset role;
set local role steady_rollback;
select set_config('app.auth0_sub', 'auth0|stage12-rollback-a', true);

do $$
declare
  linked_feelings int;
  linked_weekly int;
begin
  update steady.feelings
  set legacy_mongo_id = '68a51b400000000000000001'
  where user_id = 'auth0|stage12-rollback-a';
  get diagnostics linked_feelings = row_count;

  update steady.weekly_trackers
  set legacy_mongo_id = '68a51b400000000000000002'
  where user_id = 'auth0|stage12-rollback-a';
  get diagnostics linked_weekly = row_count;

  if linked_feelings <> 1 or linked_weekly <> 1 then
    raise exception 'rollback role did not link exactly its own rows';
  end if;

  update steady.feelings
  set legacy_mongo_id = '68a51b400000000000000003'
  where user_id = 'auth0|stage12-rollback-b';
  get diagnostics linked_feelings = row_count;
  if linked_feelings <> 0 then
    raise exception 'rollback role crossed the configured identity boundary';
  end if;

  begin
    update steady.feelings
    set comment = 'forbidden'
    where user_id = 'auth0|stage12-rollback-a';
    raise exception 'rollback role changed private content';
  exception
    when insufficient_privilege then null;
  end;
end
$$;

reset role;
rollback;
