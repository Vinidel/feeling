# Stage 8: differential feelings verification

Stage 8 compares the migrated feelings slice without changing production
traffic. It uses synthetic isolated services for behavioral comparison and a
fresh read-only production-source export for content reconciliation against the
authorized non-production Supabase target.

## HTTP differential

The same eight cases ran through ephemeral HTTP servers backed by:

- the real Go Gin feelings handlers and MongoDB wire mocks; and
- the real Deno handler, strict schema, Postgres mapper, least-privilege runtime
  role, forced RLS, and a disposable local Supabase Postgres database.

The comparator found zero unexplained differences. It allowed only these
approved normalizations:

1. source empty history `null` becomes target `[]`;
2. equivalent source `2026-01-02T03:04:05Z` is serialized canonically by the
   target as `2026-01-02T03:04:05.000Z`; and
3. the source's permissive out-of-range status response is replaced by target
   `400 invalid_request` with no write.

Missing and malformed authentication, saved response fields, subsequent read
visibility, identity mismatch, cross-subject isolation, status representation,
comments, activities, and supported timestamps otherwise matched.

## Source-to-target reconciliation

A fresh MongoDB `mongoexport` 100.17.0 read produced 114 feelings and two weekly
trackers. The existing pinned migration CLI ran in read-only `reconcile` mode
through the migration-only TLS session connection and forced-RLS runtime role.
It accepted all 116 source records, rejected none, inserted nothing, matched all
114 feelings and both weekly trackers, and found zero target-only rows.

The feelings comparison is exact per retained legacy ID and includes ownership,
timestamp, numeric status, complete comment text, and all five activity
booleans. The durable report records only safe aggregates:

| Field | Source | Target result |
| --- | ---: | ---: |
| Feelings | 114 | 114 exact matches |
| Pseudonymous ownership groups | 5 (`106, 3, 2, 2, 1`) | Same owner per matched row |
| Status `0, 1, 2, 3, 4` | `9, 14, 19, 34, 38` | Exact per matched row |
| Non-empty / empty comments | `106 / 8` | Exact content per matched row |
| True activities: bow/lift/run/cycle/swim | `14 / 14 / 10 / 4 / 10` | Exact per matched row |
| Timestamp normalizations | 2 approved Go-zero conversions | Exact normalized instant per matched row |
| Target-only feelings | 0 | 0 |

The temporary HMAC report used an ephemeral 32-byte key and contained only
pseudonymous ownership hashes, non-content structural hashes, counts,
transformation codes, and reconciliation metrics. It contained no raw Auth0
subject, comment, note, credential, connection string, or token.

## React journey

The React `FeelingComponent` ran against two configurable stateful test endpoint
profiles: Go's `null` empty response and Deno's `[]` empty response. Both
profiles proved the current Auth0 audience/header contract, save request,
automatic history refresh, success feedback, history rendering, trend summary
and chart rendering, unmount/remount reload, and persisted readback. No
production frontend endpoint or component behavior changed.

## Rollback-source availability

The ephemeral Deno target server shut down and the disposable local Supabase
stack was removed without backup. The full Go characterization suite then
remained runnable. The repository's Go/Heroku/Mongo implementation was neither
changed nor deleted, so disabling the replacement still means stopping or
removing target routing while leaving the rollback source available.

## Operational safety

The current Supabase breaking-change scan found no change affecting the private
schema, direct Postgres, or reconciliation path. Hosted database/security
advisors reported no issue. No hosted data was written, no Deno service was
deployed, and no production infrastructure, environment variable, frontend
endpoint, Auth0 configuration, traffic, MongoDB record, Heroku resource, or
backup object changed.
