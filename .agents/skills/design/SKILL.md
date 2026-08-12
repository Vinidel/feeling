---
name: design
description: Use when converting an approved delivery brief into a grounded technical design with explicit hard-to-reverse decisions.
---

# Design

## Purpose

Create the technical contract for implementation without relying on prior chat context.

## Input

`specs/<work-id>/brief.json`

The brief must validate and be human-approved. If it is not approved, warn and stop unless the human explicitly chooses to proceed for exploration only.

## Output

Write `specs/<work-id>/design.json` conforming to `.ai-os/schemas/design.schema.json`.

## Workflow

1. Read the approved brief and relevant repository architecture/docs.
2. Ground the design in existing patterns before proposing a new one.
3. Define data, interfaces, state/behaviour, security boundaries, observability and rollout implications that matter to this change.
4. Record alternatives for hard-to-reverse decisions and explain the selected trade-off.
5. Map every acceptance criterion to a design element or explicitly mark it as requiring no technical design.
6. Identify risk triggers and required reviews.
7. Ask a human when architecture, security, data classification or product behaviour requires accountable judgement.
8. Never invent access rules, data classifications, credentials, policy exceptions or acceptance of risk.
9. Write the JSON artefact and validate it:

   `python3 .ai-os/validate.py specs/<work-id>/design.json .ai-os/schemas/design.schema.json`

10. Request technical approval when the design contains a hard-to-reverse decision or a triggered review.

## Stop conditions

Stop when:

- the brief is missing or invalid;
- a blocking design decision is unresolved;
- an acceptance criterion has no coverage;
- a required security/architecture decision lacks an accountable owner;
- approval required by the risk profile is missing.

## Human gate

AI proposes designs and trade-offs. Accountable humans approve architecture, security-sensitive decisions and accepted residual risk.

## Exit contract

Ready for Plan when validation passes, coverage is complete, blocking questions are resolved, and required approvals are recorded.
