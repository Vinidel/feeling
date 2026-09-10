# Stage 17 — production cutover

Recorded: 2026-08-28 (Australia/Brisbane)

Stage 17 is complete. The existing Australia East Azure Container App and the
Sydney Supabase project are now the production service selected in Release.
Heroku and MongoDB remain available as non-deleted rollback assets.

## Authority and commit point

Vinicius Delascio explicitly authorized the eight production action groups on
2026-08-27: Mongo credential rotation, encrypted backup upload and restore,
Heroku write freeze, retired-token removal, final data checkpoint and migration,
Azure public cutover, authenticated writes, and rollback-asset retention.

The source-of-truth commit point was the first acknowledged replacement write:

- UTC: `2026-08-27T14:49:55.8342617Z`;
- local: `2026-08-28T00:49:55.8342617+10:00`;
- route: `POST /api/weekly-tracker`;
- result: HTTP 200 on revision `steady-preprod--r3`.

The subsequent `POST /api/feelings` returned HTTP 200 at
`2026-08-27T14:50:29.5948854Z`. Both records were entered by Vinicius as real
application data; no synthetic production mood or tracker record was invented.

## Mongo and Heroku boundary

Atlas now has exactly two application users, each with only `readWrite` on the
`feeling` database:

- `steady_legacy_runtime`, held by Heroku; and
- `steady_rollback_operator`, held by the operator secret store.

Both users passed allowed database access and denied named-user/cross-database
probes. Heroku continued to serve the authenticated journal and weekly tracker
after its runtime credential changed. Only then was the old
`atlasAdmin@admin` user `feeling` revoked; its old credential now fails
authentication.

Heroku maintenance mode is on. `CHAT_INGEST_TOKEN` and `AGENT_API_TOKEN` are
absent and must never be restored. The public Heroku origin returns 503 while
the web and worker deployments remain retained. No Heroku or MongoDB resource
was deleted.

## Fresh recovery evidence

The accepted pre-cutover Supabase backup is:

- object:
  `database/20260827T055046Z/steady-production-cutover-20260827T055046Z.steady.enc`;
- private bucket: `database-backups` in the separate Sydney backup project;
- ciphertext size: 52,789 bytes;
- ciphertext SHA-256:
  `22c21cdf5e20360d9badd26b5cda1afbc42291db78cd7476923d1a9c4bc9fb68`;
- encryption: AES-256-GCM using the operator-only Keychain key; and
- manifest: PostgreSQL 17.6, Sydney-to-Sydney, migrations
  `20260817053317`, `20260818040229`, `20260819004100`, and 114/2 rows.

Authenticated download matched the outer checksum. Decryption and all internal
component checksums passed. A clean PostgreSQL 17 restore preserved both table
owners, all grants, 114 feelings, two weekly trackers, nine policies, and forced
RLS on both tables. The complete schema/RLS suite and real Deno feeling/weekly
service smoke passed; all restore-smoke writes rolled back.

An earlier encrypted object at `database/20260827T054438Z/` is retained but is
**not approved for recovery**: its first restore rehearsal correctly detected
that its generic `pg_dump --no-owner --no-privileges` schema export omitted
ownership and grants. The accepted object above was recreated using the
established Supabase CLI export method. The failed object was never treated as
restorable evidence.

## Frozen migration and accounting

After Heroku maintenance was enabled, the scoped rollback operator exported a
final immutable Mongo checkpoint:

- feelings: 114; checkpoint SHA-256
  `734d813a0b85540b9cd35c157a1c6bbe6a81dc2d56cfd98c8b7e367c52f55587`;
- weekly trackers: 2; checkpoint SHA-256
  `2f566f483bc368bdffbadaf410950dc3b03c7baec9cabf8b94c87e57ac95f686`.

Dry-run accepted all 116 records, rejected none, and reported only the two
previously approved Go-zero-time-to-ObjectId-time normalizations. The idempotent
import inserted zero rows because the target already matched all source rows.
The final reconciliation matched 114/2 with zero exception and zero target-only
row.

After the two user-entered production writes, aggregate accounting is:

- Mongo rollback source: 114 feelings and 2 weekly trackers;
- Supabase production target: 115 feelings and 3 weekly trackers;
- post-commit target-only rows: exactly 1 feeling and 1 weekly tracker; and
- RLS: nine policies, enabled and forced on both application tables.

The read-only post-write rollback plan reports that an authorized rollback
would insert exactly that one feeling and one weekly tracker into Mongo, leave
the two historical weekly rows already matched, and then link the target rows.
It performed no write. The Deno MongoDB driver required full environment-read
permission inside its isolated container and an explicit provider-equivalent
three-host TLS seedlist because SRV resolution failed in the container. The
container mounted no operator home or secret store, received only explicit
secrets, and limited network access to Supabase plus the three Atlas hosts.

## Production service evidence

The isolated personal Azure profile identifies only `Azure subscription 1`
under `vini.delascio@gmail.com`. Revision `steady-preprod--r3` is Running and
Succeeded at 100 percent traffic in Australia East. Scale remains 0..1. The
only secret name is `database-url`; ACR admin is disabled; the user-assigned
identity has only `AcrPull`; Log Analytics retains 30 days; and the existing
monthly 5 budget retains its 80-percent alert.

The public production URL is:

`https://steady-preprod.wittyglacier-50c44c34.australiaeast.azurecontainerapps.io`

The retained Auth0 user completed the journal and weekly read routes, both save
routes, and authenticated reload. Journal history increased from 106 to 107
visible normalized check-ins. Azure logs record both POSTs as HTTP 200, no 5xx,
and no body, comment, note, authorization, token, or database-URL fields. A
live hosted RLS test denied other-subject operations and rolled every fixture
back.

The Auth0 API audience remains the historical Heroku URL as an identifier; it
was not changed. No account plan was upgraded.

## Retained rollback and next gate

Heroku remains in maintenance mode, Mongo remains unchanged after the frozen
checkpoint, both scoped credentials remain active, and the complete Go/Heroku
deployment remains retained. Post-write rollback requires a fresh explicit
authorization to suspend Azure writes, execute the target-to-Mongo plan twice,
verify zero further writes on the second run, and only then disable Heroku
maintenance. Retired tokens are never restored.

Stage 18 is the next runnable stage: observe production and collect stability,
error, write-accounting, backup, and cost evidence. Stage 19 decommissioning
remains blocked on a later explicit human approval and must not delete Heroku,
MongoDB, or scoped rollback credentials automatically.
