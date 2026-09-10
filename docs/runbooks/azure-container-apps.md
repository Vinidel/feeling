# Azure Container Apps target

Status: nonproduction rehearsal environment. It is not a production endpoint.

Release candidate decision: on 2026-08-27 Vinicius Delascio selected this
existing environment for promotion instead of provisioning a duplicate stack.
The selected production URL is
`https://steady-preprod.wittyglacier-50c44c34.australiaeast.azurecontainerapps.io`.
This decision does not make the endpoint production or authorize promotion;
Stage 17 still requires separate deployment, environment, Auth0, and public
traffic authority.

## Selected resources

All resources are in Australia East inside `rg-steady-preprod-aue`:

- Azure Container Registry `steadypreprodaue001` with admin access disabled;
- Container Apps environment `cae-steady-preprod-aue`;
- Container App `steady-preprod`;
- user-assigned identity `id-steady-preprod-aue`, granted only `AcrPull` on the
  registry;
- generated Log Analytics workspace;
- monthly resource-group budget `steady-preprod-monthly` at 5 with an 80
  percent actual-cost owner alert. A budget alerts; it does not cap spend.

The app scales from zero to one replica and uses 0.25 CPU and 0.5 GiB memory.
Its only secret name is `database-url`; the value is supplied from the operator
secret store and is not committed. Auth0 issuer/audience, exact CORS origin,
database SSL mode, deployment version, and static root are non-secret settings.

## ARCH-002 fit

- Australian compute: Australia East.
- Portable OCI deployment: digest-pinned Linux/AMD64 image in ACR.
- Managed TLS and same-origin routing: Container Apps HTTPS ingress serves the
  React build and `/api/*` from one origin.
- Secrets: Container Apps secret references; no secret in image or frontend.
- Health: startup, liveness, and readiness probes use `/healthz` and `/readyz`.
- Logs: structured request events exclude bodies, secrets, and private fields.
- Rollback: multiple-revision mode retains the prior healthy image and supports
  an explicit traffic shift.

## Verified rehearsal state

Revision `r3` is the active dark revision. The hosted target passed TLS, HTTPS
redirect, root, SPA fallback, readiness, unauthenticated API, same-origin, and
sanitized-log checks. Traffic was shifted to retained revision `r2` and back to
`r3`, with readiness passing both times. The active image registry digest is
recorded in Stage 12 implementation evidence; production should always deploy
an approved digest rather than a mutable tag.

The API connects to Sydney Supabase through Supavisor transaction mode. In
plain terms, Supavisor is Supabase's managed PostgreSQL connection pooler: it
lets short API requests share a bounded set of database connections. Transaction
mode fits this API because identity is set transaction-locally and prepared
statements are disabled. Migration and rollback tools use session mode instead,
because their longer operator transactions need a stable session.

Use the isolated Azure CLI profile at `/Users/vinny/.azure-feeling` so the
personal subscription remains separate from unrelated Microsoft accounts. Do
not use any other subscription. Creating production resources, adding a custom
domain, changing production secrets, switching traffic, or deleting this
environment requires separate approval.
