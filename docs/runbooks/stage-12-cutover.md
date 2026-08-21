# Steady production cutover runbook

Status: rehearsal-ready; production execution is not authorized.

Owner and approver: Vinicius Delascio. Replacement: the pinned Deno OCI image
on Azure Container Apps in Australia East with Supabase Postgres in Sydney.
Rollback source: the retained Go/Heroku service and MongoDB Atlas database.

## Commit point

The cutover commit point is the first production request routed to the Deno
service after the final Mongo checkpoint has reconciled 100 percent and writes
have been enabled on Supabase. Before that instant use the pre-commit rollback.
After it, assume Supabase may contain acknowledged writes and use the post-write
rollback. Never infer the mode from elapsed time.

## Preconditions

- Obtain separate written approval for the production infrastructure, backup,
  write suspension, environment changes, traffic switch, and deployment.
- Record the exact source and target environments, image digest, current Go
  release, operators, start time, and rollback decision-maker.
- Verify the Azure revision is healthy, ready, TLS-valid, same-origin, scale
  bounded, and has only the named secret references.
- Verify Auth0 callback, logout, and web-origin entries for the production URL.
- Verify the latest encrypted Mongo and Supabase backups using
  [backup.md](backup.md) and [restore.md](restore.md).
- Run all contract, RLS, API, React, and hosted reconciliation checks. Stop on
  any unexplained exception or target-only row.

## Rehearsed sequence

1. Announce write suspension and reject new writes at the source boundary.
2. Confirm all requests that began before suspension have completed.
3. Export final owner-only Mongo checkpoints for `feelings` and
   `weekly_trackers`; record timestamps, counts, checksums, and custody without
   committing private files.
4. Run the migration CLI `dry-run`, then `import`, then `reconcile` with the
   same report key. Require zero rejected records, 100 percent matching, and
   zero target-only rows.
5. Run API contracts, forced-RLS isolation, Auth0 login, feeling read/write,
   weekly read/write, reload persistence, readiness, and log-sanitization
   checks against the dark target.
6. Record the commit point, switch only the approved production hostname to
   the healthy pinned revision, then enable target writes.
7. Run the same authenticated smoke journey through the production hostname.
8. Observe errors, latency, health, authentication failures, database
   saturation, and write success. Keep Go/Heroku and Mongo unchanged and
   recoverable.

## Stop and rollback triggers

Rollback on unexplained data mismatch, lost/duplicated acknowledged write,
cross-user access, persistent authentication failure, unhealthy readiness,
secret exposure, or an unavailable rollback source. Before the commit point
follow [pre-commit-rollback.md](pre-commit-rollback.md); after it follow
[post-write-rollback.md](post-write-rollback.md).

The Stage 12 nonproduction rehearsal showed that an Azure revision traffic
shift and reversal completed in under two minutes. This is evidence for the
mechanism, not a production recovery-time guarantee.
