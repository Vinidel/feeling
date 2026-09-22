# Deployment Validation Guide

This is the Phase 1 validation plan. Existing application commands can run now; deployment
tooling/workflow commands become runnable after implementation. No such tooling has been
implemented or executed by the planning stage.

## Prerequisites

Use the repository root, Node 20 matching the image, npm, Deno 2.9.4, Docker with Linux/AMD64
build support, and Python 3.12. Install a pinned actionlint version during implementation.
Local orchestration tests must use fake GitHub/Azure/HTTP command boundaries; they need no
production credentials or network access. Do not point tests at the hosted database.

## Existing Application Checks

```bash
cd api
deno ci
deno task fmt:check
deno task lint
deno task check
deno task test
```

From repository root:

```bash
cd client
npm ci
CI=true npm test -- --watchAll=false
npm run build
```

From repository root:

```bash
docker build --platform linux/amd64 -f api/Dockerfile -t steady-deploy-validation .
```

Expected: every required check passes and the combined image builds. These checks do not
prove Azure authentication or production readiness. Record versions and command results.

## Deployment Tooling Checks (After Implementation)

From repository root:

```bash
python3 -m unittest discover -s scripts/deploy/tests -p 'test_*.py' -v
actionlint .github/workflows/deploy-production.yml
git diff --check
```

Expected: fake-command tests cover the scenarios below and perform zero real Azure calls.
The runner fixture asserts argv and projected outputs, injects partial/ambiguous mutations,
and records state transitions. Do not merely assert that implementation helper names exist.
Use [the contract](contracts/deployment.md) for inputs, output states and timeouts.

| Scenario | Expected evidence | Requirements |
|---|---|---|
| Merge or direct push to master | Event SHA validated and eligible; branch protection untouched | FR-001, FR-002 |
| Other branch or unmerged PR | No production job | FR-003 |
| Required test/build fails | No publication or app mutation | FR-004 |
| Archive checksum/SHA/image mismatch | Fail before publication/mutation | FR-005 |
| Healthy rollout | Baseline captured; candidate digest verified; prechecks; named traffic switch; public checks; cleanup | FR-002, FR-005, FR-006 |
| Candidate fails pre-promotion checks | Baseline traffic unchanged; failed candidate deactivated; failed outcome | FR-006, FR-011 |
| Public check fails after promotion | Baseline restored and verified; candidate deactivated; original result failed | FR-006, FR-011 |
| Azure mutation times out after applying | State re-read discovers change; recovery follows observed state | FR-006, FR-011 |
| Missing healthy baseline | No app mutation; actionable failed preflight | FR-009, FR-011 |
| Recovery fails | Failed recovery distinct from failed deployment; manual instructions present | FR-009, FR-011 |
| Several queued builds complete out of order | Stale jobs skip under lock; newest survives; active recovery uninterrupted | FR-008 |
| Older run retried after newer publish | Skip without downgrade or evicting newest job | FR-008 |
| Newest build fails | Do not deploy older waiting build as fallback | FR-004, FR-008 |
| Manual/outside traffic change | Unknown state reported; no blind traffic overwrite | FR-009 |
| Cleanup fails after healthy rollout | Report serving revision plus failed cleanup; no unnecessary rollback | FR-007, FR-012 |
| Secret sentinel in fake tool output | Sentinel absent from logs/state/summary | FR-007 |
| Configuration comparison | Env/secrets/scaling/identity unchanged; no migrations or new resources | FR-010, FR-012 |
| Cost structure review | Only temporary revision overlap; no permanent standby or paid tier upgrade | FR-012 |
| Deadline exhaustion | Forward work yields reserved recovery budget; bounded termination | FR-006, FR-011 |

Validate queue behavior with a controlled Actions exercise before first rollout, using no
Azure writes. A 101st pending entry may be canceled by GitHub: document rerunning current
master, and never interpret a queue cancellation as a successful deployment. Do not emulate
provider queue semantics solely by unit tests; verify accepted workflow syntax on GitHub.

## Operational Setup Before Enabling Production Workflow

1. Resolve exact non-secret IDs and role scopes from the existing Feeling subscription.
2. Configure the OIDC identity and narrow Azure assignments described in the contract with
   explicit setup authority. Verify subject matching using the actual repository identity.
3. Configure GitHub production environment values and its master-only deployment restriction.
   Inspect existing environment protection first; do not remove existing protections silently.
4. Verify registry role mode and login/push access. The runtime identity remains pull-only.
5. Verify the current app still has Multiple mode, one named 100% traffic revision, existing
   resource limits and a healthy baseline. A changed baseline fails safely for investigation.
6. Finish setup before merging the workflow to master. The merge will trigger the authorized
   production automation; local validation alone is not permission to perform setup mutations.

No environment IDs, token values, database URLs or client secrets should be pasted into
planning artifacts. Non-secret identifiers are configured through the normal repository UI.

## First Normal Production Run (After Implementation and Setup)

Make a normal approved merge to master. Open the resulting GitHub Actions run. Confirm its
source SHA, image digest, baseline/candidate revisions, final traffic mapping, health results,
and cleanup status. Do not deliberately deploy a broken image to prove rollback in production.

Read-only public verification:

```bash
curl --fail --silent --show-error --max-time 10 https://www.delasc.io/healthz
curl --fail --silent --show-error --max-time 10 https://www.delasc.io/readyz
curl --fail --silent --show-error --max-time 10 --output /dev/null https://www.delasc.io/
```

Expected health JSON: status `ok`; readiness JSON: status `ready`; root returns success.
Combine HTTP results with the workflow's control-plane digest and named traffic checks.
These requests may consume usage; the owner accepted variable recovery usage rather than
an added environment or permanent standby.

## Recovery Evidence and Manual Fallback

For a failed run, inspect the sanitized state artifact, streamed run log and summary to identify captured
baseline, candidate, traffic attempt, recovery result and cleanup result. If the runner was
lost before artifact upload, use the baseline/candidate identifiers streamed to the run log.
An operator must inspect live traffic first, activate the saved healthy baseline if
necessary, explicitly route 100% traffic to it, verify public health, and only then deactivate
the failed candidate. Follow the Azure runbook and operation-specific authority; do not guess
revision names or execute unreviewed commands copied from arbitrary run output.

Retain failure simulation evidence alongside normal live-run evidence. Recovery restores
application revision and routing, not database contents or globally changed secrets.
