import postgres from "postgres";
import type { MigrationAnalysis, SourceException } from "./types.ts";
import type { DatabaseMetrics } from "./report.ts";

export class ReconciliationError extends Error {
  constructor(readonly conflicts: SourceException[]) {
    super("target reconciliation conflict");
  }
}

interface TargetFeeling {
  legacy_mongo_id: string | null;
  user_id: string;
  status: number;
  created_at: Date;
  comment: string;
  activity_bow: boolean;
  activity_lift: boolean;
  activity_run: boolean;
  activity_cycle: boolean;
  activity_swim: boolean;
}

interface TargetWeekly {
  legacy_mongo_id: string | null;
  user_id: string;
  week_of: string | Date;
  mood: string;
  tracker_version: number;
  check_cardio: boolean;
  check_strength: boolean;
  check_mobility: boolean;
  check_build: boolean;
  check_archery: boolean;
  check_hunt: boolean;
  note_win: string;
  note_challenge: string;
  note_next_week: string;
  updated_at: Date;
}

function sourceFeeling(record: MigrationAnalysis["feelings"][number]): string {
  return JSON.stringify({
    legacy_mongo_id: record.legacyMongoId,
    user_id: record.userId,
    status: record.status,
    created_at: record.createdAt,
    comment: record.comment,
    activity_bow: record.activityBow,
    activity_lift: record.activityLift,
    activity_run: record.activityRun,
    activity_cycle: record.activityCycle,
    activity_swim: record.activitySwim,
  });
}

function targetFeeling(record: TargetFeeling): string {
  return JSON.stringify({
    legacy_mongo_id: record.legacy_mongo_id,
    user_id: record.user_id,
    status: record.status,
    created_at: new Date(record.created_at).toISOString(),
    comment: record.comment,
    activity_bow: record.activity_bow,
    activity_lift: record.activity_lift,
    activity_run: record.activity_run,
    activity_cycle: record.activity_cycle,
    activity_swim: record.activity_swim,
  });
}

function sourceWeekly(
  record: MigrationAnalysis["weeklyTrackers"][number],
): string {
  return JSON.stringify({
    legacy_mongo_id: record.legacyMongoId,
    user_id: record.userId,
    week_of: record.weekOf,
    mood: record.mood,
    tracker_version: record.trackerVersion,
    check_cardio: record.checkCardio,
    check_strength: record.checkStrength,
    check_mobility: record.checkMobility,
    check_build: record.checkBuild,
    check_archery: record.checkArchery,
    check_hunt: record.checkHunt,
    note_win: record.noteWin,
    note_challenge: record.noteChallenge,
    note_next_week: record.noteNextWeek,
    updated_at: record.updatedAt,
  });
}

function serializeTargetWeekly(record: TargetWeekly): string {
  const weekOf = record.week_of instanceof Date
    ? record.week_of.toISOString().slice(0, 10)
    : record.week_of.slice(0, 10);
  return JSON.stringify({
    legacy_mongo_id: record.legacy_mongo_id,
    user_id: record.user_id,
    week_of: weekOf,
    mood: record.mood,
    tracker_version: record.tracker_version,
    check_cardio: record.check_cardio,
    check_strength: record.check_strength,
    check_mobility: record.check_mobility,
    check_build: record.check_build,
    check_archery: record.check_archery,
    check_hunt: record.check_hunt,
    note_win: record.note_win,
    note_challenge: record.note_challenge,
    note_next_week: record.note_next_week,
    updated_at: new Date(record.updated_at).toISOString(),
  });
}

export async function importAndReconcile(
  databaseUrl: string,
  sslMode: "require" | "disable",
  analysis: MigrationAnalysis,
  action: "import" | "reconcile" = "import",
): Promise<DatabaseMetrics> {
  if (analysis.exceptions.length > 0) {
    throw new Error("source exceptions must be resolved before import");
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ssl: sslMode === "require" ? "require" : false,
  });

  try {
    return await sql.begin(async (transaction) => {
      await transaction.unsafe("set local role steady_runtime");
      await transaction.unsafe("set local statement_timeout = '30s'");

      const userIds = [
        ...new Set([
          ...analysis.feelings.map((record) => record.userId),
          ...analysis.weeklyTrackers.map((record) => record.userId),
        ]),
      ].sort();

      let insertedFeelings = 0;
      let insertedWeeklyTrackers = 0;
      let matchedFeelings = 0;
      let matchedWeeklyTrackers = 0;
      let targetOnlyFeelings = 0;
      let targetOnlyWeeklyTrackers = 0;
      const conflicts: SourceException[] = [];

      for (const userId of userIds) {
        await transaction`
          select set_config('app.auth0_sub', ${userId}, true)
        `;

        const feelings = analysis.feelings.filter((record) =>
          record.userId === userId
        );
        const weeklyTrackers = analysis.weeklyTrackers.filter((record) =>
          record.userId === userId
        );

        if (action === "import" && feelings.length > 0) {
          const inserted = await transaction`
            insert into steady.feelings ${
            transaction(
              feelings.map((record) => ({
                legacy_mongo_id: record.legacyMongoId,
                user_id: record.userId,
                status: record.status,
                created_at: record.createdAt,
                comment: record.comment,
                activity_bow: record.activityBow,
                activity_lift: record.activityLift,
                activity_run: record.activityRun,
                activity_cycle: record.activityCycle,
                activity_swim: record.activitySwim,
              })),
            )
          }
            on conflict (legacy_mongo_id) do nothing
            returning legacy_mongo_id
          `;
          insertedFeelings += inserted.length;
        }

        if (action === "import" && weeklyTrackers.length > 0) {
          const inserted = await transaction`
            insert into steady.weekly_trackers ${
            transaction(
              weeklyTrackers.map((record) => ({
                legacy_mongo_id: record.legacyMongoId,
                user_id: record.userId,
                week_of: record.weekOf,
                mood: record.mood,
                tracker_version: record.trackerVersion,
                check_cardio: record.checkCardio,
                check_strength: record.checkStrength,
                check_mobility: record.checkMobility,
                check_build: record.checkBuild,
                check_archery: record.checkArchery,
                check_hunt: record.checkHunt,
                note_win: record.noteWin,
                note_challenge: record.noteChallenge,
                note_next_week: record.noteNextWeek,
                updated_at: record.updatedAt,
              })),
            )
          }
            on conflict do nothing
            returning legacy_mongo_id
          `;
          insertedWeeklyTrackers += inserted.length;
        }

        const targetFeelings = await transaction`
          select
            legacy_mongo_id,
            user_id,
            status,
            created_at,
            comment,
            activity_bow,
            activity_lift,
            activity_run,
            activity_cycle,
            activity_swim
          from steady.feelings
          where user_id = ${userId}
          order by legacy_mongo_id nulls last, id
        ` as TargetFeeling[];
        const targetWeekly = await transaction`
          select
            legacy_mongo_id,
            user_id,
            week_of,
            mood,
            tracker_version,
            check_cardio,
            check_strength,
            check_mobility,
            check_build,
            check_archery,
            check_hunt,
            note_win,
            note_challenge,
            note_next_week,
            updated_at
          from steady.weekly_trackers
          where user_id = ${userId}
          order by legacy_mongo_id nulls last, id
        ` as TargetWeekly[];

        const targetFeelingByLegacyId = new Map(
          targetFeelings.filter((record) => record.legacy_mongo_id !== null)
            .map(
              (record) => [record.legacy_mongo_id as string, record],
            ),
        );
        const targetWeeklyByLegacyId = new Map(
          targetWeekly.filter((record) => record.legacy_mongo_id !== null).map(
            (record) => [record.legacy_mongo_id as string, record],
          ),
        );

        for (const record of feelings) {
          const target = targetFeelingByLegacyId.get(record.legacyMongoId);
          if (!target || targetFeeling(target) !== sourceFeeling(record)) {
            conflicts.push({
              collection: "feelings",
              source_id: record.legacyMongoId,
              user_hash: record.userHash,
              reason_code: "target_conflict",
            });
            continue;
          }
          matchedFeelings += 1;
        }
        for (const record of weeklyTrackers) {
          const target = targetWeeklyByLegacyId.get(record.legacyMongoId);
          if (
            !target || serializeTargetWeekly(target) !== sourceWeekly(record)
          ) {
            conflicts.push({
              collection: "weekly_trackers",
              source_id: record.legacyMongoId,
              user_hash: record.userHash,
              reason_code: "target_conflict",
            });
            continue;
          }
          matchedWeeklyTrackers += 1;
        }

        const sourceFeelingIds = new Set(
          feelings.map((record) => record.legacyMongoId),
        );
        const sourceWeeklyIds = new Set(
          weeklyTrackers.map((record) => record.legacyMongoId),
        );
        targetOnlyFeelings += targetFeelings.filter((record) =>
          record.legacy_mongo_id === null ||
          !sourceFeelingIds.has(record.legacy_mongo_id)
        ).length;
        targetOnlyWeeklyTrackers += targetWeekly.filter((record) =>
          record.legacy_mongo_id === null ||
          !sourceWeeklyIds.has(record.legacy_mongo_id)
        ).length;
      }

      if (conflicts.length > 0) {
        throw new ReconciliationError(conflicts);
      }

      return {
        insertedFeelings,
        insertedWeeklyTrackers,
        matchedFeelings,
        matchedWeeklyTrackers,
        targetOnlyFeelings,
        targetOnlyWeeklyTrackers,
      };
    });
  } finally {
    await sql.end();
  }
}
