# Migration backup runbook

Owner: Vinicius Delascio. Real backup creation or upload needs explicit approval
for the named environment.

1. Create a new owner-only scratch directory outside version control. Use a
   unique path and record it so cleanup cannot target a parent directory.
2. Read database credentials and the 32-byte encryption key from the approved
   secret store without printing them.
3. Export PostgreSQL roles without passwords, the private `steady` schema, and
   data using the matching PostgreSQL 17 tools. Export Mongo collections with
   `mongoexport --jsonArray --jsonFormat relaxed`.
4. Set the non-secret manifest inputs required by `tools/backup/workflow.ts`:
   `BACKUP_ENVIRONMENT`, `BACKUP_CREATED_AT`, `BACKUP_POSTGRES_VERSION`,
   `BACKUP_SUPABASE_CLI_VERSION`, `BACKUP_SOURCE_REGION`,
   `BACKUP_DESTINATION_REGION`, `BACKUP_MIGRATION_VERSIONS`,
   `BACKUP_FEELINGS_COUNT`, and `BACKUP_WEEKLY_TRACKER_COUNT`. Both regions
   must be `ap-southeast-2`; counts must be aggregate integers; migration
   versions must be 14 digits. Never include comments, notes, raw Auth0
   subjects, credentials, URLs, or arbitrary metadata.
5. Read the 32-byte base64 encryption key into `BACKUP_ENCRYPTION_KEY` without
   displaying it. Run the pinned Deno 2.9.4 container with only the scratch
   directory mounted and invoke `workflow.ts pack roles.sql schema.sql data.sql
   <new-ciphertext-path>`. The tool creates a content-free manifest, verifies
   component SHA-256 values, archives in memory, AES-256-GCM encrypts, writes a
   new mode-0600 ciphertext file, and refuses overwrite. It never writes the
   plaintext archive.
6. Upload only ciphertext to the private `database-backups` bucket in the
   Sydney `Steady backups` Supabase project.
7. Download the object into a separate new scratch path, compare its outer
   SHA-256 with the `pack` result, then run `workflow.ts verify
   <downloaded-ciphertext> <new-output-directory>`. This authenticates and
   decrypts, verifies the strict manifest and every internal checksum, and
   refuses an existing restore directory. Treat upload success alone as no
   evidence of recoverability.
8. Permanently remove the exact plaintext scratch files and clear temporary
   environment/clipboard values. Retain the object path, size, checksum,
   timestamp, owner, and restore-test result.

The Storage operator credential and encryption key have separate purposes and
must remain operator-only. Do not give either to the request-serving Deno API or
the browser. Upload needs only a new object; do not use Storage upsert.

Free-plan storage is not a managed database backup and provides no PITR. This
operator procedure and the successful restore rehearsal are therefore required
immediately before cutover and before any later data-affecting migration. The
Release decision owns the ongoing cadence and retention duration.
