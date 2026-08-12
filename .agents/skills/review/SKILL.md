---
name: review
description: Use when independently checking implementation evidence against requirements, design, quality, architecture and security expectations.
---

# Review

## Purpose

Produce independent, evidence-based findings before release. Review does not rewrite the requirements or silently waive gaps.

## Input

At minimum:

- `specs/<work-id>/brief.json`
- `specs/<work-id>/design.json`
- `specs/<work-id>/plan.json`
- `specs/<work-id>/implementation.json`

## Output

Write `specs/<work-id>/review.json` conforming to `.ai-os/schemas/review.schema.json`.

## Workflow

1. Validate all upstream artefacts.
2. Verify acceptance criteria against implementation/test evidence.
3. Review material architecture changes against the approved design.
4. Review security/privacy risk triggers and evidence.
5. Check operational concerns: observability, failure behaviour, migration/compatibility and rollback where applicable.
6. Record findings with severity, evidence and owner.
7. Distinguish `pass`, `needs_input`, `needs_changes` and `waived` rather than flattening everything to a single AI opinion.
8. Never author missing requirements as part of review; return the gap to the accountable stage.
9. Write and validate the artefact:

   `python3 .ai-os/validate.py specs/<work-id>/review.json .ai-os/schemas/review.schema.json`

## Stop conditions

Release is blocked when:

- any critical/high finding is unresolved or unwaived;
- required acceptance criteria lack evidence;
- architecture/security review was required but not completed;
- test evidence is missing or failing;
- review itself lacks the required accountable approval.

## Human gate

AI can identify findings and recommend severity. A named human must own waivers and residual-risk acceptance. The reviewer must not approve its own waiver.

## Exit contract

Ready for Release only when the review artefact validates and `verdict` is `pass` or all non-pass findings are explicitly resolved/waived under the configured risk model.
