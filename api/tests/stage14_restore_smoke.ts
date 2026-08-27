import assert from "node:assert/strict";
import {
  createDatabase,
  type Database,
  type UserTransaction,
} from "../src/database.ts";
import { createFeelingsService } from "../src/feelings.ts";
import { createWeeklyTrackersService } from "../src/weekly.ts";

const databaseUrl = Deno.env.get("DATABASE_URL");
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const userId = "auth0|stage14-restore-smoke";
class ExpectedRollback extends Error {}

const database = createDatabase({ databaseUrl, ssl: "disable" });

try {
  await database.checkReadiness();
  try {
    await database.withUserTransaction(userId, async (transaction) => {
      const scopedDatabase: Pick<Database, "withUserTransaction"> = {
        async withUserTransaction<T>(
          nestedUserId: string,
          operation: (nested: UserTransaction) => Promise<T>,
        ): Promise<T> {
          assert.equal(nestedUserId, userId);
          return await operation(transaction);
        },
      };
      const feelings = createFeelingsService(scopedDatabase);
      const weekly = createWeeklyTrackersService(scopedDatabase);

      assert.deepEqual(await feelings.list(userId), []);
      assert.equal(await weekly.get(userId, "2099-08-25"), null);

      const feeling = await feelings.create(userId, {
        status: "3",
        createdAt: "2099-08-25T00:00:00Z",
        comment: "stage 14 disposable restore smoke",
        activities: {
          bow: false,
          lift: false,
          run: true,
          cycle: false,
          swim: false,
        },
      });
      assert.equal(feeling.userID, userId);

      const tracker = await weekly.upsert(userId, {
        weekOf: "2099-08-25",
        mood: "steady",
        trackerVersion: 1,
        checks: {
          cardio: true,
          strength: false,
          mobility: false,
          build: false,
          archery: false,
          hunt: false,
        },
        notes: { win: "", challenge: "", nextWeek: "" },
      });
      assert.equal(tracker.userID, userId);
      throw new ExpectedRollback();
    });
  } catch (error) {
    if (!(error instanceof ExpectedRollback)) throw error;
  }

  await database.withUserTransaction(userId, async (transaction) => {
    const [counts] = await transaction.query`
      select
        (select count(*)::int from steady.feelings) as feelings,
        (select count(*)::int from steady.weekly_trackers) as weekly_trackers
    `;
    assert.deepEqual(counts, { feelings: 0, weekly_trackers: 0 });
  });
} finally {
  await database.close();
}

console.log("Stage 14 restored API service smoke passed with rollback.");
