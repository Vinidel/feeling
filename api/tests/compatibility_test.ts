import assert from "node:assert/strict";
import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import postgres from "postgres";
import { z } from "zod";
import { parseRuntimeConfig } from "../src/config.ts";
import { createLogRecord } from "../src/log.ts";

Deno.test("Zod strict schemas run under the pinned Deno runtime", () => {
  const schema = z.object({ status: z.enum(["0", "1", "2", "3", "4"]) })
    .strict();
  assert.deepEqual(schema.parse({ status: "3" }), { status: "3" });
  assert.equal(
    schema.safeParse({ status: "3", userID: "untrusted" }).success,
    false,
  );
});

Deno.test("JOSE signs and verifies claims and provides remote JWKS support", async () => {
  const secret = new TextEncoder().encode("stage-2-local-test-secret-32-bytes");
  const token = await new SignJWT({ sub: "auth0|characterization-user-a" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("https://issuer.example/")
    .setAudience("https://audience.example/api")
    .setExpirationTime("1h")
    .sign(secret);

  const verified = await jwtVerify(token, secret, {
    issuer: "https://issuer.example/",
    audience: "https://audience.example/api",
  });
  assert.equal(verified.payload.sub, "auth0|characterization-user-a");
  assert.equal(
    typeof createRemoteJWKSet(
      new URL("https://issuer.example/.well-known/jwks.json"),
    ),
    "function",
  );
});

Deno.test("postgres.js creates a lazy TLS-capable client without native addons or scripts", async () => {
  const sql = postgres("postgres://runtime:synthetic@127.0.0.1:5432/steady", {
    max: 1,
    prepare: false,
    ssl: "require",
  });
  assert.equal(typeof sql, "function");
  assert.equal(sql.options.prepare, false);
  assert.equal(sql.options.ssl, "require");
  await sql.end({ timeout: 0 });
});

Deno.test("runtime configuration is strict and defaults to the permitted container listener", () => {
  assert.deepEqual(parseRuntimeConfig({}), {
    deploymentVersion: "development",
    hostname: "0.0.0.0",
    port: 8080,
  });
  assert.throws(() => parseRuntimeConfig({ PORT: "0" }));
  assert.throws(() => parseRuntimeConfig({ PORT: "not-a-port" }));
  assert.throws(() => parseRuntimeConfig({ UNKNOWN: "not-allowed" }));
});

Deno.test("structured logging discards unapproved fields", () => {
  const record = createLogRecord("info", "test", {
    method: "GET",
    routeTemplate: "/healthz",
    token: "must-not-appear",
    body: "must-not-appear",
  }, "2026-01-01T00:00:00.000Z");

  assert.deepEqual(record, {
    timestamp: "2026-01-01T00:00:00.000Z",
    level: "info",
    event: "test",
    method: "GET",
    routeTemplate: "/healthz",
  });
});
