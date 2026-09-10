# Stage 1 — Existing Go API and React contract

This record characterizes the migration source. It does not redefine approved target behavior; where the existing implementation has an approved quirk, the target normalization from `brief.json` and `design.json` wins.

## Supported browser API

| Method and path | Verified identity | Source success shape | Persisted/query behavior | Target treatment |
|---|---|---|---|---|
| `GET /api/feelings` | Auth0 access-token `sub`; optional matching `x-user-id` | Bare JSON array when populated; JSON `null` when empty | Mongo query filters `userid`; no source sort | Preserve route/fields; normalize empty to `[]` and order deterministically |
| `POST /api/feelings` | Auth0 access-token `sub`; body `userID` is overwritten; conflicting header rejected | `200` with the saved feeling object | One Mongo insert using verified `sub` | Preserve supported payload/success; add strict validation and structured failures |
| `GET /api/weekly-tracker?weekOf=YYYY-MM-DD` | Auth0 access-token `sub`; optional matching `x-user-id` | `{ "ok": true, "record": null }` or a tracker | Mongo lookup filters `userid` and `weekof` | Preserve successful no-record and record envelopes |
| `POST /api/weekly-tracker` | Auth0 access-token `sub`; body `userID` is overwritten; conflicting header rejected | `200` with `{ "ok": true, "record": tracker }` | Mongo upsert filters verified user/week; forces version `1` and UTC update time | Preserve supported payload/success; enforce uniqueness and atomic upsert in Postgres |

The source Auth0 middleware requires RS256, issuer `https://dev-vin.au.auth0.com/`, audience `https://stormy-cliffs-52671.herokuapp.com/api`, a valid expiry, and a non-empty `sub`. Missing/malformed/expired credentials return `401`; a conflicting `x-user-id` returns `403`.

## Approved normalization observations

- Empty feeling history currently serializes as `null`; the approved target is `[]`.
- The source feeling query does not request a sort; the approved target order is `createdAt` descending and then target ID descending.
- Source request decoding accepts unknown fields and has inconsistent error bodies; the approved target uses strict schemas and one structured error envelope.
- The legacy CORS middleware stops disallowed requests with an empty `200`; the approved target returns a standards-compliant failure before the handler.
- `/api/ping` has no Go route. `TitleComponent` nevertheless requests it on mount, and the unused `PingComponent` contains the same request. Both calls are approved for removal rather than migration.

## React dependency trace

| Journey | Client source | Request contract |
|---|---|---|
| Auth0 provider/session | `client/src/index.js`, `client/src/config.js` | Existing Auth0 domain, client ID, API audience, local-storage token cache, refresh tokens, redirect to the current origin |
| Save feeling | `client/src/components/FeelingComponent.js` | `POST /api/feelings`; bearer access token; `x-user-id` from `user.sub`; string status; ISO timestamp; comment; five activity booleans |
| Load feeling history/trends | `client/src/components/WithFetch.js`, `FeelingComponent.js` | `GET /api/feelings`; bearer token; `x-user-id`; expects an array and otherwise falls back to `[]`; polls while visible |
| Load weekly tracker | `client/src/components/WeeklyTrackerComponent.js` | `GET /api/weekly-tracker` with `weekOf`; bearer token and `x-user-id`; reads `response.data.record` |
| Save weekly tracker | `client/src/components/WeeklyTrackerComponent.js` | `POST /api/weekly-tracker`; bearer token and `x-user-id`; week, mood, version, six checks, and three notes |
| Local/deployed routing | `client/src/config.js` | Local browser origin uses `http://localhost:8080`; deployed browser requests its own origin |

The checked-in `WithFetch.js` development fallback contains historical-looking mock content. It is not used as a migration fixture and its content must not be copied into specifications, logs, or new tests.

## Retired-route evidence

Repository search finds the legacy integrations only in Go route/handler/configuration code and README documentation:

- `GET /api/chat/capabilities`
- `POST /api/chat/feeling`
- `GET /api/agent/feelings`
- `CHAT_INGEST_TOKEN`
- `AGENT_API_TOKEN`
- `AGENT_ALLOWED_USER_IDS`

No React caller, worker, scheduler, or other repository caller references those integration routes. Vinicius Delascio confirmed during Define that the routes belonged to an OpenClaw instance that no longer exists, that there are no external callers, and that everything still in scope is defined in this repository. This owner confirmation is the available active-caller evidence; no production logs or credentials were accessed during Stage 1. If contrary caller evidence appears before release, AC-6 requires retirement to stop and the contract to return to Define.

## Characterization test boundary

- `server/api_characterization_test.go` runs the real Gin middleware and handlers over HTTP using synthetic identities, locally signed JWTs, a local JWKS transport, and MongoDB driver's mock wire protocol.
- `tests/contract/fixtures.json` provides non-private, runtime-neutral payload fixtures for later Deno comparison.
- `tests/contract/run.mjs` accepts `CONTRACT_BASE_URL` and optional test credential environment variables for source/target smoke comparison without embedding secrets.
- Existing Go CORS tests remain historical source evidence. They do not define the normalized target CORS contract.
