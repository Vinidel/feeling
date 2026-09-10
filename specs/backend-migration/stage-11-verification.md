# Stage 11 verification

## Outcome

Stage 11 passed in non-production. A fresh read-only MongoDB export contained
114 feelings and 2 weekly trackers. The migration accepted all 116 records,
rejected none, and a final hosted reconciliation matched every retained record
with no target-only row or exception. The two previously approved Go-zero
timestamp transformations were applied and reported.

No production endpoint, traffic, environment variable, Auth0 configuration,
MongoDB record, Heroku resource, or public payload was changed. Go/Heroku and
MongoDB remain the rollback implementation.

## Full-data verification

The operator created a fresh owner-only relaxed Extended JSON export with
`mongoexport` 100.17.0. Secret values were read from macOS Keychain and were not
printed, committed, or stored in reports.

| Check | Result |
| --- | --- |
| Source feelings | 114 |
| Source weekly trackers | 2 |
| Accepted / rejected | 116 / 0 |
| Hosted matched feelings | 114 |
| Hosted matched weekly trackers | 2 |
| Hosted target-only rows | 0 |
| Sanitized exceptions | 0 |
| Approved timestamp transformations | 2 |

A clean disposable PostgreSQL 17 target was rebuilt only from the two versioned
migrations. Its first import inserted 114 feelings and 2 weekly trackers. An
identical second import inserted zero rows, matched all 116 records, and retained
the same keyed structural hashes:

- feelings: `7b96fd0026c90b55f3fe1aedcdbf3494fa1004840c5dc074db49e2d5a8567666`
- weekly trackers: `99e62789eb43f2a08f547146cb2150af8343d4a92032131be6553d8420c328f1`

The report key was ephemeral. Hashes from reports made with a different key are
intentionally not comparable. The final post-integration hosted reconciliation
used a new key and again matched 114/2 with zero insert, target-only row, or
exception.

## Application journeys

The retained Auth0 tenant and an existing account completed the replacement
journey against a disposable local Supabase copy. No re-registration, account
relinking, Auth provider change, or production configuration change was needed.

The real browser verified:

- Auth0 sign-in and return to the React application;
- retained authenticated session after reload;
- migrated feeling history and aggregate trends;
- feeling save, automatic history refresh, and persisted reload;
- weekly tracker read, edit, save feedback, and persisted reload;
- split-origin development mode (`localhost:3000` to `localhost:8080`);
- deployed-style same-origin mode through the local static/proxy harness;
- Auth0 sign-out and return to the signed-out landing page.

The browser wrote two synthetic feelings and one synthetic weekly tracker only
to the disposable local copy. The React journey suite separately exercised
changing the selected week, loading that week, editing all weekly fields,
saving, remounting, and reading the selected week back. It also protects the
split-origin default, explicit API URL, and same-origin configuration modes.

## Complete regression matrix

| Area | Evidence | Result |
| --- | --- | --- |
| Legacy rollback | Go 1.23 full characterization and reusable contracts | Pass |
| Source/target differential | 8 feelings and 9 weekly cases | 17 cases, 0 unexplained differences |
| Replacement API | Deno 2.9.4 unit, HTTP, Auth0/JWKS, CORS, schemas, feelings, weekly contracts | 26/26 pass |
| Hosted database | Runtime transaction, two-subject isolation, denial and rollback | Pass |
| Hosted feelings | Mapping, ordering, insertion, isolation and rollback | Pass |
| Hosted weekly | Create/edit, one-row guarantee, isolation and rollback | Pass |
| Local database | Full schema, grants, forced RLS and two-subject SQL suite | Pass |
| Concurrent weekly writes | 12 simultaneous upserts, one user/week row | Pass |
| Migration | Format, lint, type check and unit suite | 6/6 pass |
| Backup crypto | Format, lint and authenticated-encryption suite | 3/3 pass |
| React | API, configuration, feelings and weekly journeys | 9/9 pass |
| React production build | Same-origin optimized build and proxy syntax | Pass |
| Supabase advisors | Local and linked security/performance advisors | No issues |
| Container | Digest-pinned Deno, frozen lock, restricted permissions, UID 1993 | Pass |
| Dependency audit | Deno locked application dependencies | No known vulnerabilities |

The hosted integration suites intentionally rolled back their synthetic writes.
The final full reconciliation after those tests is the authoritative proof that
the hosted target still contains exactly the migrated source set.

## Discrepancy register

There is no remaining unapproved discrepancy.

| Difference | Status | Accountable decision/evidence |
| --- | --- | --- |
| Empty feelings normalize from `null` to `[]` | Approved | Approved target design and differential tests |
| Equivalent timestamps use canonical/database serialization | Approved | Approved target design and differential tests |
| Invalid feeling status is rejected instead of accepted | Approved | Quirks must be normalized |
| Invalid weekly mood is rejected instead of accepted | Approved | Quirks must be normalized |
| Two Go-zero timestamps use their Mongo ObjectId time | Approved | Vinicius Delascio's Stage 5 normalization approval |
| Retired ping/chat/agent routes are absent | Approved | Unused code must not migrate; OpenClaw no longer exists |

## Safety and cleanup

- Hosted tests were read-only or transaction-wrapped and rolled back.
- The local TLS opt-out is strict, explicit, and defaults to `require`; hosted
  environments must not set it to `disable`.
- The API and browser harness were stopped after verification.
- The disposable local Supabase project and all browser/differential fixtures
  were removed during Stage 11 housekeeping.
- Fresh MongoDB exports, sanitized keyed reports, temporary observation files,
  and ephemeral report keys are removed after durable evidence is recorded.
- No deployment or cutover authority is implied by this result.

## Stage boundary

Stage 11 proves the replacement behavior and data in non-production. It does
not authorize Stage 12 infrastructure, a frontend production endpoint change,
traffic switching, deployment, or Heroku decommissioning.
