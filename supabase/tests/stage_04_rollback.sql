-- Local/test rollback rehearsal only. Never run this against production.
drop schema if exists steady cascade;

revoke steady_runtime from steady_migration_owner;
drop owned by steady_runtime;
revoke steady_runtime from postgres;
drop role if exists steady_runtime;

drop owned by steady_migration_owner;
revoke steady_migration_owner from postgres;
drop role if exists steady_migration_owner;
