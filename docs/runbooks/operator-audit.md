# Operator access and audit

Owner: Vinicius Delascio. Operator access is through cloud-provider controls;
the application deliberately has no operator API.

## Access boundary

- Azure: use the isolated personal subscription profile for Steady. Do not use
  unrelated or corporate subscriptions. The Container App identity has only
  registry pull access; the database URL is a named server-side secret.
- Supabase: use the Dashboard/CLI and a named migration credential only for an
  approved change. Normal requests use `steady_runtime`; migrations use
  `steady_migration_owner`; rollback uses the narrower `steady_rollback`
  membership. Never use an administrative credential in the browser or API.
- Auth0: use the tenant Dashboard for callback/origin settings and logs. Do not
  copy access tokens into tickets or records.
- MongoDB/Heroku: use only to operate the retained rollback source until
  decommissioning receives separate approval.

## Change record

For every operator mutation, record the accountable person, UTC timestamp,
environment, approval, reason, command or Dashboard action, resource name,
before/after state without values, code/image/migration identifier, verification
result, and rollback result. Keep private row content and secret values out of
the record. Production infrastructure, data, environment, traffic, irreversible
migration, deployment, and deletion actions each require explicit authority.

## Provider evidence and limits

- Azure Activity Log records control-plane changes automatically and retains
  them for 90 days by default. Resource/data-plane logs require the configured
  Log Analytics path. See https://learn.microsoft.com/azure/azure-monitor/platform/activity-log.
- Supabase Platform Audit Logs require Team or Enterprise. On the selected Free
  plan, use the single operator's Account Audit Log, project logs, migration
  history, repository evidence, and change record. This is a known reduced-audit
  posture, not equivalent to organization-wide immutable audit logging. See
  https://supabase.com/docs/guides/security/platform-audit-logs.
- Auth0 retention depends on its subscription. Verify the tenant plan and
  retention immediately before Release; the Free plan currently retains one
  day. See https://auth0.com/docs/deploy-monitor/logs/log-data-retention.

Before Release, reauthenticate the isolated Azure CLI profile, verify it names
the personal subscription, and capture the current Container App, revision,
secret-name-only, role assignment, budget, and Log Analytics retention state.
Never print secret values while doing so.
