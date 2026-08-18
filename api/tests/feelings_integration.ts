import assert from "node:assert/strict";
import {
  createDatabase,
  type Database,
  type UserTransaction,
} from "../src/database.ts";
import { createFeelingsService } from "../src/feelings.ts";

const databaseUrl = Deno.env.get("DATABASE_URL");
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const userA = "auth0|stage7-feelings-user-a";
const userB = "auth0|stage7-feelings-user-b";

class ExpectedRollback extends Error {}

function serviceInTransaction(
  transaction: UserTransaction,
): ReturnType<typeof createFeelingsService> {
  const transactionDatabase: Pick<Database, "withUserTransaction"> = {
    async withUserTransaction<T>(
      userId: string,
      operation: (nested: UserTransaction) => Promise<T>,
    ): Promise<T> {
      assert.equal(userId, transaction.userId);
      return await operation(transaction);
    },
  };
  return createFeelingsService(transactionDatabase);
}

const database = createDatabase({ databaseUrl });

try {
  await database.checkReadiness();

  try {
    await database.withUserTransaction(userA, async (transaction) => {
      const feelings = serviceInTransaction(transaction);
      const [before] = await transaction.query`
        select count(*)::int as count
        from steady.feelings
        where user_id = ${transaction.userId}
      `;
      assert.equal(before.count, 0);

      const created = await feelings.create(userA, {
        status: "4",
        createdAt: "2099-07-03T04:05:06Z",
        comment: "stage 7 rollback fixture newest",
        activities: {
          bow: true,
          lift: true,
          run: true,
          cycle: true,
          swim: true,
        },
      });
      assert.deepEqual(created, {
        activities: {
          bow: true,
          lift: true,
          run: true,
          cycle: true,
          swim: true,
        },
        status: "4",
        createdAt: "2099-07-03T04:05:06.000Z",
        comment: "stage 7 rollback fixture newest",
        userID: userA,
      });

      await transaction.query`
        insert into steady.feelings (
          id, user_id, status, created_at, comment
        ) values
          (
            '00000000-0000-4000-8000-000000000001',
            ${transaction.userId},
            2,
            '2099-07-02T00:00:00Z',
            'stage 7 tie lower id'
          ),
          (
            '00000000-0000-4000-8000-000000000002',
            ${transaction.userId},
            3,
            '2099-07-02T00:00:00Z',
            'stage 7 tie higher id'
          ),
          (
            '00000000-0000-4000-8000-000000000003',
            ${transaction.userId},
            1,
            '2099-07-01T00:00:00Z',
            'stage 7 oldest'
          )
      `;

      const [after] = await transaction.query`
        select count(*)::int as count
        from steady.feelings
        where user_id = ${transaction.userId}
      `;
      assert.equal(after.count, 4);

      const history = await feelings.list(userA);
      assert.deepEqual(
        history.map(({ comment }) => comment),
        [
          "stage 7 rollback fixture newest",
          "stage 7 tie higher id",
          "stage 7 tie lower id",
          "stage 7 oldest",
        ],
      );
      assert.ok(history.every(({ userID }) => userID === userA));

      throw new ExpectedRollback();
    });
  } catch (error) {
    if (!(error instanceof ExpectedRollback)) throw error;
  }

  for (const userId of [userB, userA]) {
    await database.withUserTransaction(userId, async (transaction) => {
      const feelings = serviceInTransaction(transaction);
      assert.deepEqual(await feelings.list(userId), []);
    });
  }
} finally {
  await database.close();
}

console.log(
  "Stage 7 feelings mapping, ordering, insertion, isolation, and rollback checks passed.",
);
