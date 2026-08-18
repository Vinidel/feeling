import assert from "node:assert/strict";
import { createDatabase } from "../src/database.ts";
import type { WeeklyTrackerRequest } from "../src/schemas.ts";
import { createWeeklyTrackersService } from "../src/weekly.ts";

const databaseUrl = Deno.env.get("DATABASE_URL");
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const database = createDatabase({ databaseUrl, ssl: "disable" });
const weekly = createWeeklyTrackersService(database);
const userId = "auth0|stage9-concurrent-user";
const weekOf = "2099-08-10";

const writes: WeeklyTrackerRequest[] = Array.from(
  { length: 12 },
  (_, index) => ({
    weekOf,
    mood: (["rough", "low", "steady", "good", "great"] as const)[index % 5],
    trackerVersion: 1,
    checks: {
      cardio: index % 2 === 0,
      strength: index % 3 === 0,
      mobility: index % 4 === 0,
      build: index % 5 === 0,
      archery: index % 6 === 0,
      hunt: index % 7 === 0,
    },
    notes: {
      win: `concurrent-${index}`,
      challenge: "synthetic",
      nextWeek: "synthetic",
    },
  }),
);

try {
  const results = await Promise.all(
    writes.map((tracker) => weekly.upsert(userId, tracker)),
  );
  assert.equal(results.length, writes.length);
  assert.ok(
    results.every((record) =>
      record.userID === userId && record.weekOf === weekOf
    ),
  );

  await database.withUserTransaction(userId, async (transaction) => {
    const [count] = await transaction.query`
      select count(*)::int as count
      from steady.weekly_trackers
      where user_id = ${transaction.userId}
        and week_of = ${weekOf}
    `;
    assert.equal(count.count, 1);
  });

  const final = await weekly.get(userId, weekOf);
  assert.ok(final);
  assert.ok(writes.some((candidate) =>
    candidate.mood === final.mood &&
    candidate.notes.win === final.notes.win &&
    JSON.stringify(candidate.checks) === JSON.stringify(final.checks)
  ));
} finally {
  await database.close();
}

console.log(
  "Stage 9 concurrent atomic upsert produced exactly one user/week row.",
);
