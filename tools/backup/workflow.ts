import { decodeEncryptionKey, decryptBytes, encryptBytes } from "./crypto.ts";
import {
  type BackupMetadata,
  COMPONENT_NAMES,
  packBackup,
  sha256Hex,
  unpackBackup,
} from "./archive.ts";

type EnvironmentReader = { get(name: string): string | undefined };

function required(env: EnvironmentReader, name: string): string {
  const value = env.get(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function count(env: EnvironmentReader, name: string): number {
  const value = required(env, name);
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${name} is too large`);
  return parsed;
}

function metadataFromEnvironment(env: EnvironmentReader): BackupMetadata {
  return {
    environment: required(env, "BACKUP_ENVIRONMENT"),
    createdAt: required(env, "BACKUP_CREATED_AT"),
    postgresVersion: required(env, "BACKUP_POSTGRES_VERSION"),
    supabaseCliVersion: required(env, "BACKUP_SUPABASE_CLI_VERSION"),
    sourceRegion: required(env, "BACKUP_SOURCE_REGION"),
    destinationRegion: required(env, "BACKUP_DESTINATION_REGION"),
    migrationVersions: required(env, "BACKUP_MIGRATION_VERSIONS").split(",")
      .filter(Boolean),
    counts: {
      feelings: count(env, "BACKUP_FEELINGS_COUNT"),
      weeklyTrackers: count(env, "BACKUP_WEEKLY_TRACKER_COUNT"),
    },
  };
}

async function writeNew(path: string, value: Uint8Array): Promise<void> {
  await Deno.writeFile(path, value, { createNew: true, mode: 0o600 });
}

export async function run(
  args: string[],
  env: EnvironmentReader = Deno.env,
  emit: (line: string) => void = console.log,
): Promise<void> {
  const [operation, ...paths] = args;
  const key = decodeEncryptionKey(required(env, "BACKUP_ENCRYPTION_KEY"));

  if (operation === "pack") {
    if (paths.length !== 4) {
      throw new Error(
        "usage: workflow.ts pack <roles.sql> <schema.sql> <data.sql> <encrypted-output>",
      );
    }
    const [rolesPath, schemaPath, dataPath, outputPath] = paths;
    const [roles, schema, data] = await Promise.all([
      Deno.readFile(rolesPath),
      Deno.readFile(schemaPath),
      Deno.readFile(dataPath),
    ]);
    const { archive, manifest } = await packBackup(
      metadataFromEnvironment(env),
      { "roles.sql": roles, "schema.sql": schema, "data.sql": data },
    );
    const encrypted = await encryptBytes(archive, key);
    await writeNew(outputPath, encrypted);
    emit(JSON.stringify({
      operation: "pack",
      ciphertextSize: encrypted.length,
      ciphertextSha256: await sha256Hex(encrypted),
      manifest,
    }));
    return;
  }

  if (operation === "verify") {
    if (paths.length !== 2) {
      throw new Error(
        "usage: workflow.ts verify <encrypted-input> <new-output-directory>",
      );
    }
    const [inputPath, outputDirectory] = paths;
    const encrypted = await Deno.readFile(inputPath);
    const archive = await decryptBytes(encrypted, key);
    const { manifest, components } = await unpackBackup(archive);
    await Deno.mkdir(outputDirectory, { mode: 0o700 });
    try {
      for (const name of COMPONENT_NAMES) {
        await writeNew(`${outputDirectory}/${name}`, components[name]);
      }
      await writeNew(
        `${outputDirectory}/manifest.json`,
        new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`),
      );
    } catch (error) {
      await Deno.remove(outputDirectory, { recursive: true });
      throw error;
    }
    emit(JSON.stringify({
      operation: "verify",
      ciphertextSize: encrypted.length,
      ciphertextSha256: await sha256Hex(encrypted),
      manifest,
    }));
    return;
  }

  throw new Error("operation must be pack or verify");
}

if (import.meta.main) await run(Deno.args);
