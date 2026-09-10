# Stage 20 — post-decommission recovery remediation

Recorded: 2026-09-08 (Australia/Brisbane)

Vinicius Delascio explicitly approved this bounded remediation on 2026-09-08:
resume the existing Free `Steady backups` project, create and fully
restore-test a current encrypted production backup, and correct the
post-decommission operational records without upgrading an account.

## Provider preflight

- Production `Steady non-prod` (`qzsdmhptclzqndzsqpax`) remained
  `ACTIVE_HEALTHY` in Sydney (`ap-southeast-2`) on PostgreSQL 17.6.1.155.
- `Steady backups` (`dabuqchfkqbsgymbspvk`) was `INACTIVE` after low use. The
  approved restore operation returned success, the project passed through
  `COMING_UP`, and it became `ACTIVE_HEALTHY` in the same Sydney region without
  an account-plan change.
- The public project hostname had a short DNS wake-up delay after the control
  plane became healthy. Bounded preflight attempts stopped safely until it was
  reachable.
- The `database-backups` bucket remained private and retained its original
  seven ciphertext objects before this operation.
- Production preflight reported 116 feelings, 4 weekly trackers, 9 policies,
  and RLS enabled and forced on both application tables.
- The required database-owner, Storage-operator, and encryption Keychain items
  were verified by service/account name only. No value was printed or written
  to repository evidence.
- [Supabase's current project-pausing documentation](https://supabase.com/docs/guides/platform/free-project-pausing)
  says Free projects can auto-pause after low activity and can currently be
  resumed from the dashboard for up to one year. The current changelog exposes
  no breaking change relevant to this private-schema, direct-Postgres,
  operator-Storage workflow.

## Current export and encrypted objects

PostgreSQL 17 tools exported password-free application roles, the private
`steady` schema, and current data into a new mode-0700 scratch directory outside
version control. Source verification reported PostgreSQL 17.6, the three
version-controlled migration identifiers, and 116/4 rows. A credential-marker
scan of the roles component passed.

The first new immutable candidate was:

- object:
  `database/20260908T035825Z/steady-production-weekly-20260908T035825Z.steady.enc`;
- size: 56,417 bytes; and
- SHA-256:
  `7723373154c6493b0894d1747e47752380f3b48c01e467fc8ccc36abb2555df6`.

Its upload, separate download, outer checksum, authenticated decryption, and
component checksums passed. The empty-target restore then correctly failed: the
raw role export contained duplicate Supabase-platform membership grants with
`supabase_admin` grantor semantics that do not exist in plain PostgreSQL. The
candidate is retained as immutable unqualified evidence and must never be used
for recovery.

Only those platform-internal duplicate grants were removed. The three
application roles, their exact safe attributes, and all application membership
relationships were preserved. Production was rechecked at 116/4 before a new
object was created.

The qualified current recovery point is:

- object:
  `database/20260908T041928Z/steady-production-weekly-20260908T041928Z.steady.enc`;
- private bucket: `database-backups` in the separate Sydney project;
- size: 56,095 bytes;
- SHA-256:
  `b35f03b7ffb9786d8fc6d170186e7b98dc67b86e11095e0f0bbdccf910895056`;
- manifest: format 1, `steady-production`, PostgreSQL 17.6, pinned Supabase CLI
  2.114.0, Sydney-to-Sydney, migrations `20260817053317`,
  `20260818040229`, and `20260819004100`, with 116 feelings and 4 weekly
  trackers; and
- encryption: the existing operator-only AES-256-GCM key with a new random IV
  and authenticated tag.

The backup project now retains nine private `application/octet-stream`
ciphertext objects totalling 369,619 bytes. No object was overwritten or
deleted.

## Qualified restore result

The qualified object was downloaded to a separate path and matched its recorded
outer SHA-256. Authenticated decryption and all three internal checksums passed.
It restored from the beginning into a new network-isolated PostgreSQL 17
container with `ON_ERROR_STOP`.

Verification proved:

- exactly 116 feelings and 4 weekly trackers;
- exactly 9 RLS policies and both application tables with RLS enabled and
  forced;
- all three application roles retained no superuser, create-role,
  create-database, inherit, or bypass-RLS capability;
- table ownership, grants, constraints, indexes, default behavior, unique
  identifiers, weekly upsert behavior, and all Stage 4 schema tests passed;
- a transaction-local restored application identity could read its own real
  rows and no different subject row; and
- both production and backup Supabase projects returned no Security or
  Performance Advisor lint.

The exact disposable restore container and the owner-only scratch directory,
including all plaintext SQL, decrypted components, downloads, and local
ciphertexts, were removed after durable sanitized evidence was captured. The
qualified remote ciphertext is now the current recovery point.

## Operational correction

The active backup and restore runbooks now require a Free-project state,
resume, DNS/reachability, private-bucket, and inventory preflight. The active
monitoring, incident-response, and operator-audit runbooks state that Heroku and
MongoDB were decommissioned and cannot be used for rollback. The amended
Release record now defines recovery as a verified new-target PostgreSQL restore
and keeps its approval pending for targeted Review.

This remediation changed no production business row, database schema, API,
Auth0 setting, Azure deployment, public traffic, account plan, or retained
backup object.
