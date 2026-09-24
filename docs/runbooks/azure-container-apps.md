# Feeling production deployment and recovery

## Scope and ownership

GitHub Actions deploys each eligible update to `master` to the existing Azure Container App
serving `https://www.delasc.io`. The existing names containing `preprod` are historical: this
is the sole production environment. The workflow does not create another Container App,
environment, paid tier, database, or warm standby. Temporary overlap between revisions and
verification requests can consume usage.

The target was checked read-only on 2026-09-25. Its fixed non-secret resource coordinates are:

- subscription `d840b6bc-0a68-438f-a400-2589a385114c` (`Azure subscription 1`)
- tenant `8e263016-4fa0-4d3c-a7f2-7cc76d872ccb`
- resource group `rg-steady-preprod-aue`
- Container App and container `steady-preprod`
- registry `steadypreprodaue001.azurecr.io`
- repository `steady`
- public origin `https://www.delasc.io`

Production infrastructure changes, identity and role assignments, GitHub environment changes,
traffic changes, and live deployments require the repository owner's separate approval. Local
tests and a ready workflow do not grant that authority.

## Operational setup proposal

Status: applied and verified on 2026-09-25 under explicit owner approval.

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

1. Create a custom role named `Feeling Production Revision Deployer` with only the following
   control-plane actions. `containerApps/write` is required by Azure's app update surface used for
   revision copy and named traffic; the explicit revision actions support recovery and cleanup.
   Do not include `listSecrets/action`, delete, exec, logstream, role-assignment, environment write,
   or resource-group write permissions.

   ```text
   Microsoft.App/containerApps/read
   Microsoft.App/containerApps/write
   Microsoft.App/containerApps/revisions/read
   Microsoft.App/containerApps/revisions/activate/action
   Microsoft.App/containerApps/revisions/deactivate/action
   ```

   Assign it only at:

   ```text
   /subscriptions/d840b6bc-0a68-438f-a400-2589a385114c/resourceGroups/rg-steady-preprod-aue/providers/Microsoft.App/containerApps/steady-preprod
   ```

2. The registry reports `LegacyRegistryPermissions`, so assign built-in `AcrPush` only at:

   ```text
   /subscriptions/d840b6bc-0a68-438f-a400-2589a385114c/resourceGroups/rg-steady-preprod-aue/providers/Microsoft.ContainerRegistry/registries/steadypreprodaue001
   ```

Do not grant subscription Contributor, role-assignment permissions, or reuse the app's runtime
pull identity. The workflow must not receive `DATABASE_URL`, Azure client secrets, or production
application secrets. The revision-copy operation preserves existing secret references, scaling,
CPU/memory, identities and runtime environment variables.

Review these exact intended mutations before setup:

- one federated credential on the dedicated deployment identity;
- one narrow Container App role assignment at the app resource ID;
- one registry/repository push assignment at the existing registry boundary;
- three non-secret GitHub environment variables and a `master` deployment restriction.

Applied identity details (non-secret): application/client ID
`3906ee09-ad38-4235-94d8-ebfd451bf846`, application object ID
`966f8014-ea80-4bb3-aa72-3a9cf95e6e3d`, and service-principal object ID
`f6df6cac-e147-420f-8256-940b4e54fbf5`. Federation, both role assignments, the GitHub environment,
its exact `master` branch policy and the three environment variables were read back successfully.
No client secret exists. No runtime identity assignment or application configuration was changed.

Read-only repository verification confirmed `Vinidel/feeling` and default branch `master`, making
the exact federated subject `repo:Vinidel/feeling:environment:production`. The GitHub `production`
environment endpoint returned 404 and therefore must be created during authorized setup with a
`master`-only deployment policy; there are no existing environment protections to replace.

Read-only Azure verification on 2026-09-25 confirmed the subscription is enabled, ACR admin is
disabled, and registry authorization mode is `LegacyRegistryPermissions`. The app is in Multiple
revision mode with 100% named traffic on healthy/provisioned `steady-preprod--qd8vj4s`, using
immutable digest `sha256:bffde960b8d9eb263d72a7b02b817039bb75733dad93f533c3c77fc4a4757497`.
The runtime user-assigned identity retains `AcrPull` at registry scope. The dedicated deployment
service principal now has only the documented custom role at app scope and `AcrPush` at registry
scope. The app remains on `Consumption`, scales from zero to one replica, and uses 0.25 CPU / 0.5 GiB.
Its only secret reference name is `database-url`; no secret value was read.

## Preflight and provider validation

Before applying setup, repeat the read-only checks that established the expected enabled
subscription, `Multiple` revision mode, exactly one named 100% traffic target, and an active,
provisioned, healthy baseline with an immutable image digest. Confirm the app remains on its
Consumption workload profile with its existing scale and resource settings.

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
