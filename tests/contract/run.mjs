import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.CONTRACT_BASE_URL;
const accessToken = process.env.CONTRACT_ACCESS_TOKEN;
const userId = process.env.CONTRACT_USER_ID;

const contractTest = baseUrl ? test : test.skip;

async function request(path, options = {}) {
  return fetch(new URL(path, baseUrl), {
    redirect: "manual",
    ...options,
  });
}

contractTest("supported routes reject a missing bearer token", async () => {
  for (
    const path of ["/api/feelings", "/api/weekly-tracker?weekOf=2026-01-05"]
  ) {
    const response = await request(path);
    assert.equal(response.status, 401, `${path} should reject missing auth`);
  }
});

contractTest("supported routes reject a malformed bearer token", async () => {
  for (
    const path of ["/api/feelings", "/api/weekly-tracker?weekOf=2026-01-05"]
  ) {
    const response = await request(path, {
      headers: { Authorization: "Bearer not-a-jwt" },
    });
    assert.equal(response.status, 401, `${path} should reject malformed auth`);
  }
});

contractTest("unmatched ping is not an API route", async () => {
  const response = await request("/api/ping");
  assert.equal(response.status, 404);
});

contractTest("authenticated reads preserve their top-level source shapes", {
  skip: !accessToken || !userId,
}, async () => {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "x-user-id": userId,
  };

  const feelings = await request("/api/feelings", { headers });
  assert.equal(feelings.status, 200);
  const feelingsBody = await feelings.json();
  assert.ok(feelingsBody === null || Array.isArray(feelingsBody));

  const weekly = await request("/api/weekly-tracker?weekOf=2026-01-05", {
    headers,
  });
  assert.equal(weekly.status, 200);
  const weeklyBody = await weekly.json();
  assert.equal(weeklyBody.ok, true);
  assert.ok(Object.hasOwn(weeklyBody, "record"));
});
