import assert from "node:assert/strict";
import { decodeReportKey } from "../hashing.ts";
import { run } from "../main.ts";
import { analyzeDocuments } from "../parse.ts";
import { buildReport, exceptionManifest } from "../report.ts";

const reportKey = decodeReportKey(
  "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
);

async function fixture(path: string): Promise<unknown[]> {
  const value = JSON.parse(await Deno.readTextFile(`fixtures/${path}`));
  assert.ok(Array.isArray(value));
  return value;
}

Deno.test("valid relaxed Extended JSON is mapped with deterministic defaults", async () => {
  const analysis = await analyzeDocuments(
    await fixture("valid/feelings.json"),
    await fixture("valid/weekly_trackers.json"),
    reportKey,
  );

  assert.equal(analysis.exceptions.length, 0);
  assert.equal(analysis.feelings.length, 3);
  assert.equal(analysis.weeklyTrackers.length, 2);
  assert.equal(analysis.feelings[1].comment, "");
  assert.equal(analysis.feelings[1].activityRun, false);
  assert.equal(analysis.weeklyTrackers[1].trackerVersion, 1);
  assert.equal(analysis.weeklyTrackers[1].noteWin, "");
  assert.equal(analysis.weeklyTrackers[1].checkCardio, false);
});

Deno.test("invalid, orphaned, mixed-type, unknown, and duplicate records are all accounted for", async () => {
  const feelings = await fixture("invalid/feelings.json");
  const weekly = await fixture("invalid/weekly_trackers.json");
  const analysis = await analyzeDocuments(feelings, weekly, reportKey);

  assert.equal(analysis.feelings.length, 0);
  assert.equal(analysis.weeklyTrackers.length, 0);
  assert.equal(analysis.exceptions.length, feelings.length + weekly.length);
  assert.deepEqual(
    [...new Set(analysis.exceptions.map((item) => item.reason_code))].sort(),
    [
      "duplicate_source_id",
      "duplicate_user_week",
      "invalid_identifier",
      "invalid_type",
      "invalid_value",
      "missing_identity",
      "unknown_field",
    ],
  );
});

Deno.test("reports are repeatable and contain no identity or private text", async () => {
  const feelings = await fixture("valid/feelings.json");
  const weekly = await fixture("valid/weekly_trackers.json");
  const first = await analyzeDocuments(feelings, weekly, reportKey);
  const second = await analyzeDocuments(feelings, weekly, reportKey);
  const firstOutput = JSON.stringify({
    report: await buildReport(first, reportKey, "dry-run"),
    manifest: exceptionManifest(first.exceptions),
  });
  const secondOutput = JSON.stringify({
    report: await buildReport(second, reportKey, "dry-run"),
    manifest: exceptionManifest(second.exceptions),
  });

  assert.equal(firstOutput, secondOutput);
  for (
    const forbidden of [
      "auth0|synthetic",
      "PRIVATE-FEELING",
      "PRIVATE-WIN",
      "PRIVATE-CHALLENGE",
      "PRIVATE-NEXT",
    ]
  ) {
    assert.equal(firstOutput.includes(forbidden), false);
  }
});

Deno.test("report keys must be exactly 32 base64-decoded bytes", () => {
  assert.throws(() => decodeReportKey("not-base64"));
  assert.throws(() => decodeReportKey(btoa("short")));
});

Deno.test("only Go zero time is normalized from the ObjectId timestamp", async () => {
  const objectId = "65a000000000000000000099";
  const analysis = await analyzeDocuments(
    [
      {
        _id: { $oid: objectId },
        userid: "auth0|synthetic-normalization",
        status: "2",
        createdat: { $date: { $numberLong: "-62135596800000" } },
      },
      {
        _id: { $oid: "65a000000000000000000100" },
        userid: "auth0|synthetic-normalization",
        status: "2",
        createdat: { $date: { $numberLong: "1" } },
      },
    ],
    [],
    reportKey,
  );

  assert.equal(analysis.feelings.length, 1);
  assert.equal(
    analysis.feelings[0].createdAt,
    new Date(Number.parseInt(objectId.slice(0, 8), 16) * 1000).toISOString(),
  );
  assert.equal(analysis.exceptions[0].reason_code, "invalid_value");
  assert.deepEqual(
    analysis.transformations.map((item) => ({
      source_id: item.source_id,
      transformation_code: item.transformation_code,
      field: item.field,
    })),
    [{
      source_id: objectId,
      transformation_code: "go_zero_time_to_object_id_time",
      field: "createdat",
    }],
  );
  const report = await buildReport(analysis, reportKey, "dry-run");
  assert.deepEqual(report.transformations, {
    total: 1,
    by_code: { go_zero_time_to_object_id_time: 1 },
  });
});

Deno.test("existing output is rejected before database configuration is read", async () => {
  const directory = await Deno.makeTempDir();
  const reportPath = `${directory}/existing-report.json`;
  const exceptionsPath = `${directory}/exceptions.json`;
  await Deno.writeTextFile(reportPath, "reserved");
  Deno.env.set(
    "MIGRATION_REPORT_KEY",
    "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
  );

  try {
    await assert.rejects(() =>
      run([
        "import",
        "--feelings",
        "fixtures/valid/feelings.json",
        "--weekly-trackers",
        "fixtures/valid/weekly_trackers.json",
        "--report",
        reportPath,
        "--exceptions",
        exceptionsPath,
      ])
    );
  } finally {
    Deno.env.delete("MIGRATION_REPORT_KEY");
    await Deno.remove(directory, { recursive: true });
  }
});
