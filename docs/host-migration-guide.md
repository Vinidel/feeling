# How to manage an application migration from one host to another

This handbook explains how to move a live application between hosting and data
platforms without losing data, weakening security, or cutting traffic over on
hope alone. It is grounded in the Steady pilot, which migrated:

```text
Go + Heroku + MongoDB
            ↓
Deno TypeScript + Azure Container Apps + Supabase Postgres
```

Auth0 remained the identity provider. The migration was incremental: the old
system stayed recoverable until the replacement had been reviewed, released,
used in production, observed, backed up, and separately approved for
decommissioning.

The most important lesson is that a migration is not mainly a code rewrite. It
is a controlled transfer of behaviour, data authority, security boundaries,
operations, and recovery responsibility.

## 1. The migration control model

A safe migration answers five questions at every stage:

1. **What behaviour must remain true?**
   URLs, payloads, authentication, ordering, validation, errors, and user
   journeys form the external contract.
2. **Which system is authoritative right now?**
   There must be exactly one source of truth for writes at each point in the
   cutover.
3. **Can every acknowledged write be accounted for?**
   Counts alone are insufficient. Reconcile stable identifiers and mapped
   fields, and classify every exception.
4. **Can we recover from the next action?**
   Recovery must be tested before taking the action that makes it necessary.
5. **Who has authority to proceed or stop?**
   A passing command is evidence, not permission. Production changes, traffic
   switching, data migration, irreversible operations, and deletion need named
   human authority.

### The source-of-truth timeline

```text
Before write freeze       During final migration        After commit point
Old system authoritative  Writes suspended              New system authoritative
New system is compared    Final checkpoint reconciled   Old system is rollback only
```

The **commit point** is the exact event after which the new database may contain
acknowledged writes that the old database does not. Record it explicitly. It
separates a simple traffic rollback from a data-reconciliation rollback.

## 2. Use lifecycle contracts, not chat history

Steady used the AI Engineering OS lifecycle. Each stage produced a durable JSON
contract under `specs/backend-migration/`:

| Stage | Contract | Question it answers |
| --- | --- | --- |
| Define | `brief.json` | What outcome and observable behaviour are required? |
| Design | `design.json` | What target architecture and security boundaries will achieve it? |
| Plan | `plan.json` | In what small, verifiable order will the work happen? |
| Implement | `implementation.json` | What changed, and what commands/tests prove it? |
| Review | `review.json` | Does independent evidence satisfy the contract and expose residual risk? |
| Release | `release.json` | Is the system operationally ready, and who owns rollout and recovery? |

This matters because migrations often span days or weeks. Decisions, approvals,
failed attempts, checksums, and stop conditions must survive beyond one terminal
session or conversation.

For every stage:

- validate the artifact structure;
- validate stage readiness separately;
- keep unresolved questions visible;
- record human approvals by name and time;
- do not silently rewrite failed historical evidence; and
- do not begin the next lifecycle stage without an explicit instruction.

## 3. Assess the current system before designing the target

Create a current-state assessment before changing production code. Map:

- process and module architecture;
- every HTTP route and caller;
- business/domain services;
- database collections/tables, indexes, constraints, and ownership fields;
- data-access patterns and transaction semantics;
- authentication and authorization;
- jobs, schedulers, queues, and workers;
- external integrations;
- host-specific configuration, build, deployment, and add-ons;
- environment-variable and secret-name dependencies without their values;
- frontend API dependencies;
- tests and the behaviour they actually protect; and
- risks, unknowns, unused code, and accidental quirks.

Do not assume every old responsibility should be rewritten. Classify each one:

- **KEEP IN APPLICATION CODE** — business behaviour or orchestration that
  belongs in the API.
- **MOVE TO THE DATA PLATFORM** — constraints, atomic updates, row-level
  authorization, storage, or other capabilities the platform can enforce more
  reliably.
- **REPLACE** — behaviour still needed but better served by a new mechanism.
- **REMOVE** — unused routes, dead integrations, compatibility shims, or jobs
  confirmed to have no caller.

Steady kept the user-facing feelings and weekly-tracker behaviour, moved data
constraints and defence-in-depth authorization to Postgres/RLS, retained Auth0,
replaced hosting and persistence, and removed the abandoned OpenClaw machine
routes.

## 4. Characterize observable behaviour first

Before rewriting anything, put tests around the old API. These tests are your
behavioural measuring instrument.

Characterize at least:

- successful reads and writes;
- empty results;
- malformed and unsupported input;
- missing, invalid, expired, and mismatched credentials;
- attempts to select another user through a body, query, or header;
- cross-user reads and writes with two synthetic identities;
- response status, headers, JSON fields, types, timestamps, and ordering;
- duplicate handling and upsert semantics;
- CORS preflight and disallowed origins;
- unmatched and retired routes; and
- observable write side effects.

Separate findings into:

- behaviour that must remain compatible;
- accidental quirks explicitly approved for normalization; and
- unused behaviour explicitly approved for retirement.

Run the same black-box contract suite against old and new services during each
vertical migration slice. Do not let the new implementation redefine expected
behaviour simply because it is easier to build differently.

## 5. Design the target around responsibilities

Compare realistic architecture options before selecting a runtime or provider
feature. Consider:

- standalone API versus provider-native functions/Data API;
- long-running versus request-scoped compute;
- transaction and connection requirements;
- cold starts and scaling costs;
- database connection pooling;
- authentication compatibility;
- row-level authorization;
- storage and backup boundaries;
- observability and operator access;
- local testability and dependency support; and
- hard-to-reverse commitments.

Steady selected a standalone Deno API because Auth0 remained canonical and the
service needed controlled database transactions, strict HTTP compatibility,
same-origin React hosting, and portable container deployment. Supabase Postgres
stores the data, while the browser cannot access the private application schema
through the Data API.

### Connection pooling matters

Serverless and autoscaling compute can open more database connections than a
small Postgres plan safely supports. A pooler such as Supavisor sits between the
application and Postgres:

- **session mode** holds a database connection for the client session and is
  suitable for migrations and tools that require session state;
- **transaction mode** lends a connection only for one transaction and is
  suitable for request-serving APIs with short transactions.

Transaction pooling means application code must not rely on connection-level
state leaking between requests. Steady sets its Auth0 subject transactionally,
runs the query in the same transaction, and disables prepared statements for
the pooled runtime path.

## 6. Provision the target dark

Create the target environment without sending production traffic to it.
Separate environments and credentials by purpose:

- runtime/API credential;
- migration/schema-owner credential;
- backup Storage operator credential;
- backup encryption key; and
- temporary rollback/reconciliation credential while the old system exists.

Verify and record:

- region and account/subscription;
- project and resource names;
- plan limits and cost alerts;
- TLS and network path;
- direct versus pooled database connectivity;
- secret references, never values;
- schema exposure and Data API settings;
- logging and retention;
- backup availability or the approved manual alternative; and
- operator audit capabilities and limitations.

Provider CLI, dashboard, management API, and MCP tools are different interfaces
to provider state. Use whichever is safest for the operation:

- CLI for reproducible discovery, builds, exports, and scripted checks;
- dashboard for authentication, one-off approvals, or provider-only controls;
- management/API tools for exact read-only inventory and bounded mutations; and
- repository scripts for deterministic domain-specific validation.

Always discover current CLI commands with `--help`, pin versions used for
evidence, and check current provider documentation and breaking changes.

## 7. Recreate the data model intentionally

Map every source field to a target field. Include:

- stable legacy identifier;
- user/tenant ownership key;
- required and optional values;
- type conversion;
- timestamps and time zones;
- defaults;
- uniqueness;
- enum/range validation;
- ordering indexes;
- foreign keys, if any;
- update/upsert rules; and
- explicitly approved normalization.

Put invariants in Postgres when they are truly data invariants. Application
validation gives useful errors; database constraints protect every writer.

Steady used a private schema, uniqueness for legacy identifiers and
user/week trackers, field constraints, deterministic history indexes, and
forced RLS. The API also filters by the verified user, but RLS protects against
an accidentally missing application predicate.

## 8. Build a deterministic migration pipeline

A safe import has four modes:

1. **Extract** a stable checkpoint from the source.
2. **Dry-run** parsing and mapping without writing.
3. **Import** idempotently using stable legacy keys.
4. **Reconcile** source, accepted, rejected, matched, inserted, and target-only
   records.

The second import run should write nothing. If it creates duplicates, the
migration is not retry-safe.

Useful sanitized evidence includes:

```text
source count
accepted count
rejected count by reason
inserted count
matched-existing count
target-only count
stable keyed/content hashes
approved transformation count
```

Never put journal text, personal data, tokens, passwords, database URLs, or raw
identity subjects in migration reports. Use aggregate counts, pseudonymous keys,
and cryptographic hashes where possible.

## 9. Preserve authentication; strengthen authorization

Authentication migration and backend migration do not have to happen together.
Changing both at once increases risk.

When retaining an identity provider:

- preserve issuer, audience, signing algorithm, expiry, and subject semantics;
- reject a client-supplied user identifier that conflicts with the verified
  token;
- derive row ownership only from the verified identity;
- test missing, malformed, expired, wrong-audience, and wrong-subject tokens;
- keep administrative credentials out of the browser; and
- test at least two identities through application and database paths.

Steady retained Auth0 and used the Auth0 subject as the ownership key. Operator
access occurs through Azure/Supabase/Auth0 provider controls, not through an
application operator endpoint.

## 10. Migrate in vertical slices

Prefer a complete user-visible slice over translating every controller, then
every service, then every repository.

For one slice:

1. implement its target schema and authorization;
2. implement its read and write API behaviour;
3. run unit and integration tests;
4. run the black-box contract against old and new services;
5. exercise it through the frontend; and
6. record differences as approved normalization or defects.

Steady migrated feelings first, compared it to Go, then migrated weekly
tracking. This exposed compatibility issues earlier than a big-bang rewrite
would have.

## 11. Build the actual deployment shape

Testing source modules is not enough. Build and test the exact artifact that
will run:

- pinned runtime and dependency lock;
- immutable container image/digest;
- non-root execution where practical;
- minimum filesystem, environment, and network permissions;
- static frontend serving and same-origin API routing;
- health and readiness endpoints;
- graceful shutdown;
- managed TLS;
- sanitized structured logs; and
- revision rollback.

Test cold and warm behaviour separately. Steady intentionally scales Azure
Container Apps to zero to control cost, so a roughly 20–30 second first request
is a known trade-off while warm checks remain around a tenth of a second.

## 12. Back up by proving restoration

An uploaded file is not yet a usable backup. A backup is qualified only after:

1. source counts and migration versions are recorded;
2. roles are exported without password hashes;
3. schema and data are exported with matching database tools;
4. plaintext components are packed and authenticated-encrypted;
5. only ciphertext is uploaded to private storage;
6. the object is downloaded to a separate path;
7. its outer checksum matches;
8. authenticated decryption and internal checksums pass;
9. it restores from the beginning into an empty matching database;
10. schema, constraints, grants, RLS, counts, and application reads pass; and
11. disposable databases and all local plaintext are removed.

If restoration fails, keep the immutable object clearly marked **unqualified**,
fix the export, create a new object, and repeat the entire test. Never overwrite
the failed candidate or quietly promote it.

This happened in Steady Stage 20: the first role export contained
Supabase-internal grantor semantics that a plain PostgreSQL restore could not
replay. The restore gate caught the problem. A corrected new object passed the
full restore. That is exactly why restore rehearsal is mandatory.

### Free-plan pause behaviour

Low-activity Supabase Free projects may auto-pause. A backup run must therefore
begin with a project-state preflight:

1. inspect the exact backup project;
2. resume it if paused;
3. wait for `ACTIVE_HEALTHY`;
4. allow for DNS/service wake-up delay;
5. verify the private bucket and existing inventory; and
6. only then export or upload.

A pause does not automatically require a paid plan. The operator can resume the
project and run the verified workflow. Check the provider's current restore
window each time because platform policies change.

## 13. Rehearse cutover and rollback

Run the production sequence in non-production using realistic data shape and
the actual deployment artifact.

### Pre-commit rollback

Before the new system accepts authoritative writes:

1. keep writes suspended;
2. cancel the traffic change;
3. verify the old source checkpoint;
4. verify the old application and authentication;
5. return traffic to the old system; and
6. resume old-system writes.

No reverse data copy is needed because the old database remained authoritative.

### Post-commit rollback

After the new system accepts writes:

1. suspend new-system writes;
2. create fresh backups of both states;
3. identify target-only acknowledged writes;
4. copy them back idempotently using a narrowly scoped operator credential;
5. reconcile in both directions;
6. verify identity boundaries and user journeys;
7. change traffic back; and
8. resume writes only after every acknowledged write is accounted for.

Confusing these two rollback modes is an easy way to lose data.

## 14. Execute production cutover with gates

A practical production run sheet is:

1. **Authority** — name every production mutation and obtain approval.
2. **Freeze candidate** — record commit, image digest, migration versions,
   resources, operator, start time, and decision-maker.
3. **Provider preflight** — verify health, region, TLS, credentials by name,
   limits, logs, and rollback readiness.
4. **Qualified backup** — create, download, restore, and verify a fresh backup.
5. **Write freeze** — stop or isolate every old writer and wait for in-flight
   work.
6. **Final source checkpoint** — export and record sanitized counts/hashes.
7. **Final idempotent import** — dry-run, import, repeat, and reconcile.
8. **Dark-target verification** — contracts, auth failures, RLS, CORS, frontend,
   logs, health, and readiness.
9. **Commit point** — record it, switch traffic, and make the new system
   authoritative.
10. **Immediate smoke** — login/session, reads, approved writes, logout,
    isolation, logs, and post-write accounting.

Stop on any unexplained difference. Do not rationalize a discrepancy while the
write freeze is active.

## 15. Observe before decommissioning

After cutover, monitor:

- HTTP status and supported journeys;
- health/readiness and cold versus warm latency;
- authentication failures;
- cross-user or ownership failures;
- database connections, errors, storage, and capacity;
- provider security/performance advisors;
- migration and ongoing data accounting;
- backup cadence and restore results;
- logs for secret/private-data leakage; and
- cost and plan limits.

Keep the old system isolated but recoverable during the approved observation
period. Successful traffic switching is not deletion authority.

Decommission only after a separate human decision names exact targets and
verifies:

- observation exit conditions;
- current data reconciliation;
- a fresh qualified backup;
- retention obligations;
- no active legacy caller;
- production health after each deletion; and
- what recovery remains after the old system is gone.

Steady separately approved and removed its Heroku app, MongoDB cluster and
scoped users, rollback credential, and Go/Heroku repository artifacts only
after these gates. Azure, Supabase, Auth0, DNS, encrypted backups and keys,
current code, runbooks, specifications, and Git history were retained.

## 16. Recovery after the old system is gone

Once legacy infrastructure is deleted, stop describing it as rollback.
Update Release, monitoring, incident, audit, backup, and restore records.

There are then two recovery cases:

- **Bad compute revision, healthy database:** route to the last healthy
  immutable revision and run authenticated contract smoke tests.
- **Database corruption or uncertain integrity:** suspend writes, preserve the
  affected system, restore the latest qualified encrypted object into a new
  empty database, apply later reviewed migrations, reconcile and test, then
  separately approve any secret or traffic switch.

Never restore blindly over the only production database.

## 17. Common failure modes

Avoid these patterns:

- rewriting old architecture one-for-one without reassessing responsibility;
- changing hosting, database, authentication, and frontend contract together;
- relying on counts without field-level/keyed reconciliation;
- using client-provided identity for ownership;
- giving the runtime schema-owner or service-role privileges;
- exposing a private schema through a convenient Data API;
- assuming transaction-pooled connections preserve session state;
- treating upload success as backup success;
- overwriting a failed backup candidate;
- leaving plaintext dumps in a repository or broad temporary directory;
- switching traffic without recording the commit point;
- deleting the old system during cutover;
- retaining stale runbooks that promise a deleted rollback path;
- silently upgrading an account to solve a control problem; and
- treating validator/test success as authorization to mutate production.

## 18. Evidence checklist

Before declaring a migration complete, retain sanitized evidence for:

- approved Define, Design, Plan, Review, and Release contracts;
- old-service characterization tests;
- route and caller inventories;
- schema and ownership mapping;
- secret names and custody, never values;
- source, accepted, rejected, inserted, matched, and target-only accounting;
- idempotent second import;
- two-user authorization denial;
- exact build/runtime versions and image digest;
- production cutover authority and commit point;
- health, readiness, frontend, and authentication smoke;
- backup path, size, checksum, manifest, and restore result;
- observation results and incidents;
- exact decommission targets and outcomes; and
- post-decommission recovery and support ownership.

## 19. Reusable decision checklist

Before starting another migration, answer:

- What externally observable behaviour must remain unchanged?
- Which quirks should be normalized?
- Which unused code/integrations are approved for removal?
- What is the identity provider and immutable ownership key?
- Which responsibilities belong in application code versus the platform?
- Where must data and backups reside?
- What are the RPO, RTO, cadence, and retention expectations?
- How will imports be made idempotent?
- How will every record and acknowledged write be reconciled?
- What is the exact commit point?
- What are the pre-commit and post-commit rollback procedures?
- Which credentials are needed, where are they held, and what is their minimum
  privilege?
- What signals stop cutover or suspend writes?
- Who owns deployment, incident response, rollback/recovery, backups, and
  provider escalation?
- What exact approval is required before traffic, data, environment, or
  deletion changes?

## 20. Steady reference material

The final Steady architecture and evidence are recorded in:

- [`specs/backend-migration/current-state.md`](../specs/backend-migration/current-state.md)
- [`specs/backend-migration/brief.json`](../specs/backend-migration/brief.json)
- [`specs/backend-migration/design.json`](../specs/backend-migration/design.json)
- [`specs/backend-migration/plan.json`](../specs/backend-migration/plan.json)
- [`specs/backend-migration/implementation.json`](../specs/backend-migration/implementation.json)
- [`specs/backend-migration/review.json`](../specs/backend-migration/review.json)
- [`specs/backend-migration/release.json`](../specs/backend-migration/release.json)
- [`specs/backend-migration/stage-20-recovery-remediation.md`](../specs/backend-migration/stage-20-recovery-remediation.md)

Executable operating procedures are in:

- [`docs/runbooks/backup.md`](runbooks/backup.md)
- [`docs/runbooks/restore.md`](runbooks/restore.md)
- [`docs/runbooks/monitoring-support.md`](runbooks/monitoring-support.md)
- [`docs/runbooks/breach-response.md`](runbooks/breach-response.md)
- [`docs/runbooks/operator-audit.md`](runbooks/operator-audit.md)

Historical cutover and rollback runbooks remain useful as migration evidence,
but the active post-decommission recovery contract is the approved Release
record plus the current backup and restore runbooks.
