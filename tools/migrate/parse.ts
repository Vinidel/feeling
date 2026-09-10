import { keyedHash } from "./hashing.ts";
import type {
  CollectionName,
  FeelingRecord,
  MigrationAnalysis,
  SourceException,
  WeeklyTrackerRecord,
} from "./types.ts";

type UnknownRecord = Record<string, unknown>;

class RecordIssue extends Error {
  constructor(
    readonly reasonCode: SourceException["reason_code"],
    readonly field?: string,
  ) {
    super(reasonCode);
  }
}

function asRecord(value: unknown, field?: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RecordIssue("invalid_type", field);
  }
  return value as UnknownRecord;
}

function rejectUnknownFields(
  record: UnknownRecord,
  allowed: readonly string[],
  prefix = "",
): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(record).sort().find((key) =>
    !allowedSet.has(key)
  );
  if (unknown) {
    throw new RecordIssue("unknown_field", `${prefix}${unknown}`);
  }
}

function parseObjectId(value: unknown): string {
  const objectId = asRecord(value, "_id");
  rejectUnknownFields(objectId, ["$oid"], "_id.");
  if (
    typeof objectId.$oid !== "string" ||
    !/^[0-9a-f]{24}$/i.test(objectId.$oid)
  ) {
    throw new RecordIssue("invalid_identifier", "_id");
  }
  return objectId.$oid.toLowerCase();
}

function parseIdentity(value: unknown): string {
  if (typeof value !== "string") {
    throw new RecordIssue("invalid_type", "userid");
  }
  if (value.trim() === "") {
    throw new RecordIssue("missing_identity", "userid");
  }
  return value;
}

function parseExtendedDate(value: unknown, field: string): string {
  const dateObject = asRecord(value, field);
  rejectUnknownFields(dateObject, ["$date"], `${field}.`);
  if (typeof dateObject.$date !== "string") {
    throw new RecordIssue("invalid_type", field);
  }

  const date = new Date(dateObject.$date);
  if (Number.isNaN(date.getTime())) {
    throw new RecordIssue("invalid_value", field);
  }
  return date.toISOString();
}

function parseFeelingCreatedAt(
  value: unknown,
  legacyMongoId: string,
): { value: string; normalizedGoZero: boolean } {
  const dateObject = asRecord(value, "createdat");
  rejectUnknownFields(dateObject, ["$date"], "createdat.");

  if (typeof dateObject.$date === "string") {
    return {
      value: parseExtendedDate(value, "createdat"),
      normalizedGoZero: false,
    };
  }

  const canonicalDate = asRecord(dateObject.$date, "createdat");
  rejectUnknownFields(canonicalDate, ["$numberLong"], "createdat.$date.");
  if (canonicalDate.$numberLong !== "-62135596800000") {
    throw new RecordIssue(
      typeof canonicalDate.$numberLong === "string"
        ? "invalid_value"
        : "invalid_type",
      "createdat",
    );
  }

  const objectIdSeconds = Number.parseInt(legacyMongoId.slice(0, 8), 16);
  return {
    value: new Date(objectIdSeconds * 1000).toISOString(),
    normalizedGoZero: true,
  };
}

function parseBooleanObject<T extends readonly string[]>(
  value: unknown,
  field: string,
  keys: T,
): Record<T[number], boolean> {
  if (value === undefined) {
    return Object.fromEntries(keys.map((key) => [key, false])) as Record<
      T[number],
      boolean
    >;
  }

  const record = asRecord(value, field);
  rejectUnknownFields(record, keys, `${field}.`);
  const parsed: Record<string, boolean> = {};

  for (const key of keys) {
    const item = record[key];
    if (item !== undefined && typeof item !== "boolean") {
      throw new RecordIssue("invalid_type", `${field}.${key}`);
    }
    parsed[key] = item ?? false;
  }

  return parsed as Record<T[number], boolean>;
}

function parseTextObject<T extends readonly string[]>(
  value: unknown,
  field: string,
  keys: T,
): Record<T[number], string> {
  if (value === undefined) {
    return Object.fromEntries(keys.map((key) => [key, ""])) as Record<
      T[number],
      string
    >;
  }

  const record = asRecord(value, field);
  rejectUnknownFields(record, keys, `${field}.`);
  const parsed: Record<string, string> = {};

  for (const key of keys) {
    const item = record[key];
    if (item !== undefined && typeof item !== "string") {
      throw new RecordIssue("invalid_type", `${field}.${key}`);
    }
    parsed[key] = item ?? "";
  }

  return parsed as Record<T[number], string>;
}

function parseWeekOf(value: unknown): string {
  if (typeof value !== "string") {
    throw new RecordIssue("invalid_type", "weekof");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RecordIssue("invalid_value", "weekof");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
  ) {
    throw new RecordIssue("invalid_value", "weekof");
  }
  return value;
}

async function parseFeeling(
  value: unknown,
  reportKey: Uint8Array,
): Promise<FeelingRecord> {
  const record = asRecord(value);
  const legacyMongoId = parseObjectId(record._id);
  const userId = parseIdentity(record.userid);
  const userHash = await keyedHash(reportKey, `user:${userId}`);

  rejectUnknownFields(record, [
    "_id",
    "activities",
    "status",
    "createdat",
    "comment",
    "userid",
  ]);

  if (typeof record.status !== "string") {
    throw new RecordIssue("invalid_type", "status");
  }
  if (!/^[0-4]$/.test(record.status)) {
    throw new RecordIssue("invalid_value", "status");
  }
  if (record.comment !== undefined && typeof record.comment !== "string") {
    throw new RecordIssue("invalid_type", "comment");
  }

  const activities = parseBooleanObject(
    record.activities,
    "activities",
    [
      "bow",
      "lift",
      "run",
      "cycle",
      "swim",
    ] as const,
  );
  const createdAt = parseFeelingCreatedAt(record.createdat, legacyMongoId);

  return {
    legacyMongoId,
    userId,
    userHash,
    status: Number(record.status),
    createdAt: createdAt.value,
    comment: record.comment ?? "",
    activityBow: activities.bow,
    activityLift: activities.lift,
    activityRun: activities.run,
    activityCycle: activities.cycle,
    activitySwim: activities.swim,
    ...(createdAt.normalizedGoZero
      ? { createdAtNormalization: "go_zero_time_to_object_id_time" as const }
      : {}),
  };
}

async function parseWeeklyTracker(
  value: unknown,
  reportKey: Uint8Array,
): Promise<WeeklyTrackerRecord> {
  const record = asRecord(value);
  const legacyMongoId = parseObjectId(record._id);
  const userId = parseIdentity(record.userid);
  const userHash = await keyedHash(reportKey, `user:${userId}`);

  rejectUnknownFields(record, [
    "_id",
    "weekof",
    "mood",
    "trackerVersion",
    "checks",
    "notes",
    "userid",
    "updatedat",
  ]);

  const moods = ["rough", "low", "steady", "good", "great"] as const;
  if (
    typeof record.mood !== "string" ||
    !moods.includes(record.mood as (typeof moods)[number])
  ) {
    throw new RecordIssue(
      typeof record.mood === "string" ? "invalid_value" : "invalid_type",
      "mood",
    );
  }
  if (
    record.trackerVersion !== undefined &&
    (typeof record.trackerVersion !== "number" ||
      !Number.isInteger(record.trackerVersion))
  ) {
    throw new RecordIssue("invalid_type", "trackerVersion");
  }
  if (record.trackerVersion !== undefined && record.trackerVersion !== 1) {
    throw new RecordIssue("invalid_value", "trackerVersion");
  }

  const checks = parseBooleanObject(
    record.checks,
    "checks",
    [
      "cardio",
      "strength",
      "mobility",
      "build",
      "archery",
      "hunt",
    ] as const,
  );
  const notes = parseTextObject(
    record.notes,
    "notes",
    [
      "win",
      "challenge",
      "nextWeek",
    ] as const,
  );

  return {
    legacyMongoId,
    userId,
    userHash,
    weekOf: parseWeekOf(record.weekof),
    mood: record.mood as WeeklyTrackerRecord["mood"],
    trackerVersion: 1,
    checkCardio: checks.cardio,
    checkStrength: checks.strength,
    checkMobility: checks.mobility,
    checkBuild: checks.build,
    checkArchery: checks.archery,
    checkHunt: checks.hunt,
    noteWin: notes.win,
    noteChallenge: notes.challenge,
    noteNextWeek: notes.nextWeek,
    updatedAt: parseExtendedDate(record.updatedat, "updatedat"),
  };
}

function sourceIdForException(value: unknown, index: number): string {
  try {
    return parseObjectId(asRecord(value)._id);
  } catch {
    return `record-${String(index + 1).padStart(6, "0")}`;
  }
}

async function userHashForException(
  value: unknown,
  reportKey: Uint8Array,
): Promise<string | undefined> {
  try {
    const userId = parseIdentity(asRecord(value).userid);
    return await keyedHash(reportKey, `user:${userId}`);
  } catch {
    return undefined;
  }
}

async function parseCollection<T>(
  collection: CollectionName,
  values: unknown[],
  reportKey: Uint8Array,
  parse: (value: unknown, reportKey: Uint8Array) => Promise<T>,
): Promise<{ records: T[]; exceptions: SourceException[] }> {
  const records: T[] = [];
  const exceptions: SourceException[] = [];

  for (let index = 0; index < values.length; index += 1) {
    try {
      records.push(await parse(values[index], reportKey));
    } catch (error) {
      if (!(error instanceof RecordIssue)) throw error;
      exceptions.push({
        collection,
        source_id: sourceIdForException(values[index], index),
        user_hash: await userHashForException(values[index], reportKey),
        reason_code: error.reasonCode,
        field: error.field,
      });
    }
  }

  return { records, exceptions };
}

function rejectDuplicateIds<
  T extends { legacyMongoId: string; userHash: string },
>(
  collection: CollectionName,
  records: T[],
): { records: T[]; exceptions: SourceException[] } {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(
      record.legacyMongoId,
      (counts.get(record.legacyMongoId) ?? 0) + 1,
    );
  }

  const duplicates = new Set(
    [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id),
  );

  return {
    records: records.filter((record) => !duplicates.has(record.legacyMongoId)),
    exceptions: records.filter((record) => duplicates.has(record.legacyMongoId))
      .map((record) => ({
        collection,
        source_id: record.legacyMongoId,
        user_hash: record.userHash,
        reason_code: "duplicate_source_id",
        field: "_id",
      })),
  };
}

function rejectDuplicateWeeks(records: WeeklyTrackerRecord[]): {
  records: WeeklyTrackerRecord[];
  exceptions: SourceException[];
} {
  const keys = new Map<string, number>();
  for (const record of records) {
    const key = `${record.userId}\u0000${record.weekOf}`;
    keys.set(key, (keys.get(key) ?? 0) + 1);
  }
  const duplicates = new Set(
    [...keys.entries()].filter(([, count]) => count > 1).map(([key]) => key),
  );

  return {
    records: records.filter((record) =>
      !duplicates.has(`${record.userId}\u0000${record.weekOf}`)
    ),
    exceptions: records.filter((record) =>
      duplicates.has(`${record.userId}\u0000${record.weekOf}`)
    ).map((record) => ({
      collection: "weekly_trackers",
      source_id: record.legacyMongoId,
      user_hash: record.userHash,
      reason_code: "duplicate_user_week",
      field: "weekof",
    })),
  };
}

export async function analyzeDocuments(
  feelingsValues: unknown[],
  weeklyValues: unknown[],
  reportKey: Uint8Array,
): Promise<MigrationAnalysis> {
  const feelingsParsed = await parseCollection(
    "feelings",
    feelingsValues,
    reportKey,
    parseFeeling,
  );
  const weeklyParsed = await parseCollection(
    "weekly_trackers",
    weeklyValues,
    reportKey,
    parseWeeklyTracker,
  );
  const feelingsUnique = rejectDuplicateIds(
    "feelings",
    feelingsParsed.records,
  );
  const weeklyIdsUnique = rejectDuplicateIds(
    "weekly_trackers",
    weeklyParsed.records,
  );
  const weeklyWeeksUnique = rejectDuplicateWeeks(weeklyIdsUnique.records);

  return {
    feelings: feelingsUnique.records.sort((left, right) =>
      left.legacyMongoId.localeCompare(right.legacyMongoId)
    ),
    weeklyTrackers: weeklyWeeksUnique.records.sort((left, right) =>
      left.legacyMongoId.localeCompare(right.legacyMongoId)
    ),
    exceptions: [
      ...feelingsParsed.exceptions,
      ...weeklyParsed.exceptions,
      ...feelingsUnique.exceptions,
      ...weeklyIdsUnique.exceptions,
      ...weeklyWeeksUnique.exceptions,
    ].sort((left, right) =>
      `${left.collection}:${left.source_id}:${left.reason_code}`.localeCompare(
        `${right.collection}:${right.source_id}:${right.reason_code}`,
      )
    ),
    transformations: feelingsUnique.records.filter((record) =>
      record.createdAtNormalization === "go_zero_time_to_object_id_time"
    ).map((record) => ({
      collection: "feelings",
      source_id: record.legacyMongoId,
      user_hash: record.userHash,
      transformation_code: "go_zero_time_to_object_id_time",
      field: "createdat",
    })),
    sourceCounts: {
      feelings: feelingsValues.length,
      weeklyTrackers: weeklyValues.length,
    },
  };
}
