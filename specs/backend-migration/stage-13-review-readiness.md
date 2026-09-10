# Stage 13 Review and Release readiness

Date: 2026-08-24. Accountable owner: Vinicius Delascio.

This is the handoff from implementation rehearsal to the separate AI-OS Review
stage. It is not a Review verdict, Release approval, production deployment, data
migration, environment change, traffic switch, or decommissioning authority.

## Architecture snapshot

- Retained source/rollback: Go/Gin on Heroku, MongoDB Atlas in Sydney, Auth0.
- Replacement: standalone Deno 2.9.4 TypeScript API and bundled React static
  files in one digest-pinned OCI image on Azure Container Apps, Australia East.
- Data: private `steady` schema in Supabase Postgres 17, Sydney, accessed through
  TLS Supavisor with least-privilege roles. Data API, Supabase Auth, Edge
  Functions, Realtime, and application Storage are not used.
- Identity: Auth0 remains authoritative. The API verifies RS256 access tokens;
  the verified `sub` is transaction-scoped and forced RLS enforces same-user
  rows. No caller-selected identity or operator route exists.
- Cutover: single writer with a defined first-request commit point. Go/Heroku
  and Mongo remain intact through observation and require a later explicit
  decommissioning approval.

Hard-to-reverse choices remain those approved in `design.json`: Deno standalone
compute, Azure Australia East, Supabase Sydney, Auth0 retention, a private
relational schema, transaction-scoped Auth0-sub RLS, same-origin deployment,
and single-writer cutover. No Stage 13 activity changed them.

## Acceptance traceability

| Contract | Primary evidence | State for Review |
| --- | --- | --- |
| AC-1, AC-2 | Stages 7, 8 and 11; feelings contract, hosted integration, differential and authenticated browser tests | Passed in nonproduction |
| AC-3, AC-4 | Stages 9 and 11; weekly contract, concurrency, hosted integration and browser tests | Passed in nonproduction |
| AC-5 | Stages 6, 7, 9 and 11; Auth0 matrix, header mismatch, two-subject RLS | Passed in nonproduction |
| AC-6, AC-7 | Stages 1 and 10; owner confirmation, caller/config scan, exact replacement route test | Passed; recheck at Release |
| AC-8 | Stages 8, 9, 11 and 12; React contract/journey tests and retained-account Azure journey | Passed in nonproduction |
| AC-9 | Stages 1, 7, 9, 10 and 11; characterized quirks, strict schemas/errors/CORS, ping removal | Passed in nonproduction |
| AC-10 | Stages 3, 4, 5 and 11; Sydney placement, deterministic 114/2 migration, normalization, backup/restore | Passed in nonproduction |
| AC-11 | Stages 4, 6, 7, 9, 11 and 12; grants, forced RLS, credential matrix, rollback-role isolation | Passed in nonproduction |
| AC-12 | Stage 11; full 114/2 reconciliation, contracts, browser and negative checks | Passed in nonproduction |
| AC-13 | Stage 12; revision reversal plus pre/post-write rollback and bidirectional reconciliation | Passed in rehearsal |
| AC-14 | Stage 13 and named runbooks; this remains subject to Review and Release | Evidence assembled; no release approval |

Every completed plan stage has command/result evidence in `implementation.json`.
The direct Supabase IPv6 migration endpoint probe in Stage 3 remains truthfully
failed; the owner approved TLS Supavisor session mode for IPv4-only migration
runners. This is a recorded portability trade-off, not a hidden pass.

## Final security, privacy, and data evidence

On 2026-08-24:

- linked Supabase Security and Performance Advisors reported no issue;
- hosted roles `steady_runtime` and `steady_migration_owner` are login roles but
  neither is superuser nor `BYPASSRLS`;
- both tables have RLS enabled and forced, nine policies exist, runtime table
  grants are only `SELECT`, `INSERT`, and `UPDATE`, and `PUBLIC` has no table
  grant in `steady`;
- hosted migrations are exactly `20260817053317`, `20260818040229`, and
  `20260819004100`; counts remain 114 feelings and 2 weekly trackers;
- Deno audits reported no known vulnerability for the API, migration CLI, or
  rollback CLI. Their frozen lockfile SHA-256 fingerprints were recorded in
  Stage 13 implementation evidence;
- the replacement image runs as UID/GID 1993, uses frozen/cached dependencies,
  reads only the static bundle, grants only nine named environment variables,
  and grants network access only to its listener, Auth0 JWKS, and Sydney
  Supavisor runtime endpoint;
- the API suite passed 28/28, React passed 9/9, and the unchanged Go rollback
  suite passed. Tests cover log allowlisting, sanitized errors, exact routes,
  retired routes, authentication, validation, CORS, static serving, and domain
  contracts;
- the replacement contains no retired shared secret, Mongo credential,
  migration/admin credential, Supabase service-role key, or browser database
  credential. Legacy references remain only in the retained rollback source,
  its documentation, and explicit negative tests.

Private content was not emitted during Stage 13. Hosted database queries
returned only metadata, counts, and approximate serialized sizes.

## Data size, traffic, and operational baseline

The target contains five identity groups and 114 feelings. The largest history
is 106 records and approximately 50,464 bytes as JSON. This is safely below the
initial 500-row/250-KiB review guardrail, so pagination is not required by the
current contract. Crossing that guardrail returns history pagination to Define;
it is not added silently during implementation.

Heroku reported one Basic `web` dyno and one Basic `worker` dyno running the
same `./main` HTTP process. The app is in the US region on the container stack.
Its current config-variable names are `DB_USER`, `DB_PASS`,
`CHAT_INGEST_TOKEN`, and `AGENT_API_TOKEN`; values were never printed. Heroku
returned no retained Logplex lines, so historic request/error rates are not
recoverable and are not invented. The app owner is the only user. Absolute
low-volume alert thresholds are defined in `docs/runbooks/monitoring-support.md`.

Current public checks returned:

- Azure preproduction root `200` after a 26-second scale-to-zero cold start;
- warm Azure readiness `200` in about 0.09 seconds;
- unauthenticated Azure feelings `401` in about 0.09 seconds;
- retained Heroku root `200` in about 2.25 seconds.

On 2026-08-24 the Azure isolated personal CLI profile was reauthenticated using
browser-based modern authentication. Security Defaults correctly blocked the
legacy device-code flow and remained enabled. The refreshed evidence confirms
the personal subscription, Australia East placement, healthy retained
revisions, approved image digest, 0..1 scale, one named secret reference,
ACR-admin disabled, managed-identity-only `AcrPull`, 30-day Log Analytics
retention, and the monthly 5 budget with its 80-percent alert. Seven-day metrics
show 17 counted requests and zero restarts. The unrelated corporate subscription
was not used.

## Environment and secret dependencies

No values are included below.

| Boundary | Names/dependency | Handling |
| --- | --- | --- |
| Legacy Heroku | `DB_USER`, `DB_PASS`, `CHAT_INGEST_TOKEN`, `AGENT_API_TOKEN`; platform-injected `PORT` | Stage 14 rehearses scoped browser credential rotation and fail-closed token removal; production changes remain separately gated for Stage 17 |
| Legacy Go constants | Auth0 issuer/audience, Mongo host/database, permissive CORS | Replaced by strict target configuration; retain only in rollback source |
| Target API | `AUTH0_AUDIENCE`, `AUTH0_ISSUER`, `CORS_ORIGINS`, `DATABASE_SSL_MODE`, `DATABASE_URL`, `DEPLOYMENT_VERSION`, `HOST`, `PORT`, `STATIC_ROOT` | Only `DATABASE_URL` is a deployment secret; exact Deno env permission list |
| Migration | migration-owner database URL/password, report HMAC key, backup encryption key | Operator secret store only; never supplied to serving API |
| Rollback | scoped Postgres rollback membership; separate `steady_legacy_runtime` and `steady_rollback_operator` Mongo credentials | Runtime credential in Heroku only; operator credential in the operator store only; explicit execution approval |
| Backup Storage | server-only Supabase Storage operator credential | Separate Sydney project; never browser/API accessible |
| Frontend/Auth0 | Auth0 domain, client ID, audience and allowed origins | Public client configuration; no client secret |

## Operations and provider defaults

All responsibilities are owned by Vinicius Delascio:

| Responsibility | Procedure |
| --- | --- |
| Migration and cutover | `stage-12-cutover.md`, migration CLI documentation |
| Pre-commit rollback | `pre-commit-rollback.md` |
| Post-write rollback | `post-write-rollback.md`, rollback CLI documentation |
| Backup and restore | `backup.md`, `restore.md` |
| Legacy rollback security | `legacy-rollback-security.md` |
| Azure operation | `azure-container-apps.md` |
| Monitoring and support | `monitoring-support.md` |
| Operator audit | `operator-audit.md` |
| Security/privacy incident | `breach-response.md` |

The Supabase Free plan does not provide owner-accessible managed daily database
backups or PITR. The approved low-cost posture is manual authenticated-encrypted
logical backup to a private bucket in the separate Sydney `Steady backups`
project, with checksum download and restore rehearsal. Supabase explicitly
recommends regular logical exports for Free projects:
https://supabase.com/docs/guides/platform/backups. This is not misrepresented as
a managed database backup.

Azure automatically records control-plane Activity Log events for 90 days.
Supabase Free supplies the single operator's Account Audit Log and project logs,
but organization Platform Audit Logs require Team/Enterprise. Auth0 log
retention is plan-dependent and must be reverified at Release. These limitations
and the compensating repository change record are documented in the audit and
incident runbooks.

## Review risks and required decisions

1. **Separate follow-up — legacy React dependencies.** `npm audit` reports 82
   advisories: 15 low, 17 moderate, 42 high, and 8 critical. Direct affected
   packages include axios, moment, postcss, and react-scripts; many others are
   transitive build dependencies. The replacement image still builds this
   client. On 2026-08-24, Vinicius Delascio decided that reachability analysis,
   dependency modernization, and remediation will be separately Defined work,
   not scope added to `backend-migration`. The findings remain visible risk; no
   automated forced upgrade or waiver was performed.
2. **Known cost/latency choice — scale to zero.** A 26-second cold load was
   observed. Keeping zero minimum replicas minimizes cost; changing it requires
   a separately approved cost/infrastructure decision.
3. **Reduced Free-plan recovery/audit posture.** Manual backup and limited
   provider audit retention are deliberate constraints. The amended owner-
   approved contract and Stage 14 now provide a reusable strict encrypted
   workflow plus a fresh full restore rehearsal. Release must still choose the
   ongoing cadence and retention.
4. **Production legacy controls remain gated.** Stage 14 proves fail-closed
   machine routes, exact scoped Mongo policies, real disposable allowed/denied
   probes, and the ordered maintenance/token-removal/credential-rotation
   runbook. The production machine tokens and broad Atlas credential remain
   unchanged until Review and Release pass and Stage 17 receives separate
   production authority. The redundant worker remains deletion-only debt for
   Stage 19.

## Gate status

Evidence is ready for the AI-OS Review stage. Review must not infer Release or
deployment approval. Production remains blocked until Review passes, Release is
explicitly approved, and each production infrastructure, data, environment,
deployment, traffic, irreversible migration, or deletion action receives its
own explicit human authority. Go, Heroku, MongoDB, and their rollback credentials
remain available and unchanged.

The deterministic implementation structural validator passes. Its full
`--ready` mode intentionally remains closed because the Stage 3 direct-IPv6
probe remains a truthful failure and production Stages 14 through 16 have not
been authorized or executed.

## Separate follow-up register

`FOLLOWUP-REACT-001` is owned by Vinicius Delascio and is not yet planned. Its
future Define stage must bound browser/runtime reachability, direct dependency
upgrades, replacement of obsolete build tooling, React modernization, regression
coverage, and rollout safety. This record tracks the work without inventing its
architecture, acceptance criteria, priority, or approval.
