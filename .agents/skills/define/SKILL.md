---
name: define
description: Use when turning a product opportunity, feature request, issue or problem statement into a bounded and testable delivery brief.
---

# Define

## Purpose

Create a durable requirements contract that a fresh agent can consume without access to the conversation that produced it.

## Input

At least one of:

- a problem statement or feature request;
- an issue/ticket;
- product notes or research;
- existing repository context.

## Output

Write `specs/<work-id>/brief.json` conforming to `.ai-os/schemas/brief.schema.json`.

A Markdown projection may also be written for humans, but `brief.json` is the hand-off contract.

## Workflow

1. Ground in repository and supplied product context before asking a human.
2. State the business outcome, users, scope and non-goals.
3. Turn behaviour into stable acceptance criteria.
4. Identify constraints, dependencies, risks and unresolved questions.
5. Ask a bounded human question only when a missing decision changes scope, behaviour, access, risk or acceptance criteria.
6. Never invent a product decision or silently convert an unknown into an assumption.
7. Write the JSON artefact.
8. Run deterministic validation:

   `python3 .ai-os/validate.py specs/<work-id>/brief.json .ai-os/schemas/brief.schema.json`

9. Request explicit product approval.

## Stop conditions

Stop with the artefact in `pending` approval when:

- a blocking product decision is unresolved;
- acceptance criteria cannot be made testable;
- scope is contradictory;
- the accountable product owner has not approved.

## Human gate

The AI may draft and refine the brief. It must not set `approval.status` to `approved` on behalf of a human.

## Exit contract

This stage is ready for Design only when:

- schema validation passes;
- `unresolved_questions` contains no blocking item;
- `approval.status == "approved"`.
