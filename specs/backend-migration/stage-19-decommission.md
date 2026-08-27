# Stage 19 — decommission discovery and approval contract

Recorded: 2026-08-28 (Australia/Brisbane)

Status: custom-domain prerequisite complete; destructive execution is not
authorized.

Stage 18 is committed at `8ca0b9d`. The Deno/Azure and Supabase replacement is
the production source of truth. This record resolves the legacy targets and
the recovery prerequisites needed before Vinicius Delascio can approve any
deletion. No provider resource, credential, data, DNS record, backup object, or
repository artifact was deleted during discovery.

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

The existing Heroku app and domain attachment remain intact until the Azure
hostname is secured and the supported journey passes. DNS rollback is the
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
target until Heroku retirement is separately approved.

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

The current accepted PostgreSQL backup predates the two real post-commit
writes. It remains fully restorable at 114 feelings and two weekly trackers,
but production is now 115/3. It is therefore not sufficient by itself for
legacy destruction.

Before any Heroku or Atlas deletion, Stage 19 must separately authorize and
complete:

1. a fresh current Supabase PostgreSQL 17 encrypted logical backup at 115/3 or
   the then-current counts;
2. authenticated download, checksum, empty-target restore, migrations, grants,
   constraints, forced-RLS, API smoke, and reconciliation;
3. a final owner-only Mongo export at 114/2 or the then-current frozen counts;
4. authenticated encryption, private Sydney upload, download/checksum, and a
   disposable Mongo restore/reconciliation of that export; and
5. final source/target accounting with every Supabase post-commit row explained
   and no missing, duplicate, cross-user, malformed, or unexpected row.

The private backup bucket currently has five ciphertext objects totalling
188,237 bytes. Recommended disposition is to retain every existing ciphertext
for 12 months from its creation because the storage cost is negligible. The
object under `20260827T054438Z` remains explicitly non-qualified for recovery;
retention does not promote it to a usable backup. The accepted
`20260827T055046Z` object and any new final backups must retain their recorded
checksums and operator encryption key. No backup deletion is proposed in the
initial decommission contract.

## Repository artifacts

After provider retirement succeeds, the exact version-controlled legacy
deployment artifacts proposed for removal are:

- root `Dockerfile`, `heroku.yml`, and `app.json`; and
- all 20 tracked files under `server/`, including the Go source, Go module,
  characterization tests, compiled `server/main` binary, and embedded legacy
  frontend build.

The current `client/` React application is not a legacy artifact; Azure builds
and serves it through `api/Dockerfile`. The root README and Docker ignore rules
must be updated to describe Deno/Azure/Supabase and remove Go/Heroku/Mongo
operator instructions. Historical migration specifications, evidence,
runbooks, and Git history remain retained. Migration, rollback, and backup
tools remain until a later maintenance decision because they support audit and
restore, even after the live legacy provider is gone.

## Proposed destructive approval groups

No group below is authorized yet.

1. **Recovery creation:** create and upload the exact final encrypted Supabase
   and Mongo backups and execute disposable restores. These are production data
   export/upload actions but not deletions.
2. **Heroku retirement:** delete app `stormy-cliffs-52671`, including its two
   Basic dynos, 15 releases, config, Git endpoint, Heroku hostname, and custom
   domain attachment, only after the `www.delasc.io` decision is executed.
3. **Atlas retirement:** delete M0 cluster `Cluster0` in project
   `5f891a6c6940e56d2d915ab0`, then delete database users
   `steady_legacy_runtime` and `steady_rollback_operator`. Delete the operator
   Keychain password only after provider revocation is verified.
4. **Repository cleanup:** remove the named root deployment files and all
   tracked `server/` files; update current documentation and ignore rules.
5. **Retention:** retain Supabase, Azure, Auth0, the Atlas project audit shell,
   all encrypted backup objects, backup keys, and historical AI-OS evidence.

After any authorized deletion, re-run Azure health/readiness, authenticated
production reads, aggregate Supabase accounting, forced-RLS/advisors, backup
availability, Heroku/Atlas absence, billing/resource inventory, and a scoped
repository test suite. Stop on any unexpected target or unrelated-resource
impact.
