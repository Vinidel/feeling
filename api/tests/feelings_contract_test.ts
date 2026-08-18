import assert from "node:assert/strict";
import { createHandler } from "../src/app.ts";
import { HttpError } from "../src/errors.ts";
import type { FeelingResponse, FeelingsService } from "../src/feelings.ts";
import {
  feelingFixture,
  runFeelingsContract,
} from "../../tests/contract/feelings.mjs";

Deno.test("reusable feelings contract passes against the Deno HTTP boundary", async () => {
  const users = new Map([
    ["stage7-token-a", "auth0|stage7-contract-a"],
    ["stage7-token-b", "auth0|stage7-contract-b"],
  ]);
  const stored = new Map<string, FeelingResponse[]>();
  const feelings: FeelingsService = {
    list: (userId) => Promise.resolve(stored.get(userId) ?? []),
    create: (userId, feeling) => {
      const saved = { ...feeling, userID: userId };
      stored.set(userId, [saved, ...(stored.get(userId) ?? [])]);
      return Promise.resolve(saved);
    },
  };
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
    feelings,
    deploymentVersion: "stage-7-contract",
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
    await runFeelingsContract({
      baseUrl: await address,
      accessToken: "stage7-token-a",
      otherAccessToken: "stage7-token-b",
      userId: "auth0|stage7-contract-a",
      otherUserId: "auth0|stage7-contract-b",
      mode: "target",
    });
    assert.deepEqual(stored.get("auth0|stage7-contract-a"), [
      { ...feelingFixture, userID: "auth0|stage7-contract-a" },
    ]);
  } finally {
    await server.shutdown();
  }
});
