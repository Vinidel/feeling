# GitHub Actions deployment to Azure

Status: draft; deployment target confirmed; complete brief approval pending.

## User request

Add GitHub Actions so every merge to master deploys the existing Feeling application to Azure.

## Scope

Build the combined React frontend and Deno API using `api/Dockerfile`, run relevant checks, deploy the resulting image directly to the production Azure Container App `steady-preprod` serving `delasc.io`, and verify health and readiness. Record the source commit and deployment outcome in the workflow run. Failed validation or builds must prevent deployment.

## Acceptance scenarios

- **AC-001** Given a change is merged into master, when GitHub receives the resulting master update, then a GitHub Actions run validates and builds the application for Azure deployment.
- **AC-002** Given required validation and the container build succeed, when the deployment job runs, then the combined frontend and API image for that commit is deployed directly to the production Azure Container App `steady-preprod` serving `delasc.io`.
- **AC-003** Given a required validation or build step fails, when the run completes, then the run reports failure and does not deploy that build.
- **AC-004** Given Azure accepts the deployment, when post-deployment verification runs, then the workflow checks application health and readiness and reports failure if either fails.
- **AC-005** Given a maintainer inspects a deployment run, when they review its result, then they can identify the source commit, deployed image, target, and verification outcome without exposed credentials.

## Confirmed deployment decision

On 2026-09-10 the owner confirmed that the former nonproduction Azure environment became production to control costs. There is only one environment. Merges to `master` deploy directly to `delasc.io` using the existing `steady-preprod` Container App; no staging environment is included.

## Boundaries

No application behaviour changes or database migrations are included. Azure and GitHub authentication setup and deployment ordering need design. Secrets must not appear in code or logs.

This is an initial feature draft. Spec Kit 1.0.0 is initialized with repository-local Codex skills. The adjacent brief preserves compatibility with the repository's current stage contract while adopting the requested workflow.
