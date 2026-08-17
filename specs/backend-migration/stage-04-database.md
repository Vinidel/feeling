# Stage 4 — private Postgres schema and row isolation

Stage 4 creates the relational target for the retained feelings and weekly
tracker responsibilities. It does not migrate representative or production
data and does not connect the Deno API to the database.

## Hosted target

- Supabase project: `Steady non-prod` (`qzsdmhptclzqndzsqpax`)
- Region: Sydney (`ap-southeast-2`)
- PostgreSQL: 17
- Data API: disabled
- Application schema: `steady` (private)
- Migration applied: `20260817053317_create_private_feelings_and_weekly_schema.sql`

The hosted tables are empty after validation. Remote test fixtures are created
inside one transaction and deliberately rolled back.

## Relational model

`steady.feelings` retains the source event timestamp and provides a new UUID
primary key. `legacy_mongo_id` is nullable and unique so Stage 5 can perform
idempotent source-to-target reconciliation. Status is restricted to `0..4`,
activity flags and comment are non-null with neutral defaults, and the read path
is supported by `(user_id, created_at desc, id desc)`.

`steady.weekly_trackers` has a UUID primary key and the same nullable unique
legacy identifier. `(user_id, week_of)` is unique for atomic upserts. Mood and
tracker version are constrained, checklist and note fields are non-null with
neutral defaults, and `updated_at` defaults to the database statement time.

No chat, agent, job, Supabase Auth, Storage, Realtime, Edge Function, JSONB, or
retired source responsibility was reproduced.

## Roles and authorization

`steady_migration_owner` owns the schema and tables. It is a login role without
superuser, database creation, role creation, inheritance, or RLS bypass. It is
used through the TLS Supavisor session endpoint when the preferred direct IPv6
endpoint is unavailable.

`steady_runtime` is a separate login role with the same restricted role
attributes. It receives only:

- schema `USAGE`;
- `SELECT, INSERT` on `steady.feelings`;
- `SELECT, INSERT, UPDATE` on `steady.weekly_trackers`.

It has no `DELETE`, feelings `UPDATE`, ownership, `BYPASSRLS`, or Supabase
service-role capability. `anon`, `authenticated`, and `service_role` have no
access to the private schema.

Both tables use enabled and forced RLS. The Deno API must open a transaction,
set the verified Auth0 subject with:

```sql
select set_config('app.auth0_sub', $1, true);
```

and run every user-data statement in that same transaction. Policies compare
`user_id` with the transaction-local setting. A missing or empty identity sees
no rows and cannot insert. Weekly updates use both `USING` and `WITH CHECK`, so
ownership cannot be reassigned.

## Connection and secret handling

Secret values are not stored in the repository. The following macOS Keychain
services hold the non-production credentials and composed URLs:

| Service | Account | Purpose |
| --- | --- | --- |
| `feeling/supabase/steady-nonprod/migration-owner-password` | `steady_migration_owner` | Schema-owner password |
| `feeling/supabase/steady-nonprod/runtime-password` | `steady_runtime` | Runtime password |
| `feeling/supabase/steady-nonprod/migration-database-url` | `steady_migration_owner` | TLS session-pooler URL |
| `feeling/supabase/steady-nonprod/runtime-database-url` | `steady_runtime` | TLS transaction-pooler URL |

The runtime uses Supavisor transaction mode on port `6543`, one short
transaction per request, and postgres.js `prepare: false`. The migration role
uses Supavisor session mode on port `5432` from the current IPv4-only operator
environment. Direct TLS remains preferred from an IPv6-capable environment.

## Reproduction and verification

Local Supabase ports use `5532x` to coexist with another local Supabase project.
The local Data API and pooler remain disabled.

From the repository root:

```bash
supabase db reset --local
docker exec -i supabase_db_steady-backend-migration \
  psql --username postgres --dbname postgres --set ON_ERROR_STOP=1 \
  < supabase/tests/stage_04_schema_test.sql
supabase db advisors --local --type all --level info --fail-on warn
```

The SQL test is transaction-wrapped and covers schema metadata, constraints,
defaults, indexes, atomic weekly upsert, grants, missing identity, two synthetic
Auth0 subjects, ownership reassignment, delete denial, owner behavior under
forced RLS, and rollback of all fixtures.

`supabase/tests/stage_04_remote_runtime_test.ts` repeats runtime-level TLS,
transaction pooling, insert/upsert, and two-subject isolation checks against an
explicitly selected environment. It requires `DATABASE_URL`; the value must
come from an approved secret store. All fixtures are rolled back.

`supabase/tests/stage_04_rollback.sql` is for disposable local/test databases
only. It removes the `steady` schema and the two Stage 4 roles. Hosted rollback
must be separately reviewed and authorized; no hosted rollback was needed or
performed.

## Stage boundary

The schema is ready for Stage 5 migration design and validation, but the manual
encrypted backup destination in Australia and restore rehearsal remain required
before representative data is loaded. The existing Go/Heroku implementation is
unchanged and remains the active rollback source.
