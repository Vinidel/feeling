import { createHandler } from "../src/app.ts";
import { createDatabase } from "../src/database.ts";
import { HttpError } from "../src/errors.ts";
import { createFeelingsService } from "../src/feelings.ts";
import { createWeeklyTrackersService } from "../src/weekly.ts";
import { runWeeklyContract } from "../../tests/contract/weekly.mjs";

const databaseUrl = Deno.env.get("DATABASE_URL");
const snapshotPath = Deno.env.get("WEEKLY_CONTRACT_SNAPSHOT");
if (!databaseUrl || !snapshotPath) {
  throw new Error("DATABASE_URL and WEEKLY_CONTRACT_SNAPSHOT are required");
}

const users = new Map([
  ["stage9-token-a", "auth0|characterization-user-a"],
  ["stage9-token-b", "auth0|characterization-user-b"],
]);
const database = createDatabase({ databaseUrl, ssl: "disable" });
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
  database,
  feelings: createFeelingsService(database),
  weeklyTrackers: createWeeklyTrackersService(database),
  deploymentVersion: "stage-10-differential",
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
  const observations = await runWeeklyContract({
    baseUrl: await address,
    accessToken: "stage9-token-a",
    otherAccessToken: "stage9-token-b",
    userId: "auth0|characterization-user-a",
    otherUserId: "auth0|characterization-user-b",
    mode: "target",
  });
  await Deno.writeTextFile(
    snapshotPath,
    `${JSON.stringify(observations, null, 2)}\n`,
    { create: true, mode: 0o600 },
  );
} finally {
  await server.shutdown();
  await database.close();
}
