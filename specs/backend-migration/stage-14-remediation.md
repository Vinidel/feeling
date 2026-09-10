# Stage 14 — backup and rollback-security remediation

Recorded: 2026-08-25 (Australia/Brisbane)

Stage 14 implements and rehearses the controls approved in the amended brief,
design, and plan. It does not perform the production Mongo credential rotation,
Heroku maintenance/token removal, deployment, traffic switch, or deletion.

## Supabase and backup boundary

Read-only provider checks reported both `Steady non-prod` and `Steady backups`
active and healthy in Sydney (`ap-southeast-2`) on PostgreSQL 17.6. The
`database-backups` Storage bucket remains private. The current Supabase
changelog and CLI 2.114.0 command help were reviewed; no relevant breaking
change blocks this operator-managed workflow.

`tools/backup/` now provides a dependency-free Deno workflow around the
existing AES-256-GCM primitive:

- the archive accepts exactly `roles.sql`, `schema.sql`, and `data.sql`;
- the content-free manifest accepts only environment, UTC timestamp,
  PostgreSQL/Supabase CLI versions, Sydney source/destination regions, 14-digit
  migration versions, aggregate counts, component sizes, and SHA-256 values;
- unknown manifest fields, unsafe metadata, missing/reordered components,
  trailing payload, checksum mismatch, wrong key, and tampering all fail;
- `pack` archives in memory, writes only new mode-0600 ciphertext, and refuses
  overwrite;
- `verify` authenticates before writing and creates only a new mode-0700 output
  directory; and
- JSON evidence contains no SQL, comment, note, raw Auth0 subject, credential,
  connection URL, or private field value.

Eight pinned Deno tests cover archive, encryption, manifest, tampering,
plaintext-exposure, overwrite, and round-trip behavior.

## Fresh backup and restore rehearsal

The migration-owner connection correctly refused the owner-level dump because
it cannot assume `postgres`. The workflow then used the separate Keychain-held
database-owner backup credential without displaying it. This is the intended
operator boundary; the serving API and migration role were not elevated.

The fresh read-only export reported:

- source PostgreSQL: 17.6;
- source rows: 114 feelings and 2 weekly trackers;
- migration versions: `20260817053317`, `20260818040229`, and
  `20260819004100`;
- role dump password/SCRAM/MD5 scan: clean; and
- source and destination regions: Sydney (`ap-southeast-2`).

Only the ciphertext was uploaded as a new object:

- object:
  `database/20260825T051148Z/steady-nonprod-20260825T051148Z.steady.enc`;
- encrypted size: 52,785 bytes;
- encrypted SHA-256:
  `7c80298cb21b5a48138c554052b9be44189472f8a80d27348d3a241fb440b0b7`;
- encryption: AES-256-GCM with a random 96-bit IV and authentication tag; and
- bucket: private `database-backups` in the separate Sydney project.

The object downloaded through operator authorization with the same SHA-256.
Authenticated decryption and all component checksums passed. A first plain
PostgreSQL restore identified that Supabase-provided `authenticator` and
`supabase_realtime_admin` fixture roles were absent; that incomplete disposable
target was deleted. A second new PostgreSQL 17 target supplied only the
platform fixture roles and restored roles, schema, and data with
`ON_ERROR_STOP` from the beginning.

The completed restore proved:

- 114 feelings and 2 weekly trackers;
- nine policies with RLS enabled and forced on both tables;
- complete Stage 4 constraints, indexes, grants, atomic upsert, denial, and
  two-subject isolation checks;
- manifest migration versions equal both the hosted source and the three
  version-controlled migrations; and
- the Deno feelings and weekly services can read, write, and map data through
  `steady_runtime`, with all synthetic smoke writes rolled back and final
  counts still 114/2.

The exact restore container, local encrypted copies, downloads, SQL exports,
decrypted files, manifests, and both plaintext scratch directories were
permanently removed. The new private ciphertext object is the only retained
artifact from this rehearsal; the earlier Stage 5 encrypted historical objects
also remain under their recorded retention decision. This is an
operator-managed logical backup, not a managed database backup or PITR.

## Retired Go machine routes

`server/retired_routes_test.go` characterizes the unmodified Go middleware with
both machine tokens absent. `/api/chat/capabilities` and
`/api/agent/feelings` return the legacy configuration failure before their
handlers run. In the same token-absent environment, an isolated Auth0 boundary
keeps all four browser route shapes runnable. The full Go suite passes.

The installed Heroku CLI help confirms reversible `maintenance:on`,
`maintenance:off`, and multi-name `config:unset` commands. The ordered runbook
requires maintenance at the write freeze, removal of both token config names,
and browser-only rollback after data verification. The retired tokens are never
restored. `heroku_sequence.ts` makes that ordering executable: its tests reject
token removal outside maintenance, maintenance-off before token/data gates, and
any attempt to restore a retired token. No Heroku command that changes state was
executed in Stage 14.

## Mongo least privilege

`tools/legacy-security/` defines two exact policies:

- `steady_legacy_runtime`: `readWrite` on `feeling`, credential in Heroku only;
- `steady_rollback_operator`: `readWrite` on `feeling`, credential in the
  operator secret store only.

The five legacy-security tests cover the Heroku sequence and reject
`atlasAdmin`, `readWriteAnyDatabase`, extra/cross-database roles, shared
custody, unsafe maintenance ordering, and token restoration. Both users were created with synthetic passwords in
an exact disposable local MongoDB 7 container. Each passed insert/read/update/
delete on a disposable `feeling` probe and was denied both `admin.usersInfo`
and a cross-database read. The probe collection, users, passwords, and container
were removed. Production Atlas and Heroku credentials were not read or changed.

The production runbook orders creation and verification of both users, the
unchanged 114/2 source check, Heroku browser verification, and only then
revocation of the old `atlasAdmin@admin` credential. Every mutation remains a
separate Stage 17 approval gate.

## Review finding mapping

| Finding | Stage 14 control |
| --- | --- |
| REV-001 | Owner-approved Free-plan contract plus reusable encrypted workflow and passing fresh full restore rehearsal |
| REV-002 | Executable fail-closed Go checks plus reversible Heroku maintenance/token-removal and browser-only rollback runbook |
| REV-003 | Exact separate-custody role policy, real allowed/denied disposable probes, and ordered production rotation/revocation runbook |

Stage 15 must independently repeat Review. Stage 14 does not resolve or approve
its own Review findings.
