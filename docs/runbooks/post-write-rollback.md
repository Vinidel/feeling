# Post-write rollback

Use this after the cutover commit point, because Supabase may contain writes
that Mongo has never seen. Returning traffic first would lose acknowledged
writes.

Owner and approver: Vinicius Delascio. `execute` needs fresh, explicit approval
for the named production databases.

1. Suspend target writes and wait for in-flight requests to finish.
2. Confirm the final pre-cutover Mongo checkpoint exports are available and
   unchanged. They bound the allowed Auth0 subjects.
3. Create fresh encrypted backups of current Supabase and Mongo state.
4. Run `tools/rollback/main.ts plan` using the `steady_migration_owner` session
   connection and Mongo rollback credential. Review only sanitized counts.
5. Stop on any identity conflict or unexpected user. Otherwise authorize and
   run `execute`.
6. Run `execute` a second time. It must insert/update/link nothing; all weekly
   rows must report already matched.
7. Export Mongo again and run `tools/migrate/main.ts reconcile` against
   Supabase. Require zero rejected records, full matched counts, and zero
   target-only rows in both collections.
8. Verify Auth0 subject isolation, Go API contracts, aggregate counts, and a
   read-only authenticated browser journey before changing traffic.
9. Route production back to the retained Go/Heroku release, verify health, and
   then re-enable Mongo writes.
10. Keep Supabase read-only and preserve both reports, logs, checksums, and
    backups until Review and Release decide disposition.

## Idempotency proof

The disposable Stage 12 rehearsal started with 3 feelings and 2 weekly rows,
then created one target-only feeling, changed one weekly row, and created one
target-only weekly row. The first reconciliation produced 4/3 in Mongo and
linked both new target rows. The second produced zero writes or links and
reported all three weekly rows already matched. A fresh Mongo export reconciled
4 feelings and 3 weekly rows back to Supabase with zero exception and zero
target-only row.
