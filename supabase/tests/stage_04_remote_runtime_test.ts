import postgres from "postgres";

const databaseUrl = Deno.env.get("DATABASE_URL");

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const sql = postgres(databaseUrl, {
  max: 1,
  prepare: false,
  ssl: "require",
});

class ExpectedRollback extends Error {}

try {
  await sql.begin(async (transaction) => {
    await transaction`select set_config('app.auth0_sub', 'auth0|stage4-remote-user-a', true)`;

    const [feeling] = await transaction`
      insert into steady.feelings (user_id, status, created_at, comment)
      values (
        'auth0|stage4-remote-user-a',
        3,
        statement_timestamp(),
        'stage 4 remote rollback fixture'
      )
      returning
        id,
        activity_bow,
        activity_lift,
        activity_run,
        activity_cycle,
        activity_swim
    `;

    if (
      !feeling.id || feeling.activity_bow || feeling.activity_lift ||
      feeling.activity_run || feeling.activity_cycle || feeling.activity_swim
    ) {
      throw new Error("feelings defaults or generated identifier are invalid");
    }

    const [weekly] = await transaction`
      insert into steady.weekly_trackers (user_id, week_of, mood)
      values ('auth0|stage4-remote-user-a', date '2026-08-17', 'steady')
      on conflict (user_id, week_of) do update
      set mood = excluded.mood, updated_at = statement_timestamp()
      returning id
    `;

    const [updatedWeekly] = await transaction`
      insert into steady.weekly_trackers (user_id, week_of, mood, tracker_version)
      values ('auth0|stage4-remote-user-a', date '2026-08-17', 'good', 2)
      on conflict (user_id, week_of) do update
      set mood = excluded.mood,
          tracker_version = excluded.tracker_version,
          updated_at = statement_timestamp()
      returning id, mood, tracker_version
    `;

    if (
      weekly.id !== updatedWeekly.id || updatedWeekly.mood !== "good" ||
      updatedWeekly.tracker_version !== 2
    ) {
      throw new Error("weekly tracker upsert is not atomic or stable");
    }

    const [ownerCounts] = await transaction`
      select
        (select count(*)::int from steady.feelings) as feelings,
        (select count(*)::int from steady.weekly_trackers) as weekly_trackers
    `;

    if (ownerCounts.feelings !== 1 || ownerCounts.weekly_trackers !== 1) {
      throw new Error("the owning identity cannot see its inserted rows");
    }

    await transaction`select set_config('app.auth0_sub', 'auth0|stage4-remote-user-b', true)`;

    const [otherCounts] = await transaction`
      select
        (select count(*)::int from steady.feelings) as feelings,
        (select count(*)::int from steady.weekly_trackers) as weekly_trackers
    `;

    if (otherCounts.feelings !== 0 || otherCounts.weekly_trackers !== 0) {
      throw new Error("RLS exposed one identity's rows to another identity");
    }

    let crossIdentityInsertRejected = false;
    await transaction.savepoint(async (savepoint) => {
      try {
        await savepoint`
          insert into steady.feelings (user_id, status, created_at)
          values ('auth0|stage4-remote-user-a', 2, statement_timestamp())
        `;
      } catch {
        crossIdentityInsertRejected = true;
        throw new ExpectedRollback();
      }
    }).catch((error) => {
      if (!(error instanceof ExpectedRollback)) throw error;
    });

    if (!crossIdentityInsertRejected) {
      throw new Error("RLS accepted a cross-identity insert");
    }

    throw new ExpectedRollback();
  });
} catch (error) {
  if (!(error instanceof ExpectedRollback)) throw error;
} finally {
  await sql.end();
}

console.log(
  "Stage 4 remote runtime isolation checks passed; fixtures rolled back.",
);
