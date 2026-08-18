# Stage 6 — Auth0, authorization, and HTTP boundary

Stage 6 is complete. It establishes the shared Deno security and operational
boundary without enabling a feelings, weekly tracker, chat, or agent route and
without deploying or changing production traffic.

## Auth0 boundary

The replacement retains the existing Auth0 access-token contract:

- issuer: `https://dev-vin.au.auth0.com/`;
- audience: `https://stormy-cliffs-52671.herokuapp.com/api`;
- signing algorithm: RS256; and
- ownership key: the unchanged, non-empty `sub` claim.

JOSE `6.2.9` verifies signature, exact issuer, exact audience, expiry, required
`sub`, and the RS256 allowlist through the tenant JWKS endpoint. Remote key
resolution uses a three-second timeout, 30-second cooldown, and one-hour
in-memory cache maximum. The optional `x-user-id` header must match the verified
subject exactly. Leading/trailing whitespace and empty subjects are invalid
rather than normalized into a different ownership key.

The controlled-JWKS tests use generated RSA keys and synthetic subjects. They
cover valid and cached verification; missing/malformed credentials; wrong
signature, issuer, and audience; expired or missing expiry; missing or blank
subject; and matching/mismatching compatibility headers. Invalid credentials
return the shared 401 failure and identity mismatch returns 403. No token or raw
subject enters application logs.

## Input and identity boundary

Strict Zod schemas model the current React feeling and weekly payloads without
enabling their routes. Supported values and neutral defaults are explicit;
calendar dates and RFC3339 timestamps are validated; unknown fields are
rejected. In particular, both request schemas reject `userID`, so a body cannot
override the verified Auth0 subject. The current React contract tests confirm
the browser still sends only supported fields plus the bearer token and optional
matching header.

## Database and RLS boundary

`api/src/database.ts` owns the only request-serving PostgreSQL client. It uses
the `steady_runtime` Supavisor transaction endpoint with TLS, `prepare: false`,
at most four client connections, bounded connect/idle/lifetime settings, and a
five-second transaction-local statement timeout. The application receives no
migration-owner, database-owner, Data API, or service-role capability.

Every user operation opens one short transaction, parameterizes
`set_config('app.auth0_sub', <verified-sub>, true)`, and receives a tagged-query
wrapper that does not expose raw SQL execution. Callers must also use the same
`transaction.userId` in explicit ownership predicates. Forced RLS and the
least-privilege grants remain the independent second layer.

The authorized hosted integration test used two synthetic Auth0 subjects. It
proved transaction-local identity, an explicit `user_id` predicate, same-user
visibility, cross-user insert denial, ownership-reassignment denial, DELETE
denial, rollback of every synthetic write, and identity replacement across
pooled transactions. The complete transaction-wrapped Stage 4 schema/RLS suite
also passed against the hosted project after migration. An owner-only count
probe confirmed the retained target remained unchanged at 114 feelings and two
weekly trackers. Supabase security and performance advisors reported no issue.

## HTTP and operational boundary

- `GET /healthz` is dependency-free liveness.
- `GET /readyz` runs a minimal database probe and returns a sanitized 503 when
  unavailable.
- All responses receive a server-generated request ID and `no-store` caching.
- Errors use the approved structured JSON envelope; dependency and unexpected
  details are not returned.
- Structured logs allow only request ID, route template, method, status,
  duration, deployment version, and coarse failure code.
- CORS accepts only exact configured origins, GET/POST/OPTIONS, and
  Authorization/Content-Type/x-user-id. Disallowed origins and retired headers
  fail before readiness or future route handling. Credentialed CORS is not
  enabled.

The clean Stage 6 image build uses the existing digest-pinned Deno 2.9.4 base,
the unchanged integrity lock, and the non-root `deno` user. Runtime permissions
allow only the seven documented environment variables, block ambient `PG*`
reads, listen on port 8080, and reach only the existing Auth0 JWKS host and
Sydney Supavisor runtime endpoint. A local container smoke test returned 200 for
liveness/readiness, 403 for a disallowed origin, and 404 for the still-disabled
feelings route; its logs contained no secret or private-data pattern.

## Server-only environment contract

The API accepts only:

| Name                 | Classification                    | Purpose                                                                   |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`       | Secret                            | `steady_runtime` TLS transaction-pooler URL                               |
| `AUTH0_ISSUER`       | Integrity-sensitive configuration | Exact retained issuer                                                     |
| `AUTH0_AUDIENCE`     | Integrity-sensitive configuration | Exact retained API identifier                                             |
| `CORS_ORIGINS`       | Non-secret configuration          | Comma-separated exact development origins; production remains same-origin |
| `DEPLOYMENT_VERSION` | Non-secret configuration          | Release correlation                                                       |
| `HOST`               | Non-secret configuration          | Listener host                                                             |
| `PORT`               | Non-secret configuration          | Listener port                                                             |

No value is committed. `MIGRATION_DATABASE_URL`, owner credentials, Supabase API
keys, Auth0 client secrets, MongoDB credentials, and retired integration tokens
are explicitly outside the request-serving environment.

## Stage boundary

Stage 7 may now wire only the feelings vertical slice through this boundary.
Weekly and retired routes remain disabled. Go/Heroku/MongoDB remains the active
rollback implementation, the hosted migrated data is unchanged, and no target
API has been deployed.
