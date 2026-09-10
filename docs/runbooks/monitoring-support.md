# Production monitoring and support

Status: Active since the production commit point on 2026-08-27 at
14:49:55 UTC. The first post-cutover checkpoint is recorded in
`specs/backend-migration/stage-18-observation.md`.

Owner, first responder, and escalation decision-maker: Vinicius Delascio.
Provider support paths are the Azure, Supabase, and Auth0 dashboards and their
public status pages. The owner records each incident, provider case, decision,
and resolution in the release record without copying credentials or private
journal content.

## Signals

- Azure Container Apps: revision health, replica availability, request count,
  HTTP status class, response time, restarts, CPU, memory, and console logs.
- Application: `/healthz`, `/readyz`, allowlisted structured request/error
  events, deployment version, and Auth0 verification failures. Logs must never
  include tokens, database URLs, Auth0 subjects, comments, notes, request
  bodies, or arbitrary headers.
- Supabase: project health, database connections, storage/disk use, Postgres
  errors, slow queries, and Security/Performance Advisor results.
- Auth0: failed logins, token validation failures, configuration changes, and
  provider incidents.
- Cost: the existing Azure resource-group budget alert. It is an alert, not a
  spending cap.

The current app has one human user and low traffic, so absolute failures are
more useful than percentage-only alerts. Initial Review thresholds are:

| Signal | Investigate | Roll back or suspend writes |
| --- | --- | --- |
| Replacement HTTP 5xx | Any 5xx within 15 minutes | Repeated 5xx or a failed supported journey |
| Readiness | 3 failures within 15 minutes | Persistent failure or database unavailable |
| Authentication | 3 unexplained failures within 15 minutes | Retained user cannot authenticate or isolation is uncertain |
| Data correctness | Any reconciliation mismatch | Any lost, duplicate, cross-user, or unexplained row |
| Warm response time | p95 above 2 seconds for 15 minutes | Supported journey unusable after warm-up |
| Database capacity | 80 percent of a provider limit | Provider reports imminent exhaustion |
| History growth | 500 rows or 250 KiB serialized for one user | Return to Define before 1,000 rows or 1 MiB |

The 2026-08-24 baseline is 106 rows and about 50 KiB for the largest history.
The Azure app intentionally scales to zero: the observed first public request
took 26 seconds, while warm readiness and unauthorized API checks took about
0.09 seconds. Cold-start latency is therefore a known cost-saving trade-off,
not evidence of database latency. Review may require `minReplicas=1`, but that
would be a separately approved infrastructure and cost change.

## Current operation and recovery

Heroku and MongoDB were decommissioned under the separately approved Stage 19.
They are historical migration evidence, not available rollback targets. The
production system is Azure Container Apps, Auth0, and Supabase Postgres.
Operational recovery means restoring a qualified encrypted PostgreSQL backup
into a new empty PostgreSQL 17 target and verifying it before changing traffic;
never attempt an in-place restore over production.

Check provider health and recent errors after each use and at least monthly;
run Supabase advisors and a restore rehearsal before each release and after any
database change. Continue the weekly encrypted-backup schedule and the
pre-release/pre-migration backup gate for as long as the replacement is
production.

The separate backup project is on Supabase Free and may auto-pause after low
activity. Before every scheduled backup or recovery exercise, inspect its state
and, when needed, resume only `Steady backups`, wait for `ACTIVE_HEALTHY`, and
verify the private bucket plus inventory are reachable. A pause or DNS wake-up
delay is an investigate condition; a missed backup or failed restore is a
recovery-readiness failure that blocks data-affecting work. Do not silently
upgrade an account.
