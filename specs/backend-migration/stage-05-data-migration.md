# Stage 5 — data migration and backup preparation

Stage 5 is in progress. This document records the approved backup boundary and
will accumulate the migration, reconciliation, and restore-rehearsal evidence.

## Backup project

- Organization: `SuperVin Systems`
- Project: `Steady backups`
- Project reference: `dabuqchfkqbsgymbspvk`
- Plan: Free
- Region: Sydney (`ap-southeast-2`)
- PostgreSQL status at creation: active and healthy
- External database TLS enforcement: enabled
- Storage bucket: `database-backups`
- Bucket visibility: private

Supabase documents that the selected specific region controls where primary
project data is stored, and lists Sydney as `ap-southeast-2`:
<https://supabase.com/docs/guides/platform/regions>. Supabase Storage's origin
is the project's region:
<https://supabase.com/docs/guides/storage/cdn/fundamentals>.

Vinicius Delascio explicitly approved this separate Free Supabase project after
being informed that it provides project-level separation but remains within the
same Supabase account and provider failure boundary. It is an appropriate pilot
control, not an independent off-provider disaster-recovery copy.

## Secret handling

Values are not stored in the repository. Operator-only values are held in macOS
Keychain:

| Service | Account | Purpose |
| --- | --- | --- |
| `feeling/supabase/steady-backups/project-ref` | `steady-backups` | Backup project reference |
| `feeling/supabase/steady-backups/database-password` | `steady-backups-db-owner` | Backup-project database owner password |
| `feeling/supabase/steady-backups/storage-secret-key` | `database-backups-operator` | Server-only Storage administration |

The Storage secret key bypasses Storage RLS and is restricted to controlled
operator tooling. It must never be supplied to the browser, Deno request-serving
API, migration fixtures, logs, reports, or repository files.

## Verification

A random synthetic object was uploaded to the private bucket with the operator
credential, downloaded, and compared byte-for-byte. An unauthenticated download
was denied. The synthetic object was then deleted and its absence verified. No
application data, MongoDB data, database dump, comments, notes, Auth0 subject, or
other private content was uploaded.

## Backup format and restore gate

Before representative MongoDB data is loaded into `Steady non-prod`, Stage 5
must still:

1. generate a logical roles, schema, and data backup without secret values;
2. encrypt the backup locally before upload;
3. calculate and record a SHA-256 checksum without private content;
4. upload the encrypted object to `database-backups`;
5. download it through operator-only credentials;
6. verify the checksum, decrypt locally, and restore into a disposable database;
7. verify schema and row counts; and
8. remove all decrypted temporary material after the rehearsal.

No automatic backup deletion or retention policy has been authorized. No real
backup has been created yet.
