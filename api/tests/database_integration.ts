import assert from "node:assert/strict";
import { createDatabase, type UserTransaction } from "../src/database.ts";

const databaseUrl = Deno.env.get("DATABASE_URL");
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const userA = "auth0|stage6-runtime-user-a";
const userB = "auth0|stage6-runtime-user-b";
const weekOf = "2099-06-02";

class ExpectedRollback extends Error {}
class ExpectedDenial extends Error {}

async function expectDatabaseDenial(
  transaction: UserTransaction,
  operation: (savepoint: UserTransaction) => Promise<unknown>,
): Promise<void> {
  let denied = false;
  try {
    await transaction.savepoint(async (savepoint) => {
      try {
        await operation(savepoint);
      } catch {
        denied = true;
        throw new ExpectedDenial();
      }
      throw new Error("database operation was unexpectedly allowed");
    });
  } catch (error) {
    if (!(error instanceof ExpectedDenial)) throw error;
  }
  assert.equal(denied, true);
}

const database = createDatabase({ databaseUrl });

try {
  await database.checkReadiness();

  try {
    await database.withUserTransaction(userA, async (transaction) => {
      const [identity] = await transaction.query`
        select current_setting('app.auth0_sub', true) as value
      `;
      assert.equal(identity.value, userA);

      await transaction.query`
        insert into steady.feelings (
          user_id,
          status,
          created_at,
          comment
        ) values (
          ${transaction.userId},
          3,
          statement_timestamp(),
          'stage 6 rollback fixture'
        )
      `;
      await transaction.query`
        insert into steady.weekly_trackers (
          user_id,
          week_of,
          mood
        ) values (
          ${transaction.userId},
          ${weekOf},
          'steady'
        )
      `;

      const [owned] = await transaction.query`
        select
          (select count(*)::int from steady.feelings
            where user_id = ${transaction.userId}) as feelings,
          (select count(*)::int from steady.weekly_trackers
            where user_id = ${transaction.userId}
              and week_of = ${weekOf}) as weekly_trackers
      `;
      assert.equal(owned.feelings, 1);
      assert.equal(owned.weekly_trackers, 1);

      await expectDatabaseDenial(transaction, async (savepoint) => {
        await savepoint.query`
          insert into steady.feelings (user_id, status, created_at)
          values (${userB}, 2, statement_timestamp())
        `;
      });
      await expectDatabaseDenial(transaction, async (savepoint) => {
        await savepoint.query`
          update steady.weekly_trackers
          set user_id = ${userB}
          where user_id = ${savepoint.userId} and week_of = ${weekOf}
        `;
      });
      await expectDatabaseDenial(transaction, async (savepoint) => {
        await savepoint.query`
          delete from steady.weekly_trackers
          where user_id = ${savepoint.userId} and week_of = ${weekOf}
        `;
      });

      throw new ExpectedRollback();
    });
  } catch (error) {
    if (!(error instanceof ExpectedRollback)) throw error;
  }

  for (const userId of [userB, userA]) {
    await database.withUserTransaction(userId, async (transaction) => {
      const [result] = await transaction.query`
        select
          current_setting('app.auth0_sub', true) as identity,
          (select count(*)::int from steady.feelings
            where user_id = ${transaction.userId}) as owned_feelings,
          (select count(*)::int from steady.feelings) as visible_feelings,
          (select count(*)::int from steady.weekly_trackers
            where user_id = ${transaction.userId}
              and week_of = ${weekOf}) as fixture_weekly
      `;
      assert.equal(result.identity, userId);
      assert.equal(result.owned_feelings, 0);
      assert.equal(result.visible_feelings, 0);
      assert.equal(result.fixture_weekly, 0);
    });
  }
} finally {
  await database.close();
}

console.log(
  "Stage 6 runtime transaction, isolation, denial, and rollback checks passed.",
);
