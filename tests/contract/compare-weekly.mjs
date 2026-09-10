import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function withoutDatabaseTimestamp(envelope) {
  if (!envelope?.record) return envelope;
  return {
    ...envelope,
    record: { ...envelope.record, updatedAt: "<database timestamp>" },
  };
}

export function compareWeeklyObservations(source, target) {
  assert.equal(source.missingStatus, target.missingStatus);
  assert.equal(source.malformedStatus, target.malformedStatus);
  assert.deepEqual(source.emptyBody, target.emptyBody);
  assert.deepEqual(
    withoutDatabaseTimestamp(source.createdBody),
    withoutDatabaseTimestamp(target.createdBody),
  );
  assert.deepEqual(
    withoutDatabaseTimestamp(source.populatedBody),
    withoutDatabaseTimestamp(target.populatedBody),
  );
  assert.deepEqual(
    withoutDatabaseTimestamp(source.editedBody),
    withoutDatabaseTimestamp(target.editedBody),
  );
  assert.equal(source.mismatchStatus, target.mismatchStatus);
  assert.equal(source.invalidMoodStatus, 200);
  assert.equal(target.invalidMoodStatus, 400);
  assert.deepEqual(source.otherBody, target.otherBody);

  return {
    comparedCases: 9,
    unexplainedDifferences: 0,
    approvedNormalizations: [
      "database_generated_timestamp_instant",
      "strict_mood_validation",
    ],
  };
}

if (import.meta.main) {
  const [sourcePath, targetPath] = process.argv.slice(2);
  if (!sourcePath || !targetPath) {
    throw new Error("source and target observation paths are required");
  }
  const result = compareWeeklyObservations(
    JSON.parse(await readFile(sourcePath, "utf8")),
    JSON.parse(await readFile(targetPath, "utf8")),
  );
  console.log(
    JSON.stringify({ event: "weekly_differential_passed", ...result }),
  );
}
