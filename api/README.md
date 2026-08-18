# Standalone Deno API

Stage 6 establishes the shared authentication, authorization, database, and HTTP
boundary. It deliberately does not enable feelings, weekly tracker, chat, or
agent routes; those paths still return the normalized `404` envelope.

## Security boundary

- Auth0 access tokens are verified with JOSE `6.2.9` against the tenant's remote
  JWKS. Verification requires RS256, exact issuer, exact API audience, expiry,
  and a non-empty canonical `sub`.
- `user_id` comes only from the verified `sub`. An optional `x-user-id` must
  match exactly. Strict request schemas reject `userID` and every other unknown
  field, so body data cannot select an identity.
- The runtime connects with only the `steady_runtime` PostgreSQL role through
  Supavisor transaction mode. postgres.js uses `prepare: false`, a four-client
  application pool, bounded connection lifetime/timeouts, TLS, and short
  transactions.
- Every user transaction parameterizes
  `set_config('app.auth0_sub', <verified-sub>, true)` before data access. Query
  callers must also bind `transaction.userId` in an explicit `user_id`
  predicate. Forced RLS remains the second authorization layer.
- The runtime contains no migration credential, Supabase service-role key,
  browser database credential, operator API, or impersonation path.

JOSE bounds remote JWKS requests with a three-second timeout, a 30-second
cooldown, and a one-hour in-memory cache maximum. Auth0 documents that custom
API access tokens must be validated by audience and standard JWT checks, and
that the tenant JWKS contains the public keys used for RS256 verification:
<https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens> and
<https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-key-sets>.

## HTTP boundary

- `GET /healthz` is a liveness check and does not contact dependencies.
- `GET /readyz` performs a minimal PostgreSQL readiness query and returns `503`
  with a sanitized error when unavailable.
- Errors use `{ "error": { "code": "...", "message": "..." } }` and
  `cache-control: no-store`.
- Each response receives a server-generated `x-request-id`.
- Logs contain only allowlisted operational fields: request ID, route template,
  method, status, duration, deployment version, and coarse failure code. Tokens,
  raw subjects, URLs, bodies, comments, notes, and credentials are discarded.
- CORS accepts only exact configured origins, `GET`/`POST`/`OPTIONS`, and the
  `Authorization`, `Content-Type`, and `x-user-id` headers. It does not enable
  credentialed CORS or any retired integration header.

## Server-only configuration contract

Populate these variables through the eventual managed container provider. The
example file contains names only and no secret values.

| Variable             | Required | Classification and owner                                                                                                                            |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Yes      | Secret; deployment operator; `steady_runtime` transaction-pooler TLS URL only                                                                       |
| `AUTH0_ISSUER`       | Yes      | Non-secret security configuration; must retain the existing `https://dev-vin.au.auth0.com/` issuer                                                  |
| `AUTH0_AUDIENCE`     | Yes      | Non-secret security configuration; must retain the existing `https://stormy-cliffs-52671.herokuapp.com/api` API identifier until separately changed |
| `CORS_ORIGINS`       | No       | Non-secret deployment configuration; comma-separated exact origins; defaults to `http://localhost:3000`                                             |
| `DEPLOYMENT_VERSION` | No       | Non-secret release identifier; defaults to `development`                                                                                            |
| `HOST`               | No       | Non-secret listener configuration; defaults to `0.0.0.0`                                                                                            |
| `PORT`               | No       | Non-secret listener configuration; defaults to `8080`                                                                                               |

`MIGRATION_DATABASE_URL`, database-owner credentials, Supabase API keys, Auth0
client secrets, MongoDB credentials, and retired chat/agent tokens are not API
runtime variables.

The container's outbound permission list is limited to the existing Auth0 JWKS
host and the Steady Sydney Supavisor transaction endpoint. Changing either host
requires a reviewed image-permission update rather than silently expanding
network access.

## Verification

From `api/`, using pinned Deno `2.9.4`:

```bash
deno task fmt:check
deno task lint
deno task check
deno task test
```

The regular suite uses a controlled loopback JWKS server and synthetic signed
tokens. `tests/database_integration.ts` is a separately authorized hosted test:
provide the runtime-only `DATABASE_URL` through an operator secret mechanism and
grant Deno network access only to that database host. It inserts synthetic rows
inside an intentionally rolled-back transaction, proves two-subject isolation,
ownership-reassignment and DELETE denial, explicit application predicates,
transaction-local identity replacement, and absence of pool identity leakage.

Build the portable OCI image from the repository root:

```bash
docker build -f api/Dockerfile -t feeling-api:stage-6 .
```

The image remains based on the digest-pinned official Deno 2.9.4 image, runs as
the non-root `deno` user, installs only integrity-locked production
dependencies, and starts with frozen cached dependencies and explicit
permissions.
