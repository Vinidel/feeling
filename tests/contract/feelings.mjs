import assert from 'node:assert/strict';

export const feelingFixture = {
  status: '3',
  createdAt: '2026-01-02T03:04:05Z',
  comment: 'synthetic feeling',
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
  const request = (options = {}) => fetch(new URL('/api/feelings', baseUrl), {
    redirect: 'manual',
    ...options,
  });
  const headers = (token, subject) => ({
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'x-user-id': subject,
  });

  assert.equal((await request()).status, 401);
  assert.equal((await request({
    headers: { authorization: 'Bearer not-a-token' },
  })).status, 401);

  const empty = await request({ headers: headers(accessToken, userId) });
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), mode === 'source' ? null : []);

  const saved = await request({
    method: 'POST',
    headers: headers(accessToken, userId),
    body: JSON.stringify(feelingFixture),
  });
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), { ...feelingFixture, userID: userId });

  const history = await request({ headers: headers(accessToken, userId) });
  assert.equal(history.status, 200);
  assert.deepEqual(await history.json(), [{ ...feelingFixture, userID: userId }]);

  const mismatch = await request({
    headers: headers(accessToken, otherUserId),
  });
  assert.equal(mismatch.status, 403);

  const invalid = await request({
    method: 'POST',
    headers: headers(accessToken, userId),
    body: JSON.stringify({ ...feelingFixture, status: '5' }),
  });
  assert.equal(invalid.status, mode === 'source' ? 200 : 400);

  const otherHistory = await request({
    headers: headers(otherAccessToken, otherUserId),
  });
  assert.equal(otherHistory.status, 200);
  const otherBody = await otherHistory.json();
  assert.ok(otherBody === null || Array.isArray(otherBody));
  assert.equal(otherBody?.some((feeling) => feeling.userID === userId) ?? false, false);
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
