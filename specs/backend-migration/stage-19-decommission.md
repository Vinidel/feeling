# Stage 19 — legacy decommission record

Recorded: 2026-08-28 (Australia/Brisbane)

Status: complete. The exact approved Heroku, Atlas, credential, and repository
targets were retired on 2026-08-28. Retained-state checks and the final
post-deletion authenticated browser reads pass.

Stage 18 is committed at `8ca0b9d`. The Deno/Azure and Supabase replacement is
the production source of truth. The inventory sections below preserve the
pre-deletion discovery evidence. Vinicius Delascio subsequently approved each
exact destructive group, and the completion record near the end of this file
is authoritative for current state.

## Heroku target

The exact app is `stormy-cliffs-52671`, created in the Heroku US region on the
container stack. It is in maintenance mode and has no add-on or pipeline
coupling. It retains two running Basic dynos:

- `web`, command `./main`; and
- `worker`, command `./main`.

Release 65 is the latest of 15 retained releases. The app owns the Heroku Git
endpoint and these two domains:

- `stormy-cliffs-52671.herokuapp.com`; and
- custom domain `www.delasc.io`.

The public Heroku origin remains 503. The short-retention router sample had
only two post-commit records, both 503 observation probes; no legacy handler
success occurred after the replacement commit point. There is no Heroku Git
remote in the local repository.

Deleting the app is not recoverable in place: it removes both dynos, config,
releases, domain attachments, and the Heroku Git repository. GitHub retains the
source history, but it does not retain Heroku config values or release state.

### Custom-domain migration completed

Vinicius Delascio chose to preserve and migrate `www.delasc.io` on 2026-08-28.
That decision authorizes the bounded domain migration before Heroku deletion:

1. add `www.delasc.io` to the existing non-secret Azure `CORS_ORIGINS` value;
2. verify the existing Auth0 application's callback, logout, and web-origin
   allowlists include the custom origin, adding it if absent;
3. at GoDaddy, replace only the `www` CNAME target with
   `steady-preprod.wittyglacier-50c44c34.australiaeast.azurecontainerapps.io`
   and add `asuid.www` with Azure's current domain-verification value;
4. add and bind `www.delasc.io` to Container App `steady-preprod` using Azure's
   free managed certificate with CNAME validation; and
5. verify DNS, certificate, Auth0 login/session, feelings/weekly reads, and
   same-origin health before removing the Heroku custom-domain attachment.

The existing Heroku app and domain attachment were retained until the Azure
hostname was secured and the supported journey passed. The then-available DNS rollback was the
previous Heroku CNAME target
`mighty-sprout-f31z370qg3n0fbtlcqtqeazn.herokudns.com`.

The bounded migration completed on 2026-08-28:

- Auth0 already allowed `https://www.delasc.io` as a callback, logout, web
  origin, and CORS origin, so no Auth0 setting or secret changed.
- Azure `CORS_ORIGINS` now contains the direct Azure origin and
  `https://www.delasc.io`. Revision `steady-preprod--qd8vj4s` is ready and has
  100% traffic; the preceding revision remains available for rollback.
- GoDaddy now serves a `www` CNAME directly to
  `steady-preprod.wittyglacier-50c44c34.australiaeast.azurecontainerapps.io`
  and the required `asuid.www` ownership TXT record. Both authoritative
  nameservers and public resolvers returned the new records.
- Container App `steady-preprod` has an SNI-enabled `www.delasc.io` binding.
  Its CNAME-validated Azure managed certificate reached `Succeeded` in
  Australia East. The certificate is issued for `www.delasc.io`, verifies
  successfully, and is valid from 2026-08-27 through 2027-02-27.
- Direct Azure custom-host checks returned 200 for the SPA, `/healthz`, and
  `/readyz`; missing bearer tokens returned 401 for both supported resources;
  `/api/ping` returned the intentional normalized 404; and an allowed-origin
  preflight returned 204 with `Access-Control-Allow-Origin` set to the custom
  origin.
- The browser completed the Auth0 session redirect back to `www.delasc.io`,
  loaded the journal with 107 visible check-ins, and loaded the weekly-tracker
  screen. No production write was made during this verification.

One command-line probe temporarily reached Heroku because the workstation DNS
cache retained the previous address after authoritative DNS had changed. A
forced Azure-ingress probe and the in-app browser both passed; this was DNS TTL
propagation, not an Azure routing failure. The Heroku app and its domain
attachment remain intact, and the recorded previous CNAME remains the rollback
target until Heroku retirement was separately approved.

The Auth0 audience string
`https://stormy-cliffs-52671.herokuapp.com/api` is an identifier, not a live
route. Heroku deletion does not itself require changing that identifier; it
remains until a separately designed Auth0 audience migration is approved.

## MongoDB Atlas target

The exact Atlas project is `feeling`, ID `5f891a6c6940e56d2d915ab0`. It contains
one cluster:

- `Cluster0`;
- M0 shared tier on AWS Sydney `AP_SOUTHEAST_2`;
- MongoDB 8.0.29, one replica set, 0.5 GB allocation;
- provider backup disabled; and
- termination protection disabled.

The scoped operator can access database `feeling`, which contains only:

- `feelings`: 114 documents; and
- `weekly_trackers`: two documents.

Atlas process metrics did not return a database inventory on this M0 cluster,
so provider metadata cannot independently prove that no other database exists.
Project naming, the single cluster, and the scoped application's view all agree
with the repository boundary, but cluster deletion must still be named
explicitly because it destroys every database on `Cluster0`.

Atlas has exactly two database users. Each has only `readWrite@feeling` and no
other scope:

- `steady_legacy_runtime`, held only by Heroku; and
- `steady_rollback_operator`, held only by the operator Keychain item
  `feeling/mongodb/steady-rollback-operator-password`.

The safe retirement unit is the complete `Cluster0` plus both database users,
after final recovery evidence. The empty Atlas project may be retained as an
audit shell or separately deleted; project deletion is a different destructive
target and is not inferred from cluster deletion.

Because Atlas backup is disabled, deleting `Cluster0` is irreversible through
Atlas. A final encrypted Mongo export and verified disposable restore are hard
preconditions.

## Current recovery and retention boundary

Vinicius Delascio explicitly approved the recovery-creation group on
2026-08-28. It completed without deleting or changing a business row.

The final current PostgreSQL backup is:

- object:
  `database/20260827T231728Z/steady-production-decommission-20260827T231728Z.steady.enc`;
- private bucket: `database-backups` in the separate Sydney backup project;
- ciphertext size: 53,134 bytes;
- ciphertext SHA-256:
  `3f4657892de20f577fec0336bde00ecbdb030936b8db153fb964ea8a9fb4f4b4`;
- manifest: PostgreSQL 17.6, Supabase CLI 2.114.0, Sydney-to-Sydney,
  migrations `20260817053317`, `20260818040229`, and `20260819004100`,
  with 115 feelings and 3 weekly trackers; and
- recovery result: authenticated download and decryption, exact outer and
  component checksums, password-free roles, owner/grant preservation, 9
  policies, forced RLS on both tables, the complete Stage 4 schema/security
  suite, and rolled-back Deno service smoke all passed in a new PostgreSQL 17
  target. Final restored counts remained 115/3.

The final frozen MongoDB backup is:

- object:
  `mongo/20260827T231728Z/steady-mongo-decommission-20260827T231728Z.tar.gz.enc`;
- private bucket: `database-backups` in the separate Sydney backup project;
- ciphertext size: 15,736 bytes;
- ciphertext SHA-256:
  `c49058afe82abf085830928728ec4d0e731df4cf2e0e0239009d2946813a48b2`;
- manifest: mongoexport 100.18.0, project
  `5f891a6c6940e56d2d915ab0`, cluster `Cluster0`, database `feeling`,
  Sydney-to-Sydney, with 114 feelings and 2 weekly trackers; and
- recovery result: authenticated download and decryption, exact component
  sizes and checksums, import into a new MongoDB 8 target, collection/count
  checks, and canonical full-document comparison all passed. The two source
  component hashes exactly match the frozen Stage 17 checkpoint.

Final read-only reconciliation accepted all 116 Mongo records, rejected none,
matched 114 feelings and 2 weekly trackers, and reported only the expected
post-commit target-only feeling and weekly tracker. The two already approved
Go-zero-time conversions remain the only transformations. There is no missing,
duplicate, malformed, cross-user, or unexplained row.

After this evidence was recorded and validated, the exact disposable
PostgreSQL and MongoDB containers, their isolated network, local SQL and JSON
exports, decrypted archives, reports, command logs, downloaded and local
ciphertexts, and owner-only scratch directory were removed. Only the two new
private Storage ciphertexts and sanitized repository evidence remain.

The private bucket now has seven ciphertext objects totalling 257,107 bytes.
Recommended disposition is to retain every existing ciphertext for 12 months
from its creation because the storage cost is negligible. The object under
`20260827T054438Z` remains explicitly non-qualified for recovery; retention
does not promote it to a usable backup. The new final objects above supersede
the prior 114/2 PostgreSQL recovery point for decommission readiness. No backup
deletion is proposed in the initial decommission contract.

## Repository artifacts

The exact version-controlled legacy deployment artifacts removed after
provider retirement were:

- root `Dockerfile`, `heroku.yml`, and `app.json`; and
- all 20 tracked files under `server/`, including the Go source, Go module,
  characterization tests, compiled `server/main` binary, and embedded legacy
  frontend build.

The current `client/` React application is not a legacy artifact; Azure builds
and serves it through `api/Dockerfile`. The root README and Docker ignore rules
now describe Deno/Azure/Supabase and omit Go/Heroku/Mongo operator
instructions. Historical migration specifications, evidence,
runbooks, and Git history remain retained. Migration, rollback, and backup
tools remain until a later maintenance decision because they support audit and
restore, even after the live legacy provider is gone.

## Approved destructive groups and retained-state contract

Vinicius Delascio explicitly approved groups 2 through 4 after the recovery
evidence and exact targets were presented. Group 1 had already completed; group
5 remains the continuing retention boundary.

1. **Recovery creation — completed:** create and upload the exact final
   encrypted Supabase and Mongo backups and execute disposable restores. These
   production data export/upload actions completed on 2026-08-28 without
   deletion.
2. **Heroku retirement — completed:** delete app `stormy-cliffs-52671`, including its two
   Basic dynos, 15 releases, config, Git endpoint, Heroku hostname, and custom
   domain attachment, only after the `www.delasc.io` decision is executed.
3. **Atlas retirement — completed:** delete M0 cluster `Cluster0` in project
   `5f891a6c6940e56d2d915ab0`, then delete database users
   `steady_legacy_runtime` and `steady_rollback_operator`. Delete the operator
   Keychain password only after provider revocation is verified. The Atlas CLI
   session expired after the successful scoped export and must be
   reauthenticated before any separately approved retirement command.
4. **Repository cleanup — completed:** remove the named root deployment files and all
   tracked `server/` files; update current documentation and ignore rules.
5. **Retention:** retain Supabase, Azure, Auth0, the Atlas project audit shell,
   all encrypted backup objects, backup keys, and historical AI-OS evidence.

After any authorized deletion, re-run Azure health/readiness, authenticated
production reads, aggregate Supabase accounting, forced-RLS/advisors, backup
availability, Heroku/Atlas absence, billing/resource inventory, and a scoped
repository test suite. Stop on any unexpected target or unrelated-resource
impact.

## Completion outcome

The deletion gate was re-resolved immediately before execution. Heroku still
identified exactly app `stormy-cliffs-52671`; Atlas project
`5f891a6c6940e56d2d915ab0` still contained exactly `Cluster0` and the two named
database users; and the final encrypted backups remained private and
checksum-qualified.

The approved retirement then completed in bounded order:

- Heroku app `stormy-cliffs-52671` was permanently deleted. A provider lookup
  now returns `not_found`. Its dynos, releases, configuration, Git endpoint,
  Heroku hostname, and old custom-domain attachment are no longer recoverable
  in place.
- Atlas cluster `Cluster0` was permanently deleted. The project cluster
  inventory now contains zero clusters.
- Atlas database users `steady_legacy_runtime` and
  `steady_rollback_operator` were deleted. The project database-user inventory
  now contains zero users.
- After provider revocation was verified, the local Keychain password named
  `feeling/mongodb/steady-rollback-operator-password` was deleted and its
  absence verified.
- The empty Atlas project was deliberately retained as the approved audit
  shell. No project, Azure, Supabase, Auth0, DNS, backup object, or backup key
  was deleted.
- Root `Dockerfile`, `heroku.yml`, and `app.json`, plus all 20 tracked files
  under `server/`, were removed. The root README and Docker ignore rules now
  describe the current Deno/Azure/Supabase system, and the dead frontend script
  that copied assets into `server/web` was removed.

Public DNS continues to point `www.delasc.io` to Azure. The custom-host Azure
liveness check continued to return 200 with valid TLS immediately after Heroku
deletion. Supabase remained at 115 feelings and three weekly trackers, and the
private backup bucket retained all seven ciphertext objects totalling 257,107
bytes. Recovery from the retired data stores now depends on the retained,
previously restored and checksum-qualified encrypted backups rather than an
in-place provider rollback.

## Resumed verification checkpoint

On 2026-09-02, the approved plan again passed structural and readiness
validation. The implementation artefact passed structural validation and patch
hygiene remained clean. The Deno checks passed formatting, lint, type checking,
and all 28 isolated tests. The React checks passed all nine tests and produced
an optimized production build.

Provider state was also rechecked without mutation. Heroku still returns
`not_found`; Azure custom-host liveness and readiness return 200 with valid
TLS; production Supabase has advanced through post-decommission use to 116
feelings and four weekly trackers, with nine policies and forced RLS on both
tables; both advisors are empty; and the private Storage bucket still contains
seven ciphertexts totalling 257,107 bytes. The Atlas CLI session expired before
the 2026-09-02 refresh, so the current record does not invent a new result: the
immediate post-deletion provider check remains the durable evidence that the
retained project had zero clusters and zero database users.

The public SPA loaded and redirected to the correct retained Auth0 tenant,
client, historical opaque API audience, and `www.delasc.io` callback. The
browser session had expired during the pause, so Vinicius Delascio renewed it.
The authenticated journal then loaded 108 check-ins and the weekly tracker
loaded the week of 2026-08-31. Both showed the retained Auth0 identity and
expected controls. No Save control was used and no production write occurred.

Final structural validation and patch hygiene pass. The implementation
readiness audit continues to surface the historical failed direct-IPv6 probe
from Stage 3. That evidence is deliberately retained; the approved TLS
Supavisor fallback passed, became the production connection path, and remains
healthy, but historical evidence is not rewritten to make the aggregate
readiness result green.
