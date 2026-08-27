# Migration restore runbook

Owner: Vinicius Delascio. Never restore over an existing production database.

1. Select the exact encrypted backup by recorded object path and checksum.
2. Download it into a new owner-only scratch directory and verify the
   ciphertext checksum before decryption.
3. Read the encryption key from the secret store without displaying it and run
   the pinned `tools/backup/workflow.ts verify` command into a new mode-0700
   output directory. The command authenticates the AES-256-GCM envelope and
   verifies the strict content-free manifest plus all internal checksums before
   writing SQL. A wrong key, modified ciphertext, unexpected manifest field,
   component mismatch, trailing payload, or existing output directory must
   stop the restore.
4. Confirm the manifest reports the selected environment, Sydney source and
   destination, PostgreSQL 17, exact repository migration versions, and the
   expected aggregate counts. Never execute SQL when this comparison differs.
5. Create a new empty disposable PostgreSQL 17 database. Restore roles, schema,
   then data; do not restore password values.
6. Compare the manifest migration list with the source and version-controlled
   migration history, then apply any later reviewed migrations in order. Run
   schema tests, forced-RLS two-subject isolation, exact aggregate counts,
   constraints, indexes, grants, API service smoke tests, and migration-history
   checks.
7. For a Mongo checkpoint, import into a new disposable database and compare
   collection counts and keyed migration reconciliation reports.
8. Record elapsed time and all sanitized results. A successful command is not
   enough: the restored application must pass API and authenticated read smoke
   tests.
9. Remove only the exact disposable database and plaintext scratch directory
   after evidence is durable. Confirm the paths first, never use a repository or
   home directory as a recursive cleanup target, and keep the encrypted source
   backup.
