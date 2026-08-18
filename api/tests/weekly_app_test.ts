import assert from "node:assert/strict";
import { createHandler } from "../src/app.ts";
import { HttpError } from "../src/errors.ts";
import type { WeeklyTrackerRequest } from "../src/schemas.ts";
import type {
  WeeklyTrackerResponse,
  WeeklyTrackersService,
} from "../src/weekly.ts";

const fixture: WeeklyTrackerRequest = {
  weekOf: "2026-01-05",
  mood: "good",
  trackerVersion: 1,
  checks: {
    cardio: true,
    strength: true,
    mobility: false,
    build: true,
    archery: false,
    hunt: true,
  },
  notes: {
    win: "synthetic win",
    challenge: "synthetic challenge",
    nextWeek: "synthetic focus",
  },
};

function saved(
  userId: string,
  tracker: WeeklyTrackerRequest,
): WeeklyTrackerResponse {
  return {
    ...tracker,
    userID: userId,
    updatedAt: "2026-01-06T07:08:09.000Z",
  };
}

function handlerFor(weeklyTrackers: WeeklyTrackersService) {
  return createHandler({
    allowedOrigins: new Set(),
    authenticate: (request) => {
      const userId = request.headers.get("authorization")?.replace(
        /^Bearer /,
        "",
      );
      if (!userId) {
        throw new HttpError(
          401,
          "invalid_token",
          "Valid authentication is required",
        );
      }
      const claimed = request.headers.get("x-user-id");
      if (claimed !== null && claimed !== userId) {
        throw new HttpError(
          403,
          "forbidden_identity",
          "Request identity does not match the authenticated user",
        );
      }
      return Promise.resolve({ userId });
    },
    database: { checkReadiness: () => Promise.resolve() },
    feelings: {
      list: () => Promise.resolve([]),
      create: () => Promise.reject(new Error("unexpected feeling create")),
    },
    weeklyTrackers,
    deploymentVersion: "stage-9-test",
    logger: () => undefined,
  });
}

function request(
  method: "GET" | "POST",
  userId: string,
  body?: unknown,
  query = "?weekOf=2026-01-05",
  headerUserId = userId,
): Request {
  return new Request(`http://localhost/api/weekly-tracker${query}`, {
    method,
    headers: {
      authorization: `Bearer ${userId}`,
      "content-type": "application/json",
      "x-user-id": headerUserId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

Deno.test("GET weekly returns null or the exact user/week record envelope", async () => {
  const owner = "auth0|stage9-owner";
  const calls: Array<{ userId: string; weekOf: string }> = [];
  let record: WeeklyTrackerResponse | null = null;
  const handler = handlerFor({
    get: (userId, weekOf) => {
      calls.push({ userId, weekOf });
      return Promise.resolve(record);
    },
    upsert: () => Promise.reject(new Error("unexpected upsert")),
  });

  const empty = await handler(request("GET", owner));
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { ok: true, record: null });

  record = saved(owner, fixture);
  const populated = await handler(request("GET", owner));
  assert.equal(populated.status, 200);
  assert.deepEqual(await populated.json(), { ok: true, record });
  assert.deepEqual(calls, [
    { userId: owner, weekOf: fixture.weekOf },
    { userId: owner, weekOf: fixture.weekOf },
  ]);
});

Deno.test("POST weekly preserves supported fields and applies defaults", async () => {
  const owner = "auth0|stage9-owner";
  const calls: Array<{ userId: string; tracker: WeeklyTrackerRequest }> = [];
  const handler = handlerFor({
    get: () => Promise.resolve(null),
    upsert: (userId, tracker) => {
      calls.push({ userId, tracker });
      return Promise.resolve(saved(userId, tracker));
    },
  });

  const complete = await handler(request("POST", owner, fixture, ""));
  assert.equal(complete.status, 200);
  assert.deepEqual(await complete.json(), {
    ok: true,
    record: saved(owner, fixture),
  });

  const minimal = await handler(request("POST", owner, {
    weekOf: "2026-01-12",
    mood: "steady",
  }, ""));
  assert.equal(minimal.status, 200);
  assert.deepEqual(calls[1], {
    userId: owner,
    tracker: {
      weekOf: "2026-01-12",
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
  });
});

Deno.test("invalid weekly input returns 400 without persistence", async () => {
  let gets = 0;
  let upserts = 0;
  const handler = handlerFor({
    get: () => {
      gets += 1;
      return Promise.resolve(null);
    },
    upsert: () => {
      upserts += 1;
      return Promise.reject(new Error("unexpected upsert"));
    },
  });

  for (
    const query of [
      "",
      "?weekOf=bad",
      "?weekOf=2026-01-05&extra=1",
      "?weekOf=2026-01-05&weekOf=2026-01-12",
    ]
  ) {
    const response = await handler(
      request("GET", "auth0|stage9-owner", undefined, query),
    );
    assert.equal(response.status, 400, query);
  }

  for (
    const body of [
      { ...fixture, mood: "amazing" },
      { ...fixture, trackerVersion: 2 },
      { ...fixture, userID: "auth0|body-selected" },
      { ...fixture, unknown: true },
      { ...fixture, checks: { ...fixture.checks, unknown: true } },
      { ...fixture, weekOf: "2026-02-30" },
    ]
  ) {
    const response = await handler(
      request("POST", "auth0|stage9-owner", body, ""),
    );
    assert.equal(response.status, 400);
  }
  const malformed = await handler(
    new Request(
      "http://localhost/api/weekly-tracker",
      {
        method: "POST",
        headers: { authorization: "Bearer auth0|stage9-owner" },
        body: "{",
      },
    ),
  );
  assert.equal(malformed.status, 400);
  assert.equal(gets, 0);
  assert.equal(upserts, 0);
});

Deno.test("weekly routes isolate authenticated subjects", async () => {
  const records = new Map<string, WeeklyTrackerResponse>();
  const handler = handlerFor({
    get: (userId) => Promise.resolve(records.get(userId) ?? null),
    upsert: (userId, tracker) => {
      const record = saved(userId, tracker);
      records.set(userId, record);
      return Promise.resolve(record);
    },
  });

  for (const owner of ["auth0|stage9-a", "auth0|stage9-b"]) {
    assert.equal(
      (await handler(request("POST", owner, fixture, ""))).status,
      200,
    );
    const response = await handler(request("GET", owner));
    assert.deepEqual(await response.json(), {
      ok: true,
      record: saved(owner, fixture),
    });
  }

  const mismatch = await handler(request(
    "GET",
    "auth0|stage9-a",
    undefined,
    "?weekOf=2026-01-05",
    "auth0|stage9-b",
  ));
  assert.equal(mismatch.status, 403);
});
