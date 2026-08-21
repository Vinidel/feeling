# Pre-commit rollback

Use this only when no production request has reached the replacement and no
write has been acknowledged by Supabase.

Owner and approver: Vinicius Delascio.

1. Keep source writes suspended while classifying the failure.
2. Verify the production route still points to Go/Heroku. If a pending DNS or
   proxy change exists, cancel or reverse it before it can serve traffic.
3. Verify Go health, Auth0 login, and Mongo aggregate counts against the final
   checkpoint. Do not copy target data back to Mongo in this mode.
4. Verify every source write acknowledged before suspension is present in the
   checkpoint and Mongo.
5. Re-enable Go/Mongo writes only after the owner records that the route and
   counts are correct.
6. Leave the failed Deno revision dark, retain its logs and reports, and record
   the failure without deleting Go, Heroku, Mongo, or target data.

The rehearsal used an unchanged synthetic Mongo checkpoint and proved the
target could be discarded before traffic without affecting the source.
