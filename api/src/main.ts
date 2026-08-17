import { createHandler } from "./app.ts";
import { readRuntimeConfig } from "./config.ts";
import { logEvent } from "./log.ts";

export async function run(): Promise<void> {
  const config = readRuntimeConfig();
  const server = Deno.serve({
    hostname: config.hostname,
    port: config.port,
    onListen: ({ hostname, port }) => {
      logEvent("info", "server_started", {
        deploymentVersion: config.deploymentVersion,
        host: hostname,
        port,
      });
    },
  }, createHandler({ deploymentVersion: config.deploymentVersion }));

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
  }
}

if (import.meta.main) {
  await run();
}
