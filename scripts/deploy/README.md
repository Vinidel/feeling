# Production deployment controller

The deployment controller is a Python 3.12 standard-library program used by
`.github/workflows/deploy-production.yml`. It deploys the exact Docker archive built and tested
for a push to `master`; it does not rebuild application source in the privileged job.

The runtime toolchain is Docker, Node 20, Deno 2.9.4, Azure CLI 2.78.0 with Container Apps
extension 1.2.0b4, and pinned GitHub Actions listed in the feature research document. No
Python packages, long-lived Azure secrets, production database credentials, or new cloud
services are required.

Run local tests from the repository root:

```bash
python3 -m unittest discover -s scripts/deploy/tests -p 'test_*.py' -v
actionlint -ignore 'unexpected key "queue" for "concurrency" section' \
  .github/workflows/deploy-production.yml
```

Tests inject fake command, HTTP and clock boundaries. Unexpected commands fail immediately;
the test suite never authenticates to Azure or contacts production.

The narrow actionlint suppression covers a known actionlint 1.7.9 schema lag only. GitHub added
the `queue: max` concurrency key after that release; all other workflow diagnostics remain active.

The workflow calls:

```bash
python3 scripts/deploy/deploy.py --manifest PATH --state PATH
```

The manifest contains the source SHA, workflow run and attempt, artifact name, archive
SHA-256, Docker image ID and OCI source label. The state file contains allowlisted deployment
identifiers and outcomes only. The controller validates configuration from the environment,
uses subprocess argument arrays, writes state atomically, and never stores tokens, database
URLs, secret values or full Azure resource responses.

Exit zero means `succeeded`, verified `already_deployed`, or `superseded`; consult the state
and GitHub summary for the exact outcome. Any validation, rollout, recovery or cleanup failure
is nonzero. A recovered failed rollout stays failed.

See `specs/github-actions-azure-deploy/contracts/deployment.md` for the complete input,
permission, deadline, health and recovery contract.
