import assert from "node:assert/strict";
import {
  feelingRequestSchema,
  weeklyTrackerQuerySchema,
  weeklyTrackerRequestSchema,
} from "../src/schemas.ts";

Deno.test("feeling schema accepts the React contract and neutral defaults", () => {
  assert.deepEqual(
    feelingRequestSchema.parse({
      status: "3",
      createdAt: "2026-08-18T05:00:00.000Z",
    }),
    {
      status: "3",
      createdAt: "2026-08-18T05:00:00.000Z",
      comment: "",
      activities: {
        bow: false,
        lift: false,
        run: false,
        cycle: false,
        swim: false,
      },
    },
  );
});

Deno.test("strict body schemas reject client identity and unknown fields", () => {
  assert.equal(
    feelingRequestSchema.safeParse({
      status: "2",
      createdAt: "2026-08-18T05:00:00.000Z",
      userID: "auth0|attacker-selected",
    }).success,
    false,
  );
  assert.equal(
    weeklyTrackerRequestSchema.safeParse({
      weekOf: "2026-08-17",
      mood: "steady",
      userID: "auth0|attacker-selected",
    }).success,
    false,
  );
  assert.equal(
    feelingRequestSchema.safeParse({
      status: "3",
      createdAt: "not-a-date",
    }).success,
    false,
  );
});

Deno.test("weekly schemas enforce supported values and calendar dates", () => {
  assert.deepEqual(
    weeklyTrackerRequestSchema.parse({
      weekOf: "2026-08-17",
      mood: "steady",
    }),
    {
      weekOf: "2026-08-17",
      mood: "steady",
      trackerVersion: 1,
      checks: {
        cardio: false,
        strength: false,
        mobility: false,
        build: false,
        archery: false,
        hunt: false,
      },
      notes: { win: "", challenge: "", nextWeek: "" },
    },
  );
  assert.equal(
    weeklyTrackerRequestSchema.safeParse({
      weekOf: "2026-02-30",
      mood: "steady",
    }).success,
    false,
  );
  assert.equal(
    weeklyTrackerQuerySchema.safeParse({
      weekOf: "2026-08-17",
      userID: "auth0|attacker-selected",
    }).success,
    false,
  );
});
