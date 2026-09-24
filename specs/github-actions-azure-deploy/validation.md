# Implementation Validation Evidence

Status: implementation in progress. Unexecuted and authority-gated checks remain pending.

## Workflow-linter compatibility finding

Status: **known false positive isolated; provider behavior verified**.

On 2026-09-24, pinned actionlint 1.7.9 rejected the required `queue: max` concurrency key:

```text
.github/workflows/deploy-production.yml:107:7: unexpected key "queue" for "concurrency" section
```

GitHub's official 2026 documentation and changelog support this syntax and its 100-pending
semantics. actionlint 1.7.9 predates the feature. The validation command suppresses this exact
message only; no workflow key or other diagnostic is ignored. The controlled provider exercise
below confirms acceptance. Authority-gated T037/T038 remain pending.

## Toolchain

| Tool | Selected version | Evidence |
|---|---|---|
| Python | 3.12.14 | Local bundled runtime verified |
| Node | 20 workflow target; 26.7.0 local | Local frontend suite verified; hosted Node 20 pending |
| Deno | 2.9.4 | Pinned container suite verified |
| Docker | 28.0.0 client / 27.4.0 server | Linux/AMD64 build passed |
| Azure CLI / Container Apps extension | 2.78.0 / 1.2.0b4 | Version selection recorded; production use pending |
| actionlint | 1.7.9 | Installed from pinned release; required queue syntax rejected as recorded above |

Full Action commit pins and source evidence are in `research.md`.

## Local checks

| Check | Result | Evidence |
|---|---|---|
| Deployment unit tests | Pass | 42 tests passed with Python 3.12.14; zero real Azure/HTTP calls |
| actionlint | Pass with one exact compatibility suppression | 1.7.9 reports only its pre-feature `queue` schema error; all other diagnostics pass |
| API checks | Pass | Deno 2.9.4 `ci`, fmt, lint, check and 30 tests passed in pinned container |
| Frontend tests/build | Pass | 5 suites / 9 tests passed; optimized build compiled |
| Combined Linux/AMD64 image | Pass | `api/Dockerfile` built as `steady-deploy-validation` |
| `git diff --check` | Pass | No whitespace errors |

## Failure simulations

The fake suite passes candidate failure, post-promotion recovery outcome, stale checks before
publication and mutation, bounded deadlines, cleanup failure without rollback, atomic-write
interruption, HTTP/TLS/schema failures and secret redaction. Broader ambiguous-mutation,
failed-recovery, external-traffic and multi-run provider scenarios remain pending. The suite
made zero production calls; intentional live failure injection remains prohibited.

## Requirements coverage

| Requirement | Current evidence |
|---|---|
| FR-001–FR-004 | Static workflow tests cover master-only push, exact SHA, required validation dependency and no PR trigger; provider run pending |
| FR-005 | Manifest checksum, image ID/source label, unique run artifact and registry digest validation implemented and locally tested |
| FR-006 | TLS health/readiness/root verifier and failed rollout state implemented; live evidence pending |
| FR-007 | Atomic allowlisted state, streamed identifiers, summary and secret-redaction tests pass |
| FR-008 | `queue: max`, two freshness gates and stale skip implemented; controlled provider behavior exercise pending |
| FR-009 | Setup and manual recovery runbook added; exact Azure IDs/roles pending authenticated read-only inspection |
| FR-010 | Candidate copies baseline changing image/suffix only; workflow performs no migration or app configuration write |
| FR-011 | Pre-promotion containment and post-promotion baseline recovery paths implemented; broader failure matrix pending |
| FR-012 | Existing app/revisions only; no environment, service, tier or permanent standby added |
| SC-001–SC-005, SC-007 | Local workflow/controller simulations provide partial evidence; provider and authorized normal live run pending |
| SC-006, SC-008 | Diff and design audit show no database migration or standing Azure resource |

The requirements checklist remains fully checked as a specification-quality gate. It does not
claim implementation or production activation. Quickstart commands now match the implemented
workflow/controller paths; its provider and operational sections remain explicitly pending.

## Security and configuration audit

- OIDC permission appears only on the deploy job; the build job has `contents: read` only.
- Every third-party Action uses the reviewed full commit recorded in `research.md`.
- No database URL, client secret or production application secret is present in the workflow.
- Controller subprocesses use argument arrays and projected Azure queries; failed commands do
  not echo captured stdout/stderr. Persisted and summarized fields are allowlisted.
- Revision copy changes only image and suffix, retaining the baseline runtime configuration.
- No provisioning, database migration, resource deletion, image deletion or new standing
  resource command exists in the workflow/controller.
- Cleanup failure leaves the healthy candidate serving and reports failure without rollback.

## Provider and operational evidence

- GitHub concurrency syntax/behavior exercise with Azure disabled: passed 2026-09-24. Three
  feature-branch runs used a temporary probe with `queue: max` and `cancel-in-progress: false`.
  Run 36008944059 executed first while runs 36008986212 and 36009013640 were simultaneously
  retained as pending; all completed successfully in FIFO order. Their probe jobs began at
  13:54:38Z, 13:55:27Z and 13:56:03Z. In every run, `validate-and-build` and `deploy` were
  skipped with zero steps, proving no checkout, artifact, OIDC, Azure or deployment action ran.
  Evidence: https://github.com/Vinidel/feeling/actions/runs/36008944059,
  https://github.com/Vinidel/feeling/actions/runs/36008986212, and
  https://github.com/Vinidel/feeling/actions/runs/36009013640. The temporary probe was removed
  immediately after evidence capture.
- Repository identity/default branch: `Vinidel/feeling`, `master` (read-only verified 2026-09-24).
- GitHub `production` environment: API returned 404; existence/access and setup are pending.
- Azure registry role mode and exact subscription/app scopes: pending because no Azure CLI login
  was available; no login or mutation was attempted.
- OIDC federation, scoped Azure roles, and GitHub production environment setup: pending exact
  mutation review and explicit production-infrastructure authority.
- First normal production deployment: pending completed local/provider checks and explicit
  production activation authority.

No production configuration, Azure role assignment, GitHub environment, traffic, image, or
data was changed while preparing this evidence file.
