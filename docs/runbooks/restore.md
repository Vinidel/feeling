# Migration restore runbook

Owner: Vinicius Delascio. Never restore over an existing production database.

1. Select the exact encrypted backup by recorded object path and checksum.
2. Download it into a new owner-only scratch directory and verify the
   ciphertext checksum before decryption.
3. Read the encryption key from the secret store and run
   `tools/backup/crypto.ts decrypt` into the scratch directory.
4. Verify the archive manifest and all internal checksums before executing SQL.
5. Create a new empty disposable PostgreSQL 17 database. Restore roles, schema,
   then data; do not restore password values.
6. Apply any later reviewed migrations in order. Run schema tests, forced-RLS
   two-subject isolation, exact aggregate counts, constraints, indexes, and
   migration-history checks.
7. For a Mongo checkpoint, import into a new disposable database and compare
   collection counts and keyed migration reconciliation reports.
8. Record elapsed time and all sanitized results. A successful command is not
   enough: the restored application must pass API and authenticated read smoke
   tests.
9. Remove only the exact disposable database and plaintext scratch directory
   after evidence is durable. Keep the encrypted source backup.
