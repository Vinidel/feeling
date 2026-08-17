import assert from "node:assert/strict";
import { createHandler } from "../src/app.ts";
import type { LogRecord } from "../src/log.ts";

Deno.test("health endpoint is unprivileged and emits a sanitized request record", async () => {
  const records: LogRecord[] = [];
  const handler = createHandler({
    deploymentVersion: "test-version",
    logger: (level, event, fields) => {
      records.push({
        timestamp: "2026-01-01T00:00:00.000Z",
        level,
        event,
        ...fields,
      });
    },
  });

  const response = handler(new Request("http://localhost/healthz"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { status: "ok" });
  assert.equal(records.length, 1);
  assert.equal(records[0].event, "http_request");
  assert.equal(records[0].routeTemplate, "/healthz");
  assert.equal(records[0].status, 200);
});

Deno.test("foundation exposes no business route", async () => {
  const handler = createHandler({
    deploymentVersion: "test-version",
    logger: () => undefined,
  });

  for (
    const path of [
      "/api/feelings",
      "/api/weekly-tracker",
      "/api/chat/capabilities",
      "/api/agent/feelings",
    ]
  ) {
    const response = handler(new Request(`http://localhost${path}`));
    assert.equal(response.status, 404, path);
    assert.deepEqual(await response.json(), {
      error: { code: "not_found", message: "Route not found" },
    });
  }
});
