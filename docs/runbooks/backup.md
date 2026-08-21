# Migration backup runbook

Owner: Vinicius Delascio. Real backup creation or upload needs explicit approval
for the named environment.

1. Create a new owner-only scratch directory outside version control.
2. Read database credentials and the 32-byte encryption key from the approved
   secret store without printing them.
3. Export PostgreSQL roles without passwords, the private `steady` schema, and
   data using the matching PostgreSQL 17 tools. Export Mongo collections with
   `mongoexport --jsonArray --jsonFormat relaxed`.
4. Record a manifest containing environment, UTC timestamp, tool versions,
   migration version, Australian region, aggregate counts, and SHA-256 values.
   Never include comments, notes, raw Auth0 subjects, credentials, or URLs.
5. Archive the dumps and manifest, then encrypt the archive with
   `tools/backup/crypto.ts encrypt`. Keep plaintext only for the minimum time.
6. Upload only ciphertext to the private `database-backups` bucket in the
   Sydney `Steady backups` Supabase project.
7. Download the object, compare its ciphertext checksum, authenticate-decrypt
   it, and verify every internal checksum before calling the backup usable.
8. Permanently remove the exact plaintext scratch files and clear temporary
   environment/clipboard values. Retain the object path, size, checksum,
   timestamp, owner, and restore-test result.

Free-plan storage is not a managed database backup. This operator procedure and
the successful restore rehearsal are therefore required before cutover.
