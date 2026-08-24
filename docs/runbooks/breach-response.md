# Security and privacy incident response

Owner and incident commander: Vinicius Delascio. This application contains
private journal content. Treat suspected cross-user disclosure, credential
exposure, unauthorized operator activity, or unexplained data mutation as a
high-severity incident.

## Respond

1. Record the first known time, affected environment, observable symptom, and
   who is responding. Do not paste tokens, credentials, comments, notes, raw
   Auth0 subjects, database URLs, or request bodies into the record.
2. Preserve Azure application/resource logs, Azure Activity Log, Supabase
   project/account logs, Auth0 tenant logs, Heroku logs, deployment identifiers,
   migration history, and backup checksums before their provider retention
   windows expire.
3. If confidentiality or ownership is uncertain, suspend writes and remove
   production traffic from the suspect revision. Use the correct rollback
   runbook; do not delete the target or rollback source.
4. Identify the boundary involved: Auth0 credential/session, Azure operator or
   app secret, Supabase database role, backup Storage operator key, MongoDB
   credential, or Heroku configuration.
5. Revoke or rotate only the affected credential through its provider, update
   the named server-side secret under explicit production authority, restart
   the minimum affected workload, and prove old access fails. Never expose the
   replacement value in a command log or repository artifact.
6. Verify Auth0 identity enforcement, forced RLS with two subjects, aggregate
   record reconciliation, application log redaction, and backup integrity.
7. Restore service only after the owner records containment and verification.
   If data integrity is affected, restore into a new empty target and reconcile;
   never restore blindly over production.
8. Record root cause, affected records/users, provider case references,
   corrective work, and the decision to notify. The current user and owner are
   the same person, but the notification decision must still be explicit.

## Provider paths and known limits

- Azure: Activity Log, Container App revision/logs, Defender/security notices,
  Service Health, and subscription support.
- Supabase: project logs, Account Audit Log, Security Advisor, project pause or
  credential controls, status page, and support. Free projects do not have Team
  or Enterprise Platform Audit Logs or managed daily database backups.
- Auth0: tenant logs, session/client credential controls, status page, and
  support. Short log retention makes prompt preservation important.
- Heroku and MongoDB Atlas: retain logs/configuration and rollback data until
  explicit decommissioning approval.

After containment, return any changed requirement, new access rule, or risk
acceptance to Define. Emergency response authority does not authorize resource
deletion or permanent architecture changes.
