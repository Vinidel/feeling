# Tasks: Automatic Production Deployment

**Input**: Design documents in `specs/github-actions-azure-deploy/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [deployment contract](contracts/deployment.md),
[quickstart.md](quickstart.md), `.specify/memory/constitution.md`.

**Generated**: 2026-09-22 on `codex/github-actions-azure-deploy`.

**Tests**: Included because the specification explicitly calls for independent simulated
success, failure, overlap and retry scenarios. Implement tests before their corresponding
behaviour; observe meaningful failures and then passing results. Production failure injection
is excluded. All checkboxes start unchecked; this file does not claim implementation evidence.

**Organization**: Setup, shared foundation, US1 (P1), US2 (P1), US3 (P2), final verification
and operational activation. Paths are repository-relative. `[P]` means independent files
within the stated phase after its prerequisites; it does not authorize concurrent edits to
shared files. Test-module subdivisions below refine the plan's `scripts/deploy/tests/` layout.

## Phase 1: Setup

**Purpose**: Establish version selections and the local execution environment without Azure writes.

- [X] T001 Record verified full-commit pins for checkout, runtime setup, Azure login and artifact Actions, plus compatible Azure CLI/Container Apps extension and actionlint versions, in specs/github-actions-azure-deploy/research.md; verify support for the planned queue syntax and report any incompatibility instead of changing its semantics.
- [X] T002 [P] Create scripts/deploy/README.md describing Python 3.12 stdlib tooling, Docker, Node 20, Deno 2.9.4, local test commands and the manifest/state CLI contract; do not add an application framework or cloud service.
- [X] T003 [P] Prepare the implementation evidence sections in specs/github-actions-azure-deploy/validation.md for command versions, results, requirement coverage, local failure simulations and separately gated operational evidence; leave unexecuted checks explicitly pending.

**Checkpoint**: Tool choices and evidence locations are concrete. T002 and T003 may run together.

## Phase 2: Foundational Prerequisites

**Purpose**: Shared contracts and fake boundaries needed by every story. Complete before US1.

- [X] T004 Create the fake Azure/GitHub/Docker command runner, injected clock and HTTP responses in scripts/deploy/tests/support.py and scripts/deploy/tests/fixtures/; reject unexpected external calls so tests cannot access production.
- [X] T005 Implement configuration, Release manifest and DeploymentAttempt validation in scripts/deploy/deploy.py using the fields in data-model.md; enforce SHA/digest formats, expected target/repository, positive run/attempt IDs, safe revision suffixes and the --manifest/--state entry point without printing credentials.
- [X] T006 Add subprocess argument-array invocation, allowlisted output projection, atomic sanitized state writes and injected monotonic deadlines to scripts/deploy/deploy.py; expose replaceable command/clock boundaries and suppress raw tool stderr/stdout on failures.
- [X] T007 Validate foundation rejection and state-persistence paths in scripts/deploy/tests/test_foundation.py with invalid manifests, wrong targets, interrupted writes and secret sentinels; demonstrate that no mutation occurs on invalid input.

**Checkpoint**: Fake tests run via `python3 -m unittest discover -s scripts/deploy/tests -p 'test_*.py' -v` without cloud credentials.

## Phase 3: US1 — Publish a Merged Change (Priority: P1)

**Goal**: Test and publish the exact source revision, verify a candidate, and promote it to
production's existing app. This is the first local/demo increment, not an activation milestone.

**Independent Test**: Simulate a healthy baseline and candidate. Assert the tested archive
identity reaches the expected registry digest, candidate checks precede traffic switch, and
public checks confirm the named serving revision. Other-branch and validation-failure inputs
must not reach deployment. No recovery implementation is needed to exercise the success path.

### Tests

- [X] T008 [P] [US1] Add event, permissions, artifact identity and validation-gating checks in scripts/deploy/tests/test_workflow.py for master merge/direct-push events, excluded branches/PRs, failed required checks and foreign-run artifacts; validate observable workflow behaviour rather than matching helper names.
- [X] T009 [P] [US1] Add successful rollout and baseline rejection scenarios in scripts/deploy/tests/test_deploy.py covering missing/unhealthy baseline, multiple traffic targets, latestRevision wildcard and wrong digest; assert exact command order and no app mutation before preflight passes.
- [X] T010 [P] [US1] Add health-verification tests in scripts/deploy/tests/test_verify.py for TLS errors, wrong JSON status, readiness 503, non-HTML root, timeout and two consecutive successful rounds using fake responses/clock.

### Implementation

- [X] T011 [US1] Create the validation/build job in .github/workflows/deploy-production.yml with push/master and no path filters, exact event-SHA checkout, contents:read only, frozen dependency installation, existing API fmt/lint/check/test and frontend test/build commands, and Linux/AMD64 api/Dockerfile build; publish no Azure credentials to this job.
- [X] T012 [US1] Add the OCI source label, Docker archive export and manifest generation to .github/workflows/deploy-production.yml; include SHA, image ID, archive SHA-256, run/attempt and unique artifact name with one-day retention, without changing application source or environment.
- [X] T013 [US1] Add verified artifact loading and registry publication to scripts/deploy/deploy.py; reject checksum/image-ID/source-label mismatches, publish a unique run tag to the existing repository, resolve the pushed image digest and reject any identity/target mismatch before deployment.
- [X] T014 [US1] Implement HTTPS health/readiness/root checks in scripts/deploy/verify.py with the contract's connection/request timeouts, two successful rounds ten seconds apart, phase deadlines and no insecure TLS; use real endpoint response schemas from api/src/app.ts.
- [X] T015 [US1] Implement projected baseline inspection, explicit baseline revision copy with only image/suffix changes, candidate FQDN/digest verification, named 100% traffic promotion and public verification in scripts/deploy/deploy.py; preserve runtime configuration and correlate HTTP success with control-plane identity.
- [X] T016 [US1] Add the deployment job to .github/workflows/deploy-production.yml with successful-build dependency, production environment, scoped OIDC login, same-run artifact retrieval and controller invocation; preserve the plan's lock settings from the start, while keeping activation pending US2/US3 and final checks.

**Checkpoint**: T008–T010 pass against T011–T016. Demonstrate US1 locally only; do not merge a partial production workflow.

## Phase 4: US2 — Identify and Contain Failed Releases (Priority: P1)

**Goal**: Keep failed builds away from production, retain or restore the healthy baseline,
verify recovery, and report failures without hiding partial Azure mutations.

**Independent Test**: Starting from fake baseline/candidate state, inject failures before
and after promotion, ambiguous Azure results and failed recovery. Assert serving revision,
cleanup target, final failed result and bounded execution; no real deployment is needed.

### Tests

- [X] T017 [P] [US2] Add candidate failure, post-promotion failure, missing baseline, rollback failure and external-traffic-change scenarios in scripts/deploy/tests/test_rollback.py; include a mutation that applies server-side then times out and require state inspection before recovery.
- [X] T018 [P] [US2] Add elapsed-time and timeout-budget scenarios in scripts/deploy/tests/test_deadlines.py covering publication/preflight, provisioning, HTTP retries, ambiguous CLI timeout and reserved rollback/cleanup time; use the injected clock rather than sleeping.

### Implementation

- [X] T019 [US2] Implement failure-before-promotion handling in scripts/deploy/deploy.py to keep and verify baseline traffic, discover candidates after ambiguous creation responses and deactivate only the known failed candidate; fail preflight before mutation when no healthy baseline exists.
- [X] T020 [US2] Implement post-promotion recovery in scripts/deploy/deploy.py: inspect observed traffic, activate the captured baseline if needed, restore named 100% routing, verify public health and report recovery separately while retaining the original failed deployment outcome; stop automatic writes for unknown outside traffic changes.
- [X] T021 [US2] Implement cleanup in scripts/deploy/deploy.py to deactivate the unused baseline after success or failed candidate after recovery, preserve retained images/metadata, and report cleanup failure without rolling back a healthy successful release or deactivating the only verified serving revision.
- [X] T022 [US2] Enforce contract budgets in scripts/deploy/deploy.py and .github/workflows/deploy-production.yml: 60-minute job limit, ten-minute publication/preflight, twenty-minute forward work, ten-minute recovery and five-minute cleanup; bound commands at the smaller of 120 seconds and remaining phase time, inspect ambiguous outcomes and prevent retries consuming recovery allowance.
- [X] T023 [US2] Document the existing-resource rollback process, possible temporary usage charges, retained inactive baseline and manual recovery for lost runners/outages in docs/runbooks/azure-container-apps.md; include reviewable command templates with discovered revision inputs and no secret values or standing standby.
- [X] T024 [US2] Run the US2 fake failure suite and record command results and observed serving/recovery/cleanup outcomes in specs/github-actions-azure-deploy/validation.md; explicitly prove no production calls or intentional live failure injection occurred.

**Checkpoint**: A recovered deployment still reports failure, and cleanup cannot remove the verified serving revision. Recovery requires no added standing Azure resource.

## Phase 5: US3 — Trace Releases and Preserve Their Order (Priority: P2)

**Goal**: Preserve active deployment/recovery, deploy only the newest waiting source revision,
prevent old retries from downgrading production and make every outcome traceable.

**Independent Test**: Simulate out-of-order builds, a new push during recovery, stale retries
and a newest build that fails. Confirm stale entries never mutate Azure and cannot evict the
newest waiting job. Independently inspect sanitized success/failure/skipped evidence.

### Tests

- [X] T025 [P] [US3] Add out-of-order build, late stale retry, new push during rollback, newest-build failure and current-HEAD lookup failure tests in scripts/deploy/tests/test_ordering.py; require stale skips before login/publication and a second freshness check before first app mutation.
- [X] T026 [P] [US3] Add summary/state/log tests in scripts/deploy/tests/test_evidence.py for source SHA, digest, target, baseline/candidate, phase and recovery/cleanup outcomes; inject secret sentinels into tool failures and simulate runner loss before artifact upload.

### Implementation

- [X] T027 [US3] Complete the first freshness gate and fixed feeling-production job concurrency in .github/workflows/deploy-production.yml using cancel-in-progress:false and queue:max; stale entries skip before Azure login/publication, while controller/recovery/cleanup share the same job and cannot be canceled by a newer push.
- [X] T028 [US3] Implement final master-SHA verification and superseded/already-deployed outcomes in scripts/deploy/deploy.py; fail closed on lookup errors, skip stale retries, never fall back to an older waiting build and allow later pushes to wait once the final guard starts active deployment.
- [X] T029 [US3] Emit allowlisted structured progress, immediate baseline/candidate identifiers and complete terminal summaries from scripts/deploy/deploy.py; persist atomic state per transition, keep failed recovery distinguishable, and report skips as superseded rather than deployed.
- [X] T030 [US3] Add always-run sanitized state/summary publication with seven-day retention to .github/workflows/deploy-production.yml; preserve failure exit status, support missing artifact/state on early failure, and retain streamed identifiers as the fallback when a runner cannot upload evidence.
- [X] T031 [US3] Add queue overflow and stale-rerun operator guidance plus a no-Azure-write provider validation procedure to docs/runbooks/azure-container-apps.md; explain the 100-pending cap and rerunning current HEAD without interrupting an active deployment or altering branch protection.

**Checkpoint**: US3 simulations pass with US1/US2; old runs cannot downgrade production. GitHub's actual queue acceptance is checked separately before activation.

## Phase 6: Polish, Cross-Cutting Verification and Operational Activation

**Purpose**: Complete traceability, validate the integrated workflow and record explicit
operational setup/activation evidence. Do not mark gated actions complete using local tests.

- [X] T032 Reconcile implemented commands and outcomes with specs/github-actions-azure-deploy/quickstart.md and checklists/requirements.md; remove stale assumptions in checklist notes, preserve approval status, and map all FR-001–FR-012 and SC-001–SC-008 to evidence in specs/github-actions-azure-deploy/validation.md.
- [X] T033 Run all deployment unittests, selected actionlint, git diff --check, existing API/frontend checks and combined Linux/AMD64 build; record exact versions/results in specs/github-actions-azure-deploy/validation.md and investigate failures without weakening application contracts.
- [X] T034 Audit .github/workflows/deploy-production.yml and scripts/deploy/deploy.py for job-scoped OIDC, reviewed Action pins, no production database credentials in build/test jobs, no raw Azure output, preserved app configuration and no new standing resources; record findings and resolutions in specs/github-actions-azure-deploy/validation.md.
- [X] T035 Prepare exact non-secret OIDC subject, required app/registry role actions and scopes, GitHub environment configuration and current-state preflight in docs/runbooks/azure-container-apps.md; verify actual registry role mode and repository subject format read-only, list proposed setup mutations for review and preserve existing protection rules.
- [X] T036 Validate workflow concurrency syntax and behaviour in a controlled GitHub Actions exercise with Azure steps disabled, following specs/github-actions-azure-deploy/quickstart.md; record provider evidence in specs/github-actions-azure-deploy/validation.md, obtaining authority for any required remote workflow dispatch rather than treating simulation as provider proof.
- [X] T037 After exact operational setup changes from T035 have explicit authority, configure federation, scoped roles and production environment values, then record non-secret verification in specs/github-actions-azure-deploy/validation.md; if authority or access is missing leave this task pending and name the missing action, with no fallback client secret or broader role grant.
- [X] T038 After T032–T037 pass and production activation is explicitly authorized, observe the first normal approved master update through .github/workflows/deploy-production.yml and record SHA/digest, named traffic, public health and cleanup in specs/github-actions-azure-deploy/validation.md; do not introduce a broken live release to test recovery or infer merge authority from this checkbox.

**Checkpoint**: Local implementation and operational activation have distinct evidence. No source or production mutations are performed while generating this task list.

## Dependencies & Execution Order

```text
Setup T001–T003
  -> Foundation T004–T007
  -> US1 T008–T016 (P1: local MVP)
  -> US2 T017–T024 (P1: failure/recovery)
  -> US3 T025–T031 (P2: ordering/evidence)
  -> Integrated verification T032–T034
  -> Setup preparation T035
  -> Provider exercise T036
  -> Authorized setup T037
  -> Authorized normal production run T038
```

- Setup's T002/T003 are independent; all setup completes before foundation.
- Foundation is sequential: fake boundaries, validated state, safe execution/persistence, verification.
- US1 tests T008/T009/T010 are independent after foundation. T011 precedes T012; T013 uses its manifest; T014 precedes T015; T016 integrates the controller and workflow.
- US2 builds on US1's rollout states; tests T017/T018 can run together. T019–T022 share controller files and run sequentially. T024 verifies the complete recovery path.
- US3 builds on the complete US2 lifecycle to protect recovery as well as promotion. T025/T026 can run together. T027–T030 are sequential integrations; T031 documents their operation.
- Every story has an isolated acceptance test using fakes; stories are not independent production deployments because they share a controller and one live target.
- T032–T038 are ordered. T037/T038 are operational gates, not implied authorization from task generation or local implementation.
- Only `[P]` groups below are safe parallel edits; do not parallelize tasks modifying `deploy.py`, the workflow or the shared evidence file.

## Parallel Examples by Story

| Group | Tasks | Independent files / condition |
|---|---|---|
| Setup | T002 + T003 | README and evidence skeleton |
| US1 | T008 + T009 + T010 | test_workflow.py, test_deploy.py, test_verify.py; foundation complete |
| US2 | T017 + T018 | test_rollback.py and test_deadlines.py; US1 complete |
| US3 | T025 + T026 | test_ordering.py and test_evidence.py; US2 complete |

These describe scheduling opportunities only; no agents or implementation jobs are launched
by this task-generation stage.

## Requirement Coverage

| Requirement | Principal tasks |
|---|---|
| FR-001 updates to master | T008, T011, T016 |
| FR-002 direct production delivery | T009, T013–T016, T038 |
| FR-003 excluded triggers | T008, T011, T034 |
| FR-004 failed checks prevent deployment | T008, T011, T016, T033 |
| FR-005 exact image identity | T005, T012, T013, T015 |
| FR-006 health and failure outcomes | T010, T014, T017–T022, T024 |
| FR-007 traceability without secrets | T006, T026, T029, T030, T034 |
| FR-008 ordering and retries | T025, T027, T028, T031, T036 |
| FR-009 setup and recovery instructions | T023, T031, T035–T038 |
| FR-010 behaviour/configuration preserved | T015, T021, T034 |
| FR-011 rollback | T017–T024 |
| FR-012 no added standing resources | T021, T023, T034, T035, T037 |

## Implementation Strategy

1. Build the shared contracts and fake test boundaries first.
2. Deliver US1 as the local MVP: a testable complete successful release path. Do not activate it in production without US2 and US3.
3. Add US2 recovery and US3 ordering/evidence incrementally, rerunning relevant earlier scenarios after controller changes.
4. Complete all integrated checks, operational setup review and provider verification before production activation.
5. Keep task completion and evidence synchronized. A task blocked on explicit operational authority stays unchecked; do not manufacture approval.

**Next workflow step**: `$speckit-analyze` can check spec/plan/task consistency before implementation.
Task generation ends here; this document does not execute `$speckit-implement`.
