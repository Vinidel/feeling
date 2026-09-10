# Backend migration current-state assessment

**Work ID:** `backend-migration`  
**Assessment date:** 2026-08-12  
**Scope:** Repository evidence only; no production systems, Heroku configuration, Auth0 tenant, MongoDB Atlas data, or external callers were inspected.  
**Purpose:** Establish the observable and inferred baseline for Pilot #001 before Define and Design. This document does not select Node, Bun, Supabase Edge Functions, or any other compute model.

## Executive summary

Steady is a small, containerized monolith. A Go/Gin process connects directly to MongoDB Atlas, serves a built React SPA, validates Auth0 JWTs for browser-facing APIs, and exposes two shared-secret integration surfaces for chat ingestion and agent reads. There is no service or repository layer: routing, authentication, validation, domain rules, and MongoDB access are concentrated in `server/main.go` and `server/handlers.go`. Some presentation and aggregation rules live only in the React client.

The migration is technically bounded but behaviourally under-specified. The repository registers seven API routes, persists two document types, and has no server-side background-job implementation. However, the current automated tests protect only CORS behaviour plus a React render smoke test. Production data shape, MongoDB indexes, external integration callers, actual Heroku process formation, Auth0 tenant configuration, and operational expectations are not represented in the repository.

The most consequential migration boundary is identity. Browser routes derive ownership from the Auth0 JWT `sub`; chat and agent routes instead trust a deployment-wide shared secret and a caller-supplied `x-user-id`. Any Supabase RLS design must preserve or intentionally replace those two distinct trust models.

## Evidence reviewed

- Repository instructions: `AGENTS.md` and `.agents/skills/define/SKILL.md`.
- Go service: `server/main.go`, `server/handlers.go`, `server/go.mod`, and both Go test files.
- React API/auth call sites: `client/src/index.js`, `client/src/config.js`, `App.js`, `FeelingComponent.js`, `WeeklyTrackerComponent.js`, `WithFetch.js`, `TitleComponent.js`, and related presentation components.
- Deployment/configuration: `Dockerfile`, `heroku.yml`, `app.json`, `.gitignore`, package manifests, and root `README.md`.
- Generated/compiled artefacts were inventoried but not treated as authoritative source: the tracked `server/main` binary and built frontend bundles under `server/web/`.
- Official Supabase documentation was consulted only to identify plausible responsibility boundaries, not to make a design decision.

## 1. Current Go backend architecture

### Runtime shape

The backend is one Go `main` package using Gin:

1. Create a Gin router with default request logging and recovery middleware.
2. Install global CORS middleware.
3. Construct a MongoDB Atlas connection string from environment variables.
4. Connect to and ping MongoDB during startup; failure terminates the process.
5. Serve static files from `./web` at `/`.
6. Register browser, chat-ingest, and agent routes.
7. Listen on `PORT`, defaulting to `8080`.

The same runtime serves the SPA and API in production. The root Dockerfile builds the Go binary and React bundle in separate stages, then copies both into a minimal Alpine runtime image.

### Code organization

| Area | Current location | Observation |
|---|---|---|
| Data/domain structs | `server/main.go` | `Feeling`, `Activity`, and weekly-tracker types are transport and persistence models simultaneously. |
| Database bootstrap | `server/main.go` | URI construction, connect, and startup ping are global bootstrap concerns. |
| Auth middleware | `server/main.go` | Auth0 JWT, chat shared-secret, and agent shared-secret checks are separate middleware functions. |
| CORS | `server/main.go` | One global policy, configurable by environment with a hard-coded fallback. |
| Routing | `server/main.go` | Routes are registered directly in `main()`. |
| Request handling and data access | `server/handlers.go` | Handlers perform parsing, validation, authorization context lookup, Mongo queries, logging, and response formatting. |
| Static frontend | `server/main.go` + Dockerfile | `./web` is mounted at `/`; Docker builds the client and supplies that directory. |

There is no explicit service layer, data-access abstraction, dependency-injection boundary, transaction boundary, API schema, OpenAPI document, migration system, or centralized error model.

## 2. HTTP/API routes

Seven routes are explicitly registered.

| Method and path | Authentication | Inputs | Success contract | Important current behaviour |
|---|---|---|---|---|
| `GET /api/feelings` | Auth0 RS256 JWT | Optional `x-user-id`; no query parameters | `200` with a bare JSON array of feeling records | User is always the JWT `sub`. If `x-user-id` is present and differs, middleware returns `403`. Mongo query has no server-side sort, pagination, or limit. An empty result may serialize as `null` because the Go slice starts nil; the client normalizes non-arrays to `[]`. |
| `POST /api/feelings` | Auth0 RS256 JWT | JSON `activities`, `status`, `createdAt`, `comment`; client also sends `x-user-id` | `200` echoing the persisted `Feeling`, including `userID` | Body `userID`, if supplied, is overwritten with JWT `sub`. `createdAt` must decode as Go `time.Time`; the browser sends ISO/RFC3339. There is no explicit status range, comment length, activity-key, future-date, or duplicate validation. Unknown JSON fields are not rejected. |
| `GET /api/weekly-tracker?weekOf=YYYY-MM-DD` | Auth0 RS256 JWT | Required `weekOf` query string; optional matching `x-user-id` | `200 {"ok":true,"record":<tracker-or-null>}` | Lookup key is JWT `sub` plus the unvalidated `weekOf` string. Missing `weekOf` returns `400`. |
| `POST /api/weekly-tracker` | Auth0 RS256 JWT | JSON `weekOf`, `mood`, `checks`, `notes`; client sends `trackerVersion` and `x-user-id` | `200 {"ok":true,"record":<normalized-tracker>}` | Upserts by JWT `sub` plus `weekOf`. Requires non-empty `weekOf` and trimmed non-empty `mood`; allowed mood values and date format are not validated. Server overwrites user ID, sets tracker version to `1`, and sets `updatedAt` to current UTC time. |
| `GET /api/chat/capabilities` | `x-ingest-token` shared secret | No body | `200` action/schema description for `log_feeling` | Capabilities are not public; the same ingest secret protects this metadata route. Advertises status `0..4`, known activity keys, optional comment, and optional RFC3339 timestamp. |
| `POST /api/chat/feeling` | `x-ingest-token` shared secret | Required caller-controlled `x-user-id`; JSON numeric `status`, activities, comment, optional `createdAt`, optional `source` | `200 {"ok":true,"saved":{status,createdAt,comment,source}}` | Validates status `0..4` and RFC3339 timestamp. Defaults timestamp to current UTC. Converts status to a string for persistence. `source` is returned but is not persisted in the `Feeling` document. Any user ID is accepted once the shared ingest token is valid. |
| `GET /api/agent/feelings` | `x-agent-token` shared secret | Required caller-controlled `x-user-id`; optional positive integer `limit` | `200 {"ok":true,"count":N,"records":[...]}` | Sorts newest first by `createdat`. Invalid/non-positive limits are silently ignored; there is no maximum. If `AGENT_ALLOWED_USER_IDS` is blank, the allowlist is disabled and any requested user ID is accepted. Access is logged with user ID, limit, and client IP. |

### Cross-cutting HTTP behaviour

- JWT middleware returns bare `401` for token-validation failures, JSON `401` for invalid claims, and JSON `403` for an `x-user-id` mismatch.
- Shared-secret middleware returns `500` if its server-side token is unset and `401` if the provided token is absent or wrong.
- Default allowed CORS origins include local React development, the Heroku hostname, and apex/`www` production domains. Allowed request headers include all three identity/token headers.
- CORS allows credentials and the methods `GET`, `PUT`, `POST`, and `DELETE`, although only `GET` and `POST` routes exist.
- Error response shapes are inconsistent. Some handlers return `{"message":...}`, one bad-body path returns a JSON string, and two feelings-read failures marshal bytes before passing them to `c.JSON`.
- There is no explicit API version prefix beyond `/api`, health/readiness endpoint, rate limiting, request-size policy, timeout policy, idempotency mechanism, or API-wide request validation.

### Undocumented/mismatched route

`TitleComponent` performs `GET /api/ping` whenever the SPA mounts, and the unused `PingComponent` does the same. No `/api/ping` route is registered in the Go server. `TitleComponent` ignores the result except for console logging, so the mismatch does not block rendering but creates a routine failed request and should be treated as observable current behaviour until intentionally removed.

## 3. Business/domain services

There are no separately modeled business services. Current responsibilities are split between handlers and browser components.

### Server-side domain behaviour

- Associate every browser-created/read record with Auth0 `sub`, not the caller's body/header value.
- Insert feelings as append-only records; there are no update or delete routes.
- Upsert one weekly tracker per `(user ID, weekOf)` at the application-query level.
- Force weekly tracker version `1` and update time on every save.
- Validate chat mood status as integer `0..4`, default chat timestamps, and transform chat status to the persisted string form.
- Optionally constrain agent reads to configured user IDs.
- Describe chat-ingest capability metadata.

### Client-side domain and presentation behaviour

- Mood scale maps `0..4` to Rough, Low, Steady, Good, and Great.
- Browser feeling submissions convert mood to a string and date input to an ISO timestamp.
- Feeling history is sorted newest-first in the browser because the user-facing API does not sort it.
- History filters and mood counts are computed entirely in the browser.
- The chart uses valid entries from the last 30 days, keeps the latest entry for each day, and computes a seven-day summary/trend in the browser.
- The browser polls `GET /api/feelings` every 15 seconds while authenticated and the document is visible.
- Weekly completion percentage, current-week Monday calculation, mood options, checklist labels, and default form state are client-side rules.

This split matters: migrating only the Go code would not capture the full current domain contract.

## 4. Database schema and data-access layer

### Database connection

- Provider: MongoDB Atlas.
- Atlas host is hard-coded in the connection string builder.
- Credentials come from `DB_USER` and `DB_PASS`.
- The URI contains a default/auth database path named `prod`, while handlers explicitly select database `feeling`. The operational purpose of the `prod` path must be verified.
- Startup performs a ping and exits fatally if connection or ping fails.
- Contexts use `context.TODO()` with no application-defined deadlines or cancellation.

### Collections and observed document shapes

#### `feeling.feelings`

| Persisted key | Observed type | Notes |
|---|---|---|
| `_id` | MongoDB-generated ID | Not mapped into the Go response model and therefore not returned by the API. |
| `activities` | object | Boolean keys `bow`, `lift`, `run`, `cycle`, `swim`. Missing/extra historical shapes are unknown. |
| `status` | string | Browser path accepts arbitrary strings; chat path stores `"0"` through `"4"`. |
| `createdat` | BSON datetime | Exposed as JSON `createdAt`. Browser path accepts the client-selected timestamp; chat may default server-side. |
| `comment` | string | Free text with no length or content validation. Potentially sensitive personal data. |
| `userid` | string | Auth0 `sub` format, or caller-supplied identity on shared-secret integration routes. |

The field names above follow the Mongo Go driver's default lowercasing of struct field names because `Feeling` and `Activity` have JSON tags but no BSON tags.

#### `feeling.weekly_trackers`

| Persisted key | Observed type | Notes |
|---|---|---|
| `_id` | MongoDB-generated ID | Not mapped into the API response. |
| `weekof` | string | Expected by the UI to be `YYYY-MM-DD`, but server does not validate it. |
| `mood` | string | UI uses five labels; server only requires non-empty text. |
| `trackerVersion` | integer | Always forced to `1` by current server code. Camel-case BSON key is intentional in tags/update document. |
| `checks` | object | Boolean keys `cardio`, `strength`, `mobility`, `build`, `archery`, `hunt`. |
| `notes` | object | String keys `win`, `challenge`, `nextWeek`. |
| `userid` | string | Auth0 `sub`. |
| `updatedat` | BSON datetime | Server-generated UTC timestamp. |

### Data-access characteristics

- MongoDB calls are made directly in each handler; there is no reusable repository abstraction.
- No schema migrations, collection validators, index declarations, seed scripts, backup/restore configuration, retention rules, or data export/import tooling are present.
- The weekly tracker upsert does not prove uniqueness. Without a unique database index on `(userid, weekof)`, duplicates remain possible under concurrency or from historical/manual writes.
- User feelings are fetched without ordering or pagination; agent feelings are ordered and optionally limited.
- No multi-document transaction is used or currently required by a route.
- Actual row counts, data volume, malformed/legacy documents, duplicate weekly trackers, timezone distribution, indexes, and BSON type consistency are unknown.

## 5. Authentication and authorization

### Browser authentication

- Auth provider: Auth0 via `@auth0/auth0-react`.
- The SPA contains a public Auth0 client identifier, tenant domain, and API audience as source configuration.
- Redirect URI and logout return URL use the browser origin.
- Auth tokens are cached in browser local storage and refresh tokens are enabled.
- The API accepts only RS256 JWTs, fetches the tenant JWKS over HTTPS, and caches keys in process memory for one hour.
- Issuer and audience are hard-coded in the Go server; the audience contains the Heroku-era API URL.
- Authorization is ownership-only: the JWT `sub` becomes `authenticatedUserID`, and all browser database queries filter by that value. No roles, permissions, organizations, or scopes are checked.
- The browser redundantly sends `x-user-id`; the API rejects a mismatch but does not require the header.

### Integration authentication

- Chat ingest uses one deployment-wide static bearer-equivalent shared secret in `x-ingest-token`.
- Agent reads use a separate deployment-wide static shared secret in `x-agent-token`.
- Neither integration token identifies an individual machine/caller, carries expiry, scopes actions, or rotates in code.
- Both integration surfaces accept a caller-provided user identity. The optional agent allowlist narrows this; chat has no equivalent allowlist in code.
- Simple string comparison is used for shared tokens; no explicit constant-time comparison, replay protection, rate limit, or audit identity is present.

### Authorization implications

The current browser isolation rule is straightforward to express as owner-based RLS, but the identity key is currently an Auth0 string rather than necessarily a Supabase user UUID. The shared-token routes cannot safely be translated into broad client-side database access: they require a trusted server/function boundary or a deliberately redesigned machine-auth model.

Current Supabase documentation states that Auth0 can be configured as third-party authentication for Supabase APIs, so an incremental design can evaluate retaining Auth0 before deciding whether user migration to Supabase Auth is necessary. That path has token-claim and signing-algorithm requirements and therefore must be validated against the actual Auth0 tenant: <https://supabase.com/docs/guides/auth/third-party/auth0>.

## 6. Background jobs and scheduled processes

No server-side background job, queue consumer, scheduler, cron task, webhook retry loop, or scheduled database process exists in repository source.

Two adjacent behaviours need clarification:

- `heroku.yml` declares both `web` and `worker` build images from the same Dockerfile, but there is no distinct worker command or worker-specific code. The repository cannot show whether a worker dyno is actually scaled in production.
- The authenticated React client polls feelings every 15 seconds while the tab is visible. This is client-side periodic traffic, not a backend job, but it affects load and freshness expectations.

Heroku Scheduler, one-off dynos, external cron callers, and Atlas triggers cannot be ruled out without inspecting deployed services.

## 7. External integrations

| Integration | Purpose | Coupling/evidence | Unknowns |
|---|---|---|---|
| MongoDB Atlas | Primary persistence | Hard-coded cluster host; credentials from environment; database/collection names in handlers | Data size/quality, indexes, network allowlists, backup/PITR, region, plan, users/roles, and whether other applications share the cluster/database. |
| Auth0 | Interactive login and JWT issuance | SPA SDK config; Go issuer/audience checks; JWKS fetched from tenant | Enabled identity providers, Actions/rules, refresh-token settings, callbacks, logout URLs, user count, account-linking, MFA, custom claims, signing algorithm configuration, and tenant ownership. |
| Chat integration | Create feelings through `/api/chat/*` | Shared ingest token, capability contract, caller-supplied user ID | Actual caller/system, traffic, retry/idempotency behaviour, IPs, token rotation owner, accepted response contract, and whether `source` should have been persisted. |
| Agent integration | Read a user's feelings through `/api/agent/feelings` | Shared agent token, optional allowlist, audit-style logging | Actual callers, data-use purpose, expected maximum limit, pagination needs, token rotation, allowlist production state, and privacy/access approval. |
| Custom web domains | Browser and API entry point | Production domains in README/CORS; SPA uses same origin | DNS/SSL ownership, Heroku routing, redirects, CDN/proxy, and cutover constraints. |

No repository evidence shows email, payments, object/file storage, analytics, error monitoring, queueing, or other third-party APIs.

## 8. Heroku-specific configuration and services

- `app.json` declares a container-stack app named `feeling`.
- `heroku.yml` defines `web` and `worker` images using the root Dockerfile.
- The Docker runtime expects Heroku-style dynamic `PORT` and defaults to `8080`.
- The README identifies the current Heroku app and custom production domain and describes GitHub-branch or Heroku Git deployment.
- Heroku hostnames are embedded in:
  - Auth0 API audience in both server and client;
  - default CORS origins;
  - documentation and live/deployment references.
- The container is responsible for serving both the SPA and API, so moving compute also changes frontend hosting unless this responsibility is deliberately separated.

Not present in the repository: dyno formation/scale, Heroku config-var values, add-ons, pipelines, review apps, release phase, health checks, log drains, metrics, domains/certificates, region, stack details beyond `container`, deploy branch settings, or rollback procedures.

The worker declaration is suspicious but not proof of an active service: if run unchanged, the image's command starts the HTTP server rather than a worker loop.

## 9. Environment variables and secret dependencies

No secret values were read or recorded. The dependency inventory is:

| Variable | Secret? | Effective requirement | Consumer and failure mode |
|---|---|---|---|
| `DB_USER` | Yes | Required for startup | Used to construct MongoDB URI; missing/invalid credentials cause connect/ping failure and process exit. |
| `DB_PASS` | Yes | Required for startup | Same as `DB_USER`; URI construction also requires correct escaping, which the code does not perform explicitly. |
| `PORT` | No | Optional | HTTP listener; defaults to `8080`. Heroku normally injects it. |
| `CORS_ORIGINS` | No, but security-sensitive | Optional | Comma-separated override. Blank uses hard-coded local, Heroku, and production-domain origins. |
| `CHAT_INGEST_TOKEN` | Yes | Required only for chat routes to function | Blank causes chat routes to return `500`; wrong/missing request token returns `401`. |
| `AGENT_API_TOKEN` | Yes | Required only for agent routes to function | Blank causes agent routes to return `500`; wrong/missing request token returns `401`. |
| `AGENT_ALLOWED_USER_IDS` | Access-control configuration | Optional, currently fail-open | Blank disables user allowlisting; populated comma-separated values constrain caller-supplied `x-user-id`. |

Hard-coded, non-secret operational dependencies include the MongoDB host, explicit database and collection names, Auth0 tenant/issuer, Auth0 audience, public SPA client identifier, production/Heroku origins, and local development ports. These should become explicit configuration or consciously retained constants during Design.

## 10. Frontend dependencies on the current API

### Hosting and endpoint location

- In local development, the client uses `http://localhost:8080` when the page origin is `http://localhost:3000`.
- In every other environment, API base URL is exactly `window.location.origin`.
- Production therefore assumes the SPA and API share an origin and that `/api/*` is routed to the backend.
- Hash-based navigation avoids server-side SPA route fallback requirements.

### Authentication coupling

- The whole application is wrapped in Auth0's provider.
- Authenticated access controls whether journal/tracker UI is rendered.
- Every browser API call obtains an Auth0 token for the hard-coded Heroku-era audience and sends `Authorization: Bearer ...` plus `x-user-id: <user.sub>`.
- Refresh tokens and local-storage caching influence login/session continuity and are externally observable during an auth migration.

### Data and response coupling

- `GET /api/feelings` must currently be a bare array for normal operation. The client converts any non-array response to empty history.
- Feeling objects are expected to contain camel-case JSON fields `activities`, `status`, `createdAt`, `comment`, and `userID`.
- Mood status is treated as parseable integer text. Client history/chart logic tolerates invalid entries by filtering or falling back, but save UI sends strings `"0"` through `"4"`.
- The frontend sorts feelings itself and assumes the endpoint returns the complete history; it has no pagination protocol.
- A successful feeling save is any resolved POST; the echoed body is ignored. The client immediately refetches and continues polling every 15 seconds.
- Weekly GET requires `{record: null}` or `{record: object}` inside a response object. Weekly POST response body is ignored on success.
- Weekly tracker field names and nesting must remain camel-case as currently consumed.
- Error bodies are not interpreted; frontend displays generic messages.
- The mount-time `/api/ping` call is expected by code but has no matching backend route; its failure is only logged.

### Build/deployment coupling

- Docker builds React with Node 20 and copies its output into the Go runtime's `./web` directory.
- Tracked compiled frontend bundles and a tracked Go binary may be stale relative to source. Docker rebuilds from source, so source plus lockfiles should be the migration baseline, not checked-in binaries.

## 11. Existing tests and protected behaviour

### Go tests

Four tests across two files focus only on CORS middleware:

1. An unknown origin prevents a POST handler from running and currently produces HTTP `200` with an empty body—an unusual library-specific behaviour.
2. The production `www` origin allows POST handling.
3. Comma-separated CORS environment input is normalized to the delimiter format expected by the middleware library.
4. The historical allowlist allows a same-origin/no-`Origin` GET but blocks a production-domain POST, documenting the regression that the current fallback fixed.

The Go suite could not be executed in this assessment environment because no Go executable is installed. This is an environment limitation, not a recorded test failure. Static inspection found no database dependency in these tests.

### React tests

- One test renders `<App />` without crashing.
- Command run: `CI=true npm test -- --watchAll=false`.
- Result: one suite and one test passed.
- The run warns about deprecated `componentWillMount` usage in `TitleComponent`.
- The smoke test does not wrap an Auth0 provider explicitly, assert UI/API behaviour, or fail on the `/api/ping` request.

### Unprotected behaviour

There are no automated tests for route registration; JWT issuer/audience/signature/subject behaviour; shared-token routes; cross-user isolation; validation; Mongo query filters; empty collections; sorting; weekly upsert semantics; API response shapes; frontend request payloads; polling; chart/history calculations; integration contracts; startup configuration; Docker build; migration/backfill; or end-to-end behaviour.

As a result, preserving behaviour will require a characterization-test stage before or alongside replacement implementation. Current code alone is the primary contract, including inconsistencies that product may choose either to preserve temporarily or explicitly change.

## 12. Migration risks and unknowns

### High-impact risks

1. **Identity-key migration:** Existing ownership uses Auth0 `sub` strings. Supabase-native user IDs and RLS policies must not orphan, merge, or expose records. Account linking and rollback mappings require an explicit strategy.
2. **Sensitive personal data:** Mood notes and weekly reflections may contain health, relationship, or other intimate information. Classification, region, retention, access, logging, support access, backup, and deletion requirements are not documented.
3. **Unknown production data shape:** MongoDB is schema-flexible and current server validation is weak. Historical types, missing fields, invalid statuses/dates, duplicate weekly trackers, and caller-created identities could break a strict Postgres migration or silently change results.
4. **Sparse regression protection:** Most observable API and UI behaviour lacks automated coverage, making accidental contract drift likely.
5. **Machine-auth trust model:** Chat and agent routes use broad static secrets and caller-selected user IDs. Direct client database access or overly broad service-role use would increase exposure.
6. **Hard-coded Heroku/Auth0 coupling:** The audience appears in both backend validation and frontend token acquisition; hostname/cutover changes require coordinated Auth0 and frontend changes.
7. **Incremental cutover consistency:** Running MongoDB and Postgres in parallel raises dual-write ordering, idempotency, reconciliation, backfill, rollback, and source-of-truth questions.
8. **API compatibility:** Current clients depend on exact paths, headers, mixed response envelopes, camel-case names, same-origin routing, and some unusual error/empty-result behaviour.
9. **Operational unknowns:** Actual Heroku add-ons, traffic, logs, domains, dynos, scheduler, deploy pipeline, and MongoDB backup/network posture are outside the repository.
10. **No stable record ID in API:** Feeling `_id` is hidden. Backfill reconciliation and future idempotency need a durable mapping without changing current public responses accidentally.

### Important unknowns to resolve

- Who is the accountable product owner and who approves security/privacy, data migration, infrastructure, and release decisions?
- How many users and records exist, and are all current `userid` values valid Auth0 subjects?
- What indexes/validators exist in MongoDB Atlas, especially uniqueness for weekly trackers?
- Does the URI's `prod` database path serve authentication only, or is there another data dependency not visible in handlers?
- Which Auth0 login providers, Actions/rules, claims, callbacks, refresh settings, and signing algorithms are active?
- Must existing Auth0 sessions survive cutover, and is Auth0 retirement actually required or only optional?
- Who calls chat and agent routes, with what SLAs, retry behaviour, token rotation, expected response shapes, and user-access approval?
- Is `AGENT_ALLOWED_USER_IDS` populated in production? Is its current blank/fail-open behaviour intentional?
- Is chat `source` intentionally non-persistent, a defect to correct, or behaviour to preserve during compatibility migration?
- Are there Heroku Scheduler jobs, external cron requests, active worker dynos, add-ons, or one-off operational processes?
- What are production request volume, latency/availability expectations, peak patterns, maximum history size, and acceptable downtime?
- What are the data residency, retention, export, correction, account deletion, backup, recovery, and audit requirements?
- Should unusual behaviours (`null` empty feelings, unsorted results, invalid-limit handling, inconsistent errors, missing `/api/ping`) be preserved during compatibility or explicitly fixed under approved scope?
- Are any third parties consuming the browser endpoints, or is the React SPA the only caller?
- Is object/file upload planned? There is no current Storage responsibility in repository behaviour.

## Candidate responsibility placement for Design

These are candidates to evaluate, not architecture decisions.

| Current responsibility | Supabase Postgres | Supabase Auth | Supabase RLS | Supabase Storage | Supabase Edge Functions | Standalone TypeScript API |
|---|---|---|---|---|---|---|
| Persist feelings and weekly trackers | Strong candidate: relational tables, constraints, indexes, timestamps, and explicit migration history | — | Owner policies can protect rows | — | Could access via Supabase APIs/DB when compute is needed | Could own SQL access and preserve the current HTTP contract |
| Enforce one tracker per user/week | Strong candidate: unique constraint after data cleanup | — | Ensures ownership, not uniqueness | — | — | May validate/upsert but should rely on DB constraint |
| Browser identity issuance/login/session | Stores only identity references as needed | Candidate to replace Auth0, but not required for initial data migration | Consumes verified identity claims | — | Can validate/forward identity | Can continue validating Auth0 or later Supabase JWTs |
| Incremental Auth0 coexistence | User ID column can retain Auth0 subject during transition | Supabase docs support Auth0 as third-party auth; actual tenant compatibility must be checked | Candidate policy can use trusted JWT subject, with exact expression/type decided in Design | Can use the same trusted identity | Can receive trusted auth context | Can preserve current Auth0 middleware semantics |
| Browser row ownership | Query/index support | Supplies identity if adopted | Strong candidate for select/insert/update owner isolation | — | Should avoid bypassing RLS unnecessarily | Could additionally enforce ownership; must not weaken RLS |
| Current browser REST paths and response shapes | Data source only | Token source only | Authorization only | — | Candidate compatibility façade for small HTTP handlers | Strong candidate compatibility façade, especially for exact routing/error semantics |
| Chat ingest | Inserts into Postgres | Not a natural fit for current static machine token without redesign | Service/machine path needs policies distinct from end users | — | Candidate for a short authenticated ingest endpoint/webhook-style handler | Candidate when richer machine auth, rate limiting, observability, or runtime control is required |
| Agent read API | Queries/indexes/pagination | Not a natural fit for current static machine token without redesign | Must prevent arbitrary cross-user access; service-role bypass needs strict containment | — | Candidate for bounded machine-to-machine reads | Candidate for stronger machine authorization, audit, pagination, and compatibility |
| Chat capability document | Could be static/configured data if needed | — | — | — | Candidate simple response | Candidate simple response |
| Mood/history aggregation | SQL views/functions are possible, but current behaviour is client-side | — | Policies must apply to any query/view | — | Candidate only if aggregation moves server-side | Candidate only if aggregation moves server-side |
| Static SPA hosting | — | — | — | Technically possible for files, but no current user-file requirement and hosting suitability needs separate evaluation | Not the natural primary static-site responsibility | A standalone service could serve it, but frontend hosting can also be separated |
| User-uploaded files | — | Identity source | Object policies | No current responsibility; candidate only if future approved scope introduces files | Candidate for transformations/webhooks | Candidate for orchestration |
| Long-running/scheduled work | Postgres scheduling/queues could be evaluated if a real need is discovered | — | — | — | Current docs advise short-lived functions; no repository job exists | Candidate worker only if operational discovery identifies a real job |

Supabase RLS can enforce per-row ownership using trusted JWT identity helpers, and Storage access also uses RLS policies. Official references: <https://supabase.com/docs/guides/database/postgres/row-level-security> and <https://supabase.com/docs/guides/storage/security/access-control>.

Supabase Edge Functions are TypeScript on a Deno-compatible runtime and are positioned for short-lived HTTP endpoints and third-party integrations; this is one compute option to compare in Design, not a selection made here: <https://supabase.com/docs/guides/functions>.

### Boundary observations

- **Supabase Postgres** can absorb all current durable application data, but only after data profiling and an approved identity/data mapping.
- **Supabase Auth** could eventually replace Auth0, but current Supabase third-party Auth0 support makes coexistence a viable Design option and may reduce cutover risk.
- **Supabase RLS** is a strong fit for browser user ownership. It does not by itself solve the machine-auth design for chat/agent routes.
- **Supabase Storage** has no current application responsibility. Do not introduce it merely because it is available.
- **Supabase Edge Functions** and a **standalone TypeScript API** are competing or complementary compatibility/compute boundaries. Design must compare runtime constraints, routing, observability, machine auth, deployment/rollback, testability, and exact API preservation before choosing.
- Direct browser access to Supabase Data APIs could remove some API code, but it would change the current HTTP contract and trust boundary. That is a product/design decision, not an automatic migration step.

## Major architectural findings

1. The backend is a small Go/Gin monolith with only two source files and direct MongoDB access from handlers; migration complexity lies more in identity, data quality, compatibility, and operations than in code volume.
2. There are three auth models: Auth0 user JWTs, a chat shared secret, and an agent shared secret. Only the Auth0 path derives user ownership from a verified identity.
3. The current data model is two MongoDB collections with no repository-managed schema, constraints, indexes, or migration history.
4. The React SPA and API are operationally one deployment and one production origin, while Auth0 audience configuration remains coupled to the Heroku hostname.
5. Important business behaviour lives in the frontend, including sorting, trend calculations, mood labels, weekly defaults, and 15-second polling.
6. No server-side job implementation is present. The Heroku worker image declaration is not backed by distinct worker code.
7. Supabase Storage has no current use case. Postgres and RLS are clear candidates; Auth and compute placement require Design-stage trade-off analysis.
8. Automated coverage is insufficient to prove behavioural equivalence. The only meaningful server tests preserve CORS-library behaviour.

## Decisions the accountable humans need to make

These decisions should be captured as blocking or non-blocking questions in the Define brief rather than guessed:

1. **Compatibility policy:** Which quirks must be preserved for incremental cutover, and which are approved defects to change?
2. **Authentication direction:** Retain Auth0 initially, run Auth0 with Supabase third-party auth, or migrate identities/sessions to Supabase Auth—and on what timeline?
3. **Identity mapping:** What immutable key links existing Auth0 subjects, Mongo documents, future Postgres rows, and any future Supabase users?
4. **API boundary:** Must all existing `/api/*` routes, headers, response bodies, and same-origin URLs remain stable, or may the React client move to direct Supabase access?
5. **Machine access:** Who may use chat and agent capabilities, for which users/actions, and what stronger authentication, authorization, rotation, audit, rate-limit, and retention rules are required?
6. **Data policy:** Classification, residency, retention, deletion, export, backup, restore, and support-access requirements for mood/reflection data.
7. **Data-cleanup policy:** How invalid/legacy/duplicate records will be handled and who approves transformations or exclusions.
8. **Cutover and rollback tolerance:** Allowed downtime, dual-write/backfill strategy constraints, reconciliation standard, rollback window, and authoritative data source at each phase.
9. **Hosting boundary:** Whether frontend hosting moves with the API or is separated, while preserving the production domain and rollback path.
10. **Storage scope:** Confirm that file/object storage is out of scope unless a concrete product requirement is introduced.

## Recommended next AI-OS lifecycle step

Proceed with **Define**, not Design or implementation. Create `specs/backend-migration/brief.json` from this assessment, with a bounded incremental-migration outcome, explicit externally observable compatibility criteria, non-goals, dependencies, risks, and unresolved questions. Before the brief can be approved, perform read-only operational discovery with the accountable owners for MongoDB Atlas, Auth0, Heroku, chat, and agent integrations, and obtain production data-profile results that contain counts/types only—not secret values or private note content.

The Define artefact must remain `pending` until a named accountable human resolves the blocking identity, compatibility, data-policy, and machine-access questions and explicitly approves it. Do not advance automatically to Design after drafting the brief.
