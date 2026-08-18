# Stage 5 migration CLI

This standalone Deno tool validates relaxed MongoDB Extended JSON arrays,
imports only accepted records through the RLS-constrained PostgreSQL runtime
role, and produces deterministic reports that exclude comments, notes, raw Auth0
subjects, credentials, and database URLs.

It is not part of the request-serving API. It has no MongoDB network client:
source reads and export custody remain separate, explicitly authorized operator
actions. The input files must be JSON arrays shaped like `mongoexport` relaxed
Extended JSON, including `{ "$oid": "..." }` IDs and `{ "$date": "..." }`
timestamps.

The only approved source transformation is deliberately narrow: a feeling whose
`createdat` is BSON/Go zero time (`0001-01-01T00:00:00Z`) receives the creation
timestamp encoded in its MongoDB ObjectId. Every such record appears in the
report as `go_zero_time_to_object_id_time`. Other canonical numeric dates remain
validation errors rather than being silently coerced.

## Invocation

Set these values through an operator-only secret mechanism:

- `MIGRATION_REPORT_KEY`: base64 encoding of exactly 32 random bytes. Keep the
  same key for reports that need comparable user and structural hashes.
- `MIGRATION_DATABASE_URL`: required only for `import` and `reconcile`; use the
  `steady_migration_owner` session connection, never the request-serving
  credential.
- `MIGRATION_DATABASE_SSL_MODE`: `require` by default; `disable` is allowed only
  for a disposable local PostgreSQL test.

Run Deno with only the two input paths, two output paths, exact environment
names, and target database host permitted. For example:

```text
deno run --frozen --no-prompt \
  --allow-env=MIGRATION_REPORT_KEY,MIGRATION_DATABASE_URL,MIGRATION_DATABASE_SSL_MODE \
  '--ignore-env=PG*' \
  --allow-read=<feelings.json>,<weekly_trackers.json> \
  --allow-write=<report.json>,<exceptions.json> \
  --allow-net=<database-host>:<database-port> \
  main.ts dry-run \
  --feelings <feelings.json> \
  --weekly-trackers <weekly_trackers.json> \
  --report <new-report.json> \
  --exceptions <new-exceptions.json>
```

Use `import` to insert missing legacy IDs and reconcile full source/target
content in one short transaction. Use `reconcile` to perform the same comparison
without inserts and report target-only rows. Output files must not already
exist; the tool reserves both with owner-only permissions before any database
write and removes incomplete outputs if the operation fails. Any source
exception prevents database writes and returns exit code 2 after both sanitized
outputs are written.

Never place real exports or generated reports in the repository. Each real
cleanup, transformation, quarantine, or exclusion requires Vinicius Delascio's
explicit recorded decision before the migration can be accepted.
