# Existing Go API contract runner

`run.mjs` is a base-URL-driven smoke layer for comparing the existing Go service with later replacement slices. It never contains credentials or private fixtures.

`feelings.mjs` is the reusable Stage 7 URL-level contract. It covers missing and
malformed auth, empty and populated reads, one create followed by a visible
read, header identity mismatch, two-subject isolation, and the approved source
versus target status-validation normalization. The Deno suite imports it
directly against an ephemeral target HTTP server. The Go suite exercises the
same shared synthetic fixture and URL cases against an ephemeral source HTTP
server backed by Mongo wire mocks.

`weekly.mjs` is the reusable Stage 9 URL-level contract. It covers missing and
malformed auth, no-record and populated reads, create and edit, database-owned
timestamps, header identity mismatch, two-subject isolation, and the approved
strict-mood normalization. The Deno and Go suites execute equivalent synthetic
URL cases against their real HTTP handlers; the Go test uses Mongo wire mocks
and the Deno test uses an isolated in-memory service boundary. Separate Deno
integration tests exercise the real PostgreSQL mapper, forced RLS, rollback,
unique key, and concurrent `INSERT ... ON CONFLICT` behavior.

Stage 8 captures the same source and target observations from isolated real
transport/persistence combinations: Gin handlers with Mongo wire mocks and the
Deno handler with a disposable least-privilege Postgres database.
`compare-feelings.mjs` rejects every difference except the approved empty-array,
canonical RFC3339 timestamp, and strict status-validation normalizations. The
observation files contain synthetic data only and are temporary test evidence,
not repository artifacts.

Run unauthenticated and route checks against a local or isolated deployment:

```bash
CONTRACT_BASE_URL=http://localhost:8080 node --test tests/contract/run.mjs
```

Authenticated read-shape checks additionally require an isolated test account and non-production data:

```bash
CONTRACT_BASE_URL=http://localhost:8080 \
CONTRACT_ACCESS_TOKEN='<test token>' \
CONTRACT_USER_ID='<synthetic test subject>' \
node --test tests/contract/run.mjs
```

Do not point this runner at production without separate authorization. Do not commit or log the environment values. The deterministic handler-level source characterization lives in `server/api_characterization_test.go` and uses MongoDB wire-protocol mocks plus locally signed test JWTs.
