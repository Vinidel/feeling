# AI Engineering OS

This repository uses the AI Engineering OS executable workflow. Durable JSON artefacts under `specs/<work-id>/` carry context between stages.

## Current Pilot

Work ID:

backend-migration

Objective:

Migrate the existing backend from Go and Heroku toward a TypeScript-based backend and Supabase while preserving externally observable behaviour.

This is an incremental migration, not a greenfield rewrite.

Do not choose Node, Bun, Supabase Edge Functions, or another compute model until the Design stage has evaluated the trade-offs.

Do not remove the existing Go/Heroku implementation until the replacement has passed Review and Release.

## Lifecycle

Use the matching skill for each stage:

1. Define — `.agents/skills/define/SKILL.md` → `brief.json`
2. Design — `.agents/skills/design/SKILL.md` → `design.json`
3. Plan — `.agents/skills/plan/SKILL.md` → `plan.json`
4. Implement — `.agents/skills/implement/SKILL.md` → code + `implementation.json`
5. Review — `.agents/skills/review/SKILL.md` → `review.json`
6. Release — `.agents/skills/release/SKILL.md` → `release.json`

Before performing a stage, read its `SKILL.md` completely and follow its input, output, stop-condition, human-gate, and exit-contract requirements.

## Artefacts

Store work under:

```text
specs/<work-id>/
  brief.json
  design.json
  plan.json
  implementation.json
  review.json
  release.json
```

JSON is the machine hand-off contract. Markdown projections may be added for humans.

## Validation

Validate structure with:

```bash
python3 .ai-os/validate.py specs/<work-id>/<artifact>.json .ai-os/schemas/<artifact>.schema.json
```

Validate stage readiness with:

```bash
python3 .ai-os/validate.py specs/<work-id>/<artifact>.json .ai-os/schemas/<artifact>.schema.json --ready
```

## Stage Progression

A stage may advance only when:

1. its required artefact exists;
2. structural validation passes;
3. readiness validation passes;
4. all required human approvals are recorded.

Passing structural validation alone does not permit progression.

When a stage requires human input, stop and ask one bounded question rather than guessing.

Do not start the next lifecycle stage automatically after completing the current one unless explicitly instructed.

## Shared rules

- Ground decisions in repository context and existing artefacts before asking the user.
- Do not invent product behaviour, access rules, data classifications, policy exceptions, risk acceptance, waivers, or release approval.
- Keep unresolved questions and findings visible in the relevant artefact.
- Treat structural validity and stage readiness as separate checks.
- Set approval status to `pending` unless a named accountable human explicitly approves it.
- Implement only approved scope, one runnable plan stage at a time.
- Record commands and test results as implementation evidence.
- Do not deploy merely because a release artefact is ready; deployment needs separate authority.

## Safety Boundaries

The following always require explicit human approval:

- creating or changing production infrastructure;
- migrating production data;
- changing production environment variables;
- changing frontend production API endpoints;
- switching production traffic;
- applying irreversible database migrations;
- deleting Heroku resources;
- deleting or replacing production databases;
- deploying to production.

Never expose secret values in artefacts, logs, commits, or responses.

Never treat a successful validation result as authority to deploy or destroy infrastructure.
