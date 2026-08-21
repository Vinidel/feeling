import { type Document, MongoClient, ObjectId } from "mongodb";
import postgres from "postgres";

export type RollbackMode = "plan" | "execute";

export interface TargetFeeling {
  id: string;
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

export interface TargetWeekly {
  id: string;
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

export interface RollbackMetrics {
  target_only_feelings: number;
  feelings_inserted: number;
  feelings_already_present: number;
  weekly_inserted: number;
  weekly_updated: number;
  weekly_already_matched: number;
  target_rows_linked: number;
}

export class RollbackConflictError extends Error {
  constructor(readonly count: number) {
    super("rollback reconciliation conflict");
  }
}

export async function deterministicObjectId(
  namespace: "feeling" | "weekly",
  targetId: string,
  timestamp: Date,
): Promise<ObjectId> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${namespace}:${targetId}`),
    ),
  );
  const bytes = new Uint8Array(12);
  const seconds = Math.max(0, Math.floor(timestamp.getTime() / 1000));
  new DataView(bytes.buffer).setUint32(0, seconds >>> 0, false);
  bytes.set(digest.subarray(0, 8), 4);
  return new ObjectId(bytes);
}

function weekOf(value: string | Date): string {
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value.slice(0, 10);
}

export function feelingDocument(
  row: TargetFeeling,
  id: ObjectId,
): Document {
  return {
    _id: id,
    activities: {
      bow: row.activity_bow,
      lift: row.activity_lift,
      run: row.activity_run,
      cycle: row.activity_cycle,
      swim: row.activity_swim,
    },
    status: String(row.status),
    createdat: new Date(row.created_at),
    comment: row.comment,
    userid: row.user_id,
  };
}

export function weeklyDocument(
  row: TargetWeekly,
  id: ObjectId,
): Document {
  return {
    _id: id,
    weekof: weekOf(row.week_of),
    mood: row.mood,
    trackerVersion: row.tracker_version,
    checks: {
      cardio: row.check_cardio,
      strength: row.check_strength,
      mobility: row.check_mobility,
      build: row.check_build,
      archery: row.check_archery,
      hunt: row.check_hunt,
    },
    notes: {
      win: row.note_win,
      challenge: row.note_challenge,
      nextWeek: row.note_next_week,
    },
    userid: row.user_id,
    updatedat: new Date(row.updated_at),
  };
}

function canonicalFeeling(document: Document): string {
  const activities = document.activities as Document | undefined;
  return JSON.stringify({
    status: document.status,
    createdat: new Date(document.createdat as Date).toISOString(),
    comment: document.comment,
    userid: document.userid,
    activities: {
      bow: activities?.bow,
      lift: activities?.lift,
      run: activities?.run,
      cycle: activities?.cycle,
      swim: activities?.swim,
    },
  });
}

function canonicalWeekly(document: Document): string {
  const checks = document.checks as Document | undefined;
  const notes = document.notes as Document | undefined;
  return JSON.stringify({
    weekof: document.weekof,
    mood: document.mood,
    trackerVersion: document.trackerVersion,
    userid: document.userid,
    updatedat: new Date(document.updatedat as Date).toISOString(),
    checks: {
      cardio: checks?.cardio,
      strength: checks?.strength,
      mobility: checks?.mobility,
      build: checks?.build,
      archery: checks?.archery,
      hunt: checks?.hunt,
    },
    notes: {
      win: notes?.win,
      challenge: notes?.challenge,
      nextWeek: notes?.nextWeek,
    },
  });
}

function sameId(left: ObjectId, right: ObjectId): boolean {
  return left.toHexString() === right.toHexString();
}

async function linkTargetRow(
  transaction: postgres.TransactionSql,
  table: "feelings" | "weekly_trackers",
  targetId: string,
  mongoId: ObjectId,
): Promise<number> {
  const linked = table === "feelings"
    ? await transaction`
      update steady.feelings
      set legacy_mongo_id = ${mongoId.toHexString()}
      where id = ${targetId} and legacy_mongo_id is null
      returning id
    `
    : await transaction`
      update steady.weekly_trackers
      set legacy_mongo_id = ${mongoId.toHexString()}
      where id = ${targetId} and legacy_mongo_id is null
      returning id
    `;
  return linked.length;
}

export async function reconcileTargetToMongo(options: {
  databaseUrl: string;
  databaseSslMode: "require" | "disable";
  mongoUrl: string;
  mongoDatabase: string;
  mode: RollbackMode;
  userIds: readonly string[];
}): Promise<RollbackMetrics> {
  const sql = postgres(options.databaseUrl, {
    max: 1,
    prepare: false,
    ssl: options.databaseSslMode === "require" ? "require" : false,
  });
  const mongo = new MongoClient(options.mongoUrl, {
    connectTimeoutMS: 10_000,
    serverSelectionTimeoutMS: 10_000,
  });
  const metrics: RollbackMetrics = {
    target_only_feelings: 0,
    feelings_inserted: 0,
    feelings_already_present: 0,
    weekly_inserted: 0,
    weekly_updated: 0,
    weekly_already_matched: 0,
    target_rows_linked: 0,
  };
  let conflicts = 0;

  try {
    await mongo.connect();
    const database = mongo.db(options.mongoDatabase);
    const feelings = database.collection("feelings");
    const weekly = database.collection("weekly_trackers");

    for (const userId of [...new Set(options.userIds)].sort()) {
      await sql.begin(async (transaction) => {
        await transaction.unsafe("set local role steady_rollback");
        await transaction.unsafe("set local statement_timeout = '60s'");
        await transaction`
          select set_config('app.auth0_sub', ${userId}, true)
        `;

        const targetFeelings = await transaction`
          select id, legacy_mongo_id, user_id, status, created_at, comment,
            activity_bow, activity_lift, activity_run, activity_cycle,
            activity_swim
          from steady.feelings
          where user_id = ${userId} and legacy_mongo_id is null
          order by created_at, id
        ` as TargetFeeling[];
        const targetWeekly = await transaction`
          select id, legacy_mongo_id, user_id, week_of, mood,
            tracker_version, check_cardio, check_strength, check_mobility,
            check_build, check_archery, check_hunt, note_win, note_challenge,
            note_next_week, updated_at
          from steady.weekly_trackers
          where user_id = ${userId}
          order by week_of, id
        ` as TargetWeekly[];

        metrics.target_only_feelings += targetFeelings.length;
        for (const row of targetFeelings) {
          const mongoId = await deterministicObjectId(
            "feeling",
            row.id,
            new Date(row.created_at),
          );
          const desired = feelingDocument(row, mongoId);
          const existing = await feelings.findOne({ _id: mongoId });
          if (
            existing && canonicalFeeling(existing) !== canonicalFeeling(desired)
          ) {
            conflicts += 1;
            continue;
          }
          if (existing) {
            metrics.feelings_already_present += 1;
          } else {
            metrics.feelings_inserted += 1;
            if (options.mode === "execute") await feelings.insertOne(desired);
          }
          if (options.mode === "execute") {
            metrics.target_rows_linked += await linkTargetRow(
              transaction,
              "feelings",
              row.id,
              mongoId,
            );
          }
        }

        for (const row of targetWeekly) {
          const deterministicId = await deterministicObjectId(
            "weekly",
            row.id,
            new Date(row.updated_at),
          );
          const legacyId = row.legacy_mongo_id
            ? new ObjectId(row.legacy_mongo_id)
            : undefined;
          const existingByKey = await weekly.findOne({
            userid: row.user_id,
            weekof: weekOf(row.week_of),
          });
          const mongoId = legacyId ?? existingByKey?._id ?? deterministicId;
          if (!(mongoId instanceof ObjectId)) {
            conflicts += 1;
            continue;
          }
          const existingById = await weekly.findOne({ _id: mongoId });
          if (
            existingByKey && existingById &&
            !sameId(existingByKey._id as ObjectId, existingById._id as ObjectId)
          ) {
            conflicts += 1;
            continue;
          }
          if (
            existingByKey && legacyId &&
            !sameId(existingByKey._id as ObjectId, legacyId)
          ) {
            conflicts += 1;
            continue;
          }

          const existing = existingById ?? existingByKey;
          const desired = weeklyDocument(row, mongoId);
          if (!existing) metrics.weekly_inserted += 1;
          else if (canonicalWeekly(existing) === canonicalWeekly(desired)) {
            metrics.weekly_already_matched += 1;
          } else metrics.weekly_updated += 1;

          if (options.mode === "execute") {
            await weekly.replaceOne({ _id: mongoId }, desired, {
              upsert: true,
            });
            if (!row.legacy_mongo_id) {
              metrics.target_rows_linked += await linkTargetRow(
                transaction,
                "weekly_trackers",
                row.id,
                mongoId,
              );
            }
          }
        }
      });
    }

    if (conflicts > 0) throw new RollbackConflictError(conflicts);
    return metrics;
  } finally {
    await Promise.all([sql.end(), mongo.close()]);
  }
}
