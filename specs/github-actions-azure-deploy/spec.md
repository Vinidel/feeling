# Feature Specification: Automatic Production Deployment

**Feature Branch**: `codex/github-actions-azure-deploy`

**Created**: 2026-09-10

**Status**: Draft — specified; owner approval remains pending

**Input**: Add GitHub Actions so merges to the application's default branch deploy
straight to Azure production at delasc.io. The owner confirmed there is one environment
for cost reasons and authorized starting this feature branch from `master`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publish a Merged Change (Priority: P1)

As the maintainer, I want an accepted change to reach the live application after merging
so that routine releases do not require manual deployment commands.

**Why this priority**: This is the requested automation and removes the manual release step.

**Independent Test**: Exercise a successful default-branch update against a simulated deployment
target and verify the same source revision passes checks, is published, and is verified.
A later authorized live run establishes that the production integration works.

**Acceptance Scenarios**:

1. **Given** a change is merged to `master`, **When** the resulting update is received,
   **Then** the deployment workflow starts validation and builds that source revision.
2. **Given** validation and build succeed, **When** deployment runs, **Then** that release
   is published directly to the existing production application at delasc.io without a
   routine manual deployment step or a staging environment.
3. **Given** a branch other than `master` changes or a pull request remains unmerged,
   **When** that event occurs, **Then** it does not trigger production deployment.

### User Story 2 - Identify and Contain Failed Releases (Priority: P1)

As the maintainer, I want failed checks to prevent deployment and unsuccessful releases
to be visible so I can protect the single live environment and recover when necessary.

**Why this priority**: A failed release can affect live users immediately.

**Independent Test**: Simulate a validation failure, build failure, deployment rejection,
and failed health verification; inspect the result and whether deployment was attempted.

**Acceptance Scenarios**:

1. **Given** a required check or build fails, **When** the run finishes,
   **Then** that build is not deployed and the run reports failure.
2. **Given** deployment is rejected or its verification fails, **When** the run finishes,
   **Then** it reports failure rather than a successful release.
3. **Given** a failed deployment needs investigation, **When** the maintainer reviews the
   result, **Then** the attempted revision, failure stage, and documented recovery procedure
   can be found without exposing credentials.

### User Story 3 - Trace Releases and Preserve Their Order (Priority: P2)

As the maintainer, I want to know which revision is published and ensure overlapping runs
cannot accidentally replace a newer release with an older one.

**Why this priority**: Traceability and ordering make automated releases supportable.

**Independent Test**: Simulate two closely spaced merges with unequal build durations and
inspect the deployment order and recorded outcomes, including a repeated older run.

**Acceptance Scenarios**:

1. **Given** a deployment completes, **When** the maintainer opens its result,
   **Then** the source revision, release identifier, target, and verification outcome are visible.
2. **Given** two merges trigger overlapping runs, **When** both are processed,
   **Then** deployment does not let an older release overwrite a newer published release.
3. **Given** an older run is retried after a newer release is published, **When** it reaches
   deployment, **Then** it cannot silently roll production back to the older revision.

### Edge Cases

- Missing deployment credentials or permissions: fail visibly; never print credential values.
- Hosting service unavailable: report deployment failure; do not claim a successful release.
- Health or readiness never succeeds: end verification within a finite time and report failure;
  the plan must define retry and timeout values.
- Several merges arrive quickly: preserve release ordering; the plan must define scheduling
  without silently dropping the requirement to process each merge.
- A repeated run targets an already published or older revision: avoid an unintended rollback.
- A documentation-only merge still qualifies; no path exclusions are requested.
- Verification failure may occur after production changes; recovery documentation must explain
  how to identify and restore a previously healthy release. Automatic rollback is not assumed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: GitHub Actions MUST process updates resulting from merges to `master`.
- **FR-002**: The workflow MUST deploy the existing application to its sole Azure production
  environment serving delasc.io after required validation and build succeed.
- **FR-003**: Events on other branches and unmerged pull requests MUST NOT deploy production.
- **FR-004**: Failed required validation or builds MUST prevent deployment of that build.
- **FR-005**: Deployment MUST use the release produced from the run's recorded source revision.
- **FR-006**: Successful release reporting MUST require deployed health and readiness verification;
  deployment or verification failures MUST produce a failed result.
- **FR-007**: Every attempted deployment MUST expose its source revision, release identifier,
  destination, and outcome to the maintainer without exposing secrets.
- **FR-008**: Overlapping or retried runs MUST NOT unintentionally replace a newer published
  release with an older one.
- **FR-009**: Setup and recovery documentation MUST explain required configuration and permissions,
  failure investigation, and restoration of a previously healthy release.
- **FR-010**: This feature MUST preserve existing application behaviour and production configuration
  except for the deployment automation expressly in scope; it MUST NOT introduce a second
  environment or execute database migrations.

### Key Entities

- **Release**: A publishable version of the application associated with a source revision and
  immutable release identifier.
- **Deployment run**: An attempt to validate, build, publish, and verify a release, with a recorded
  destination and outcome.
- **Production target**: The existing single live environment serving delasc.io.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A qualifying successful merge-to-release acceptance run requires zero manual
  deployment commands after the merge.
- **SC-002**: All tested validation and build failure cases result in zero deployment attempts.
- **SC-003**: Every tested deployment or verification failure is reported as unsuccessful.
- **SC-004**: Every tested deployment attempt can be traced to one source revision, release,
  destination, and outcome without exposing credentials.
- **SC-005**: Overlap and retry acceptance scenarios produce zero unintended rollbacks.
- **SC-006**: The feature adds zero persistent application environments and performs zero
  database migrations.

## Assumptions

- `master` is the actual application default branch; earlier references to `main` meant that
  branch. No branch rename is included.
- Proposed trigger default: a direct push to `master`, if allowed by repository policy, is
  treated like the update caused by a merge. This feature does not change branch protection.
- The owner confirmed on 2026-09-10 that the former nonproduction environment is production.
  Existing resource names containing `preprod` are historical.
- Initial GitHub and Azure access setup is a dependency. Its exact permissions and mechanism
  belong in planning; no credential values belong in this specification.
- Verification limits and scheduling mechanics belong in planning. No downtime guarantee,
  automatic rollback policy, or new monitoring service is assumed.
- Existing application packaging and configuration are reused. Application changes, database
  changes, additional environments, and unrelated infrastructure changes are outside scope.
- The existing feature directory is retained while converting its draft into the Spec Kit
  template; the adjacent brief records the earlier AI Engineering OS hand-off draft.
