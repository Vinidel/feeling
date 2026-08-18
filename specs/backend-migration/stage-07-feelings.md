# Stage 7: feelings vertical slice

Stage 7 enables only `GET /api/feelings` and `POST /api/feelings` in the
standalone Deno service. Weekly tracker and retired routes remain disabled. The
React application, Go/Heroku service, MongoDB source, hosted schema, migrated
data, and production traffic are unchanged.

## Request and response contract

- Both routes authenticate through the shared Auth0 boundary. The verified
  token `sub` is the only ownership source; the optional `x-user-id` must match.
- GET executes an explicit `user_id` predicate inside the transaction-local RLS
  identity boundary. It maps private relational columns back to the existing
  nested camel-case response, serializes status as a string, returns `[]` when
  empty, and orders by `created_at desc, id desc`.
- POST authenticates before parsing, strictly accepts the current React shape,
  applies neutral comment/activity defaults, and inserts exactly one append-only
  row using the transaction identity. It returns HTTP 200 with the saved public
  representation and no database ID.
- Malformed JSON, unknown fields, a body `userID`, invalid status, and invalid
  timestamps return the sanitized `400 invalid_request` envelope without a
  persistence call.

## Verification boundary

The regular Deno suite covers every status and each activity, defaults,
malformed/unknown/identity-bearing bodies, two synthetic subjects, header
mismatch, empty/populated histories, and the URL-level reusable feelings
contract. The same shared synthetic fixture and URL cases run against the real
Go handlers through an ephemeral Gin server and Mongo wire mocks. The source's
permissive out-of-range status behavior remains characterized; the target's 400
response is the approved normalization.

The hosted integration uses the Keychain-held least-privilege runtime URL. It
runs actual insert/select mapping and ordering SQL inside one intentionally
rolled-back transaction, verifies a one-row insert delta and subsequent read,
checks the UUID tie breaker, then confirms both synthetic subjects have empty
histories after rollback. No synthetic hosted row remains.

The clean Stage 7 image starts as non-root, reaches hosted readiness, returns
401 for unauthenticated feelings, and continues to return 404 for weekly. Its
captured logs contain only the approved operational fields.

## Safety status

No Deno service has been deployed. No production infrastructure, environment,
endpoint, traffic, Auth0 tenant, source MongoDB data, Heroku resource, or
frontend production configuration was changed. Go/Heroku remains the active
rollback implementation.
