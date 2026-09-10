# Legacy rollback security runbook

Status: rehearsed locally; production execution is not authorized.

Owner and approver: Vinicius Delascio. This procedure retains the verified Go
release only as a four-browser-route rollback source. The retired chat and agent
machine APIs are not rollback dependencies.

## Required MongoDB users

Create two different Atlas database users using generated passwords entered
directly into their destination secret stores:

| User | Exact role | Credential destination |
| --- | --- | --- |
| `steady_legacy_runtime` | `readWrite` on database `feeling` only | Heroku `DB_USER`/`DB_PASS` only |
| `steady_rollback_operator` | `readWrite` on database `feeling` only | Operator secret store only |

Neither user may have `atlasAdmin`, an `admin` database role,
`readWriteAnyDatabase`, cross-database access, user management, project access,
or infrastructure privileges. Never reuse one password or place the operator
credential in Heroku.

Before production, use a disposable MongoDB instance to run
`tools/legacy-security/mongo_role_probe.js` as each user. It must prove
read/write/update/delete on a synthetic `feeling` probe collection and denial
of both `admin.usersInfo` and a cross-database read. In Atlas, independently
inspect each user's role list and record only username, custody label, role, and
database through `mongo_role_policy.ts`; do not record passwords or connection
URLs.

## Ordered production credential rotation

This section needs separate explicit authority for MongoDB credential creation,
the Heroku environment change, and revocation.

1. Record the unchanged source baseline: 114 feelings and 2 weekly trackers.
2. Create `steady_legacy_runtime` with only `readWrite@feeling`. Enter its
   generated password directly into the Heroku Dashboard while changing
   `DB_USER` and `DB_PASS`; do not put it in a command argument, file, clipboard
   record, report, or repository.
3. Let Heroku restart, verify the root and all four Auth0 browser routes, and
   confirm source counts remain 114/2. Stop and restore the previous database
   credential if any browser probe fails.
4. Create `steady_rollback_operator` with only `readWrite@feeling`, store it only
   in the operator secret store, and run read-only reconciliation plus a
   separately authorized synthetic rollback probe. Confirm source counts remain
   114/2.
5. Only after both paths pass, revoke the old `atlasAdmin@admin` user. Confirm
   its authentication fails and both scoped paths still pass. Do not delete the
   Mongo database.

## Heroku isolation at the cutover write freeze

This section needs separate explicit authority for production environment and
availability changes. The installed Heroku CLI exposes `maintenance:on`,
`maintenance:off`, and `config:unset`; discover their current syntax with
`--help` immediately before use.

1. Enable maintenance mode on the exact Heroku app and verify its public
   hostname serves no application handler.
2. Remove `CHAT_INGEST_TOKEN` and `AGENT_API_TOKEN` together. Inspect config
   **names only** and prove both are absent; never print the config values.
3. Keep maintenance on throughout target observation. The Go release and
   browser database credential remain deployed, but neither retired token is
   ever restored.
4. For an authorized rollback, first complete the applicable data checks or
   target-to-Mongo reconciliation. Then disable maintenance and require all four
   Auth0 browser routes to pass before writes resume.
5. With maintenance off, a direct retired-route probe must fail closed before
   its handler because the corresponding token is unconfigured. A 500
   configuration failure is the characterized legacy result; do not mistake it
   for the handler running. Re-enable maintenance if rollback is abandoned.

If any retired caller reappears, stop and return to Define. If maintenance,
token removal, scoped credentials, or revocation cannot be verified, block the
traffic switch and retain the current source of truth.
