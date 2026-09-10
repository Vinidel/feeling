import { strict as assert } from "node:assert";
import { type BackupMetadata, packBackup, unpackBackup } from "./archive.ts";

const encoder = new TextEncoder();

const metadata: BackupMetadata = {
  environment: "steady-nonprod",
  createdAt: "2026-08-25T01:02:03Z",
  postgresVersion: "17.6",
  supabaseCliVersion: "2.114.0",
  sourceRegion: "ap-southeast-2",
  destinationRegion: "ap-southeast-2",
  migrationVersions: ["20260817053317", "20260818040229"],
  counts: { feelings: 114, weeklyTrackers: 2 },
};

const components = {
  "roles.sql": encoder.encode("create role steady_runtime;"),
  "schema.sql": encoder.encode("create schema steady;"),
  "data.sql": encoder.encode("copy steady.feelings from stdin;"),
};

Deno.test("archive round trip retains only content-free manifest metadata", async () => {
  const { archive, manifest } = await packBackup(metadata, components);
  const unpacked = await unpackBackup(archive);

  assert.deepEqual(unpacked.manifest, manifest);
  assert.deepEqual(unpacked.components, components);
  const manifestText = JSON.stringify(manifest);
  assert.equal(manifestText.includes("auth0|"), false);
  assert.equal(manifestText.includes("create schema"), false);
  assert.equal(manifestText.includes("comment"), false);
});

Deno.test("archive rejects component tampering and trailing bytes", async () => {
  const { archive } = await packBackup(metadata, components);
  const tampered = archive.slice();
  tampered[tampered.length - 1] ^= 1;
  await assert.rejects(() => unpackBackup(tampered), {
    message: "data.sql checksum mismatch",
  });

  const trailing = new Uint8Array(archive.length + 1);
  trailing.set(archive);
  await assert.rejects(() => unpackBackup(trailing), {
    message: "backup archive component sizes do not match payload",
  });
});

Deno.test("manifest metadata is strictly allowlisted", async () => {
  await assert.rejects(
    () => packBackup({ ...metadata, sourceRegion: "global" }, components),
    { message: "sourceRegion is invalid" },
  );
  await assert.rejects(
    () => packBackup({ ...metadata, environment: "private/user" }, components),
    { message: "environment is invalid" },
  );
  await assert.rejects(
    () =>
      packBackup(
        { ...metadata, counts: { ...metadata.counts, feelings: -1 } },
        components,
      ),
    { message: "counts.feelings must be a non-negative integer" },
  );
});
