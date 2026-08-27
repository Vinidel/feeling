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

## Cutover observation

During cutover, the owner watches every signal continuously, performs the
authenticated smoke journey, and records sanitized timestamps and results.
Any stop trigger in `stage-12-cutover.md` selects the pre-commit or post-write
rollback procedure. In ordinary operation, check provider health and recent
errors after each use and at least monthly; run Supabase advisors and a restore
rehearsal before each release and after any database change.

Stage 18 has no fixed elapsed observation window for this sole-user pilot.
Completing its initial stable checkpoint does not end these checks and does not
authorize decommissioning. The owner continues the after-use/monthly checks,
the weekly encrypted-backup schedule, and the pre-release/pre-migration backup
and restore gates for as long as the replacement is production.

Heroku has no durable log drain. A Stage 13 CLI query returned no retained
router lines, so historic request rate and error rate cannot be reconstructed
reliably. Heroku documents Logplex as a short retention buffer, not durable
storage: https://devcenter.heroku.com/articles/logging. The thresholds above
are deliberately absolute and replacement-focused rather than invented from a
missing source baseline.
