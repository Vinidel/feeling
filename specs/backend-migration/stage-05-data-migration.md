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
| `feeling/supabase/steady-backups/encryption-key` | `database-backups-aes256gcm` | 256-bit authenticated backup-encryption key |

The Storage secret key bypasses Storage RLS and is restricted to controlled
operator tooling. It must never be supplied to the browser, Deno request-serving
API, migration fixtures, logs, reports, or repository files.

## Verification

A random synthetic object was uploaded to the private bucket with the operator
credential, downloaded, and compared byte-for-byte. An unauthenticated download
was denied. The synthetic object was then deleted and its absence verified. No
application data, MongoDB data, database dump, comments, notes, Auth0 subject, or
other private content was uploaded.

## First logical backup and restore rehearsal

The first pre-data backup completed on 2026-08-18:

- Object: `database/20260818T020203Z/steady-nonprod-20260818T020203Z.tar.gz.enc`
- Encrypted size: 2,669 bytes
- Encrypted SHA-256: `a873d7ece7f3dcfb27706c8d4ee0c5844e1cf8203121b5d0e39e7097db4b6e30`
- Encryption: AES-256-GCM with a random 96-bit IV and authentication tag
- Source PostgreSQL: 17.6
- Source migration: `20260817053317`
- Source rows: zero feelings and zero weekly trackers

The logical archive contains separate role, `steady` schema, data, and manifest
files. The manifest records a SHA-256 for every SQL component and contains no
secret value or private application content. The role dump contains the custom
role definitions without password values. The encrypted Storage object uses
`application/octet-stream`.

`tools/backup/crypto.ts` is a dependency-free Deno helper for the authenticated
envelope. Tests prove round-trip behavior, absence of plaintext in ciphertext,
tamper rejection, wrong-key rejection, and strict 32-byte key decoding.

The object was downloaded through the operator credential and matched the
recorded encrypted checksum. After decryption, its archive and all three
component checksums matched. The schema and zero-row data were restored into a
disposable local PostgreSQL 17 database. Verification proved:

- both retained tables exist and are owned by `steady_migration_owner`;
- both source and restored row counts are zero;
- all five RLS policies exist and RLS is forced;
- the runtime grants match the approved operations and exclude `DELETE`; and
- the complete Stage 4 constraint and two-subject RLS suite passes.

The disposable database, local Supabase containers, plaintext SQL, decrypted
archive, downloaded encrypted copy, and original local encrypted copy were
removed after verification. The encrypted Storage object is the only retained
artifact outside version-controlled source and Keychain-held secrets.

## Remaining Stage 5 work

The backup and restore prerequisite is satisfied. Before representative source
data is imported, Stage 5 must still build the standalone migration CLI, prove
the synthetic invalid/duplicate/repeat-input cases, obtain separately authorized
representative MongoDB data, and complete deterministic import and reconciliation.

No automatic backup deletion or retention policy has been authorized. No real
application record was present in this first backup.
