# Stage 18 — production observation

Recorded: 2026-08-28 (Australia/Brisbane)

Stage 18's initial post-cutover observation is complete. The production
replacement is stable, every acknowledged production write remains accounted
for, and no Release rollback trigger is open. The approved Release set no
fixed elapsed observation window for this sole-user pilot, so this stage closes
on a passing post-use checkpoint while its weekly, after-use, and at-least-
monthly controls continue as operating duties.

This result does **not** authorize Stage 19 or deletion of Heroku, MongoDB,
credentials, checkpoints, or backup objects.

## Observation interval and service state

The source-of-truth commit point remains
`2026-08-27T14:49:55.8342617Z`. The Azure request-log portion covered the first
production use through approximately `2026-08-27T15:20Z`; provider, database,
backup, and rollback-boundary checks continued through
`2026-08-27T15:48Z`.

The isolated Azure profile still identifies `Azure subscription 1` in the
personal tenant. Container App `steady-preprod` is Succeeded in Australia East;
revision `steady-preprod--r3` is Healthy/Provisioned, receives 100 percent of
traffic, and retains scale 0..1. The only Container App secret name remains
`database-url`. The app had scaled cleanly to zero at the metadata check.

Public probes then reported:

| Probe | HTTP | Total time | Body size | TLS |
| --- | ---: | ---: | ---: | --- |
| `/` after scale-to-zero | 200 | 25.925 s | 1,323 bytes | verified |
| `/healthz` warm | 200 | 0.083 s | 15 bytes | verified |
| `/readyz` warm | 200 | 0.085 s | 18 bytes | verified |
| repeated `/readyz` | 200 | 0.086 s | 18 bytes | verified |

The 25.9-second first request is the known scale-to-zero cost trade-off. Warm
readiness remains far below the Release threshold of two seconds.

## Requests, errors, latency, and privacy

Sanitized Log Analytics records from the commit point through the final
checkpoint account for 283 HTTP requests:

- 280 returned 2xx;
- three returned 401 from deliberate missing/invalid-credential probes;
- zero other 4xx and zero 5xx occurred;
- application error-log count was zero;
- average observed application duration was 11.08 ms, p95 was 33.93 ms, and
  maximum was 165.04 ms; and
- Azure's cumulative restart metric remained zero.

Two server starts and two clean SIGTERM shutdowns were recorded while the app
scaled up and back to zero; there was no restart loop. Route-level records show
successful feelings and weekly reads/writes, static delivery, health, and
readiness. Log Analytics exposes only the approved structured metadata fields;
it has no body, comment, note, authorization, token, database URL, or Auth0
subject field.

The retained user had already completed login, session reload, feelings read
and save, weekly read and upsert, and authenticated reload through the Azure
origin at the commit point. This checkpoint observed those requests and their
data effects. A new isolated automation tab had no retained Auth0 session and
was closed after verifying the public sign-in page; it was not counted as an
authenticated smoke and performed no mutation. Missing credentials on both API
resources and an intentionally invalid bearer token each returned the expected
401 with the same 79-byte structured error response.

## Supabase health, security, capacity, and data accounting

Both Supabase projects remain `ACTIVE_HEALTHY`, PostgreSQL 17.6.1.155, in
Sydney `ap-southeast-2`. Current Security and Performance Advisor queries
returned no lint. No current Supabase changelog item affects the standalone
Deno/direct-Postgres design; recent Edge Functions, Realtime, client-library,
and dashboard changes are outside this runtime boundary.

Aggregate production accounting is unchanged from the verified post-write
checkpoint:

| System | Feelings | Weekly trackers | Meaning |
| --- | ---: | ---: | --- |
| Mongo rollback source | 114 | 2 | frozen pre-commit checkpoint |
| Supabase production | 115 | 3 | checkpoint plus one real post-commit row of each type |
| Supabase rows without a legacy Mongo ID | 1 | 1 | exactly the two acknowledged post-commit writes |

The two target-only rows are expected, explained post-commit records—not an
unreconciled discrepancy. The existing read-only rollback plan accounts for
both. Supabase retains all nine policies and forced RLS on both application
tables. The production database used 10,824,851 bytes, about 2.2 percent of the
[current 500 MB Free-plan database limit](https://supabase.com/docs/guides/platform/database-size),
with 10 observed connections out of 60 during the operator query.

The last 24-hour Supabase Postgres log sample contained no record at or after
the commit point. Earlier errors in that bounded sample predate production and
therefore do not contradict the post-cutover Azure/application evidence.

## Backup and recoverability

The accepted private ciphertext remains present at:

`database/20260827T055046Z/steady-production-cutover-20260827T055046Z.steady.enc`

Streaming it directly through SHA-256, without writing a local copy, reproduced
`22c21cdf5e20360d9badd26b5cda1afbc42291db78cd7476923d1a9c4bc9fb68`.
The `database-backups` bucket remains private. It holds five ciphertext objects
totalling 188,237 bytes. The backup project's database used 10,488,979 bytes,
with seven observed connections out of 60 during the operator query. Both its
database and object storage are far below 80 percent of the
[current Free-plan limits](https://supabase.com/docs/guides/platform/billing-on-supabase).

The accepted object's full PostgreSQL 17 restore, ownership/grant, forced-RLS,
constraint, API-smoke, and reconciliation evidence remains the current recovery
proof. The first post-cutover weekly backup is due no later than
`2026-09-03T05:50:46Z` (`2026-09-03T15:50:46+10:00`). The next at-least-monthly
observation checkpoint is due by 2026-09-28, or sooner after the next use. An
additional verified backup remains mandatory before every release or
data-affecting migration.

## Retained rollback boundary and decision

Heroku maintenance remains on and its public origin returns 503.
`CHAT_INGEST_TOKEN` and `AGENT_API_TOKEN` remain absent. Heroku still names
`steady_legacy_runtime` as its database user without its password being read.

Atlas lists exactly two database users: `steady_legacy_runtime` and
`steady_rollback_operator`. Each has exactly `readWrite` on database `feeling`,
with no other role or scope, and their credentials retain separate custody. An
aggregate query through the operator credential confirmed Mongo remains 114/2.
No rollback execution, Heroku maintenance change, Mongo write, plan upgrade, or
resource deletion occurred during observation.

Decision: continue on the replacement. There is no active incident, data
discrepancy, privacy concern, capacity trigger, or rollback trigger. Continue
the monitoring and backup schedules in the production runbooks. Stage 19 still
requires a new explicit approval naming every destructive target before any
legacy resource can be decommissioned.
