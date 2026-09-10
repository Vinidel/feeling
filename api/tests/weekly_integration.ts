import assert from "node:assert/strict";
import {
  createDatabase,
  type Database,
  type UserTransaction,
} from "../src/database.ts";
import { createWeeklyTrackersService } from "../src/weekly.ts";

const databaseUrl = Deno.env.get("DATABASE_URL");
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const userA = "auth0|stage9-weekly-user-a";
const userB = "auth0|stage9-weekly-user-b";
const weekOf = "2099-08-03";

class ExpectedRollback extends Error {}

function serviceInTransaction(transaction: UserTransaction) {
  const transactionDatabase: Pick<Database, "withUserTransaction"> = {
    async withUserTransaction<T>(
      userId: string,
      operation: (nested: UserTransaction) => Promise<T>,
    ): Promise<T> {
      assert.equal(userId, transaction.userId);
      return await operation(transaction);
    },
  };
  return createWeeklyTrackersService(transactionDatabase);
}

const database = createDatabase({ databaseUrl });

try {
  await database.checkReadiness();
  try {
    await database.withUserTransaction(userA, async (transaction) => {
      const weekly = serviceInTransaction(transaction);
      assert.equal(await weekly.get(userA, weekOf), null);

      const created = await weekly.upsert(userA, {
        weekOf,
        mood: "good",
        trackerVersion: 1,
        checks: {
          cardio: true,
          strength: false,
          mobility: true,
          build: false,
          archery: true,
          hunt: false,
        },
        notes: {
          win: "stage 9 rollback win",
          challenge: "stage 9 rollback challenge",
          nextWeek: "stage 9 rollback focus",
        },
      });
      assert.equal(created.userID, userA);
      assert.equal(created.weekOf, weekOf);
      assert.equal(created.trackerVersion, 1);
      assert.ok(!Number.isNaN(Date.parse(created.updatedAt)));

      const updated = await weekly.upsert(userA, {
        weekOf,
        mood: "great",
        trackerVersion: 1,
        checks: {
          cardio: false,
          strength: true,
          mobility: false,
          build: true,
          archery: false,
          hunt: true,
        },
        notes: { win: "edited", challenge: "", nextWeek: "next" },
      });
      assert.equal(updated.mood, "great");
      assert.deepEqual(updated.checks, {
        cardio: false,
        strength: true,
        mobility: false,
        build: true,
        archery: false,
        hunt: true,
      });
      assert.deepEqual(updated.notes, {
        win: "edited",
        challenge: "",
        nextWeek: "next",
      });

      const [count] = await transaction.query`
        select count(*)::int as count
        from steady.weekly_trackers
        where user_id = ${transaction.userId}
          and week_of = ${weekOf}
      `;
      assert.equal(count.count, 1);
      assert.deepEqual(await weekly.get(userA, weekOf), updated);
      throw new ExpectedRollback();
    });
  } catch (error) {
    if (!(error instanceof ExpectedRollback)) throw error;
  }

  for (const userId of [userB, userA]) {
    await database.withUserTransaction(userId, async (transaction) => {
      assert.equal(
        await serviceInTransaction(transaction).get(userId, weekOf),
        null,
      );
    });
  }
} finally {
  await database.close();
}

console.log(
  "Stage 9 weekly create/edit mapping, one-row guarantee, isolation, and rollback checks passed.",
);
