<!--
Sync Impact Report
Version: 0.1.1 -> 1.0.0 (initial owner ratification)
Modified principles: none.
Modified governance: draft and pending ratification -> ratified constitution.
Added sections: none.
Removed sections: none.
Follow-up TODOs: none.
-->
# Feeling Constitution

## Core Principles

### I. Preserve Existing Behaviour

Changes MUST preserve externally observable application behaviour unless the feature
specification explicitly changes it. Deployment automation MUST preserve the existing
frontend and API contract. This is an established application with live users.

### II. Protect Secrets and User Data

Secrets MUST NOT appear in source control, specifications, build output, logs, or responses.
Changes MUST preserve existing authentication and ownership controls unless separately
specified and approved. Credentials MUST stay in the appropriate secret store.

### III. Verify Changes with Evidence

Changes MUST run the repository checks relevant to their scope and record the results.
A successful build or structural validator MUST NOT be represented as proof of production
readiness. Deployment verification MUST assess the deployed application's health.

### IV. Respect Production Authority

The owner's instructions authorize automatic production deployment for updates to the
application's default branch, including merges and direct pushes permitted by repository
policy. Deployment automation MUST NOT change branch protection or make other branches
eligible for production deployment. Unrelated infrastructure changes, production data
migrations, secret changes, destructive operations, and traffic changes outside that
deployment scope MUST have explicit authority. Approval MUST NOT be inferred from successful
tests or invented on the owner's behalf.

### V. Keep Scope Bounded

Work MUST follow the requested feature scope and document unresolved decisions. A technical
automation feature MUST NOT silently change application behaviour or add another environment.
Historical migration artefacts MUST be preserved as evidence of completed work.

## Operational Constraints

Feeling has one Azure production environment for cost reasons. Its historical `preprod`
resource names do not denote staging. The existing Container App serves the frontend and
API for delasc.io. The repository default branch is `master`, confirmed from the remote;
references to the deployment branch in this feature use that name.

No separate staging environment or database migration is part of the deployment feature.
Existing repository documentation and the owner's current instructions provide the baseline;
stale migration-era descriptions MUST NOT be treated as current infrastructure state.

## Development Workflow

The owner selected Spec Kit for the new GitHub Actions deployment feature. Establish project
principles, specify the feature, plan the work, create tasks, and implement the bounded tasks
with verification evidence. Do not automatically advance to implementation after setup.

Existing AI Engineering OS files and migration records remain available. This constitution
records the requested Spec Kit adoption; it does not silently rewrite historical approvals
or claim that old migration constraints describe the current application architecture.

## Governance

This constitution was ratified by the owner on 2026-09-24. Amendments MUST state the changed
principle, rationale, and any required owner decision. Review subsequent work for compliance
with the applicable principles and record exceptions explicitly rather than inventing them.

Use semantic versioning: major for incompatible governance changes, minor for new principles,
and patch for clarifications. Version 1.0.0 is the initial ratified governance baseline.

**Version**: 1.0.0 | **Ratified**: 2026-09-24 | **Last Amended**: 2026-09-24
