# How to migrate an application from one host to another

A host migration is not mainly a copying exercise. It is a controlled period in
which two systems can exist, one is authoritative, and every acknowledged write
must remain accounted for. This guide uses Steady's Go/Heroku/MongoDB to
Deno/Azure/Supabase migration as a concrete example.

## The five things to establish first

1. **Behaviour contract:** list what users and integrations can observe—URLs,
   responses, authentication, ordering, validation, and error behavior.
2. **Data contract:** map every retained field, identity, constraint, default,
   timestamp, and ownership rule. Decide explicitly which quirks to normalize
   and which unused data/code to retire.
3. **Security contract:** name the identity provider, authorization boundary,
   operator access, secret store, network paths, and data residency.
4. **Operating contract:** define health checks, logs, backup/restore,
   monitoring, ownership, cost limits, and rollback.
5. **Commit point:** write down the exact event after which the old database may
   be missing acknowledged writes. This determines which rollback is safe.

## A safe sequence

Characterize the old system before changing it. Provision the target separately
and keep it dark. Recreate the schema and security boundaries, migrate a
checkpoint, and reconcile source and target by stable identity and content.
Migrate vertical API slices while comparing both implementations. Build and
test the final deployment shape, including the browser and authentication—not
just database queries.

Before cutover, take verified encrypted backups and suspend writes. Export a
final source checkpoint, import idempotently, require complete reconciliation,
and run authenticated smoke tests. Only then switch traffic. Observe the new
system while keeping the old compute, database, credentials, and deployment
recoverable.

## Two different rollbacks

Before the commit point, simply keep or restore traffic on the old system;
source data is still authoritative and unchanged. After the commit point, stop
target writes first, copy target-only acknowledged writes back to the old
database idempotently, reconcile both directions, and only then restore old
traffic. Confusing these modes is one of the easiest ways to lose data.

## How Steady applies this

- Auth0 remains the identity provider; no account relinking is required.
- The Deno API and React build share one Azure Container Apps origin.
- Supabase Postgres is private to the API. Forced RLS rechecks every Auth0
  subject in the database, while the Data API remains disabled.
- Azure and both Supabase projects are in Australia; the application uses
  managed TLS, health probes, structured logs, secrets, and revision rollback.
- MongoDB and Go/Heroku remain the rollback source until Review, Release, and a
  separate human-approved decommissioning step.
- Migration and rollback reports contain counts and keyed hashes, never private
  comments/notes or secrets.

## Practical checklist for another migration

- Pin versions and deploy an immutable artifact by digest.
- Make imports and reconciliation retry-safe; test the second run writes
  nothing.
- Separate runtime, migration, backup, and rollback credentials.
- Test authorization with at least two synthetic identities.
- Test backup restoration, not just backup creation.
- Rehearse traffic reversal and both data rollback modes in nonproduction.
- Record commands, timestamps, counts, checksums, approvals, and owners.
- Never delete the old host or database during cutover. Decommission only after
  an observation period and explicit approval.

For this repository, the executable procedures are in
`docs/runbooks/stage-12-cutover.md`, `pre-commit-rollback.md`,
`post-write-rollback.md`, `backup.md`, and `restore.md`.
