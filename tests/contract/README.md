# Existing Go API contract runner

`run.mjs` is a base-URL-driven smoke layer for comparing the existing Go service with later replacement slices. It never contains credentials or private fixtures.

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
