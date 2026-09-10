---
name: plan
description: Use when converting an approved technical design into small, sequenced and independently verifiable implementation stages.
---

# Plan

## Purpose

Turn the approved design into an execution contract that constrains implementation and exposes unnecessary complexity before code is written.

## Input

`specs/<work-id>/design.json`

## Output

Write `specs/<work-id>/plan.json` conforming to `.ai-os/schemas/plan.schema.json`.

## Workflow

1. Verify the design is valid and appropriately approved.
2. Remove speculative work that is not required by the brief or design.
3. Split the work into the smallest useful stages that can be implemented and verified independently.
4. Give each stage explicit dependencies, targets, acceptance criteria, tests and definition of done.
5. Prefer test-first sequencing for business behaviour.
6. Make migrations, rollout, observability and compatibility work explicit rather than hiding them inside coding tasks.
7. Record any accepted complexity with an owner and rationale.
8. Never add scope merely because it might be useful later.
9. Write the JSON artefact and validate it:

   `python3 .ai-os/validate.py specs/<work-id>/plan.json .ai-os/schemas/plan.schema.json`

10. Request approval of the execution plan when required by the configured operating model.

## Stop conditions

Stop when:

- an implementation stage depends on an unresolved design decision;
- acceptance criteria are not covered by stages/tests;
- sequencing is cyclic or ambiguous;
- the plan introduces unapproved scope;
- required approval is missing.

## Human gate

Humans approve material scope changes and explicitly accepted complexity. AI must not hide additional scope inside an implementation plan.

## Exit contract

Ready for Build when validation passes, dependencies are explicit, acceptance-criteria coverage is complete and required approval is recorded.
