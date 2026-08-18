import { createHandler } from "./app.ts";
import { createAuth0Authenticator } from "./auth.ts";
import { readRuntimeConfig } from "./config.ts";
import { createDatabase } from "./database.ts";
import { createFeelingsService } from "./feelings.ts";
import { logEvent } from "./log.ts";
import { createWeeklyTrackersService } from "./weekly.ts";

export async function run(): Promise<void> {
  const config = readRuntimeConfig();
  const database = createDatabase({ databaseUrl: config.databaseUrl });
  const authenticate = createAuth0Authenticator({
    audience: config.auth0Audience,
    issuer: config.auth0Issuer,
  });
  const feelings = createFeelingsService(database);
  const weeklyTrackers = createWeeklyTrackersService(database);
  const server = Deno.serve(
    {
      hostname: config.hostname,
      port: config.port,
      onListen: ({ hostname, port }) => {
        logEvent("info", "server_started", {
          deploymentVersion: config.deploymentVersion,
          host: hostname,
          port,
        });
      },
    },
    createHandler({
      allowedOrigins: config.allowedOrigins,
      authenticate,
      database,
      feelings,
      weeklyTrackers,
      deploymentVersion: config.deploymentVersion,
    }),
  );

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logEvent("info", "server_shutdown_started", { signal });
    await server.shutdown();
    logEvent("info", "server_shutdown_complete", { signal });
  };

  const onSigint = () => void shutdown("SIGINT");
  const onSigterm = () => void shutdown("SIGTERM");
  Deno.addSignalListener("SIGINT", onSigint);
  if (Deno.build.os !== "windows") {
    Deno.addSignalListener("SIGTERM", onSigterm);
  }

  try {
    await server.finished;
  } finally {
    Deno.removeSignalListener("SIGINT", onSigint);
    if (Deno.build.os !== "windows") {
      Deno.removeSignalListener("SIGTERM", onSigterm);
    }
    await database.close();
  }
}

if (import.meta.main) {
  try {
    await run();
  } catch {
    logEvent("error", "startup_failed", {
      failureCode: "configuration_or_dependency",
    });
    Deno.exit(1);
  }
}
