import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function normalizeEmpty(value) {
  return value === null ? [] : value;
}

function normalizeFeeling(value) {
  return { ...value, createdAt: new Date(value.createdAt).toISOString() };
}

export function compareFeelingsObservations(source, target) {
  assert.equal(source.missingStatus, target.missingStatus);
  assert.equal(source.malformedStatus, target.malformedStatus);
  assert.deepEqual(normalizeEmpty(source.emptyBody), target.emptyBody);
  assert.deepEqual(normalizeFeeling(source.savedBody), target.savedBody);
  assert.deepEqual(
    source.historyBody.map(normalizeFeeling),
    target.historyBody,
  );
  assert.equal(source.mismatchStatus, target.mismatchStatus);
  assert.equal(source.invalidStatus, 200);
  assert.equal(target.invalidStatus, 400);
  assert.deepEqual(normalizeEmpty(source.otherBody), target.otherBody);

  return {
    comparedCases: 8,
    unexplainedDifferences: 0,
    approvedNormalizations: [
      "empty_history_null_to_array",
      "canonical_rfc3339_timestamp",
      "strict_status_validation",
    ],
  };
}

if (import.meta.main) {
  const [sourcePath, targetPath] = process.argv.slice(2);
  if (!sourcePath || !targetPath) {
    throw new Error("source and target observation paths are required");
  }
  const result = compareFeelingsObservations(
    JSON.parse(await readFile(sourcePath, "utf8")),
    JSON.parse(await readFile(targetPath, "utf8")),
  );
  console.log(
    JSON.stringify({ event: "feelings_differential_passed", ...result }),
  );
}
