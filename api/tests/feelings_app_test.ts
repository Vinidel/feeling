import assert from "node:assert/strict";
import { createHandler } from "../src/app.ts";
import { HttpError } from "../src/errors.ts";
import type { FeelingResponse, FeelingsService } from "../src/feelings.ts";
import type { FeelingRequest } from "../src/schemas.ts";

const fixture: FeelingRequest = {
  status: "3",
  createdAt: "2026-01-02T03:04:05Z",
  comment: "synthetic feeling",
  activities: {
    bow: true,
    lift: false,
    run: true,
    cycle: false,
    swim: false,
  },
};

function responseFor(userId: string, feeling: FeelingRequest): FeelingResponse {
  return { ...feeling, userID: userId };
}

function handlerFor(feelings: FeelingsService) {
  return createHandler({
    allowedOrigins: new Set(["http://localhost:3000"]),
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
      const headerUserId = request.headers.get("x-user-id");
      if (headerUserId !== null && headerUserId !== userId) {
        throw new HttpError(
          403,
          "forbidden_identity",
          "Request identity does not match the authenticated user",
        );
      }
      return Promise.resolve({ userId });
    },
    database: { checkReadiness: () => Promise.resolve() },
    feelings,
    weeklyTrackers: {
      get: () => Promise.resolve(null),
      upsert: () => Promise.reject(new Error("unexpected weekly upsert")),
    },
    deploymentVersion: "stage-7-test",
    logger: () => undefined,
  });
}

function apiRequest(
  method: "GET" | "POST",
  userId: string,
  body?: unknown,
  headerUserId = userId,
): Request {
  return new Request("http://localhost/api/feelings", {
    method,
    headers: {
      authorization: `Bearer ${userId}`,
      "content-type": "application/json",
      "x-user-id": headerUserId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

Deno.test("GET feelings returns the service array and normalizes empty to []", async () => {
  const owner = "auth0|stage7-owner";
  const populated = [responseFor(owner, fixture)];
  let returned = populated;
  const seenUsers: string[] = [];
  const handler = handlerFor({
    list: (userId) => {
      seenUsers.push(userId);
      return Promise.resolve(returned);
    },
    create: () => Promise.reject(new Error("unexpected create")),
  });

  const response = await handler(apiRequest("GET", owner));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), populated);

  returned = [];
  const empty = await handler(apiRequest("GET", owner));
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), []);
  assert.deepEqual(seenUsers, [owner, owner]);
});

Deno.test("POST feelings supports every status and activity and inserts once", async () => {
  const owner = "auth0|stage7-owner";
  const creates: Array<{ userId: string; feeling: FeelingRequest }> = [];
  const handler = handlerFor({
    list: () => Promise.resolve([]),
    create: (userId, feeling) => {
      creates.push({ userId, feeling });
      return Promise.resolve(responseFor(userId, feeling));
    },
  });
  const activityNames = ["bow", "lift", "run", "cycle", "swim"] as const;
  const statuses = ["0", "1", "2", "3", "4"] as const;

  for (let index = 0; index < statuses.length; index += 1) {
    const activities = {
      bow: false,
      lift: false,
      run: false,
      cycle: false,
      swim: false,
    };
    activities[activityNames[index]] = true;
    const body: FeelingRequest = {
      ...fixture,
      status: statuses[index],
      activities,
    };
    const response = await handler(apiRequest("POST", owner, body));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), responseFor(owner, body));
  }

  assert.equal(creates.length, 5);
  assert.ok(creates.every(({ userId }) => userId === owner));
});

Deno.test("POST feelings applies neutral defaults without accepting identity", async () => {
  const owner = "auth0|stage7-owner";
  let captured: FeelingRequest | undefined;
  const handler = handlerFor({
    list: () => Promise.resolve([]),
    create: (userId, feeling) => {
      captured = feeling;
      return Promise.resolve(responseFor(userId, feeling));
    },
  });

  const response = await handler(apiRequest("POST", owner, {
    status: "2",
    createdAt: "2026-01-02T03:04:05Z",
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(captured, {
    status: "2",
    createdAt: "2026-01-02T03:04:05Z",
    comment: "",
    activities: {
      bow: false,
      lift: false,
      run: false,
      cycle: false,
      swim: false,
    },
  });
});

Deno.test("invalid feeling requests return 400 and never call persistence", async () => {
  let creates = 0;
  const handler = handlerFor({
    list: () => Promise.resolve([]),
    create: () => {
      creates += 1;
      return Promise.reject(new Error("unexpected create"));
    },
  });
  const invalidBodies = [
    { ...fixture, status: "5" },
    { ...fixture, createdAt: "not-a-timestamp" },
    { ...fixture, unknown: true },
    { ...fixture, userID: "auth0|body-selected" },
  ];

  for (const body of invalidBodies) {
    const response = await handler(
      apiRequest("POST", "auth0|stage7-owner", body),
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: { code: "invalid_request", message: "Request body is invalid" },
    });
  }
  const malformed = await handler(
    new Request("http://localhost/api/feelings", {
      method: "POST",
      headers: { authorization: "Bearer auth0|stage7-owner" },
      body: "{",
    }),
  );
  assert.equal(malformed.status, 400);
  assert.equal(creates, 0);
});

Deno.test("feelings routes isolate two subjects and reject header mismatch", async () => {
  const stored = new Map<string, FeelingResponse[]>();
  const handler = handlerFor({
    list: (userId) => Promise.resolve(stored.get(userId) ?? []),
    create: (userId, feeling) => {
      const saved = responseFor(userId, feeling);
      stored.set(userId, [...(stored.get(userId) ?? []), saved]);
      return Promise.resolve(saved);
    },
  });

  for (const userId of ["auth0|stage7-a", "auth0|stage7-b"]) {
    const created = await handler(apiRequest("POST", userId, fixture));
    assert.equal(created.status, 200);
    const read = await handler(apiRequest("GET", userId));
    assert.deepEqual(await read.json(), [responseFor(userId, fixture)]);
  }

  const mismatch = await handler(
    apiRequest("GET", "auth0|stage7-a", undefined, "auth0|stage7-b"),
  );
  assert.equal(mismatch.status, 403);
});
