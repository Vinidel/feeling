# Post-write rollback reconciliation

This operator-only Deno tool preserves acknowledged writes when traffic must
return from the TypeScript/Supabase replacement to the Go/MongoDB rollback
source after the cutover commit point.

It is deliberately separate from the request-serving API. It reads the final
Mongo checkpoint exports to determine the allowed Auth0 identities, reads those
identities through the forced-RLS `steady_rollback` role, and reconciles:

- target-only feelings into MongoDB with deterministic ObjectIds;
- every weekly tracker into MongoDB by its stable identity/week key; and
- newly assigned Mongo ObjectIds back into `legacy_mongo_id` using a
  column-scoped privilege.

The deterministic ID and link order make a retry safe if the process stops
between the MongoDB acknowledgement and the PostgreSQL mapping update. A
conflicting feeling or user/week identity stops the run instead of overwriting
an unrelated source record.

## Safety boundary

`plan` is read-only. `execute` writes to both MongoDB and PostgreSQL and is
permitted only after writes are suspended and an accountable human explicitly
authorizes the named environment. Never point a rehearsal at production.

Required secret environment values:

- `ROLLBACK_REPORT_KEY`: base64 encoding of exactly 32 random bytes;
- `ROLLBACK_DATABASE_URL`: `steady_migration_owner` TLS session connection;
- `ROLLBACK_MONGODB_URL`: MongoDB connection string for the rollback target.

Optional values:

- `ROLLBACK_DATABASE_SSL_MODE`: defaults to `require`; `disable` is disposable
  local testing only;
- `ROLLBACK_MONGODB_DATABASE`: defaults to `feeling`.

Run the tool in a dedicated container which mounts only the two checkpoint
files, the tool source read-only, and an empty report directory. Deno needs
environment access for the explicitly injected variables, read access to its
container filesystem, read-only system metadata used by the MongoDB driver,
write access only to the new report path, and network access only to the
selected PostgreSQL and MongoDB endpoints. Do not mount an operator home
directory or secret store into the container.

Both modes require a new owner-only report path and the final feelings/weekly
checkpoint exports. Reports contain only counts and keyed user hashes—not
comments, notes, raw Auth0 subjects, credentials, database URLs, or row IDs. Run
`plan` first. An authorized `execute` must be run twice: the first run performs
any required writes and the second must report no new writes, links, or updates.
