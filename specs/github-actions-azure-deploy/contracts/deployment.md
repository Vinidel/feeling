# Deployment Interface Contract

## GitHub Workflow

Trigger: `push` to `master`, without path filters. No PR-triggered production writes.
Checkout: exact event SHA. Required validation job completes before deployment is eligible.

Deployment concurrency: fixed `feeling-production` group, `cancel-in-progress: false`,
`queue: max`. Check current master SHA after obtaining the lock and immediately before the
first app mutation. Mark stale jobs superseded; only current HEAD may begin mutation.
All recovery/cleanup steps stay inside this job and lock. Queue overflow is visible and
recovered by rerunning current HEAD, not by deploying a stale entry.

## Inputs

Non-secret GitHub production environment configuration:

| Name | Meaning / expected value |
|---|---|
| AZURE_CLIENT_ID | Federated deployment identity configured during operational setup |
| AZURE_TENANT_ID | Tenant containing that identity |
| AZURE_SUBSCRIPTION_ID | Explicit Feeling subscription; verify Azure account after login |
| AZURE_RESOURCE_GROUP | rg-steady-preprod-aue |
| AZURE_CONTAINER_APP | steady-preprod |
| AZURE_CONTAINER_NAME | steady-preprod |
| AZURE_REGISTRY | steadypreprodaue001 |
| AZURE_IMAGE_REPOSITORY | steady |
| PRODUCTION_URL | https://www.delasc.io |

No DATABASE_URL or client secret is supplied to the workflow. Existing app secret references
are preserved through revision copy. Never use the local operator profile on GitHub runners.
The local Azure profile is only for explicitly authorized operator procedures.

Build manifest fields and state outputs follow [data-model.md](../data-model.md). Upload and
load this run's artifact only; reject checksum, source label, image ID, target or digest mismatch.
Do not interpolate event text into shell code. Controller subprocess arguments are arrays.

## Permission Boundary

Validation/build job: `contents: read`, no Azure identity. Deploy job: `contents: read` and
`id-token: write`; any additional GitHub scope must correspond to a selected API operation.
Download this workflow run's artifacts using its built-in artifact mechanism.

Azure login uses OIDC federation tied to this repository's production context. Verify current
subject format and tenant/subscription IDs during setup. GitHub production environment allows
master only, with no new routine manual approval step. Do not alter repository branch protection.

Grant the deployment identity app-scoped permissions for reading/copying revisions, updating
traffic, activating and deactivating revisions. Verify these through an explicit role definition
or reviewed built-in role at the existing app scope; do not grant subscription Contributor.
Registry publication uses registry-scoped AcrPush in classic role mode, or repository-scoped
writer permissions in ABAC mode. The runtime managed identity keeps its existing pull-only role.
No role-assignment or infrastructure-provisioning permission is needed by the running workflow.
Provisioning federation/roles/environment configuration is a separate setup operation with
reviewable exact scopes; never auto-escalate permissions when a call fails.

## Controller and Tool Boundary

Planned entry point: `python3 scripts/deploy/deploy.py --manifest PATH --state PATH`.
Configuration above is read from environment. Credentials remain in Azure/Docker tooling;
controller state contains no token material. Exit 0 means success, already-deployed verified,
or superseded; nonzero means validation, rollout, recovery or cleanup failure. The state
outcome and GitHub summary distinguish these cases. A skipped release is not called deployed.

Controller operations: read projected target state; check source freshness; create candidate
by copying baseline with new digest; inspect candidate; set named traffic weights; activate
baseline if required; deactivate only known unused revisions. Each mutation is followed by
state verification. Use Azure `--query` projections and suppress unfiltered command output.
Do not dump full resource JSON even on failure.

## Health and Identity Contract

- Candidate URL: FQDN returned for that specific revision, HTTPS, verified TLS.
- `/healthz`: HTTP 200 and JSON status `ok`.
- `/readyz`: HTTP 200 and JSON status `ready`; 503 is not ready.
- Public root `/`: HTTP 200 with HTML after promotion/recovery.
- Require two consecutive successful health/readiness rounds separated by 10 seconds.
- Individual HTTP request timeout: 10 seconds, connection timeout 5 seconds; no insecure TLS.
- Candidate/public response contains no release version; check Azure's named revision digest
  and exact 100% traffic mapping alongside HTTP results. Do not modify public APIs for this.

## Deadlines and Recovery

Deployment job timeout: 60 minutes. Artifact transfer/publication/preflight budget: 10 minutes.
Forward rollout budget: 20 minutes total, including at most 10 minutes for candidate
provisioning, 5 minutes candidate health and 5 minutes public health/promotion. Controller
must track elapsed time across calls rather than restarting a total deadline on every retry.
Reserve 10 minutes for rollback verification and 5 minutes for cleanup; remaining job time
covers initialization/summary. No forward retry may consume the reserved recovery budget.
Each Azure command is bounded at 120 seconds; if its response times out, re-read state before
retrying or recovering because the server may have applied the change.

Failure before promotion: keep baseline traffic, verify it and deactivate the candidate.
Failure after promotion attempt: inspect traffic; for known baseline/candidate state restore
baseline, verify its public health and deactivate the failed candidate. Never deactivate the
only verified serving revision. Report unknown traffic as outside intervention rather than
blindly overwriting it. Do not rollback a healthy successful release merely for cleanup failure.

## Cost and Operational Boundary

Reuse existing Consumption app, registry, configuration and log destination. No second
environment, paid tier upgrade or warm standby. Deactivate superseded/failed revisions after
verification; do not delete retained images or revision history. Variable usage charges are
accepted by the owner, including temporary replica overlap; no zero-cost promise is made.

GitHub runner/artifact usage follows the account's existing billing allowances; setup should
show those limits to the operator. This design does not purchase or upgrade a service.
Before first mutation, stream the sanitized baseline identity to the run log; stream candidate
identity immediately when known. Persist local state atomically after each transition. Upload
sanitized state in an always-run final step when the runner survives. A crash can prevent the
artifact upload, so manual recovery must also support the streamed log and live Azure state.
Runner loss/manual cancellation/Azure outage may require manual recovery. The evidence artifact
and run summary expose baseline/candidate names, digest, outcome and failed phase, not secrets.
