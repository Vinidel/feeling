import assert from "node:assert/strict";
import {
  deterministicObjectId,
  feelingDocument,
  type TargetFeeling,
  type TargetWeekly,
  weeklyDocument,
} from "../reconcile.ts";

const feeling: TargetFeeling = {
  id: "11111111-1111-4111-8111-111111111111",
  legacy_mongo_id: null,
  user_id: "auth0|rollback-test",
  status: 4,
  created_at: new Date("2026-08-19T00:00:00.000Z"),
  comment: "synthetic rollback feeling",
  activity_bow: true,
  activity_lift: false,
  activity_run: true,
  activity_cycle: false,
  activity_swim: true,
};

const weekly: TargetWeekly = {
  id: "22222222-2222-4222-8222-222222222222",
  legacy_mongo_id: null,
  user_id: "auth0|rollback-test",
  week_of: "2026-08-17",
  mood: "good",
  tracker_version: 1,
  check_cardio: true,
  check_strength: false,
  check_mobility: true,
  check_build: false,
  check_archery: true,
  check_hunt: false,
  note_win: "synthetic win",
  note_challenge: "synthetic challenge",
  note_next_week: "synthetic next week",
  updated_at: new Date("2026-08-19T01:00:00.000Z"),
};

Deno.test("deterministic rollback ObjectIds are stable, namespaced, and timestamped", async () => {
  const first = await deterministicObjectId(
    "feeling",
    feeling.id,
    feeling.created_at,
  );
  const repeat = await deterministicObjectId(
    "feeling",
    feeling.id,
    feeling.created_at,
  );
  const other = await deterministicObjectId(
    "weekly",
    feeling.id,
    feeling.created_at,
  );

  assert.equal(first.toHexString(), repeat.toHexString());
  assert.notEqual(first.toHexString(), other.toHexString());
  assert.equal(first.getTimestamp().toISOString(), "2026-08-19T00:00:00.000Z");
});

Deno.test("target records map to the exact legacy Mongo document shape", async () => {
  const feelingId = await deterministicObjectId(
    "feeling",
    feeling.id,
    feeling.created_at,
  );
  const feelingMapped = feelingDocument(feeling, feelingId);
  assert.deepEqual(feelingMapped.activities, {
    bow: true,
    lift: false,
    run: true,
    cycle: false,
    swim: true,
  });
  assert.equal(feelingMapped.status, "4");
  assert.equal(feelingMapped.userid, "auth0|rollback-test");
  assert.equal(
    feelingMapped.createdat.toISOString(),
    "2026-08-19T00:00:00.000Z",
  );

  const weeklyId = await deterministicObjectId(
    "weekly",
    weekly.id,
    weekly.updated_at,
  );
  const weeklyMapped = weeklyDocument(weekly, weeklyId);
  assert.equal(weeklyMapped.weekof, "2026-08-17");
  assert.equal(weeklyMapped.trackerVersion, 1);
  assert.deepEqual(weeklyMapped.checks, {
    cardio: true,
    strength: false,
    mobility: true,
    build: false,
    archery: true,
    hunt: false,
  });
  assert.deepEqual(weeklyMapped.notes, {
    win: "synthetic win",
    challenge: "synthetic challenge",
    nextWeek: "synthetic next week",
  });
  assert.equal(
    weeklyMapped.updatedat.toISOString(),
    "2026-08-19T01:00:00.000Z",
  );
});
