# Deployment State Model

No application database or user-data schema changes are required. These are ephemeral
orchestration records and sanitized run evidence, not new hosted storage.

## Release

| Field | Rule |
|---|---|
| source_sha | Exact 40-character Git commit SHA from the push event |
| run_id / run_attempt | Positive GitHub identifiers; distinguish retries |
| artifact_name | Unique to source/run/attempt, obtained only from this workflow run |
| archive_sha256 | SHA-256 of exported Docker archive; verify before loading |
| image_id | Built image configuration identity; verify after loading |
| source_label | OCI revision label must equal source_sha |
| registry_digest | Valid sha256 digest resolved after pushing that image |
| image_reference | Expected ACR host and repository plus digest; never mutable latest |

A source commit may have several run attempts. Each deployment uses exactly one verified
release; retry does not permit deployment when the source is no longer master HEAD.

## TargetSnapshot

Fields: expected subscription ID, resource group, app name, container name, revision mode,
public URL, named traffic entries, baseline revision name and digest, baseline healthy flag.
Only these projected fields are serialized. No full Azure response, environment variable
values, connection strings, tokens or secret values are persisted.

Before mutation, traffic must point 100% to one named healthy revision in the expected app.
Current revision name is discovered each run; the planning snapshot is not a deployment input.

## DeploymentAttempt

Fields: Release reference, TargetSnapshot reference, candidate revision name/FQDN, phase,
started_at, phase deadline, traffic_switch_attempted, outcome, failure_stage,
recovery_outcome, cleanup_outcome. Unique revision suffix uses short SHA plus run ID/attempt
and must satisfy Azure naming limits. Resolve its actual name from Azure rather than guessing.

Outcomes: `superseded`, `succeeded`, `failed`, `already_deployed` (only if exact candidate
identity and health are verified). Recovery: `not_needed`, `restored`, `failed`.
Cleanup: `not_needed`, `complete`, `failed`. Recovery never changes failed to succeeded.

## State Transitions

```text
queued -> freshness_check -> superseded
                         -> artifact_verified -> published -> baseline_verified
                         -> final_freshness_check -> superseded
                                                  -> candidate_created
                                                  -> candidate_verified
                                                  -> promotion_attempted
                                                  -> public_verified -> cleanup -> succeeded
```

Any pre-mutation failure terminates failed without traffic changes. Failure after candidate
creation but before promotion retains baseline traffic, verifies it and cleans up the candidate.
After promotion is attempted, failure enters `recovery_started -> baseline_restored ->
recovery_verified -> cleanup -> failed`. Recovery or cleanup failure is reported explicitly.
Unknown mutation results first require state inspection; unknown outside traffic changes
terminate automated writes with manual recovery guidance.

The production job lock spans all transitions after queue admission. A final SHA check is
the start boundary for active deployment: later pushes wait through recovery and cleanup.
A crash may leave nonterminal state; Azure's current traffic and saved baseline are the inputs
to manual recovery. JSON state files are evidence, never trusted commands to execute.

## Retention and Invariants

- Temporary image archive: one day in GitHub; run evidence: seven days, subject to account policy.
- Existing ACR: retain deployed and previous image; no new deletion policy in this feature.
- Retain prior revision inactive; deactivate only revisions belonging to this deployment.
- Baseline must remain recoverable until candidate verification completes.
- At steady state no warm standby is introduced. Temporary overlap may consume billable usage.
- A success requires candidate image identity, correct traffic target, health/readiness/root,
  and cleanup; HTTP 200 from an unknown old revision alone is insufficient.
