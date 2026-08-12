---
name: release
description: Use when deciding whether reviewed work is operationally ready for production and recording rollout, support and rollback responsibility.
---

# Release

## Purpose

Turn completed review evidence into an explicit production-readiness decision.

## Input

At minimum:

- `specs/<work-id>/review.json`
- `specs/<work-id>/implementation.json`
- release/deployment context for the target system.

## Output

Write `specs/<work-id>/release.json` conforming to `.ai-os/schemas/release.schema.json`.

## Workflow

1. Confirm upstream review is valid and releasable under the configured risk model.
2. Record deployment strategy, rollout scope, monitoring, support ownership and rollback plan.
3. Verify migrations, feature flags, backwards compatibility and customer communication when applicable.
4. Define observable release success/failure signals.
5. Confirm who has authority to deploy and who will respond if the release fails.
6. Do not perform an external deployment merely because the artefact is ready; deployment authority is separate from documentation readiness.
7. Write and validate the artefact:

   `python3 .ai-os/validate.py specs/<work-id>/release.json .ai-os/schemas/release.schema.json`

8. Request explicit release-owner approval.

## Stop conditions

Stop when:

- review contains unresolved blocking findings;
- rollback is required but undefined;
- monitoring/support ownership is missing;
- a migration or irreversible action lacks an accountable decision;
- release approval is not recorded.

## Human gate

A named release owner approves production rollout. AI may prepare the evidence and plan but may not grant production approval to itself.

## Exit contract

Ready to deploy only when validation passes, blocking findings are resolved, operational controls are present and `approval.status == "approved"`.
