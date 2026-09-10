---
name: implement
description: Use when executing an approved implementation plan one stage at a time with test evidence and no invented requirements.
---

# Implement

## Purpose

Execute an approved plan while preserving traceability between requirements, design, code and tests.

## Input

`specs/<work-id>/plan.json`

## Output

Working code plus `specs/<work-id>/implementation.json` conforming to `.ai-os/schemas/implementation.schema.json`.

## Workflow

1. Validate the plan and confirm it is approved when approval is required.
2. Select only the next runnable stage: dependencies complete and status not complete.
3. Before code, identify the tests/evidence required by that stage.
4. Implement the smallest change that satisfies the stage.
5. Run relevant tests and record commands/results as evidence.
6. Refactor only within the approved scope.
7. Update `implementation.json` after every stage so another agent can resume without chat history.
8. Stop rather than guess when the plan omits a required product, security, architecture or migration decision.
9. Validate the implementation artefact:

   `python3 .ai-os/validate.py specs/<work-id>/implementation.json .ai-os/schemas/implementation.schema.json`

## Stop conditions

Stop when:

- a required dependency is incomplete;
- a test expected by the plan fails;
- implementation would require an unapproved design or scope change;
- credentials, data access or external side effects are required but not authorised;
- a blocking clarification is open.

## Human gate

The AI may implement approved work. It may not approve its own scope expansion, accept failing tests, waive security findings, or declare a risky rollout acceptable.

## Exit contract

Ready for Review when all planned stages are complete, required tests pass, implementation evidence is recorded and no blocking question remains.
