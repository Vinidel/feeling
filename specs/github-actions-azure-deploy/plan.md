# Implementation Plan: Automatic Production Deployment

**Branch**: `codex/github-actions-azure-deploy` | **Date**: 2026-09-10 | **Spec**: [spec.md](spec.md)

**Status**: Phase 0 research and Phase 1 design complete. Ready for task generation.

## Summary

Use a push-to-master GitHub Actions workflow to test and build the existing combined image,
then deploy its digest to the existing Azure Container App. Serialize production work and
skip candidates that no longer match master. Verify the candidate before switching traffic,
verify the public application afterward, and automatically restore the captured healthy
revision on failure. The owner accepts recovery usage charges; no extra environment, paid
tier, or permanent standby is added.

## Technical Context

**Language/Version**: GitHub Actions YAML; Python 3.12 standard library for the deployment
controller and test doubles; existing Deno 2.9.4 API and Node 20 frontend build.

**Primary Dependencies**: GitHub-hosted Ubuntu 24.04 runner, Docker/BuildKit, Azure CLI with
Container Apps extension, Azure OIDC login, existing ACR/Container App. Pin external Actions
to reviewed full commit SHAs during implementation. Verify pinned workflow tooling supports
`queue: max`; do not silently substitute different concurrency semantics.

**Storage**: Existing ACR repository `steady`, revision metadata, temporary GitHub image
artifact with one-day retention, sanitized run summary/state artifact with seven-day retention.
No application schema changes, new Azure storage, or database migrations.

**Testing**: Existing Deno fmt/lint/check/test and frontend tests/build; Python unittest
command-boundary simulations for orchestration; actionlint and shell-free subprocess inputs.
A live normal deployment is validated only after operational setup and explicit activation.
Failure injection runs locally with fakes, never by deliberately breaking production.

**Target Platform**: Linux/AMD64; Azure Consumption in Australia East. Existing registry
`steadypreprodaue001.azurecr.io`, app/container `steady-preprod`, group `rg-steady-preprod-aue`,
public URL `https://www.delasc.io`. Multiple revision mode; 0–1 replica per revision,
0.25 CPU/0.5 GiB. Preserve these settings.

**Performance Goals**: One production mutation job at a time. Bounded checks, with a separate
recovery allowance within the job timeout; see the deployment contract. No downtime SLA added.

**Constraints**: No new standing Azure resources, migrations, application behaviour changes,
secret output, or interruption by newer pushes. Registry storage, startup, temporary overlap,
verification and log usage are not promised to be free. No global app configuration changes.

**Scale/Scope**: One repository/default branch/production app. GitHub supports up to 100
pending jobs in the selected concurrency mode; overflow is a visible failed/cancelled run
requiring a rerun of current master. No external queue service.

## Constitution Check

| Principle | Before research | After design |
|---|---|---|
| Preserve behaviour | Pass | Combined Dockerfile and runtime configuration unchanged |
| Protect secrets/data | Pass | No database credentials in builds; scoped OIDC; sanitized outputs |
| Verify with evidence | Pass | Existing checks, fake failure tests, revision/public health checks |
| Respect authority | Pass for planning | Read-only Azure inspection only; no provisioning/deployment performed |
| Keep scope bounded | Pass for research | Pass: owner resolved variable usage cost boundary; no standby/new environment |

No principle exception is needed. The owner selected Spec Kit and explicitly requested this
planning stage; historical JSON workflow approvals and constitution ratification remain
unchanged. This plan does not claim production activation or retroactive approval of those
records. Initial OIDC/role/environment setup remains an explicit operational action.

## Deployment Design

### 1. Validate and build without Azure credentials

Trigger only `push` on `master`, with no path filters. This includes merges and permitted
direct pushes. Do not alter branch protection or introduce a routine manual reviewer gate.
Check out the event SHA, install frozen dependencies, run existing checks, and build
`api/Dockerfile` for Linux/AMD64. Add an OCI source-revision label without changing application
files or runtime environment. Export the built image as a Docker archive with a manifest
containing source SHA, image ID, archive SHA-256, run ID and attempt. Upload a uniquely named
artifact for this run. Never rebuild a different checkout during deployment.

### 2. Serialize publication and deployment

The deployment job requires successful validation, uses the GitHub `production` environment,
and holds fixed concurrency group `feeling-production` with `cancel-in-progress: false`
and `queue: max`. The lock covers publication through cleanup and rollback. Every waiting
job first compares its source SHA with current `refs/heads/master`; mismatches exit with
`superseded` and do not log in to Azure or publish. Default single-slot concurrency is
rejected because an old late run can evict a newer waiting run.

Load this run's image artifact, verify archive checksum and image identity/source label,
log in through OIDC, and push to the existing ACR under a unique SHA/run/attempt tag. Resolve
and validate the registry digest and deploy only `steady@sha256:...`. Recheck master before
first app mutation. A newer push after this final guard waits; it does not cancel the active
operation. If a stale job was already queued it skips when it obtains the lock. Do not fall
back to an older build when the newest build fails checks.

### 3. Capture and verify the baseline

Project Azure responses to allowlisted non-secret fields. Require the expected subscription,
app, registry and Multiple mode. Require exactly one named revision with 100% traffic, no
latestRevision wildcard, and no unknown concurrent rollout. Check public liveness/readiness
and the baseline revision's health, record its name and image digest. If there is no healthy
baseline, fail before mutation with manual recovery guidance. Do not guess a historical r2/r3
revision or use `latestRevisionName` as the healthy production revision.

### 4. Create and test the candidate

Use `az containerapp revision copy` explicitly from the captured baseline revision, changing
only the container image and unique revision suffix. Copying the baseline avoids inheriting
an earlier failed candidate's configuration. Preserve all environment variables, secret
references, resources, scaling, identity, probes, domains and ingress configuration.
Record the candidate revision and FQDN from Azure; verify its image digest and confirm
production traffic remains pinned to the baseline. The candidate is a temporary revision of
the existing app, not another environment. Poll provisioning and the revision-specific URL
for `/healthz` and `/readyz`. It must pass before any public traffic change.

### 5. Promote, verify, recover and clean up

Set traffic to 100% of the named candidate. Read the traffic configuration back and check
`https://www.delasc.io/healthz`, `/readyz`, and `/`. Health responses alone do not identify a
release: pair them with control-plane revision/digest/traffic assertions. Require two
consecutive passing health rounds. If candidate creation/checks fail, retain baseline traffic
and deactivate any failed candidate that was created. If promotion is attempted and then
fails or public verification fails, restore baseline traffic, activating baseline if necessary,
then verify recovery. A successful recovery still leaves the deployment failed.

Treat a timed-out mutation as ambiguous: inspect current traffic/revision state before
cleanup. Never assume a failed CLI call means no change. If traffic no longer matches either
known revision, stop automated traffic writes and flag possible outside intervention.

After successful verification, deactivate the now-unused baseline; after recovery deactivate
the failed candidate. Preserve the baseline's inactive metadata and referenced image for
future recovery. Do not delete ACR images or historical revisions in this feature. Deactivation
failure is a failed cleanup outcome with the serving revision reported; it must not be hidden
as success or provoke an unnecessary rollback of a healthy release. No revision remains warm
intentionally; any cleanup failure requires owner attention.

### 6. Configuration, authorization and limits

Use the inputs and permissions in [contracts/deployment.md](contracts/deployment.md). Pin
subscription identity and resource names. Verify registry role mode and actual OIDC subject
format during setup. Setup must finish before enabling the workflow on master; no fallback
client secret or blanket Contributor permission is permitted. The existing runtime pull
identity is not the publishing identity.

New pushes cannot interrupt the protected job, but runner loss, manual cancellation, hard
timeout, revoked access, or Azure outage can prevent recovery. Persist sanitized baseline and
candidate identifiers before traffic mutation and include manual recovery instructions.
No workflow can guarantee automatic recovery after its runner is gone.

## Project Structure

### Documentation (this feature)

```text
specs/github-actions-azure-deploy/
├── spec.md
├── brief.json                 # Historical pre-Spec-Kit draft
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/deployment.md
└── checklists/requirements.md
```

### Source Code (planned; not yet created)

```text
.github/workflows/deploy-production.yml
scripts/deploy/deploy.py
scripts/deploy/verify.py
scripts/deploy/tests/test_deploy.py
scripts/deploy/tests/fixtures/
api/Dockerfile                 # Reuse existing combined image
api/deno.json                  # Reuse existing checks
client/package.json           # Reuse existing checks
docs/runbooks/azure-container-apps.md
```

**Structure Decision**: Keep orchestration and its fake-command tests separate from application
code. Use a standard-library controller to model recovery explicitly and invoke tools with
argument arrays. No extra application framework or service is introduced.

## Complexity Tracking

No governance violation or waiver. Image transfer preserves build identity across jobs;
explicit state transitions make partial failures testable. The queue guard avoids committing
to unreliable arrival order without an external scheduler. See [research.md](research.md).

## Verification and Exit

Planning artifacts agree on accepted cost policy, SHA freshness, digest identity, rollback,
and finite deadlines. All FR-001–FR-012 map to scenarios in [quickstart.md](quickstart.md).
No unresolved product question remains. Exact pinned Action commits and verified tool patch
versions are implementation dependency selections, not unresolved architecture decisions.
Phase 1 ends here; `$speckit-tasks` is next. No task execution or production mutation occurred.
