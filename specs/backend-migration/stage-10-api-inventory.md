# Stage 10 replacement API and configuration inventory

This inventory describes the standalone Deno replacement. It does not alter
the Go/Heroku/MongoDB rollback source, which remains available until the later
Review, Release, cutover, observation, and explicit decommissioning gates.

## Browser API routes

The replacement has exactly four authenticated browser routes:

| Method | Path | Responsibility |
| --- | --- | --- |
| `GET` | `/api/feelings` | Read the verified Auth0 subject's feelings. |
| `POST` | `/api/feelings` | Append one feeling for the verified subject. |
| `GET` | `/api/weekly-tracker` | Read one verified-subject/week tracker. |
| `POST` | `/api/weekly-tracker` | Atomically create or edit one verified-subject/week tracker. |

`GET /healthz` and `GET /readyz` are operational probes, not browser/domain
APIs. No other path or HTTP method is registered. Unknown and retired paths use
the normalized `404` error envelope without invoking authentication or data
services.

## Runtime configuration

| Variable | Purpose |
| --- | --- |
| `AUTH0_AUDIENCE` | Exact retained Auth0 API audience. |
| `AUTH0_ISSUER` | Exact retained Auth0 HTTPS issuer. |
| `CORS_ORIGINS` | Comma-separated exact development origins. |
| `DATABASE_URL` | Server-only least-privilege `steady_runtime` URL. |
| `DEPLOYMENT_VERSION` | Non-secret release identifier. |
| `HOST` | Container listener address. |
| `PORT` | Container listener port. |

The strict configuration parser rejects unknown variables supplied through its
configuration contract. The replacement image grants environment access only
to the seven names above.

## Intentionally absent responsibilities

The replacement contains no:

- `/api/chat/capabilities`, `/api/chat/feeling`, `/api/agent/feelings`, or
  `/api/ping` route;
- `CHAT_INGEST_TOKEN`, `AGENT_API_TOKEN`, or `AGENT_ALLOWED_USER_IDS`
  configuration;
- `x-ingest-token` or `x-agent-token` CORS/header compatibility;
- caller-selected identity, shared-token, allowlist, or application operator
  access path;
- Supabase Data API, Edge Function, Storage, Realtime, queue, cron, scheduler,
  worker, or job runtime dependency;
- Supabase service-role key, migration-owner credential, MongoDB credential, or
  browser-visible database credential.

Supabase Storage remains an operator-controlled encrypted-backup destination,
not an application runtime responsibility. Operator data access remains through
cloud-provider controls rather than an application route.

## Retirement evidence and rollback boundary

Vinicius Delascio confirmed during Define that the former OpenClaw instance no
longer exists and the chat/agent routes have no active caller. Repository search
still finds no frontend, worker, scheduler, or other caller. The dead React
mount-time ping request and unused ping component are removed in Stage 10.

The legacy shared-token handlers, variables, and Heroku worker declaration are
left only in the untouched rollback source. Their presence there is not a
replacement compatibility path. If a caller reappears before release,
retirement stops and the contract returns to Define rather than recreating the
privileged path silently.
