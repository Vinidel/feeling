import { createHandler } from "../src/app.ts";
import { HttpError } from "../src/errors.ts";
import type { WeeklyTrackerResponse } from "../src/weekly.ts";
import {
  runWeeklyContract,
  weeklyFixture,
} from "../../tests/contract/weekly.mjs";

Deno.test("reusable weekly contract passes against the Deno HTTP boundary", async () => {
  const users = new Map([
    ["stage9-token-a", "auth0|characterization-user-a"],
    ["stage9-token-b", "auth0|characterization-user-b"],
  ]);
  const stored = new Map<string, WeeklyTrackerResponse>();
  let timestampSequence = 0;
  const handler = createHandler({
    allowedOrigins: new Set(),
    authenticate: (request) => {
      const token = request.headers.get("authorization")?.match(
        /^Bearer (.+)$/,
      )?.[1];
      const userId = token ? users.get(token) : undefined;
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
    weeklyTrackers: {
      get: (userId, weekOf) => {
        const record = stored.get(userId);
        return Promise.resolve(record?.weekOf === weekOf ? record : null);
      },
      upsert: (userId, tracker) => {
        timestampSequence += 1;
        const record = {
          ...tracker,
          userID: userId,
          updatedAt: new Date(Date.UTC(2026, 0, 6, 7, 8, timestampSequence))
            .toISOString(),
        };
        stored.set(userId, record);
        return Promise.resolve(record);
      },
    },
    deploymentVersion: "stage-9-contract",
    logger: () => undefined,
  });

  let resolveAddress: (address: string) => void = () => undefined;
  const address = new Promise<string>((resolve) => resolveAddress = resolve);
  const server = Deno.serve({
    hostname: "127.0.0.1",
    port: 0,
    onListen: ({ hostname, port }) =>
      resolveAddress(`http://${hostname}:${port}`),
  }, handler);
  try {
    await runWeeklyContract({
      baseUrl: await address,
      accessToken: "stage9-token-a",
      otherAccessToken: "stage9-token-b",
      userId: "auth0|characterization-user-a",
      otherUserId: "auth0|characterization-user-b",
      mode: "target",
    });
  } finally {
    await server.shutdown();
  }

  if (weeklyFixture.weekOf !== "2026-01-05") {
    throw new Error("shared weekly fixture changed unexpectedly");
  }
});
