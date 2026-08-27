const MAGIC = new TextEncoder().encode("STEADYA1");
const HEADER_BYTES = 4;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });

export const COMPONENT_NAMES = [
  "roles.sql",
  "schema.sql",
  "data.sql",
] as const;

export type ComponentName = (typeof COMPONENT_NAMES)[number];

export interface BackupMetadata {
  environment: string;
  createdAt: string;
  postgresVersion: string;
  supabaseCliVersion: string;
  sourceRegion: string;
  destinationRegion: string;
  migrationVersions: string[];
  counts: {
    feelings: number;
    weeklyTrackers: number;
  };
}

export interface BackupManifest extends BackupMetadata {
  formatVersion: 1;
  components: Array<{
    name: ComponentName;
    size: number;
    sha256: string;
  }>;
}

export interface UnpackedBackup {
  manifest: BackupManifest;
  components: Record<ComponentName, Uint8Array>;
}

function concatenate(...parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(
    parts.reduce((length, part) => length + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function asObject(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  name: string,
): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new Error(`${name} contains unexpected fields`);
  }
}

function requireString(
  value: unknown,
  pattern: RegExp,
  name: string,
): string {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`${name} is invalid`);
  }
  return value;
}

function requireCount(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function validateMetadata(value: unknown): BackupMetadata {
  const metadata = asObject(value, "metadata");
  assertExactKeys(metadata, [
    "environment",
    "createdAt",
    "postgresVersion",
    "supabaseCliVersion",
    "sourceRegion",
    "destinationRegion",
    "migrationVersions",
    "counts",
  ], "metadata");

  const createdAt = requireString(
    metadata.createdAt,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
    "createdAt",
  );
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new Error("createdAt is invalid");
  }

  if (
    !Array.isArray(metadata.migrationVersions) ||
    metadata.migrationVersions.some((version) =>
      typeof version !== "string" || !/^\d{14}$/.test(version)
    )
  ) {
    throw new Error("migrationVersions must contain 14-digit versions only");
  }

  const counts = asObject(metadata.counts, "counts");
  assertExactKeys(counts, ["feelings", "weeklyTrackers"], "counts");

  return {
    environment: requireString(
      metadata.environment,
      /^[a-z0-9][a-z0-9-]{0,62}$/,
      "environment",
    ),
    createdAt,
    postgresVersion: requireString(
      metadata.postgresVersion,
      /^17(?:\.\d+){0,2}$/,
      "postgresVersion",
    ),
    supabaseCliVersion: requireString(
      metadata.supabaseCliVersion,
      /^\d+\.\d+\.\d+$/,
      "supabaseCliVersion",
    ),
    sourceRegion: requireString(
      metadata.sourceRegion,
      /^ap-southeast-2$/,
      "sourceRegion",
    ),
    destinationRegion: requireString(
      metadata.destinationRegion,
      /^ap-southeast-2$/,
      "destinationRegion",
    ),
    migrationVersions: [...metadata.migrationVersions] as string[],
    counts: {
      feelings: requireCount(counts.feelings, "counts.feelings"),
      weeklyTrackers: requireCount(
        counts.weeklyTrackers,
        "counts.weeklyTrackers",
      ),
    },
  };
}

export async function sha256Hex(value: Uint8Array): Promise<string> {
  const input = new Uint8Array(value.length);
  input.set(value);
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", input.buffer),
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validateManifest(value: unknown): BackupManifest {
  const manifest = asObject(value, "manifest");
  assertExactKeys(manifest, [
    "formatVersion",
    "environment",
    "createdAt",
    "postgresVersion",
    "supabaseCliVersion",
    "sourceRegion",
    "destinationRegion",
    "migrationVersions",
    "counts",
    "components",
  ], "manifest");
  if (manifest.formatVersion !== 1) {
    throw new Error("unsupported archive version");
  }

  const metadata = validateMetadata({
    environment: manifest.environment,
    createdAt: manifest.createdAt,
    postgresVersion: manifest.postgresVersion,
    supabaseCliVersion: manifest.supabaseCliVersion,
    sourceRegion: manifest.sourceRegion,
    destinationRegion: manifest.destinationRegion,
    migrationVersions: manifest.migrationVersions,
    counts: manifest.counts,
  });

  if (
    !Array.isArray(manifest.components) ||
    manifest.components.length !== COMPONENT_NAMES.length
  ) {
    throw new Error("archive must contain exactly three SQL components");
  }

  const components = manifest.components.map((value, index) => {
    const component = asObject(value, `components[${index}]`);
    assertExactKeys(
      component,
      ["name", "size", "sha256"],
      `components[${index}]`,
    );
    if (component.name !== COMPONENT_NAMES[index]) {
      throw new Error("archive component names or order are invalid");
    }
    return {
      name: component.name,
      size: requireCount(component.size, `components[${index}].size`),
      sha256: requireString(
        component.sha256,
        /^[a-f0-9]{64}$/,
        `components[${index}].sha256`,
      ),
    } as BackupManifest["components"][number];
  });

  return { formatVersion: 1, ...metadata, components };
}

export async function packBackup(
  metadataValue: BackupMetadata,
  componentValues: Record<ComponentName, Uint8Array>,
): Promise<{ archive: Uint8Array; manifest: BackupManifest }> {
  const metadata = validateMetadata(metadataValue);
  const components = await Promise.all(COMPONENT_NAMES.map(async (name) => {
    const value = componentValues[name];
    if (!(value instanceof Uint8Array) || value.length === 0) {
      throw new Error(`${name} must be a non-empty byte sequence`);
    }
    return { name, size: value.length, sha256: await sha256Hex(value) };
  }));
  const manifest: BackupManifest = {
    formatVersion: 1,
    ...metadata,
    components,
  };
  const header = encoder.encode(JSON.stringify(manifest));
  const headerSize = new Uint8Array(HEADER_BYTES);
  new DataView(headerSize.buffer).setUint32(0, header.length, false);
  return {
    archive: concatenate(
      MAGIC,
      headerSize,
      header,
      ...COMPONENT_NAMES.map((name) => componentValues[name]),
    ),
    manifest,
  };
}

export async function unpackBackup(
  archive: Uint8Array,
): Promise<UnpackedBackup> {
  if (archive.length < MAGIC.length + HEADER_BYTES) {
    throw new Error("backup archive is truncated");
  }
  if (
    await sha256Hex(archive.subarray(0, MAGIC.length)) !==
      await sha256Hex(MAGIC)
  ) {
    throw new Error("invalid backup archive format");
  }

  const headerSize = new DataView(
    archive.buffer,
    archive.byteOffset + MAGIC.length,
    HEADER_BYTES,
  ).getUint32(0, false);
  const headerStart = MAGIC.length + HEADER_BYTES;
  const headerEnd = headerStart + headerSize;
  if (headerSize === 0 || headerEnd > archive.length) {
    throw new Error("backup archive header is truncated");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(
      decoder.decode(archive.subarray(headerStart, headerEnd)),
    );
  } catch {
    throw new Error("backup archive manifest is invalid JSON");
  }
  const manifest = validateManifest(parsed);
  const expectedLength = headerEnd + manifest.components.reduce(
    (length, component) => length + component.size,
    0,
  );
  if (archive.length !== expectedLength) {
    throw new Error("backup archive component sizes do not match payload");
  }

  let offset = headerEnd;
  const components = {} as Record<ComponentName, Uint8Array>;
  for (const component of manifest.components) {
    const value = archive.slice(offset, offset + component.size);
    if (await sha256Hex(value) !== component.sha256) {
      throw new Error(`${component.name} checksum mismatch`);
    }
    components[component.name] = value;
    offset += component.size;
  }
  return { manifest, components };
}
