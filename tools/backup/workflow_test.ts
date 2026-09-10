import { strict as assert } from "node:assert";
import { run } from "./workflow.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function environment(): Map<string, string> {
  return new Map([
    ["BACKUP_ENCRYPTION_KEY", btoa("k".repeat(32))],
    ["BACKUP_ENVIRONMENT", "steady-nonprod"],
    ["BACKUP_CREATED_AT", "2026-08-25T01:02:03Z"],
    ["BACKUP_POSTGRES_VERSION", "17.6"],
    ["BACKUP_SUPABASE_CLI_VERSION", "2.114.0"],
    ["BACKUP_SOURCE_REGION", "ap-southeast-2"],
    ["BACKUP_DESTINATION_REGION", "ap-southeast-2"],
    ["BACKUP_MIGRATION_VERSIONS", "20260817053317,20260818040229"],
    ["BACKUP_FEELINGS_COUNT", "114"],
    ["BACKUP_WEEKLY_TRACKER_COUNT", "2"],
  ]);
}

Deno.test("workflow packs encrypted-only output and verifies into a new directory", async () => {
  const root = await Deno.makeTempDir();
  try {
    const roles = `${root}/roles.sql`;
    const schema = `${root}/schema.sql`;
    const data = `${root}/data.sql`;
    const encrypted = `${root}/backup.steady.enc`;
    const restored = `${root}/restored`;
    const privateMarker = "synthetic private backup content auth0|fixture";
    await Promise.all([
      Deno.writeTextFile(roles, "create role test;"),
      Deno.writeTextFile(schema, "create schema steady;"),
      Deno.writeTextFile(data, privateMarker),
    ]);

    const packOutput: string[] = [];
    await run(
      ["pack", roles, schema, data, encrypted],
      environment(),
      (line) => packOutput.push(line),
    );
    const ciphertext = await Deno.readFile(encrypted);
    assert.equal(decoder.decode(ciphertext).includes(privateMarker), false);
    assert.equal(packOutput.join("\n").includes(privateMarker), false);
    assert.equal(packOutput.join("\n").includes("auth0|"), false);

    const verifyOutput: string[] = [];
    await run(
      ["verify", encrypted, restored],
      environment(),
      (line) => verifyOutput.push(line),
    );
    assert.equal(
      await Deno.readTextFile(`${restored}/data.sql`),
      privateMarker,
    );
    assert.equal(verifyOutput.join("\n").includes(privateMarker), false);
    const manifest = JSON.parse(
      await Deno.readTextFile(`${restored}/manifest.json`),
    );
    assert.deepEqual(manifest.counts, { feelings: 114, weeklyTrackers: 2 });
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("workflow will not overwrite ciphertext or a restore directory", async () => {
  const root = await Deno.makeTempDir();
  try {
    const paths = ["roles.sql", "schema.sql", "data.sql"].map((name) =>
      `${root}/${name}`
    );
    await Promise.all(
      paths.map((path) => Deno.writeFile(path, encoder.encode("x"))),
    );
    const encrypted = `${root}/backup.enc`;
    await run(["pack", ...paths, encrypted], environment(), () => {});
    await assert.rejects(
      () => run(["pack", ...paths, encrypted], environment(), () => {}),
      Deno.errors.AlreadyExists,
    );
    const restored = `${root}/restored`;
    await Deno.mkdir(restored);
    await assert.rejects(
      () => run(["verify", encrypted, restored], environment(), () => {}),
      Deno.errors.AlreadyExists,
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});
