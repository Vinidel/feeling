# Existing Go API contract runner

`run.mjs` is a base-URL-driven smoke layer for comparing the existing Go service with later replacement slices. It never contains credentials or private fixtures.

`feelings.mjs` is the reusable Stage 7 URL-level contract. It covers missing and
malformed auth, empty and populated reads, one create followed by a visible
read, header identity mismatch, two-subject isolation, and the approved source
versus target status-validation normalization. The Deno suite imports it
directly against an ephemeral target HTTP server. The Go suite exercises the
same shared synthetic fixture and URL cases against an ephemeral source HTTP
server backed by Mongo wire mocks.

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
