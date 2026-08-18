import assert from "node:assert/strict";

export const weeklyFixture = {
  weekOf: "2026-01-05",
  mood: "good",
  trackerVersion: 1,
  checks: {
    cardio: true,
    strength: true,
    mobility: false,
    build: false,
    archery: false,
    hunt: false,
  },
  notes: {
    win: "synthetic win",
    challenge: "synthetic challenge",
    nextWeek: "synthetic focus",
  },
};

export async function runWeeklyContract({
  baseUrl,
  accessToken,
  otherAccessToken,
  userId,
  otherUserId,
  mode,
}) {
  const endpoint = new URL("/api/weekly-tracker", baseUrl);
  const headers = (token, subject) => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-user-id": subject,
  });
  const request = (options = {}, weekOf = weeklyFixture.weekOf) => {
    const url = new URL(endpoint);
    if (options.method !== "POST") url.searchParams.set("weekOf", weekOf);
    return fetch(url, { redirect: "manual", ...options });
  };
  const observations = {};

  observations.missingStatus = (await request()).status;
  assert.equal(observations.missingStatus, 401);
  observations.malformedStatus = (await request({
    headers: { authorization: "Bearer not-a-token" },
  })).status;
  assert.equal(observations.malformedStatus, 401);

  const empty = await request({ headers: headers(accessToken, userId) });
  assert.equal(empty.status, 200);
  observations.emptyBody = await empty.json();
  assert.deepEqual(observations.emptyBody, { ok: true, record: null });

  const created = await request({
    method: "POST",
    headers: headers(accessToken, userId),
    body: JSON.stringify(weeklyFixture),
  });
  assert.equal(created.status, 200);
  observations.createdBody = await created.json();
  assert.equal(observations.createdBody.ok, true);
  assert.deepEqual(
    {
      ...observations.createdBody.record,
      updatedAt: "<database timestamp>",
    },
    { ...weeklyFixture, userID: userId, updatedAt: "<database timestamp>" },
  );
  assert.ok(
    !Number.isNaN(Date.parse(observations.createdBody.record.updatedAt)),
  );

  const populated = await request({ headers: headers(accessToken, userId) });
  assert.equal(populated.status, 200);
  observations.populatedBody = await populated.json();
  assert.equal(observations.populatedBody.record.userID, userId);
  assert.deepEqual(
    { ...observations.populatedBody.record, updatedAt: "<database timestamp>" },
    { ...weeklyFixture, userID: userId, updatedAt: "<database timestamp>" },
  );

  const editedFixture = {
    ...weeklyFixture,
    mood: "great",
    checks: { ...weeklyFixture.checks, mobility: true },
    notes: { ...weeklyFixture.notes, nextWeek: "edited synthetic focus" },
  };
  const edited = await request({
    method: "POST",
    headers: headers(accessToken, userId),
    body: JSON.stringify(editedFixture),
  });
  assert.equal(edited.status, 200);
  observations.editedBody = await edited.json();
  assert.deepEqual(
    { ...observations.editedBody.record, updatedAt: "<database timestamp>" },
    { ...editedFixture, userID: userId, updatedAt: "<database timestamp>" },
  );

  const mismatch = await request({
    headers: headers(accessToken, otherUserId),
  });
  observations.mismatchStatus = mismatch.status;
  assert.equal(observations.mismatchStatus, 403);

  const invalid = await request({
    method: "POST",
    headers: headers(accessToken, userId),
    body: JSON.stringify({ ...weeklyFixture, mood: "amazing" }),
  });
  observations.invalidMoodStatus = invalid.status;
  assert.equal(observations.invalidMoodStatus, mode === "source" ? 200 : 400);

  const other = await request({
    headers: headers(otherAccessToken, otherUserId),
  });
  assert.equal(other.status, 200);
  observations.otherBody = await other.json();
  assert.deepEqual(observations.otherBody, { ok: true, record: null });
  return observations;
}

if (import.meta.main) {
  await runWeeklyContract({
    baseUrl: process.env.CONTRACT_BASE_URL,
    accessToken: process.env.CONTRACT_ACCESS_TOKEN,
    otherAccessToken: process.env.CONTRACT_OTHER_ACCESS_TOKEN,
    userId: process.env.CONTRACT_USER_ID,
    otherUserId: process.env.CONTRACT_OTHER_USER_ID,
    mode: process.env.CONTRACT_MODE,
  });
}
