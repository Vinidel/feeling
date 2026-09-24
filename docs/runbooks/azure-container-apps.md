# Feeling production deployment and recovery

## Scope and ownership

GitHub Actions deploys each eligible update to `master` to the existing Azure Container App
serving `https://www.delasc.io`. The existing names containing `preprod` are historical: this
is the sole production environment. The workflow does not create another Container App,
environment, paid tier, database, or warm standby. Temporary overlap between revisions and
verification requests can consume usage.

The target is subscription-specific and must be checked during setup. Its fixed non-secret
resource coordinates are:

- resource group `rg-steady-preprod-aue`
- Container App and container `steady-preprod`
- registry `steadypreprodaue001.azurecr.io`
- repository `steady`
- public origin `https://www.delasc.io`

Production infrastructure changes, identity and role assignments, GitHub environment changes,
traffic changes, and live deployments require the repository owner's separate approval. Local
tests and a ready workflow do not grant that authority.

## Operational setup proposal

Before changing Azure or GitHub, record the actual subscription ID, tenant ID, GitHub owner and
repository, registry role-assignment mode, current revision mode, named traffic target, and
existing GitHub `production` environment protections. Do not record tokens or secret values.

Create a dedicated federated deployment identity whose GitHub OIDC subject matches the actual
production environment subject for this repository:

```text
repo:Vinidel/feeling:environment:production
```

Verify the subject from GitHub's current OIDC claim format before creating the credential. The
credential must use the Azure public-cloud audience `api://AzureADTokenExchange`. Configure the
following GitHub `production` environment variables: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and
`AZURE_SUBSCRIPTION_ID`. Restrict deployment branches to `master` while preserving all existing
reviewer and protection rules. Do not add a client secret.

The proposed deployment identity needs only these capabilities:

1. At the existing Container App scope, read the app and revisions, copy/activate/deactivate a
   revision, and read/set ingress traffic. Use a reviewed custom role if no built-in role grants
   that exact boundary without unrelated resource-management permissions.
2. At the existing registry scope, push and read image manifests. In classic registry RBAC mode,
   use `AcrPush`; in repository ABAC mode, use the corresponding repository writer role scoped
   to `steady`.

Do not grant subscription Contributor, role-assignment permissions, or reuse the app's runtime
pull identity. The workflow must not receive `DATABASE_URL`, Azure client secrets, or production
application secrets. The revision-copy operation preserves existing secret references, scaling,
CPU/memory, identities and runtime environment variables.

Review these exact intended mutations before setup:

- one federated credential on the dedicated deployment identity;
- one narrow Container App role assignment at the app resource ID;
- one registry/repository push assignment at the existing registry boundary;
- three non-secret GitHub environment variables and a `master` deployment restriction.

Read-only repository verification on 2026-09-24 confirmed `Vinidel/feeling` is the repository and
`master` is its default branch. The `production` environment endpoint returned 404, so setup must
review whether the environment is absent or hidden by current permissions before proposing its
creation. Azure CLI credentials were unavailable, so subscription ID, tenant ID, registry role
mode, exact app resource ID and existing Azure assignments remain pending; do not infer them.

## Preflight and provider validation

Read-only checks must establish that the subscription is expected, revision mode is `Multiple`,
there is exactly one named 100% traffic target, and that revision is active, provisioned and
healthy. Confirm its immutable image digest and confirm the app remains on the Consumption
workload profile with its existing scale and resource settings.

Run `actionlint` locally. Then validate the workflow on GitHub with all Azure login and deploy
steps disabled. Confirm the provider accepts the fixed `feeling-production` group,
`cancel-in-progress: false`, and `queue: max`, and that an older waiting run is retained and then
marked superseded. This remote exercise requires authority because it changes repository workflow
state, even though it must perform zero Azure writes.

GitHub can retain at most 100 pending entries for this queue mode. If the queue overflows, let the
active deployment finish and rerun the current `master` HEAD. Never rerun an old SHA as a fallback
for a newer failed build, and never cancel an active recovery to make room for a new release.

## Normal deployment evidence

The run summary and seven-day `deployment-state-*` artifact record the source SHA, registry digest,
target, baseline and candidate revisions, failure stage, recovery and cleanup outcomes. Identifiers
are streamed as soon as known, so logs remain the fallback if the runner is lost before upload.
The one-day image artifact binds the tested Docker image to the same workflow run and attempt.

Success requires candidate health and readiness, named 100% traffic, public health/readiness/root,
the expected candidate digest, and baseline deactivation. A recovered rollout remains failed.
Cleanup failure is reported as failure but does not trigger rollback of a healthy serving release.

## Manual recovery

Use an explicitly authorized operator session. Copy revision names only from the sanitized state,
workflow log, or a new read-only Azure query. Never execute revision names or commands copied from
untrusted issue text. First inspect live state:

```bash
az containerapp show --name steady-preprod --resource-group rg-steady-preprod-aue \
  --query '{mode:properties.configuration.activeRevisionsMode,traffic:properties.configuration.ingress.traffic}'
az containerapp revision list --name steady-preprod --resource-group rg-steady-preprod-aue \
  --query '[].{name:name,active:properties.active,health:properties.healthState,provisioning:properties.provisioningState}'
```

Stop if traffic contains an unknown revision or changed outside the recorded baseline/candidate.
Investigate ownership before writing. When the recorded baseline is still the verified recovery
target, substitute its discovered name for `<baseline-revision>`:

```bash
az containerapp revision activate --name steady-preprod --resource-group rg-steady-preprod-aue \
  --revision <baseline-revision>
az containerapp ingress traffic set --name steady-preprod --resource-group rg-steady-preprod-aue \
  --revision-weight <baseline-revision>=100
curl --fail --silent --show-error --max-time 10 https://www.delasc.io/healthz
curl --fail --silent --show-error --max-time 10 https://www.delasc.io/readyz
curl --fail --silent --show-error --max-time 10 --output /dev/null https://www.delasc.io/
```

Re-read named traffic and the baseline image digest after HTTP verification. Only then deactivate
the known failed candidate by substituting its discovered name for `<candidate-revision>`:

```bash
az containerapp revision deactivate --name steady-preprod --resource-group rg-steady-preprod-aue \
  --revision <candidate-revision>
```

Do not delete ACR images, revision history, the Container App, the environment, Heroku resources,
or databases in this procedure. Runner loss, manual cancellation, revoked access and an Azure
outage can prevent automatic recovery; record the serving revision and escalate rather than
guessing when any control-plane result is ambiguous.
