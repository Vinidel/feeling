import assert from "node:assert/strict";

export const feelingFixture = {
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

export async function runFeelingsContract({
  baseUrl,
  accessToken,
  otherAccessToken,
  userId,
  otherUserId,
  mode,
}) {
  const observations = {};
  const expectedFeeling = {
    ...feelingFixture,
    createdAt: mode === "target"
      ? new Date(feelingFixture.createdAt).toISOString()
      : feelingFixture.createdAt,
    userID: userId,
  };
  const request = (options = {}) =>
    fetch(new URL("/api/feelings", baseUrl), {
      redirect: "manual",
      ...options,
    });
  const headers = (token, subject) => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-user-id": subject,
  });

  observations.missingStatus = (await request()).status;
  assert.equal(observations.missingStatus, 401);
  observations.malformedStatus = (await request({
    headers: { authorization: "Bearer not-a-token" },
  })).status;
  assert.equal(observations.malformedStatus, 401);

  const empty = await request({ headers: headers(accessToken, userId) });
  assert.equal(empty.status, 200);
  observations.emptyBody = await empty.json();
  assert.deepEqual(observations.emptyBody, mode === "source" ? null : []);

  const saved = await request({
    method: "POST",
    headers: headers(accessToken, userId),
    body: JSON.stringify(feelingFixture),
  });
  assert.equal(saved.status, 200);
  observations.savedBody = await saved.json();
  assert.deepEqual(observations.savedBody, expectedFeeling);

  const history = await request({ headers: headers(accessToken, userId) });
  assert.equal(history.status, 200);
  observations.historyBody = await history.json();
  assert.deepEqual(observations.historyBody, [expectedFeeling]);

  const mismatch = await request({
    headers: headers(accessToken, otherUserId),
  });
  observations.mismatchStatus = mismatch.status;
  assert.equal(observations.mismatchStatus, 403);

  const invalid = await request({
    method: "POST",
    headers: headers(accessToken, userId),
    body: JSON.stringify({ ...feelingFixture, status: "5" }),
  });
  observations.invalidStatus = invalid.status;
  assert.equal(observations.invalidStatus, mode === "source" ? 200 : 400);

  const otherHistory = await request({
    headers: headers(otherAccessToken, otherUserId),
  });
  assert.equal(otherHistory.status, 200);
  observations.otherBody = await otherHistory.json();
  assert.ok(
    observations.otherBody === null || Array.isArray(observations.otherBody),
  );
  assert.equal(
    observations.otherBody?.some((feeling) => feeling.userID === userId) ??
      false,
    false,
  );
  return observations;
}

if (import.meta.main) {
  await runFeelingsContract({
    baseUrl: process.env.CONTRACT_BASE_URL,
    accessToken: process.env.CONTRACT_ACCESS_TOKEN,
    otherAccessToken: process.env.CONTRACT_OTHER_ACCESS_TOKEN,
    userId: process.env.CONTRACT_USER_ID,
    otherUserId: process.env.CONTRACT_OTHER_USER_ID,
    mode: process.env.CONTRACT_MODE,
  });
}
