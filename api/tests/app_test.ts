import assert from "node:assert/strict";
import { createHandler } from "../src/app.ts";
import type { LogRecord } from "../src/log.ts";

function testHandler(options: { ready?: () => Promise<void> } = {}) {
  const records: LogRecord[] = [];
  let authenticationCalls = 0;
  const handler = createHandler({
    allowedOrigins: new Set(["http://localhost:3000"]),
    authenticate: () => {
      authenticationCalls += 1;
      return Promise.resolve({ userId: "auth0|test" });
    },
    database: {
      checkReadiness: options.ready ?? (() => Promise.resolve()),
    },
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
  return { handler, records, authenticationCalls: () => authenticationCalls };
}

Deno.test("health and readiness expose only sanitized operational state", async () => {
  const { handler, records, authenticationCalls } = testHandler();

  const health = await handler(new Request("http://localhost/healthz"));
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.ok(health.headers.get("x-request-id"));
  assert.deepEqual(await health.json(), { status: "ok" });

  const readiness = await handler(new Request("http://localhost/readyz"));
  assert.equal(readiness.status, 200);
  assert.deepEqual(await readiness.json(), { status: "ready" });
  assert.equal(authenticationCalls(), 0);
  assert.equal(records.length, 2);
  assert.deepEqual(
    records.map((record) => ({
      event: record.event,
      routeTemplate: record.routeTemplate,
      status: record.status,
    })),
    [
      { event: "http_request", routeTemplate: "/healthz", status: 200 },
      { event: "http_request", routeTemplate: "/readyz", status: 200 },
    ],
  );
});

Deno.test("readiness dependency failures are sanitized", async () => {
  const privateMessage = "database secret and private note";
  const { handler, records } = testHandler({
    ready: () => Promise.reject(new Error(privateMessage)),
  });

  const response = await handler(new Request("http://localhost/readyz"));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: {
      code: "dependency_unavailable",
      message: "Service is not ready",
    },
  });
  assert.equal(JSON.stringify(records).includes(privateMessage), false);
  assert.equal(records[0].failureCode, "dependency_unavailable");
});

Deno.test("foundation still exposes no business or retired route", async () => {
  const { handler, authenticationCalls } = testHandler();

  for (
    const path of [
      "/api/feelings",
      "/api/weekly-tracker",
      "/api/chat/capabilities",
      "/api/agent/feelings",
    ]
  ) {
    const response = await handler(new Request(`http://localhost${path}`));
    assert.equal(response.status, 404, path);
    assert.deepEqual(await response.json(), {
      error: { code: "not_found", message: "Route not found" },
    });
  }
  assert.equal(authenticationCalls(), 0);
});

Deno.test("CORS permits only configured origins, methods, and headers", async () => {
  let readinessCalls = 0;
  const { handler } = testHandler({
    ready: () => {
      readinessCalls += 1;
      return Promise.resolve();
    },
  });

  const allowed = await handler(
    new Request("http://localhost/healthz", {
      headers: { origin: "http://localhost:3000" },
    }),
  );
  assert.equal(allowed.status, 200);
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "http://localhost:3000",
  );
  assert.equal(allowed.headers.has("access-control-allow-credentials"), false);

  const preflight = await handler(
    new Request("http://localhost/api/feelings", {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "POST",
        "access-control-request-headers":
          "Authorization, Content-Type, x-user-id",
      },
    }),
  );
  assert.equal(preflight.status, 204);

  for (
    const request of [
      new Request("http://localhost/readyz", {
        headers: { origin: "https://attacker.example" },
      }),
      new Request("http://localhost/api/feelings", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:3000",
          "access-control-request-method": "DELETE",
        },
      }),
      new Request("http://localhost/api/feelings", {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:3000",
          "access-control-request-method": "POST",
          "access-control-request-headers": "x-agent-token",
        },
      }),
    ]
  ) {
    const response = await handler(request);
    assert.equal(response.status, 403);
  }
  assert.equal(readinessCalls, 0);
});
