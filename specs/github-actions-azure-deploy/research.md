# Deployment Planning Research

Date: 2026-09-10. Status: Phase 0 complete; cost policy resolved by the owner on 2026-09-10.

## R1 — Rollback feasibility and cost gate

**Decision:** Reuse the existing Container App and retained revision for rollback. The owner
accepted possible variable recovery usage charges on 2026-09-10, provided no standing Azure
resources are added. FR-012 and SC-008 now reflect this decision. Strict zero incremental
charges are not promised.

**Rationale:** Inactive revisions incur no revision compute charge. Activation, startup,
brief overlap of running revisions, external verification requests, retained image storage,
and logs may consume billable resources. Free subscription allowances may cover some usage,
but are shared and do not establish a future zero-charge guarantee. No additional app,
environment, paid tier, or permanent warm standby is needed.

**Alternatives considered:** A permanently warm standby increases standing consumption;
a second environment violates scope. Single revision mode does not remove startup or
verification consumption. Manual recovery does not fulfill the accepted automatic rollback
requirement and is not silently substituted.

**Recovery design:** Capture the healthy production revision and digest; hold traffic
on it while testing a new revision. Switch traffic only after candidate verification.
On post-switch failure restore the captured revision and verify recovery. Deactivate failed
or superseded revisions after safe verification. Preserve existing global configuration;
revision rollback cannot undo database writes or changes to shared secrets.

Sources: [Azure billing](https://learn.microsoft.com/en-us/azure/container-apps/billing),
[revisions](https://learn.microsoft.com/en-us/azure/container-apps/revisions),
[revision management](https://learn.microsoft.com/en-us/azure/container-apps/revisions-manage),
[traffic routing](https://learn.microsoft.com/en-us/azure/container-apps/traffic-splitting).

## R2 — Serialization and newest waiting release

**Decision:** The deployment job uses a fixed production concurrency group,
`cancel-in-progress: false`, and `queue: max`. Under the lock, compare its exact source SHA
with the current `master` SHA immediately before mutation. Skip superseded candidates.
Hold the lock through verification, rollback, and rollback verification.

**Rationale:** Queue order reflects arrival at the lock, not commit order. The default
single pending slot can let a late old build or old retry evict the newest waiting build.
Retaining queued jobs and skipping stale ones avoids that loss. This is an engineering
inference from GitHub's documented semantics, not an assertion that GitHub orders commits.

**Alternatives considered:** `cancel-in-progress: true` interrupts recovery. A default single
pending slot with only a SHA check prevents downgrade but can lose the newest waiting run.
A separate always-on queue service adds unnecessary infrastructure.

**Limits:** The documented queue holds at most 100 pending jobs. Overflow must report an
operational failure and document rerunning current HEAD. New HEAD failing checks must not
cause an older waiting release to deploy instead. An active deployment begins after its
final freshness guard; later pushes do not interrupt it. Manual cancellation, runner loss,
or a hard timeout require documented manual recovery, not an impossible automatic guarantee.

Sources: [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency),
[reruns](https://github.com/github/docs/blob/main/content/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs.md).

## R3 — Packaging and validation

**Decision:** Reuse `api/Dockerfile`, building Linux/AMD64 on a GitHub-hosted runner. Deploy
an ACR digest, binding the image to the exact tested event SHA. Use the existing combined
frontend/API image rather than separate deployments. Do not build with ACR Tasks.

**Rationale:** The repository already pins its Node 20 and Deno 2.9.4 base images by digest;
frontend configuration is same-origin. Image tags alone do not guarantee immutability.
Existing checks are API format/lint/typecheck/tests and frontend tests/build.
Production database credentials are not required for those unit checks and must not enter
build jobs. Full integration testing must use disposable local fixtures, not production data.

**Alternatives considered:** Mutable latest tag loses artifact identity; separate frontend
hosting changes architecture; Azure-hosted builds introduce another consumption path.

Source: [ACR image references](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-concepts).
Repository: `api/Dockerfile`, `api/deno.json`, `client/package.json`, `api/src/app.ts`.

## R4 — Authentication and permissions

**Decision:** Use GitHub OIDC and Azure login with scoped identity permissions. Restrict
federation to this repository's production deployment context; leave runtime pull identity
separate. No subscription-wide Contributor or role-assignment permissions for deployment.

**Rationale:** This avoids a long-lived Azure credential in GitHub. Verify actual federated
subject format during setup rather than assuming an older repository-name-only format.
Production environment branch restrictions must allow only `master`; do not introduce a
routine manual reviewer gate contrary to the requested automatic deployment.

**Scope to confirm during setup:** App-scoped deployment/revision/traffic permissions and
registry push permission. Classic registry roles use AcrPush; ABAC-enabled registries need
repository-scoped writer permissions. Do not grant broad privileges to bypass a failed call.
GitHub permissions start with `contents: read` and `id-token: write` only where Azure access
is needed; add other scopes only when a chosen API actually requires them.

**Alternatives considered:** Long-lived service principal secrets require rotation and
increase exposure; reusing the runtime pull identity grants it unrelated deployment powers.
Provisioning identities or changing Azure assignments is not performed by this planning run.

Sources: [Azure OIDC](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-azure),
[OIDC reference](https://docs.github.com/en/actions/reference/security/oidc),
[ACR role modes](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-rbac-abac-repository-permissions).

## Read-only production evidence

On 2026-09-10, queried only non-secret fields using the isolated Feeling Azure CLI profile.
The existing app `steady-preprod` in `rg-steady-preprod-aue` reports Multiple revision mode,
100% traffic pinned to `steady-preprod--qd8vj4s`, minimum 0 and maximum 1 replica per revision,
0.25 CPU and 0.5 GiB memory. Multiple active revisions can each run a replica; maxReplicas=1
is not an app-wide cap across all revisions. No Azure resources or configuration were changed.

## Cost decision resolved

On 2026-09-10 the owner accepted possible rollback usage charges with no extra standing
Azure resources. This resolves the only blocking product clarification. No Azure mutation
or resource provisioning was authorized merely by completing this research.

## R5 — Controller, artifacts and observed identity

**Decision:** Use Python 3.12 standard-library orchestration with subprocess argument arrays
and fake command/HTTP boundaries. Transfer the exact built Docker archive between jobs,
checking SHA-256/image identity before registry publication. Keep deployment traceability in
revision names, OCI labels and summaries rather than changing runtime environment variables.

**Rationale:** Explicit state/deadline handling is easier to exercise for partial failures than
an opaque sequence of shell steps. Existing application code and environment stay unchanged.
A build archive allows the unprivileged build job to produce the exact artifact later deployed.

**Alternatives considered:** Rebuild in deployment can drift from the tested artifact; a giant
inline shell script obscures recovery states; a persistent orchestrator adds infrastructure.

Additional read-only inspection confirmed the workload profile is Consumption, the container
name is steady-preprod, the image repository is steadypreprodaue001.azurecr.io/steady, and the
configured custom domain is www.delasc.io. No production configuration was changed.
