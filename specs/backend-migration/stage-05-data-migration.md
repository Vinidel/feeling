# Stage 5 — data migration and backup preparation

Stage 5 is complete. This document records the approved backup boundary and the
migration, reconciliation, and restore-rehearsal evidence.

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

## Standalone migration CLI

`tools/migrate/` now contains a Deno 2 migration CLI that is operationally
separate from the request-serving API. It accepts only two operator-provided
relaxed Extended JSON arrays, so it has no MongoDB client, credential, or network
permission. Real export access and custody remain a separately authorized step.

The CLI provides three modes:

- `dry-run` strictly parses and classifies source records without a database;
- `import` inserts absent legacy IDs and reconciles full source/target content in
  one short transaction; and
- `reconcile` performs the same comparison without inserting and reports
  target-only rows for rollback analysis.

User identities are represented in reports only by HMAC-SHA-256 values under an
operator-held 32-byte reporting key. Structural hashes deliberately omit feeling
comments and weekly notes. Reports and exception manifests are created as new
owner-only files and contain no database URL, credential, raw Auth0 subject,
comment, or note. Source validation failures prevent any connection or write;
target content conflicts are collected by sanitized source ID, roll back the
whole transaction, and return a non-zero result.

The migration owner remains `NOINHERIT` and without `BYPASSRLS`. Migration
`20260818040229_allow_migration_owner_to_assume_runtime.sql` grants it membership
in `steady_runtime`; each data transaction must explicitly `SET LOCAL ROLE
steady_runtime` and set one transaction-local Auth0 subject. This lets the CLI
reuse the forced-RLS path without giving the schema owner a request-time bypass.
The reversible grant was rebuilt and rollback-rehearsed locally, then applied to
the authorized empty Steady non-prod project. Local and hosted migration history
match, hosted application row counts remain zero, and both local and hosted
Supabase advisors report no issues.

## Synthetic migration evidence

Pinned Deno formatting, linting, type checking, and six unit tests pass. The
fixtures cover valid documents, defaults, malformed identifiers and dates,
missing identities, mixed types, unknown fields, duplicate source IDs, duplicate
user/week trackers, repeat input, pre-write output reservation, content conflict,
target-only writes, and the narrowly approved zero-time normalization.

The valid dry-run accepted five of five records. The invalid dry-run accepted
zero of ten and produced exactly ten classified exceptions. Neither output set
contained the private sentinel strings or synthetic raw identities, and all
files had owner-only permissions.

Against a freshly migrated disposable local PostgreSQL 17 database:

- import one inserted three feelings and two weekly trackers and matched all
  five records;
- the identical second import inserted zero rows, matched all five, preserved
  the same two collection hashes, and left three distinct feeling legacy IDs
  plus two distinct weekly legacy IDs;
- read-only reconciliation after two forced-RLS synthetic target writes reported
  one target-only feeling and one target-only weekly tracker; and
- a changed comment under an existing legacy ID produced one `target_conflict`,
  returned non-zero, exposed no content, and rolled back with zero conflicting
  values persisted.

The full constraint/grant/two-subject RLS suite passed after a clean rebuild,
after the exact local rollback removed the schema and both roles, and again after
reapplication from migration history.

## Authorized source dry-run

On 2026-08-18, Vinicius Delascio explicitly authorized read-only access to the
current MongoDB source data. The authenticated Heroku application configuration
was used only to establish the existing Atlas connection; secret values were not
written to the repository or migration reports. Atlas identifies the project as
`feeling`, the cluster as `Cluster0`, and its region as Sydney
(`ap-southeast-2`).

The source database contains only the two retained collections:

- `feelings`: 114 documents;
- `weekly_trackers`: 2 documents.

No chat, agent, or other retired collection exists. The export was written as
owner-only relaxed Extended JSON in the ignored `.tmp/` workspace. The real-data
dry-run accounted for all 116 records: 112 feelings and both weekly trackers were
accepted, while two feelings were rejected. Both exceptions belong to the
dominant identity and have a BSON `createdat` equal to Go's zero time
(`0001-01-01T00:00:00Z`); the sanitized manifest identifies only their source
IDs, pseudonymous user hash, reason, and field.

Five distinct identity values exist. Under the stable reporting key, the
accepted record distribution is:

| Pseudonymous identity | Feelings | Weekly trackers |
| --- | ---: | ---: |
| `23fcea81c25c…` | 104 | 2 |
| `cc459d70cacd…` | 2 | 0 |
| `e5dacb2b47f6…` | 1 | 0 |
| `e6216164284f…` | 3 | 0 |
| `f2832f53583c…` | 2 | 0 |

The two zero-time exceptions also map to `23fcea81c25c…`. No identity value,
comment, note, token, or connection string appears in this document. The
plaintext export and reports were removed immediately after capturing this
sanitized evidence; Atlas remained unchanged.

Vinicius Delascio explicitly decided that all five identities and all 116 source
records are in migration scope. The eight feelings belonging to the four
low-volume identities are not obsolete integration/test data and must not be
excluded or quarantined solely because of their identity distribution.

Vinicius also explicitly approved normalizing the two Go-zero `createdat`
values to the creation timestamp encoded in each record's MongoDB ObjectId. The
CLI implements only this exact conversion and emits
`go_zero_time_to_object_id_time` for each transformed source ID. Other canonical
numeric BSON dates remain validation errors rather than being silently coerced.

After implementing that rule, a fresh authorized export and dry-run accepted all
114 feelings and both weekly trackers, rejected zero records, reported exactly
two approved transformations, and retained five pseudonymous identities. The
dominant identity now accounts for 106 feelings and both weekly trackers. Output
files remained owner-only and contained no private content, raw identity, or
credential. The second plaintext export and its reports were removed after the
sanitized result was recorded.

### Credential incident and recovery

During the first export attempt, `mongoexport` included the existing database
credential in a connection error emitted to this private task output. The value
was never committed or written to a repository artifact, but it was treated as
exposed. Work stopped, the plaintext export was removed, and Vinicius Delascio
explicitly approved an immediate production credential rotation with the known
Heroku dyno restart.

A new random password was generated locally, held only in an owner-only pending
file and Keychain during the change, entered into the existing Atlas database
user, and then applied to Heroku `DB_PASS`. Verification proved:

- the Atlas credential reads the unchanged 114/2 source counts;
- Heroku holds the same replacement value without displaying it;
- both `web` and `worker` dynos restarted and report `up`;
- the production application root returns HTTP 200; and
- the pending file, temporary Keychain item, and clipboard contents were removed.

The verified replacement is retained only in macOS Keychain under service
`feeling/mongodb/atlas-password`, account `feeling`, and in the authorized Atlas
and Heroku secret stores. Atlas currently shows this application database user
with the broad `atlasAdmin@admin` role over all resources. That pre-existing
least-privilege issue is recorded but has not been changed during data migration.

## Authorized representative import

Vinicius Delascio explicitly approved loading all 116 production-derived
records, including the two recorded timestamp normalizations, into the empty
Steady non-production Supabase project. A fresh owner-only source export was
created after that approval. Its pre-write dry-run accepted 114 feelings and two
weekly trackers, rejected zero records, retained five pseudonymous identities,
and reported exactly two `go_zero_time_to_object_id_time` transformations.

The first hosted import ran through the migration-only TLS session connection,
explicitly assumed `steady_runtime`, and committed one short forced-RLS
transaction. It inserted and matched all 114 feelings and both weekly trackers,
with zero exceptions and zero target-only rows. The identical second import
inserted zero rows, matched all 116 records, retained the same collection
structural hashes, and reported no target-only row. A subsequent read-only
reconciliation produced the same 114/2 match with no exception or target-only
record. The source MongoDB collections were not changed, and the Go/Heroku
application remains available.

## Post-import encrypted backup and restore

Because the Steady non-production project remains on the Free plan, a complete
logical backup was taken immediately after reconciliation. The owner connection
captured password-free role definitions, the private `steady` schema, and its
data. A manifest records PostgreSQL 17.6, migration `20260818040229`, the Sydney
source region, 114 feelings, two weekly trackers, and a SHA-256 for every SQL
component.

The authenticated-encrypted archive is retained in the private Sydney Storage
bucket at:

`database/20260818T054525Z/steady-nonprod-post-import-20260818T054525Z.tar.gz.enc`

Its encrypted size is 20,115 bytes and its SHA-256 is
`cb1fe709653235362bf57b52bac3277cfedcbbd2a4cbc4a742a3af4564ea76e7`.
An authenticated download matched that checksum. The downloaded ciphertext was
decrypted into owner-only scratch, every archived component matched its
manifest hash, and the archive restored into a disposable PostgreSQL 17
instance. The restore contained 114/2 rows, five policies, and forced RLS on
both tables. The complete Stage 4 SQL suite passed, and the restored target
reconciled all 116 source records with zero exceptions and zero target-only
rows. The disposable database was removed after verification.

## Stage 5 outcome

Stage 5 is complete. Every authorized source record is represented in Steady
non-production, repeat import is idempotent, forward reconciliation is exact,
synthetic target-only rollback reporting remains proven, and both the pre-data
and post-import encrypted backups have successful restore rehearsals. The
ignored plaintext source export, reports, decrypted archives, SQL dumps, local
encrypted copies, and disposable database were removed after evidence capture.
The authoritative MongoDB source and both retained encrypted Storage objects
remain available.

No automatic backup deletion or retention policy has been authorized. The
pre-data zero-row backup and the post-import 116-record backup are both retained.

Stage 14 supersedes the manual archive assembly with the reusable strict
`tools/backup/workflow.ts` pack/verify workflow and records a fresh 2026-08-25
backup with all three migrations, nine policies, 114/2 rows, and a passing Deno
service smoke. These Stage 5 objects remain historical recovery evidence.
