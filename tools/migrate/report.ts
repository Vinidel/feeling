import { keyedHash } from "./hashing.ts";
import type {
  MigrationAnalysis,
  MigrationReport,
  SourceException,
} from "./types.ts";

export interface DatabaseMetrics {
  insertedFeelings: number;
  insertedWeeklyTrackers: number;
  matchedFeelings: number;
  matchedWeeklyTrackers: number;
  targetOnlyFeelings: number;
  targetOnlyWeeklyTrackers: number;
}

function feelingStructure(analysis: MigrationAnalysis): string {
  return JSON.stringify(analysis.feelings.map((record) => ({
    legacy_mongo_id: record.legacyMongoId,
    user_hash: record.userHash,
    status: record.status,
    created_at: record.createdAt,
    activity_bow: record.activityBow,
    activity_lift: record.activityLift,
    activity_run: record.activityRun,
    activity_cycle: record.activityCycle,
    activity_swim: record.activitySwim,
  })));
}

function weeklyStructure(analysis: MigrationAnalysis): string {
  return JSON.stringify(analysis.weeklyTrackers.map((record) => ({
    legacy_mongo_id: record.legacyMongoId,
    user_hash: record.userHash,
    week_of: record.weekOf,
    mood: record.mood,
    tracker_version: record.trackerVersion,
    check_cardio: record.checkCardio,
    check_strength: record.checkStrength,
    check_mobility: record.checkMobility,
    check_build: record.checkBuild,
    check_archery: record.checkArchery,
    check_hunt: record.checkHunt,
    updated_at: record.updatedAt,
  })));
}

export async function buildReport(
  analysis: MigrationAnalysis,
  reportKey: Uint8Array,
  mode: MigrationReport["mode"],
  database?: DatabaseMetrics,
): Promise<MigrationReport> {
  const userCounts = new Map<
    string,
    { feelings: number; weeklyTrackers: number }
  >();

  for (const feeling of analysis.feelings) {
    const counts = userCounts.get(feeling.userHash) ?? {
      feelings: 0,
      weeklyTrackers: 0,
    };
    counts.feelings += 1;
    userCounts.set(feeling.userHash, counts);
  }
  for (const weekly of analysis.weeklyTrackers) {
    const counts = userCounts.get(weekly.userHash) ?? {
      feelings: 0,
      weeklyTrackers: 0,
    };
    counts.weeklyTrackers += 1;
    userCounts.set(weekly.userHash, counts);
  }

  const byReason: Record<string, number> = {};
  for (const exception of analysis.exceptions) {
    byReason[exception.reason_code] = (byReason[exception.reason_code] ?? 0) +
      1;
  }

  const feelingsRejected =
    analysis.exceptions.filter((exception) =>
      exception.collection === "feelings"
    ).length;
  const weeklyRejected =
    analysis.exceptions.filter((exception) =>
      exception.collection === "weekly_trackers"
    ).length;
  const transformationsByCode: Record<string, number> = {};
  for (const transformation of analysis.transformations) {
    transformationsByCode[transformation.transformation_code] =
      (transformationsByCode[transformation.transformation_code] ?? 0) + 1;
  }

  return {
    format_version: 1,
    mode,
    collections: {
      feelings: {
        source: analysis.sourceCounts.feelings,
        accepted: analysis.feelings.length,
        rejected: feelingsRejected,
        structural_hash: await keyedHash(
          reportKey,
          `feelings:${feelingStructure(analysis)}`,
        ),
      },
      weekly_trackers: {
        source: analysis.sourceCounts.weeklyTrackers,
        accepted: analysis.weeklyTrackers.length,
        rejected: weeklyRejected,
        structural_hash: await keyedHash(
          reportKey,
          `weekly_trackers:${weeklyStructure(analysis)}`,
        ),
      },
    },
    users: [...userCounts.entries()].sort(([left], [right]) =>
      left.localeCompare(right)
    ).map(([userHash, counts]) => ({
      user_hash: userHash,
      feelings: counts.feelings,
      weekly_trackers: counts.weeklyTrackers,
    })),
    exceptions: {
      total: analysis.exceptions.length,
      by_reason: Object.fromEntries(
        Object.entries(byReason).sort(([left], [right]) =>
          left.localeCompare(right)
        ),
      ),
    },
    transformations: {
      total: analysis.transformations.length,
      by_code: Object.fromEntries(
        Object.entries(transformationsByCode).sort(([left], [right]) =>
          left.localeCompare(right)
        ),
      ),
    },
    ...(database
      ? {
        database: {
          inserted_feelings: database.insertedFeelings,
          inserted_weekly_trackers: database.insertedWeeklyTrackers,
          matched_feelings: database.matchedFeelings,
          matched_weekly_trackers: database.matchedWeeklyTrackers,
          target_only_feelings: database.targetOnlyFeelings,
          target_only_weekly_trackers: database.targetOnlyWeeklyTrackers,
        },
      }
      : {}),
  };
}

export function exceptionManifest(exceptions: SourceException[]): {
  format_version: 1;
  exceptions: SourceException[];
} {
  return { format_version: 1, exceptions };
}

export async function writeJson(
  file: Deno.FsFile,
  value: unknown,
): Promise<void> {
  const bytes = new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
  let written = 0;
  while (written < bytes.length) {
    written += await file.write(bytes.subarray(written));
  }
}
